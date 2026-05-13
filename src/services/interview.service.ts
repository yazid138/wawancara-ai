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

const getInterviewByUserCompanyPosition = (userId: number, companyId: number, positionId: number) => {
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

const getQuestionById = (id: number) => {
  return prisma.question.findUnique({ where: { id } });
};

const hasAnsweredQuestion = async (interviewId: number, questionId: number) => {
  const existing = await prisma.answer.findFirst({ where: { interviewId, questionId } });
  return Boolean(existing);
};

const TOTAL_QUESTIONS = 10;

const getNextQuestion = async (interviewId: number) => {
  const answers = await prisma.answer.findMany({
    where: { interviewId },
    include: { question: true },
  });

  // HARD LIMIT
  if (answers.length >= TOTAL_QUESTIONS) {
    return null;
  }

  const countByType: Record<QuestionType, number> = {
    INTRO: 0,
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
      const candidates = await prisma.question.findMany({
        where: {
          type,
          id: { notIn: Array.from(usedQuestionIds) },
        },
      });

      // Filter tambahan untuk memastikan benar-benar tidak ada duplikat
      const validCandidates = candidates.filter((q) => !usedQuestionIds.has(q.id));

      if (validCandidates.length > 0) {
        const selected = validCandidates[Math.floor(Math.random() * validCandidates.length)];
        
        // Validasi akhir sebelum return
        if (!usedQuestionIds.has(selected.id)) {
          return selected;
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
          technicalScore: true,
          softSkillScore: true,
          question: true,
        }
      },
    },
  });
};

const getInterviewHistory = (id: number) => {
  return prisma.interview.findUnique({
    where: { id },
    include: {
      answers: {
        include: {
          question: true,
          technicalScore: true,
          softSkillScore: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
      company: true,
      position: true,
    },
  });
};

const getUserInterviews = (userId: number) => {
  return prisma.interview.findMany({
    where: { userId },
    include: {
      company: true,
      position: true,
    },
    orderBy: {
      updatedAt: 'desc',
    },
  });
};

const processResume = async (interviewId: number) => {
  const history = await getInterviewHistory(interviewId);
  if (!history || !history.answers) return;

  const qnaList = history.answers.map(ans => ({
    question: ans.question.content,
    answer: ans.content
  }));

  const { generateInterviewResume } = await import("./ai.service");
  try {
    const resume = await generateInterviewResume(qnaList);
    await prisma.interview.update({
      where: { id: interviewId },
      data: { resume }
    });
  } catch (error) {
    console.error("Failed to generate resume:", error);
  }
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
};