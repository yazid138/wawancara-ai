import { Request, Response } from "express";
import sendResponse from "@/utils/responseHandler";
import validate from "@/utils/validation";
import interviewService from "@/services/interview.service";
import NotFoundException from "@/exception/NotFoundException";
import scoringService from "@/services/scoring.service";

type StartInterviewRequest = {
  companyId: number;
  positionId: number;
};

export const startInterview = async (req: Request, res: Response) => {
  const { companyId, positionId } = validate<StartInterviewRequest>(
    {
      companyId: "number",
      positionId: "number",
    },
    req.body
  );

  const userId = req.user!.id;

  const interview = await interviewService.startInterview({
    userId,
    companyId,
    positionId,
  });

  sendResponse(res, {
    status: 201,
    message: "Interview berhasil dibuat",
    data: interview,
  });
};

export const getQuestions = async (req: Request, res: Response) => {
  const id = +req.params.id;

  const interview = await interviewService.getInterviewById(id);
  if (!interview) {
    throw new NotFoundException("Interview tidak ditemukan");
  }

  const questions = await interviewService.getQuestionsOrdered();

  if (!questions.length) {
    return sendResponse(res, {
      status: 200,
      message: "Belum ada pertanyaan",
      data: [],
    });
  }

  sendResponse(res, {
    status: 200,
    message: "Berhasil mendapatkan pertanyaan",
    data: questions,
  });
};

export const getCurrent = async (req: Request, res: Response) => {
  const id = +req.params.id;

  const interview = await interviewService.getInterviewById(id);
  if (!interview) {
    return sendResponse(res, { status: 404, message: "Interview tidak ditemukan" });
  }

  const questions = await interviewService.getQuestionsOrdered();

  const current = questions[interview.currentIndex];

  if (!questions.length) {
    return sendResponse(res, {
      status: 200,
      message: "Belum ada pertanyaan",
      data: [],
    });
  }

  sendResponse(res, {
    status: 200,
    message: "Pertanyaan saat ini",
    data: current || null,
  });
};

type SubmitAnswerRequest = {
  interviewId: number;
  answer: string;
};

export const submitAnswer = async (req: Request, res: Response) => {
  const interviewId = +req.params.id;
  const { answer } = validate<{ answer: string }>(
    {
      answer: "string",
    },
    req.body
  );

  const userId = req.user!.id;

  const interview = await interviewService.getInterviewById(interviewId);
  if (!interview) {
    return sendResponse(res, { status: 404, message: "Interview tidak ditemukan" });
  }

  if (interview.status === "FINISH") {
    return sendResponse(res, {
      status: 400,
      message: "Interview sudah selesai",
    });
  }

  const questions = await interviewService.getQuestionsOrdered();

  if (!questions.length) {
    return sendResponse(res, {
      status: 200,
      message: "Belum ada pertanyaan",
      data: [],
    });
  }

  const currentQuestion = questions[interview.currentIndex];

  if (!currentQuestion) {
    return sendResponse(res, {
      status: 400,
      message: "Tidak ada pertanyaan",
    });
  }

  const savedAnswer = await interviewService.createAnswer({
    content: answer,
    questionId: currentQuestion.id,
    interviewId,
    userId,
  });

  const category = currentQuestion.type;

  if (["SOFTSKILL", "TECHNICAL"].includes(category)) {
    const score = await scoringService.scoreAnswer(savedAnswer.id);

    return sendResponse(res, {
      status: 200,
      message: "Jawaban & scoring berhasil",
      data: { answer: savedAnswer, score },
    });
  }

  // selain itu → no scoring
  return sendResponse(res, {
    status: 200,
    message: "Jawaban berhasil (tanpa scoring)",
    data: { answer: savedAnswer },
  });
};

export const getNext = async (req: Request, res: Response) => {
  const id = +req.params.id;

  const interview = await interviewService.getInterviewById(id);
  if (!interview) {
    return sendResponse(res, { status: 404, message: "Interview tidak ditemukan" });
  }

  const questions = await interviewService.getQuestionsOrdered();
  const nextIndex = interview.currentIndex + 1;

  if (nextIndex >= questions.length) {
    await interviewService.finishInterview(id);

    return sendResponse(res, {
      status: 200,
      message: "Interview selesai",
      data: null,
    });
  }

  await interviewService.updateInterview(id, {
    currentIndex: nextIndex,
  });

  return sendResponse(res, {
    status: 200,
    message: "Next question",
    data: questions[nextIndex],
  });
};

export const finishInterview = async (req: Request, res: Response) => {
  const id = +req.params.id;

  const interview = await interviewService.getInterviewById(id);
  if (!interview) {
    return sendResponse(res, { status: 404, message: "Interview tidak ditemukan" });
  }

  await interviewService.finishInterview(id);

  sendResponse(res, {
    status: 200,
    message: "Interview selesai",
  });
};

export const getResult = async (req: Request, res: Response) => {
  const id = +req.params.id;

  const result = await interviewService.getResult(id);

  if (!result) {
    return sendResponse(res, {
      status: 404,
      message: "Interview tidak ditemukan",
    });
  }

  sendResponse(res, {
    status: 200,
    message: "Hasil interview",
    data: result,
  });
};

export default {
  startInterview,
  getQuestions,
  getCurrent,
  submitAnswer,
  getNext,
  finishInterview,
  getResult,
};