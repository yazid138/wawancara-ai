import { Request, Response } from "express";
import sendResponse from "@/utils/responseHandler";
import validate from "@/utils/validation";
import followUpService from "@/services/followUp.service";
import NotFoundException from "@/exception/NotFoundException";
import prisma from "@/database/prisma";

// ---------------------------------------------------------------------------
// POST /interviews/:id/follow-up
//
// Generate follow-up question untuk jawaban yang lemah.
// Body: { answerId: number }
// ---------------------------------------------------------------------------

export const generateFollowUp = async (req: Request, res: Response) => {
  const interviewId = +req.params.id;

  const { answerId } = validate<{ answerId: number }>(
    { answerId: "number" },
    req.body,
  );

  const result = await followUpService.generateFollowUp(interviewId, answerId);

  sendResponse(res, {
    status: 201,
    message: result.generated
      ? "Follow-up question berhasil digenerate"
      : "Follow-up tidak diperlukan",
    data: result,
  });
};

// ---------------------------------------------------------------------------
// POST /follow-up/:id/answer
//
// Submit jawaban untuk follow-up question.
// Body: { answer: string }
// ---------------------------------------------------------------------------

export const answerFollowUp = async (req: Request, res: Response) => {
  const followUpQuestionId = +req.params.id;
  const userId             = req.user!.id;

  const { answer } = validate<{ answer: string }>(
    { answer: "string" },
    req.body,
  );

  // Ambil interviewId dari ChatHistory yang terhubung ke follow-up question ini
  const chatHistory = await prisma.chatHistory.findFirst({
    where: {
      questionId: followUpQuestionId,
      role:       "AI",
    },
  });

  if (!chatHistory) {
    throw new NotFoundException("Follow-up question tidak ditemukan di chat history");
  }

  const interviewId = chatHistory.interviewId;

  const result = await followUpService.submitFollowUpAnswer(
    followUpQuestionId,
    answer,
    interviewId,
    userId,
  );

  sendResponse(res, {
    status: 200,
    message: "Jawaban follow-up berhasil disimpan",
    data: result,
  });
};

export default {
  generateFollowUp,
  answerFollowUp,
};
