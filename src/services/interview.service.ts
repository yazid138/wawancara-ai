import prisma from "@/database/prisma";
import NotFoundException from "@/exception/NotFoundException";
import { QuestionType, Status } from "@/prisma/client";
import { generateInterviewResume, generateIntroMessage, rephraseQuestion } from "@/services/ai.service";
import logger from "@/utils/logger";

type StartInterviewInput = {
  userId: number;
  companyId: number;
  positionId: number;
  categoryIds?: number[];
};

const SOFTSKILL_PER_CATEGORY = 3;

const DISTRIBUTION: Record<QuestionType, number> = {
  INTRO: 1,
  GENERAL: 1,
  SOFTSKILL: Infinity, // dikontrol per-kategori, bukan total
  TECHNICAL: 3,
};

const FLOW: QuestionType[] = [
  QuestionType.INTRO,
  QuestionType.GENERAL,
  QuestionType.SOFTSKILL,
  QuestionType.TECHNICAL,
];

const startInterview = (data: StartInterviewInput) => {
  const { categoryIds, ...rest } = data;
  return prisma.interview.create({
    data: {
      ...rest,
      status: Status.ONGOING,
      ...(categoryIds && categoryIds.length > 0
        ? {
            focusQuestions: {
              create: categoryIds.map((id) => ({
                categoryId: id,
              })),
            },
          }
        : {}),
    },
  });
};

const getInterviewByUserCompanyPosition = (
  userId: number,
  companyId: number,
  positionId: number,
) => {
  return prisma.interview.findFirst({
    where: {
      userId,
      companyId,
      positionId,
    },
  });
};

const getInterviewById = (id: number) => {
  return prisma.interview.findUnique({
    where: { id },
  });
};

const finishInterview = (id: number) => {
  return prisma.interview.update({
    where: { id },
    data: { status: Status.FINISH },
  });
};

const createAnswer = (data: {
  content: string;
  questionId: number;
  interviewId: number;
  userId: number;
}) => {
  return prisma.answer.create({
    data,
    include: {
      question: {
        include: {
          category: true,
        },
      },
    },
  });
};

const getQuestionById = (id: number) => {
  return prisma.question.findUnique({ where: { id } });
};

const hasAnsweredQuestion = async (interviewId: number, questionId: number) => {
  const existing = await prisma.answer.findFirst({
    where: { interviewId, questionId },
  });
  return Boolean(existing);
};

export const SKIPPED_CONTENT = "[SKIPPED]";

const skipQuestion = async (data: {
  interviewId: number;
  questionId: number;
  userId: number;
}) => {
  const { interviewId, questionId, userId } = data;

  // Cek apakah sudah pernah dijawab / dilewati
  const existing = await prisma.answer.findFirst({
    where: { interviewId, questionId },
  });
  if (existing) return existing;

  // Simpan Answer dummy agar soal tidak muncul lagi di getNextQuestion
  const skippedAnswer = await prisma.answer.create({
    data: {
      content: SKIPPED_CONTENT,
      questionId,
      interviewId,
      userId,
    },
  });

  // Simpan ChatHistory USER dengan marker SKIPPED (tidak akan ditampilkan di FE)
  await prisma.chatHistory.create({
    data: {
      interviewId,
      role: "USER",
      content: SKIPPED_CONTENT,
      questionId,
    },
  });

  return skippedAnswer;
};

const generationLocks = new Map<number, Promise<any>>();

const getNextQuestion = async (interviewId: number) => {
  if (generationLocks.has(interviewId)) {
    return generationLocks.get(interviewId);
  }

  const promise = _getNextQuestion(interviewId);
  generationLocks.set(interviewId, promise);
  try {
    return await promise;
  } finally {
    generationLocks.delete(interviewId);
  }
};

