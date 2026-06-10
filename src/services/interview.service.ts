import prisma from "@/database/prisma";
import { QuestionType, Status } from "@/prisma/client";
import { generateInterviewResume, generateIntroMessage, rephraseQuestion } from "@/services/ai.service";
import BadRequestException from "@/exception/BadRequestException";

type StartInterviewInput = {
  userId: number;
  companyId: number;
  positionId: number;
  questionCategories: string[];
};

const SOFTSKILL_PER_CATEGORY = 3;

// const DISTRIBUTION: Record<QuestionType, number> = {
//   INTRO: 1,
//   GENERAL: 1,
//   SOFTSKILL: Infinity, // dikontrol per-kategori, bukan total
//   TECHNICAL: 3,
// };

const FLOW: QuestionType[] = [
  QuestionType.INTRO,
  QuestionType.GENERAL,
  QuestionType.SOFTSKILL,
  QuestionType.TECHNICAL,
];

const startInterview = async (data: StartInterviewInput) => {
  const uniqueCategories = [...new Set(data.questionCategories.map((category) => category.trim()).filter(Boolean))];

  const categories = await prisma.questionCategory.findMany({
    where: {
      name: {
        in: uniqueCategories,
      },
    },
  });

  if (categories.length !== uniqueCategories.length) {
    const foundNames = new Set(categories.map((category) => category.name));
    const missingCategories = uniqueCategories.filter((category) => !foundNames.has(category));

    throw new BadRequestException(
      `Kategori pertanyaan tidak ditemukan: ${missingCategories.join(", ")}`,
    );
  }

  const categoriesByName = new Map(categories.map((category) => [category.name, category]));
  const orderedCategories = uniqueCategories.map((categoryName) => {
    const category = categoriesByName.get(categoryName);
    if (!category) {
      throw new BadRequestException(`Kategori pertanyaan tidak ditemukan: ${categoryName}`);
    }

    return category;
  });

  return prisma.$transaction(async (tx) => {
    const interview = await tx.interview.create({
      data: {
        userId: data.userId,
        companyId: data.companyId,
        positionId: data.positionId,
        status: Status.ONGOING,
      },
    });

    await tx.focusQuestion.createMany({
      data: orderedCategories.map((category) => ({
        userId: data.userId,
        interviewId: interview.id,
        categoryId: category.id,
      })),
    });

    return interview;
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

const getFocusCategoryIdsByInterviewId = async (
  interviewId: number,
) => {
  const focusQuestions =
    await prisma.focusQuestion.findMany({
      where: {
        interviewId,
      },
      select: {
        categoryId: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

  return focusQuestions.map(
    (item) => item.categoryId,
  );
};

const finishInterview = (id: number) => {
  return prisma.interview.update({
    where: { id },
    data: { status: Status.FINISH },
  });
};

const updateFinalResume = (id: number, finalResume: string) => {
  return prisma.interview.update({
    where: { id },
    data: { finalResume },
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
  const focusCategoryIds = await getFocusCategoryIdsByInterviewId(interviewId);

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

  const questionCountByCategory = new Map<number, number>();

  for (const answer of answers) {
    const categoryId = answer.question.categoryId;

    const current =
      questionCountByCategory.get(categoryId) ?? 0;

    questionCountByCategory.set(
      categoryId,
      current + 1,
    );
  }

  // Intro
if (!introAsked) {
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

for (const type of FLOW) {
  if (type === QuestionType.INTRO) {
    continue;
  }

  for (const categoryId of focusCategoryIds) {
    const answeredCount =
      answers.filter(
        (a) =>
          a.question.categoryId === categoryId,
      ).length;

    // maksimal 3 soal per category
    if (answeredCount >= 3) {
      continue;
    }

    const question =
      await prisma.question.findFirst({
        where: {
          type,
          categoryId,
          id: {
            notIn: Array.from(
              usedQuestionIds,
            ),
          },
        },
        orderBy: {
          id: "asc",
        },
      });

    // tidak ada question dengan type ini
    // lanjut category berikutnya
    if (!question) {
      continue;
    }

    let chatHistory =
      interview.chatHistories.find(
        (ch) =>
          ch.role === "AI" &&
          ch.questionId === question.id,
      );

    if (!chatHistory) {
      const { rephrase, prompt } =
        await rephraseQuestion(
          question.content,
        );

      chatHistory =
        await prisma.chatHistory.create({
          data: {
            interviewId,
            role: "AI",
            prompt,
            content: rephrase,
            questionId: question.id,
          },
        });
    }

    return {
      ...question,
      content: chatHistory.content,
    };
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
              type: true,
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
      _count: {
        select: { answers: true },
      },
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
  updateFinalResume,
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
};

