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

    await tx.score.deleteMany({
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

  // Check if this exact ideal answer content already exists for this question
  const existing = await prisma.idealAnswer.findFirst({
    where: {
      questionId,
      content: {
        equals: idealAnswer,
        mode: "insensitive",
      },
    },
  });

  if (existing) {
    return existing;
  }

  const embedding = await createEmbedding(idealAnswer);
  const idealAnswerResult = await prisma.$queryRaw`
  INSERT INTO "IdealAnswer" ("questionId", "content", "embedding") 
  VALUES (${questionId}, ${idealAnswer}, ${`[${embedding.join(",")}]`}::vector)
  RETURNING id, "questionId", content, "createdAt", "updatedAt"
  ` as any[];

  const createdRecord = idealAnswerResult[0];
  const id = createdRecord.id;

  // Upsert vectors to Pinecone and Qdrant
  await Promise.all([
    pineconeService.upsertVector(
      embedding,
      {
        questionId,
        answer: idealAnswer,
        type: "ideal_answer",
      },
      `ideal_${id}`,
    ),
    qdrantService.upsertVector(
      embedding,
      {
        questionId,
        answer: idealAnswer,
        type: "ideal_answer",
      },
      id,
    ),
  ]);

  return createdRecord;
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
    const maxSim: { id: number; distance: number }[] = await prisma.$queryRaw`SELECT
    id,
    embedding <=> ${`[${userEmbedding.join(",")}]`}::vector AS distance
  FROM "IdealAnswer" 
  WHERE "questionId" = ${questionId} AND "embedding" IS NOT NULL
  ORDER BY distance
  LIMIT 1`;

    if (!maxSim || maxSim.length === 0) {
      return 0;
    }

    const { id, distance } = maxSim[0];
    if (!id) {
      return 0;
    }

    // <=> represents Cosine Distance (1 - Cosine Similarity)
    // We want to return Cosine Similarity
    const similarity = 1 - Number(distance);
    return Math.max(0, Math.min(similarity, 1));
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