const _getNextQuestion = async (interviewId: number) => {
  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
    include: {
      user: true,
      company: true,
      position: true,
      focusQuestions: true,
      chatHistories: {
        orderBy: {
          createdAt: "asc",
        },
      },
      answers: {
        include: { question: true },
      },
    },
  });

  if (!interview) return null;
  const answers = interview.answers || [];

  const chatHistories = interview.chatHistories || [];
  if (chatHistories.length > 0) {
    const lastChat = chatHistories[chatHistories.length - 1];
    if (lastChat.role === "AI") {
      // User hasn't answered the last question yet, so just re-return it
      if (lastChat.questionId === null) {
        return {
          id: -1,
          content: lastChat.content,
          type: QuestionType.INTRO,
        };
      } else {
        const q = await prisma.question.findUnique({
          where: { id: lastChat.questionId },
        });
        if (q) {
          return {
            ...q,
            content: lastChat.content,
          };
        }
      }
    }
  }

  const introAsked = interview.chatHistories.some((ch) => ch.role === "AI" && ch.questionId === null);

  const countByType: Record<QuestionType, number> = {
    INTRO: introAsked ? 1 : 0,
    GENERAL: 0,
    SOFTSKILL: 0,
    TECHNICAL: 0,
  };

  // Hitung jumlah jawaban per kategori softskill
  const softskillCountByCategory = new Map<number, number>();

  for (const ans of answers) {
    countByType[ans.question.type]++;
    if (ans.question.type === QuestionType.SOFTSKILL && ans.question.categoryId) {
      const prev = softskillCountByCategory.get(ans.question.categoryId) ?? 0;
      softskillCountByCategory.set(ans.question.categoryId, prev + 1);
    }
  }

  // Gunakan Set untuk tracking yang lebih efisien dan pasti tidak ada duplikat
  const usedQuestionIds = new Set(answers.map((a) => a.questionId));

  for (const type of FLOW) {
    const remaining = DISTRIBUTION[type] - countByType[type];

    if (remaining > 0 || type === QuestionType.SOFTSKILL) {
      if (type === QuestionType.INTRO) {
        const { output: aiMessage, prompt } = await generateIntroMessage(
          interview.user.name,
          interview.company.name,
          interview.position.name,
        );

        await prisma.chatHistory.create({
          data: {
            interviewId,
            role: "AI",
            content: aiMessage,
            prompt,
          },
        });

        return {
          id: -1,
          content: aiMessage,
          type: QuestionType.INTRO,
        };
      }

      const selectedCategoryIds = (interview.focusQuestions as any[])?.map((fq: any) => fq.categoryId) || [];
      const candidates = await prisma.question.findMany({
        where: {
          type,
          // Jangan tampilkan follow-up question sebagai soal utama
          isFollowUp: false,
          id: { notIn: Array.from(usedQuestionIds) },
          ...(selectedCategoryIds.length > 0 &&
          (type === QuestionType.SOFTSKILL || type === QuestionType.TECHNICAL)
            ? { categoryId: { in: selectedCategoryIds } }
            : {}),
        },
      });

      // Filter tambahan untuk memastikan benar-benar tidak ada duplikat (Meski query where sudah menyaring, dipastikan ulang)
      let validCandidates = candidates;

      // Untuk softskill: batasi maksimal SOFTSKILL_PER_CATEGORY pertanyaan per kategori
      if (type === QuestionType.SOFTSKILL && validCandidates.length > 0) {
        // Filter kandidat yang kategorinya belum mencapai batas
        validCandidates = validCandidates.filter((q) => {
          const count = softskillCountByCategory.get(q.categoryId ?? -1) ?? 0;
          return count < SOFTSKILL_PER_CATEGORY;
        });

        if (validCandidates.length === 0) {
          // Semua kategori sudah mencapai batas, lanjut ke tipe berikutnya
          continue;
        }

        // Prioritaskan kategori yang belum pernah ditanyakan sama sekali
        const unusedCategoryCandidates = validCandidates.filter(
          (q) => !softskillCountByCategory.has(q.categoryId ?? -1),
        );
        if (unusedCategoryCandidates.length > 0) {
          validCandidates = unusedCategoryCandidates;
        }
      }

      if (validCandidates.length > 0) {
        validCandidates.sort((a, b) => a.id - b.id);
        const seed = interviewId + usedQuestionIds.size * 1000;
        const pseudoRandom = (s: number) => {
          let x = Math.sin(s) * 10000;
          return x - Math.floor(x);
        };
        const randomIndex = Math.floor(
          pseudoRandom(seed) * validCandidates.length,
        );
        const selected = validCandidates[randomIndex];

        // Validasi akhir sebelum return
        if (!usedQuestionIds.has(selected.id)) {
          let chatHistory = interview.chatHistories.find(
            (ch) => ch.questionId === selected.id && ch.role === "AI",
          );

          if (!chatHistory) {
            const { rephrase, prompt } = await rephraseQuestion(selected.content);

            chatHistory = await prisma.chatHistory.create({
              data: {
                interviewId,
                role: "AI",
                prompt,
                content: rephrase,
                questionId: selected.id,
              },
            });
          }

          return {
            ...selected,
            content: chatHistory.content,
          };
        }
      }
    }
  }

  return null;
};

