import prisma from "@/database/prisma";
import { QuestionType } from "@/prisma/client";

type StartInterviewInput = {
  userId: number;
  companyId: number;
  positionId: number;
};

const DISTRIBUTION: Record<QuestionType, number> = {
  INTRO: 1,
  GENERAL: 1,
  SOFTSKILL: 4,
  TECHNICAL: 4,
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
      status: "ONGOING",
      currentIndex: 0,
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
    data: { status: "FINISH" },
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

const getNextQuestion = async (interviewId: number) => {
  const answers = await prisma.answer.findMany({
    where: { interviewId },
    include: { question: true },
  });

  const countByType: Record<QuestionType, number> = {
    INTRO: 0,
    GENERAL: 0,
    SOFTSKILL: 0,
    TECHNICAL: 0,
  };

  for (const ans of answers) {
    countByType[ans.question.type]++;
  }

  const usedQuestionIds = answers.map((a) => a.questionId);

  for (const type of FLOW) {
    const remaining = DISTRIBUTION[type] - countByType[type];

    if (remaining > 0) {
      const candidates = await prisma.question.findMany({
        where: {
          type,
          id: { notIn: usedQuestionIds },
        },
      });

      if (candidates.length > 0) {
        return candidates[Math.floor(Math.random() * candidates.length)];
      }

    }
  }

  const fallback = await prisma.question.findMany({
    where: {
      id: { notIn: usedQuestionIds },
    },
  });

  if (fallback.length > 0) {
    return fallback[Math.floor(Math.random() * fallback.length)];
  }

  return null;
};

const getResult = (id: number) => {
  return prisma.interview.findUnique({
    where: { id },
    include: {
      answers: {
        include: {
          technicalScore: true,
          softSkillScore: true,
          question: true,
        }
      },
    },
  });
};

export default {
  startInterview,
  getInterviewById,
  finishInterview,
  createAnswer,
  getNextQuestion,
  getResult,
};