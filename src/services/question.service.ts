import prisma from "@/database/prisma";
import { QuestionType } from "@/prisma/client";
import { createEmbedding } from "@/services/ai.service";
import {
  upsertVector as upsertQdrant,
  deleteVector as deleteQdrant,
} from "@/services/qdrant.service";
import {
  upsertVector as upsertPinecone,
  deleteVector as deletePinecone,
} from "@/services/pinecone.service";

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
  idealAnswer?: string;
}) => {
  const { content, keywords, type, difficulty, idealAnswer, category } = questionData;
  const keywordList = keywords ?? [];
  let embedding: number[] | undefined;
  if (idealAnswer) embedding = await createEmbedding(idealAnswer);

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
      idealAnswer: idealAnswer
        ? {
            create: {
              content: idealAnswer,
              embedding: embedding!,
            },
          }
        : undefined,
      keywords: {
        createMany: {
          data: keywordList.map((word) => ({ word })),
        },
      },
    },
  });

  if (idealAnswer && embedding) {
    await Promise.all([
      upsertQdrant(
        embedding,
        {
          questionId: question.id,
          content: idealAnswer,
        },
        "" + question.id,
      ),
      upsertPinecone(
        embedding,
        {
          questionId: question.id,
          content: idealAnswer,
        },
        "" + question.id,
      ),
    ]);
  }

  return question;
};

export const updateQuestion = async (
  id: number,
  questionData: {
    content?: string;
    keywords?: string[];
    type?: QuestionType;
    difficulty?: string;
    idealAnswer?: string;
    category?: string;
  },
) => {
  const { content, keywords, type, difficulty, idealAnswer, category } =
    questionData;
  let embedding: number[] | undefined;
  if (idealAnswer) embedding = await createEmbedding(idealAnswer);

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
      idealAnswer: idealAnswer
        ? {
            upsert: {
              create: {
                content: idealAnswer,
                embedding: embedding!,
              },
              update: {
                content: idealAnswer,
                embedding: embedding!,
              },
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

  if (idealAnswer && embedding) {
    await Promise.all([
      upsertQdrant(
        embedding,
        {
          questionId: question.id,
          content: idealAnswer,
        },
        "" + question.id,
      ),
      upsertPinecone(
        embedding,
        {
          questionId: question.id,
          content: idealAnswer,
        },
        "" + question.id,
      ),
    ]);
  }

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

    await tx.idealAnswer.deleteMany({
      where: { questionId: id },
    });

    const question = await tx.question.delete({
      where: { id },
    });

    await Promise.all([deleteQdrant("" + id), deletePinecone("" + id)]);

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
