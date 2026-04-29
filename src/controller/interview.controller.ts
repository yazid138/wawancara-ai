import { Request, Response } from "express";
import sendResponse from "@/utils/responseHandler";
import validate from "@/utils/validation";
import interviewService from "@/services/interview.service";

type CreateInterviewRequest = {
  companyId: number;
  positionId: number;
};

export const createInterview = async (req: Request, res: Response) => {
  const { companyId, positionId } = validate<CreateInterviewRequest>(
    {
      companyId: "number",
      positionId: "number",
    },
    req.body
  );

  const userId = req.user!.id;

  const interview = await interviewService.createInterview({
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
    return sendResponse(res, { status: 404, message: "Interview tidak ditemukan" });
  }

  const questions = await interviewService.getQuestionsByPosition(
    interview.positionId
  );

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

  const questions = await interviewService.getQuestionsByPosition(
    interview.positionId
  );

  const current = questions[interview.currentIndex];

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
  const { interviewId, answer } = validate<SubmitAnswerRequest>(
    {
      interviewId: "number",
      answer: "string",
    },
    req.body
  );

  const userId = req.user!.id;

  const interview = await interviewService.getInterviewById(interviewId);
  if (!interview) {
    return sendResponse(res, { status: 404, message: "Interview tidak ditemukan" });
  }

  const questions = await interviewService.getQuestionsByPosition(
    interview.positionId
  );

  const currentQuestion = questions[interview.currentIndex];

  if (!currentQuestion) {
    return sendResponse(res, {
      status: 400,
      message: "Tidak ada pertanyaan",
    });
  }

  await interviewService.createAnswer({
    content: answer,
    questionId: currentQuestion.id,
    interviewId,
    userId,
  });

  sendResponse(res, {
    status: 200,
    message: "Jawaban berhasil disimpan",
  });
};

export const getNext = async (req: Request, res: Response) => {
  const id = +req.params.id;

  const interview = await interviewService.getInterviewById(id);
  if (!interview) {
    return sendResponse(res, { status: 404, message: "Interview tidak ditemukan" });
  }

  const questions = await interviewService.getQuestionsByPosition(
    interview.positionId
  );

  const nextIndex = interview.currentIndex + 1;

  if (nextIndex >= questions.length) {
    return sendResponse(res, {
      status: 200,
      message: "Interview selesai",
      data: null,
    });
  }

  await interviewService.incrementIndex(id, nextIndex);

  sendResponse(res, {
    status: 200,
    message: "Pertanyaan berikutnya",
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
  createInterview,
  getQuestions,
  getCurrent,
  submitAnswer,
  getNext,
  finishInterview,
  getResult,
};