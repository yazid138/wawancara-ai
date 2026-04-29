import prisma from "@/database/prisma";
import { QuestionType } from "@/prisma/browser";

type StartInterviewInput = {
  userId: number;
  companyId: number;
  positionId: number;
};

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

const updateInterview = (id: number, data: any) => {
  return prisma.interview.update({
    where: { id },
    data,
  });
};

const FLOW = [
  QuestionType.INTRO,
  QuestionType.GENERAL,
  QuestionType.SOFTSKILL,
  QuestionType.TECHNICAL,
];

const getQuestionsOrdered = async () => {
  const questions = await prisma.question.findMany();

  return questions.sort((a, b) => {
    const stageA = FLOW.indexOf(a.type);
    const stageB = FLOW.indexOf(b.type);

    if (stageA !== stageB) {
      return stageA - stageB;
    }

    return a.id - b.id;
  });
};

const incrementIndex = (id: number, nextIndex: number) => {
  return prisma.interview.update({
    where: { id },
    data: { currentIndex: nextIndex },
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
  updateInterview,
  getQuestionsOrdered,
  incrementIndex,
  finishInterview,
  createAnswer,
  getResult,
};