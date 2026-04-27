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
  keywords?: string[];
  type?: QuestionType;
  difficulty?: string;
  idealAnswer?: string;
}) => {
  const { content, keywords, type, difficulty, idealAnswer } = questionData;
  const keywordList = keywords ?? [];
  let embedding: number[] | undefined;
  if (idealAnswer) embedding = await createEmbedding(idealAnswer);

  const question = await prisma.question.create({
    data: {
      content,
      type,
      difficulty,
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
    title?: string;
    content?: string;
    keywords?: string[];
    type?: QuestionType;
    difficulty?: string;
    idealAnswer?: string;
  },
) => {
  const { title, content, keywords, type, difficulty, idealAnswer } =
    questionData;
  let embedding: number[] | undefined;
  if (idealAnswer) embedding = await createEmbedding(idealAnswer);

  const question = await prisma.question.update({
    where: { id },
    data: {
      title,
      content,
      type,
      difficulty,
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

    await tx.scoreAnswer.deleteMany({
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

    return tx.question.delete({
      where: { id },
    });

    await Promise.all([deleteQdrant("" + id), deletePinecone("" + id)]);
  });
};

export default {
  getAllQuestions,
  getQuestionById,
  createQuestion,
  updateQuestion,
  deleteQuestion,
};
