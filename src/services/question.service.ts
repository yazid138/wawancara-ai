import prisma from "@/database/prisma";
import { QuestionType } from "@/prisma/client";

export const getAllQuestions = async () => {
  const questions = await prisma.question.findMany({
    include: {
      keywords: true,
      idealAnswer: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
  return questions;
};

export const getQuestionById = async (id: number) => {
  const question = await prisma.question.findUnique({
    where: { id },
    include: {
      keywords: true,
      idealAnswer: true,
    },
  });
  return question;
};

export const createQuestion = async (questionData: {
  content: string;
  category: string;
  keywords?: string[];
  type?: QuestionType;
  difficulty?: string;
}) => {
  const { content, keywords, type, difficulty, category } = questionData;
  const keywordList = keywords ?? [];

  let categoryResult = await prisma.questionCategory.findFirst({
    where: {
      name: category.toLowerCase(),
    },
  });

  if (!categoryResult) {
    categoryResult = await prisma.questionCategory.create({
      data: {
        name: category.toLowerCase(),
      },
    });
  }

  const question = await prisma.question.create({
    data: {
      content,
      type,
      difficulty,
      category: {
        connect: {
          id: categoryResult.id,
        }
      },
      keywords: {
        createMany: {
          data: keywordList.map((word) => ({ word })),
        },
      },
    },
  });

  return question;
};

export const updateQuestion = async (
  id: number,
  questionData: {
    content?: string;
    keywords?: string[];
    type?: QuestionType;
    difficulty?: string;
    category?: string;
  },
) => {
  const { content, keywords, type, difficulty, category } =
    questionData;
  let embedding: number[] | undefined;

  let categoryResult:
    | {
        id: number;
      }
    | null = null;
  if (category) {
    categoryResult = await prisma.questionCategory.findFirst({
      where: {
        name: category.toLowerCase(),
      },
    });

    if (!categoryResult) {
      categoryResult = await prisma.questionCategory.create({
        data: {
          name: category.toLowerCase(),
        },
      });
    }
  }

  const question = await prisma.question.update({
    where: { id },
    data: {
      content,
      type,
      difficulty,
      category: categoryResult
        ? {
            connect: {
              id: categoryResult.id,
            },
          }
        : undefined,
      keywords: keywords
        ? {
            deleteMany: {},
            createMany: {
              data: keywords.map((word) => ({ word })),
            },
          }
        : undefined,
    },
  });

  return question;
};

export const deleteQuestion = async (id: number) => {
  return await prisma.$transaction(async (tx) => {
    const answers = await tx.answer.findMany({
      where: { questionId: id },
      select: { id: true },
    });

    const answerIds = answers.map((answer) => answer.id);

    await tx.scoreTechnical.deleteMany({
      where: {
        answerId: {
          in: answerIds,
        },
      },
    });

    await tx.scoreSoftSkill.deleteMany({
      where: {
        answerId: {
          in: answerIds,
        },
      },
    });

    await tx.answer.deleteMany({
      where: { questionId: id },
    });

    await tx.keyword.deleteMany({
      where: { questionId: id },
    });

    const question = await tx.question.delete({
      where: { id },
    });

    return question;
  });
};

export default {
  getAllQuestions,
  getQuestionById,
  createQuestion,
  updateQuestion,
  deleteQuestion,
};
