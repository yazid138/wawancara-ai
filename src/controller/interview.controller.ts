import { Request, Response } from "express";
import sendResponse from "@/utils/responseHandler";
import validate from "@/utils/validation";
import interviewService from "@/services/interview.service";
import jobOpeningService from "@/services/jobOpening.service";
import NotFoundException from "@/exception/NotFoundException";
import scoringService from "@/services/scoring.service";
import followUpService from "@/services/followUp.service";
import ForbiddenException from "@/exception/ForbiddenException";
import { Status, QuestionType } from "@/prisma/enums";
import logger from "@/utils/logger";

type StartInterviewRequest = {
  companyId?: number;
  positionId?: number;
  jobOpeningId?: number;
  categoryIds?: number[];
};

type CreateInterviewRequest = {
  userId: number;
  companyId: number;
  positionId: number;
  categoryIds?: number[];
};

// START
export const startInterview = async (req: Request, res: Response) => {
  const user = req.user as any;
  if (user.role === "ADMIN" || user.role === "COMPANY") {
    throw new ForbiddenException("Admin/HR tidak dapat melakukan wawancara");
  }

  const userId = user.id;
  const { jobOpeningId } = req.body;

  if (jobOpeningId) {
    const jobOpening = await jobOpeningService.getJobOpeningById(+jobOpeningId);
    if (!jobOpening.isActive) {
      throw new ForbiddenException("Lamaran sudah tidak aktif");
    }

    const existingInterview =
      await interviewService.getInterviewByUserCompanyPosition(
        userId,
        jobOpening.companyId,
        jobOpening.positionId,
      );
    if (existingInterview) {
      throw new ForbiddenException(
        "Anda sudah melakukan interview untuk posisi ini",
      );
    }

    const categoryIds = jobOpening.categories.map((c) => c.categoryId);

    const interview = await interviewService.startInterview({
      userId,
      companyId: jobOpening.companyId,
      positionId: jobOpening.positionId,
      jobOpeningId: jobOpening.id,
      categoryIds,
    });

    return sendResponse(res, {
      status: 201,
      message: "Interview berhasil dibuat",
      data: interview,
    });
  }

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

  const existingInterview =
    await interviewService.getInterviewByUserCompanyPosition(
      userId,
      companyId!,
      positionId!,
    );
  if (existingInterview) {
    throw new ForbiddenException(
      "Anda sudah melakukan interview untuk posisi ini",
    );
  }

  const interview = await interviewService.startInterview({
    userId,
    companyId: companyId!,
    positionId: positionId!,
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
  const user = req.user as any;
  if (user.role === "ADMIN" || user.role === "COMPANY") {
    throw new ForbiddenException("Admin/HR tidak dapat melakukan wawancara");
  }

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
    interviewService.processResume(id).catch((error) => logger.error("[Auto-Resume Error] Failed to generate resume:", error));

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
      interviewService.processResume(interviewId).catch((error) => logger.error("[Auto-Resume Error] Failed to generate resume:", error));

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

  // Handle follow-up question answer
  if (currentQuestion.isFollowUp) {
    const result = await followUpService.submitFollowUpAnswer(
      currentQuestion.id,
      answer,
      interviewId,
      userId,
    );

    const nextQuestion = await interviewService.getNextQuestion(interviewId);

    if (!nextQuestion) {
      await interviewService.finishInterview(interviewId);
      interviewService.processResume(interviewId).catch((error) => logger.error("[Auto-Resume Error] Failed to generate resume:", error));

      return sendResponse(res, {
        status: 200,
        message: "Interview selesai",
        data: {
          answer: result.answer,
          questionId: currentQuestion.id,
        },
      });
    }

    return sendResponse(res, {
      status: 200,
      message: "Jawaban follow-up berhasil",
      data: {
        answer: result.answer,
        questionId: currentQuestion.id,
        nextQuestion,
      },
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
          logger.error("[Auto-Scoring Error] Failed to score technical answer:", err);
        });
    }

    if (currentQuestion.type === QuestionType.SOFTSKILL) {
      scoringService
        .scoreSoftSkillAnswer(savedAnswer.id)
        .catch((err) => {
          logger.error("[Auto-Scoring Error] Failed to score softskill answer:", err);
        });
    }
  } catch (err) {
    logger.error("[Auto-Scoring Error] Failed to score answer:", err);
  }

  // ── Auto-trigger follow-up (background, non-blocking) ───────────────────
  // Jalan setelah scoring selesai. Delay 3 detik agar Score record sudah
  // tersimpan sebelum follow-up service memeriksanya.
  if (
    currentQuestion.type === QuestionType.TECHNICAL ||
    currentQuestion.type === QuestionType.SOFTSKILL
  ) {
    (async () => {
      await new Promise<void>((r) => setTimeout(r, 3000));
      await followUpService.generateFollowUp(interviewId, savedAnswer.id);
    })().catch((err) =>
      logger.error("[Auto-FollowUp Error] Failed to generate follow-up:", err),
    );
  }

  const nextQuestion = await interviewService.getNextQuestion(interviewId);

  if (!nextQuestion) {
    await interviewService.finishInterview(interviewId);
    interviewService.processResume(interviewId).catch((error) => logger.error("[Auto-Resume Error] Failed to generate resume:", error));

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
    interviewService.processResume(id).catch((error) => logger.error("[Auto-Resume Error] Failed to generate resume:", error));

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
    interviewService.processResume(id).catch((error) => logger.error("[Auto-Resume Error] Failed to generate resume:", error));
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

// ALL INTERVIEWS (ADMIN ONLY)
export const getAllInterviews = async (req: Request, res: Response) => {
  const interviews = await interviewService.getAllInterviews();

  sendResponse(res, {
    status: 200,
    message: "Daftar semua interview berhasil diambil",
    data: interviews,
  });
};

// SET FOCUS CATEGORIES (ADMIN ONLY)
export const setFocusCategories = async (req: Request, res: Response) => {
  const id = +req.params.id;
  const { categoryIds } = validate<{ categoryIds: number[] }>(
    {
      categoryIds: {
        type: "array",
        items: "number",
      },
    },
    req.body,
  );

  const interview = await interviewService.getInterviewById(id);
  if (!interview) {
    throw new NotFoundException("Interview tidak ditemukan");
  }

  if (interview.status === Status.FINISH) {
    throw new ForbiddenException("Tidak dapat mengubah kategori pada interview yang sudah selesai");
  }

  const updatedInterview = await interviewService.setFocusCategories(id, categoryIds);

  sendResponse(res, {
    status: 200,
    message: "Kategori pertanyaan berhasil diatur",
    data: updatedInterview,
  });
};

// STUDENT RESULT (HANYA FINAL RESUME, TANPA SCORE)
export const getStudentResult = async (req: Request, res: Response) => {
  const id = +req.params.id;

  const interview = await interviewService.getInterviewById(id);
  if (!interview) {
    throw new NotFoundException("Interview tidak ditemukan");
  }

  if (interview.status !== Status.FINISH) {
    throw new ForbiddenException("Interview belum selesai");
  }

  const result = {
    id: interview.id,
    status: interview.status,
    finalResume: interview.finalResume,
    company: interview.company,
    position: interview.position,
  };

  sendResponse(res, {
    status: 200,
    message: "Hasil interview mahasiswa",
    data: result,
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

// CREATE INTERVIEW BY ADMIN
export const createInterviewByAdmin = async (req: Request, res: Response) => {
  const { userId, companyId, positionId, categoryIds } = validate<CreateInterviewRequest>(
    {
      userId: "number",
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

  const existingInterview =
    await interviewService.getInterviewByUserCompanyPosition(
      userId,
      companyId,
      positionId,
    );
  if (existingInterview) {
    throw new ForbiddenException(
      "Mahasiswa ini sudah melakukan interview untuk posisi ini",
    );
  }

  const interview = await interviewService.createInterviewByAdmin({
    userId,
    companyId,
    positionId,
    categoryIds,
  });

  sendResponse(res, {
    status: 201,
    message: "Lamaran berhasil dibuat",
    data: interview,
  });
};

// UPDATE INTERVIEW BY ADMIN
export const updateInterviewByAdmin = async (req: Request, res: Response) => {
  const id = +req.params.id;
  const { userId, companyId, positionId } = validate<{
    userId?: number;
    companyId?: number;
    positionId?: number;
  }>(
    {
      userId: { type: "number", optional: true },
      companyId: { type: "number", optional: true },
      positionId: { type: "number", optional: true },
    },
    req.body,
  );

  const interview = await interviewService.getInterviewById(id);
  if (!interview) {
    throw new NotFoundException("Lamaran tidak ditemukan");
  }

  if (userId || companyId || positionId) {
    if (userId && companyId && positionId) {
      const existingInterview =
        await interviewService.getInterviewByUserCompanyPosition(
          userId,
          companyId,
          positionId,
        );
      if (existingInterview && existingInterview.id !== id) {
        throw new ForbiddenException(
          "Mahasiswa ini sudah melakukan interview untuk posisi ini",
        );
      }
    }
  }

  const updatedInterview = await interviewService.updateInterview(id, {
    userId,
    companyId,
    positionId,
  });

  sendResponse(res, {
    status: 200,
    message: "Lamaran berhasil diupdate",
    data: updatedInterview,
  });
};

// DELETE INTERVIEW BY ADMIN
export const deleteInterviewByAdmin = async (req: Request, res: Response) => {
  const id = +req.params.id;

  const interview = await interviewService.getInterviewById(id);
  if (!interview) {
    throw new NotFoundException("Lamaran tidak ditemukan");
  }

  await interviewService.deleteInterview(id);

  sendResponse(res, {
    status: 200,
    message: "Lamaran berhasil dihapus",
  });
};

// GET ALL INTERVIEWS WITH DETAILS FOR ADMIN
export const getAllInterviewsForAdmin = async (req: Request, res: Response) => {
  const interviews = await interviewService.getAllInterviewsWithDetails();

  sendResponse(res, {
    status: 200,
    message: "Daftar lamaran berhasil diambil",
    data: interviews,
  });
};

// GET INTERVIEW DETAIL FOR ADMIN
export const getInterviewDetailForAdmin = async (req: Request, res: Response) => {
  const id = +req.params.id;

  const interview = await interviewService.getInterviewDetail(id);
  if (!interview) {
    throw new NotFoundException("Lamaran tidak ditemukan");
  }

  sendResponse(res, {
    status: 200,
    message: "Detail lamaran berhasil diambil",
    data: interview,
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
  getAllInterviews,
  setFocusCategories,
  getStudentResult,
  updateFinalResume,
  createInterviewByAdmin,
  updateInterviewByAdmin,
  deleteInterviewByAdmin,
  getAllInterviewsForAdmin,
  getInterviewDetailForAdmin,
};
