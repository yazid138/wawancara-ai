import questionService from "@/services/question.service";
import { Request, Response } from "express";
import sendResponse from "@/utils/responseHandler";
import validate from "@/utils/validation";
import { QuestionType } from "@/prisma/client";

export const getAllQuestions = async (req: Request, res: Response) => {
  const questions = await questionService.getAllQuestions();
  sendResponse(res, {
    status: 200,
    message: "Berhasil mendapatkan semua pertanyaan",
    data: questions,
  });
};

export const getQuestionById = async (req: Request, res: Response) => {
  const id = +req.params.id;
  const question = await questionService.getQuestionById(id);
  if (!question) {
    return sendResponse(res, {
      status: 404,
      message: "Pertanyaan tidak ditemukan",
    });
  }
  sendResponse(res, {
    status: 200,
    message: "Berhasil mendapatkan pertanyaan",
    data: question,
  });
};

type CreateQuestionRequest = {
  content: string;
  category: string;
  keywords?: string[];
  type?: string;
  difficulty?: string;
  idealAnswer?: string;
};
export const createQuestion = async (req: Request, res: Response) => {
  const { content, difficulty, idealAnswer, keywords, type, category } =
    validate<CreateQuestionRequest>(
      {
        content: "string",
        category: "string",
        keywords: {
          type: "array",
          optional: true,
        },
        type: {
          type: "enum",
          values: Object.values(QuestionType),
          optional: true,
        },
        difficulty: {
          type: "string",
          optional: true,
        },
        idealAnswer: {
          type: "string",
          optional: true,
        },
      },
      req.body,
    );

  const newQuestion = await questionService.createQuestion({
    content,
    difficulty,
    idealAnswer,
    keywords,
    type: QuestionType[type as keyof typeof QuestionType],
    category,
  });
  sendResponse(res, {
    status: 201,
    message: "Berhasil membuat pertanyaan",
    data: newQuestion,
  });
};

type UpdateQuestionRequest = {
  content?: string;
  keywords?: string[];
  type?: string;
  difficulty?: string;
  idealAnswer?: string;
  category?: string;
};
export const updateQuestion = async (req: Request, res: Response) => {
  const { content, keywords, type, difficulty, idealAnswer, category } =
    validate<UpdateQuestionRequest>(
      {
        content: {
          type: "string",
          optional: true,
        },
        keywords: {
          type: "array",
          optional: true,
        },
        type: {
          type: "enum",
          values: Object.values(QuestionType),
          optional: true,
        },
        difficulty: {
          type: "string",
          optional: true,
        },
        idealAnswer: {
          type: "string",
          optional: true,
        },
        category: {
          type: "string",
          optional: true,
        },
      },
      req.body,
    );
  const id = +req.params.id;
  const question = await questionService.updateQuestion(id, {
    content,
    type: type ? QuestionType[type as keyof typeof QuestionType] : undefined,
    difficulty,
    idealAnswer,
    keywords,
    category,
  });
  sendResponse(res, {
    status: 200,
    message: "Berhasil memperbarui pertanyaan",
    data: question,
  });
};

export const deleteQuestion = async (req: Request, res: Response) => {
  const id = +req.params.id;
  const question = await questionService.deleteQuestion(id);
  if (!question) {
    return sendResponse(res, {
      status: 404,
      message: "Pertanyaan tidak ditemukan",
    });
  }
  sendResponse(res, {
    status: 200,
    message: "Berhasil menghapus pertanyaan",
    data: question,
  });
};

export default {
  getAllQuestions,
  getQuestionById,
  createQuestion,
  updateQuestion,
  deleteQuestion,
};
