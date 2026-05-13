import prisma from "@/database/prisma";
import { QuestionType } from "@/prisma/client";
import pineconeService from "@/services/pinecone.service";
import qdrantService from "@/services/qdrant.service";
import { createEmbedding } from "@/services/ai.service";
import NotFoundException from "@/exception/NotFoundException";

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
        },
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
  const { content, keywords, type, difficulty, category } = questionData;

  let categoryResult: {
    id: number;
  } | null = null;
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

export const addIdealAnswer = async (
  questionId: number,
  idealAnswer: string,
) => {
  // Verify question exists
  const question = await prisma.question.findUnique({
    where: { id: questionId },
  });

  if (!question) {
    throw new NotFoundException(`Question with id ${questionId} not found`);
  }

  // Delete existing ideal answer if any
  await prisma.idealAnswer.deleteMany({
    where: { questionId },
  });

  const embedding = await createEmbedding(idealAnswer);
  const idealAnswerResult = await prisma.idealAnswer.create({
    data: {
      question: {
        connect: {
          id: questionId,
        },
      },
      content: idealAnswer,
      embedding,
    },
  });

  // Upsert vectors to Pinecone and Qdrant
  await Promise.all([
    pineconeService.upsertVector(
      embedding,
      {
        questionId,
        answer: idealAnswer,
        type: "ideal_answer",
      },
      `ideal_${idealAnswerResult.id}`,
    ),
    qdrantService.upsertVector(
      embedding,
      {
        questionId,
        answer: idealAnswer,
        type: "ideal_answer",
      },
      idealAnswerResult.id,
    ),
  ]);

  return idealAnswerResult;
};

export const removeIdealAnswer = async (
  questionId: number,
  idealAnswerId: number,
) => {
  const idealAnswer = await prisma.idealAnswer.findFirst({
    where: { questionId, id: idealAnswerId },
  });

  if (!idealAnswer) {
    throw new NotFoundException(
      `No ideal answer found for question ${questionId}`,
    );
  }

  // Delete vectors from Pinecone and Qdrant
  await Promise.all([
    pineconeService.deleteVector(`ideal_${idealAnswer.id}`),
    qdrantService.deleteVector(idealAnswer.id),
  ]);

  // Delete from database
  const deletedIdealAnswer = await prisma.idealAnswer.delete({
    where: { id: idealAnswer.id },
  });

  return deletedIdealAnswer;
};

export const searchVector = async (
  userEmbedding: number[],
  questionId: number,
) => {
  const idealAnswers = await prisma.idealAnswer.findMany({
    where: { questionId },
  });

  if (idealAnswers.length > 0) {
    let maxSim = 0;
    for (const ia of idealAnswers) {
      const iaEmb = ia.embedding as number[];
      if (Array.isArray(iaEmb) && iaEmb.length === userEmbedding.length) {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < userEmbedding.length; i++) {
          dotProduct += userEmbedding[i] * iaEmb[i];
          normA += userEmbedding[i] * userEmbedding[i];
          normB += iaEmb[i] * iaEmb[i];
        }
        if (normA > 0 && normB > 0) {
          const sim = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
          if (sim > maxSim) maxSim = sim;
        }
      }
    }
    return Math.max(0, Math.min(maxSim, 1));
  }
  return 0;
};

export default {
  getAllQuestions,
  getQuestionById,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  addIdealAnswer,
  removeIdealAnswer,
  searchVector,
};
