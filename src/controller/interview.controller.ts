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

// START
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

// CURRENT QUESTION 
export const getCurrent = async (req: Request, res: Response) => {
  const id = +req.params.id;

  const interview = await interviewService.getInterviewById(id);
  if (!interview) {
    return sendResponse(res, { status: 404, message: "Interview tidak ditemukan" });
  }

  if (interview.status === "FINISH") {
    return sendResponse(res, {
      status: 200,
      message: "Interview sudah selesai",
      data: null,
    });
  }

  const question = await interviewService.getNextQuestion(id);

  if (!question) {
    await interviewService.finishInterview(id);

    return sendResponse(res, {
      status: 200,
      message: "Interview selesai",
      data: null,
    });
  }

  return sendResponse(res, {
    status: 200,
    message: "Pertanyaan saat ini",
    data: question,
  });
};

// SUBMIT ANSWER 
export const submitAnswer = async (req: Request, res: Response) => {
  const interviewId = +req.params.id;

  const { answer } = validate<{ answer: string }>(
    { answer: "string" },
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

  const currentQuestion = await interviewService.getNextQuestion(interviewId);

  if (!currentQuestion) {
    await interviewService.finishInterview(interviewId);

    return sendResponse(res, {
      status: 200,
      message: "Interview selesai",
      data: null,
    });
  }

  const savedAnswer = await interviewService.createAnswer({
    content: answer,
    questionId: currentQuestion.id,
    interviewId,
    userId,
  });

  let score = null;

  try {
    if (currentQuestion.type === "TECHNICAL") {
      score = await scoringService.scoreTechnicalAnswer(savedAnswer.id);
    }

    if (currentQuestion.type === "SOFTSKILL") {
      score = await scoringService.scoreSoftSkillAnswer(savedAnswer.id);
    }
  } catch (err) {
    console.error("Scoring error:", err);
  }

  const nextQuestion = await interviewService.getNextQuestion(interviewId);

  if (!nextQuestion) {
    await interviewService.finishInterview(interviewId);

    return sendResponse(res, {
      status: 200,
      message: "Interview selesai",
      data: { answer: savedAnswer, score },
    });
  }

  return sendResponse(res, {
    status: 200,
    message: "Jawaban berhasil",
    data: {
      answer: savedAnswer,
      score,
      nextQuestion,
    },
  });
};

// NEXT QUESTION
export const getNext = async (req: Request, res: Response) => {
  const id = +req.params.id;

  const nextQuestion = await interviewService.getNextQuestion(id);

  if (!nextQuestion) {
    await interviewService.finishInterview(id);

    return sendResponse(res, {
      status: 200,
      message: "Interview selesai",
      data: null,
    });
  }

  return sendResponse(res, {
    status: 200,
    message: "Next question",
    data: nextQuestion,
  });
};

// FINISH
export const finishInterview = async (req: Request, res: Response) => {
  const id = +req.params.id;

  const interview = await interviewService.getInterviewById(id);
  if (!interview) {
    return sendResponse(res, {
      status: 404,
      message: "Interview tidak ditemukan",
    });
  }

  await interviewService.finishInterview(id);

  sendResponse(res, {
    status: 200,
    message: "Interview selesai",
  });
};

// RESULT
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
  getCurrent,
  submitAnswer,
  getNext,
  finishInterview,
  getResult,
};