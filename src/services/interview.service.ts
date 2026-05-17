import prisma from "@/database/prisma";
import { QuestionType, Status } from "@/prisma/client";

type StartInterviewInput = {
  userId: number;
  companyId: number;
  positionId: number;
};

const DISTRIBUTION: Record<QuestionType, number> = {
  INTRO: 1,
  GENERAL: 1,
  SOFTSKILL: 6,
  TECHNICAL: 2,
};

const FLOW: QuestionType[] = [
  QuestionType.INTRO,
  QuestionType.GENERAL,
  QuestionType.SOFTSKILL,
  QuestionType.TECHNICAL,
];

const startInterview = (data: StartInterviewInput) => {
  return prisma.interview.create({
    data: {
      ...data,
      status: Status.ONGOING,
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
  return prisma.answer.create({ data });
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

  for (const ans of answers) {
    countByType[ans.question.type]++;
  }

  // Gunakan Set untuk tracking yang lebih efisien dan pasti tidak ada duplikat
  const usedQuestionIds = new Set(answers.map((a) => a.questionId));

  for (const type of FLOW) {
    const remaining = DISTRIBUTION[type] - countByType[type];

    if (remaining > 0) {
      if (type === QuestionType.INTRO) {
        const { generateIntroMessage } = await import("./ai.service");
        const aiMessage = await generateIntroMessage(
          interview.user.name,
          interview.company.name,
          interview.position.name,
        );

        await prisma.chatHistory.create({
          data: {
            interviewId,
            role: "AI",
            content: aiMessage,
          },
        });

        return {
          id: -1,
          content: aiMessage,
          type: QuestionType.INTRO,
        };
      }

      const candidates = await prisma.question.findMany({
        where: {
          type,
          id: { notIn: Array.from(usedQuestionIds) },
        },
      });

      // Filter tambahan untuk memastikan benar-benar tidak ada duplikat (Meski query where sudah menyaring, dipastikan ulang)
      let validCandidates = candidates;

      // Prioritaskan kategori softskill yang belum ditanyakan
      if (type === QuestionType.SOFTSKILL && validCandidates.length > 0) {
        const usedCategoryIds = new Set(
          answers
            .filter((a) => a.question.type === QuestionType.SOFTSKILL)
            .map((a) => a.question.categoryId),
        );
        const candidatesWithNewCategory = validCandidates.filter(
          (q) => !usedCategoryIds.has(q.categoryId),
        );
        if (candidatesWithNewCategory.length > 0) {
          validCandidates = candidatesWithNewCategory;
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
            const { rephraseQuestion } = await import("./ai.service");
            const rephrasedContent = await rephraseQuestion(selected.content);

            chatHistory = await prisma.chatHistory.create({
              data: {
                interviewId,
                role: "AI",
                content: rephrasedContent,
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
          score: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
      company: true,
      position: true,
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
  const history = await getInterviewHistory(interviewId);
  if (!history || !history.answers) return;

  const qnaList: Array<{ question: string; answer: string }> = [];

  let currentQuestion = "";
  for (const chat of history.chatHistories) {
    if (chat.role === "AI") {
      currentQuestion = chat.content;
    } else if (chat.role === "USER") {
      qnaList.push({
        question: currentQuestion || "Pertanyaan tidak diketahui",
        answer: chat.content,
      });
      currentQuestion = ""; // Reset for the next pair
    }
  }

  const { generateInterviewResume } = await import("./ai.service");
  try {
    const { resume, prompt } = await generateInterviewResume(qnaList);
    await prisma.interview.update({
      where: { id: interviewId },
      data: { resume, resumePrompt: prompt },
    });
  } catch (error) {
    console.error("Failed to generate resume:", error);
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

export default {
  startInterview,
  getInterviewById,
  getInterviewByUserCompanyPosition,
  finishInterview,
  createAnswer,
  getQuestionById,
  hasAnsweredQuestion,
  getNextQuestion,
  getResult,
  getInterviewHistory,
  getUserInterviews,
  processResume,
  createUserChat,
};
