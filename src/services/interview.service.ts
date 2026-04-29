import prisma from "@/database/prisma";

const createInterview = (data: {
  userId: number;
  companyId: number;
  positionId: number;
}) => {
  return prisma.interview.create({
    data: {
      ...data,
      status: "ONGOING",
    },
  });
};

const getInterviewById = (id: number) => {
  return prisma.interview.findUnique({
    where: { id },
  });
};

const getQuestionsByPosition = (positionId: number) => {
  return prisma.question.findMany({
    where: { positionId },
    orderBy: { id: "asc" },
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
          score: true,
          question: true,
        },
      },
    },
  });
};

export default {
  createInterview,
  getInterviewById,
  getQuestionsByPosition,
  incrementIndex,
  finishInterview,
  createAnswer,
  getResult,
};