const getResult = (id: number) => {
  return prisma.interview.findUnique({
    where: { id },
    include: {
      answers: {
        include: {
          score: true,
          question: true,
        },
      },
    },
  });
};

const getInterviewHistory = async (id: number) => {
  const interview = await prisma.interview.findUnique({
    where: { id },
    include: {
      answers: {
        include: {
          question: {
            include: {
              category: true,
            },
          },
          score: {
            select: {
              id: true,
              finalScore: true,
              feedback: true,
              reason: true,
            }
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      },
      company: true,
      position: true,
      focusQuestions: true,
      chatHistories: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  if (!interview) return null;

  const answers = interview.answers || [];
  const chatHistories = [...(interview.chatHistories || [])] as any[];

  // For backwards compatibility: add missing user chats from answers
  answers.forEach((ans: any) => {
    const hasChat = chatHistories.some(
      (ch) => ch.role === "USER" && ch.questionId === ans.questionId
    );
    if (!hasChat) {
      chatHistories.push({
        id: `legacy-chat-${ans.id}`,
        interviewId: interview.id,
        role: "USER",
        content: ans.content,
        questionId: ans.questionId,
        createdAt: ans.createdAt,
        updatedAt: ans.createdAt,
      });
    }
  });

  chatHistories.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const mappedChatHistories = chatHistories.map((ch: any) => {
    if (ch.role === "USER") {
      let matchingAns = null;
      if (typeof ch.id === "string" && ch.id.startsWith("legacy-chat-")) {
        matchingAns = answers.find((a: any) => `legacy-chat-${a.id}` === ch.id);
      } else if (ch.questionId) {
        matchingAns = answers.find((a: any) => a.questionId === ch.questionId);
      }

      if (matchingAns) {
        ch.answer = matchingAns;
      }
    }
    return ch;
  });

  return {
    ...interview,
    chatHistories: mappedChatHistories,
  };
};

const getUserInterviews = (userId: number) => {
  return prisma.interview.findMany({
    where: { userId },
    include: {
      company: true,
      position: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
};

const processResume = async (interviewId: number) => {
  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
  });
  if (!interview) throw new NotFoundException("Interview not found");
  if (interview.resume) return; // Resume sudah ada, tidak perlu generate ulang
  
  const history = await getInterviewHistory(interviewId);
  if (!history || !history.answers) return;

  const qnaList: Array<{ question: string; answer: string; category?: string }> = [];

  // Buat map questionId → category name untuk lookup cepat
  const categoryByQuestionId = new Map<number, string | undefined>();
  for (const ans of history.answers) {
    categoryByQuestionId.set(ans.questionId, (ans.question as any).category?.name);
  }

  let currentQuestion = "";
  let currentQuestionId: number | null = null;
  for (const chat of history.chatHistories) {
    if (chat.role === "AI") {
      currentQuestion = chat.content;
      currentQuestionId = chat.questionId ?? null;
    } else if (chat.role === "USER") {
      qnaList.push({
        question: currentQuestion || "Pertanyaan tidak diketahui",
        answer: chat.content,
        category: currentQuestionId ? categoryByQuestionId.get(currentQuestionId) : undefined,
      });
      currentQuestion = "";
      currentQuestionId = null;
    }
  }

  try {
    const { resume, prompt } = await generateInterviewResume(qnaList);
    await prisma.interview.update({
      where: { id: interviewId },
      data: { resume, resumePrompt: prompt },
    });
  } catch (error) {
    logger.error("[Auto-Resume Error] Failed to generate resume:", error);
  }
};

const createUserChat = (interviewId: number, content: string, questionId?: number) => {
  return prisma.chatHistory.create({
    data: {
      interviewId,
      role: "USER",
      content,
      ...(questionId ? { questionId } : {}),
    },
  });
};

const updateFinalResume = (id: number, finalResume: string) => {
  return prisma.interview.update({
    where: { id },
    data: { finalResume },
  });
};

export default {
  startInterview,
  getInterviewById,
  getInterviewByUserCompanyPosition,
  finishInterview,
  createAnswer,
  getQuestionById,
  hasAnsweredQuestion,
  skipQuestion,
  getNextQuestion,
  getResult,
  getInterviewHistory,
  getUserInterviews,
  processResume,
  createUserChat,
  updateFinalResume,
};

