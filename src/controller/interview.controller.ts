import { Request, Response } from "express";
import sendResponse from "@/utils/responseHandler";
import validate from "@/utils/validation";
import interviewService from "@/services/interview.service";
import NotFoundException from "@/exception/NotFoundException";
import scoringService from "@/services/scoring.service";
import fs from "fs";
import ForbiddenException from "@/exception/ForbiddenException";
import { Status, QuestionType } from "@/prisma/enums";

type StartInterviewRequest = {
  companyId: number;
  positionId: number;
  categoryIds?: number[];
};

// START
export const startInterview = async (req: Request, res: Response) => {
  const { companyId, positionId, categoryIds } = validate<StartInterviewRequest>(
    {
      companyId: "number",
      positionId: "number",
      categoryIds: {
        type: "array",
        items: "number",
        optional: true,
      },
    },
    req.body,
  );

  const userId = req.user!.id;

  const existingInterview =
    await interviewService.getInterviewByUserCompanyPosition(
      userId,
      companyId,
      positionId,
    );
  if (existingInterview) {
    throw new ForbiddenException(
      "Anda sudah melakukan interview untuk posisi ini",
    );
  }

  const interview = await interviewService.startInterview({
    userId,
    companyId,
    positionId,
    categoryIds,
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
    throw new NotFoundException("Interview tidak ditemukan");
  }

  if (interview.status === Status.FINISH) {
    throw new ForbiddenException("Interview sudah selesai");
  }

  const question = await interviewService.getNextQuestion(id);

  if (!question) {
    await interviewService.finishInterview(id);
    interviewService.processResume(id).catch(console.error);

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

type SubmitAnswerRequest = {
  answer: string;
  questionId?: number;
};

// SUBMIT ANSWER
export const submitAnswer = async (req: Request, res: Response) => {
  const interviewId = +req.params.id;

  const { answer, questionId } = validate<SubmitAnswerRequest>(
    { 
      answer: "string", 
      questionId: { 
        type: "number", 
        optional: true 
      } 
    },
    req.body,
  );

  const userId = req.user!.id;

  const interview = await interviewService.getInterviewById(interviewId);
  if (!interview) {
    throw new NotFoundException("Interview tidak ditemukan");
  }

  if (interview.status === Status.FINISH) {
    throw new ForbiddenException("Interview sudah selesai");
  }

  // Prefer the questionId provided by client to avoid race between client/server
  let currentQuestion = null as any;
  if (questionId && questionId !== -1) {
    currentQuestion = await interviewService.getQuestionById(questionId);
    if (!currentQuestion) {
      throw new NotFoundException("Pertanyaan tidak ditemukan");
    }

    // ensure this interview hasn't answered this question yet
    const already = await interviewService.hasAnsweredQuestion(
      interviewId,
      questionId,
    );
    if (already) {
      throw new ForbiddenException("Pertanyaan sudah dijawab");
    }
  } else if (questionId === -1) {
    currentQuestion = { id: -1, type: "INTRO" };
  } else {
    currentQuestion = await interviewService.getNextQuestion(interviewId);
    if (!currentQuestion) {
      await interviewService.finishInterview(interviewId);
      interviewService.processResume(interviewId).catch(console.error);

      return sendResponse(res, {
        status: 200,
        message: "Interview selesai",
        data: null,
      });
    }
  }

  if (currentQuestion.id === -1) {
    await interviewService.createUserChat(interviewId, answer);
    return sendResponse(res, {
      status: 201,
      message: "Jawaban berhasil disimpan",
      data: null,
    });
  }

  const savedAnswer = await interviewService.createAnswer({
    content: answer,
    questionId: currentQuestion.id,
    interviewId,
    userId,
  });

  await interviewService.createUserChat(interviewId, answer, currentQuestion.id);

  try {
    if (currentQuestion.type === QuestionType.TECHNICAL) {
      scoringService
        .scoreTechnicalAnswer(savedAnswer.id)
        .catch((err) => {
          fs.appendFileSync(
            "scoring.log",
            `ERROR: inteviewId:${interviewId}, questionId:${currentQuestion.id}, type:TECHNICAL, answerId:${savedAnswer.id}, message:${err.message}\n${err.stack}\n`,
          );
          console.error("Background scoring error (TECHNICAL):", err);
        });
    }

    if (currentQuestion.type === QuestionType.SOFTSKILL) {
      scoringService
        .scoreSoftSkillAnswer(savedAnswer.id)
        .catch((err) => {
          fs.appendFileSync(
            "scoring.log",
            `ERROR: inteviewId:${interviewId}, questionId:${currentQuestion.id}, type:SOFTSKILL, answerId:${savedAnswer.id}, message:${err.message}\n${err.stack}\n`,
          );
          console.error("Background scoring error (SOFTSKILL):", err);
        });
    }
  } catch (err) {
    console.error("Scoring error:", err);
  }

  const nextQuestion = await interviewService.getNextQuestion(interviewId);

  if (!nextQuestion) {
    await interviewService.finishInterview(interviewId);
    interviewService.processResume(interviewId).catch(console.error);

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
    interviewService.processResume(id).catch(console.error);

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
    throw new NotFoundException("Interview tidak ditemukan")
  }

  // Jika interview sudah FINISH dan resume sudah ada, tidak perlu proses ulang
  const alreadyFinished = interview.status === Status.FINISH;
  await interviewService.finishInterview(id);

  if (!alreadyFinished || !interview.resume) {
    interviewService.processResume(id).catch(console.error);
  }

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
    throw new NotFoundException("Interview tidak ditemukan");
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

// UPDATE FINAL RESUME
export const updateFinalResume = async (req: Request, res: Response) => {
  const id = +req.params.id;
  const { finalResume } = validate<{ finalResume: string }>(
    {
      finalResume: "string",
    },
    req.body,
  );

  const interview = await interviewService.getInterviewById(id);
  if (!interview) {
    throw new NotFoundException("Interview tidak ditemukan");
  }

  const updatedInterview = await interviewService.updateFinalResume(id, finalResume);

  sendResponse(res, {
    status: 200,
    message: "Final resume berhasil disimpan",
    data: updatedInterview,
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
  updateFinalResume,
};
