import { Request, Response } from "express";
import sendResponse from "@/utils/responseHandler";
import validate from "@/utils/validation";
import interviewService from "@/services/interview.service";
import NotFoundException from "@/exception/NotFoundException";
import BadRequestException from "@/exception/BadRequestException";
import scoringService from "@/services/scoring.service";
import fs from "fs";

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

  const existingInterview = await interviewService.getInterviewByUserCompanyPosition(userId, companyId, positionId);
  if (existingInterview) {
    throw new BadRequestException("Anda sudah melakukan interview untuk posisi ini");
  }

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

  const { answer, questionId } = validate<{ answer: string; questionId?: number }>(
    { answer: "string", questionId: {type: 'number', optional: true} },
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

  // Prefer the questionId provided by client to avoid race between client/server
  let currentQuestion = null as any;
  if (questionId) {
    currentQuestion = await interviewService.getQuestionById(questionId);
    if (!currentQuestion) {
      return sendResponse(res, { status: 404, message: "Pertanyaan tidak ditemukan" });
    }

    // ensure this interview hasn't answered this question yet
    const already = await interviewService.hasAnsweredQuestion(interviewId, questionId);
    if (already) {
      return sendResponse(res, { status: 400, message: "Pertanyaan sudah dijawab" });
    }
  } else {
    currentQuestion = await interviewService.getNextQuestion(interviewId);
    if (!currentQuestion) {
      await interviewService.finishInterview(interviewId);

      return sendResponse(res, {
        status: 200,
        message: "Interview selesai",
        data: null,
      });
    }
  }

  const savedAnswer = await interviewService.createAnswer({
    content: answer,
    questionId: currentQuestion.id,
    interviewId,
    userId,
  });

  try {
    if (currentQuestion.type === "TECHNICAL") {
      scoringService.scoreTechnicalAnswer(savedAnswer.id)
        .then(() => fs.appendFileSync('scoring.log', `SUCCESS: inteviewId:${interviewId}, questionId:${currentQuestion.id}, type:TECHNICAL, answerId:${savedAnswer.id}\n`))
        .catch((err) => {
          fs.appendFileSync('scoring.log', `ERROR: inteviewId:${interviewId}, questionId:${currentQuestion.id}, type:TECHNICAL, answerId:${savedAnswer.id}, message:${err.message}\n${err.stack}\n`);
          console.error("Background scoring error (TECHNICAL):", err);
        });
    }

    if (currentQuestion.type === "SOFTSKILL") {
      scoringService.scoreSoftSkillAnswer(savedAnswer.id)
        .then(() => fs.appendFileSync('scoring.log', `SUCCESS: inteviewId:${interviewId}, questionId:${currentQuestion.id}, type:SOFTSKILL, answerId:${savedAnswer.id}\n`))
        .catch((err) => {
          fs.appendFileSync('scoring.log', `ERROR: inteviewId:${interviewId}, questionId:${currentQuestion.id}, type:SOFTSKILL, answerId:${savedAnswer.id}, message:${err.message}\n${err.stack}\n`);
          console.error("Background scoring error (SOFTSKILL):", err);
        });
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
      data: { answer: savedAnswer, questionId: currentQuestion.id },
    });
  }

  return sendResponse(res, {
    status: 200,
    message: "Jawaban berhasil",
    data: {
      answer: savedAnswer,
      questionId: currentQuestion.id,
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

// HISTORY
export const getInterviewHistory = async (req: Request, res: Response) => {
  const id = +req.params.id;
  
  const history = await interviewService.getInterviewHistory(id);

  if (!history) {
    throw new NotFoundException("Interview tidak ditemukan");
  }

  sendResponse(res, {
    status: 200,
    message: "Riwayat interview",
    data: history,
  });
};

// USER INTERVIEWS
export const getUserInterviews = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const interviews = await interviewService.getUserInterviews(userId);

  sendResponse(res, {
    status: 200,
    message: "Daftar interview berhasil diambil",
    data: interviews,
  });
};

export default {
  startInterview,
  getCurrent,
  submitAnswer,
  getNext,
  finishInterview,
  getResult,
  getInterviewHistory,
  getUserInterviews,
};