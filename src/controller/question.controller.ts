import questionService from "@/services/question.service";
import { Request, Response } from "express";
import sendResponse from "@/utils/responseHandler";
import validate from "@/utils/validation";
import { QuestionType } from "@/prisma/client";
import NotFoundException from "@/exception/NotFoundException";

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
    throw new NotFoundException("Pertanyaan tidak ditemukan");
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
};
export const createQuestion = async (req: Request, res: Response) => {
  const { content, difficulty, keywords, type, category } =
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
      },
      req.body,
    );

  const newQuestion = await questionService.createQuestion({
    content,
    difficulty,
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
  category?: string;
};
export const updateQuestion = async (req: Request, res: Response) => {
  const { content, keywords, type, difficulty, category } =
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
    throw new NotFoundException("Pertanyaan tidak ditemukan");
  }
  
  sendResponse(res, {
    status: 200,
    message: "Berhasil menghapus pertanyaan",
    data: question,
  });
};

type AddIdealAnswerRequest = {
  idealAnswer: string;
};
export const addIdealAnswer = async (req: Request, res: Response) => {
  const id = +req.params.id;
  const { idealAnswer } = validate<AddIdealAnswerRequest>(
    {
      idealAnswer: "string",
    },
    req.body,
  );
  const question = await questionService.addIdealAnswer(id, idealAnswer);
  sendResponse(res, {
    status: 200,
    message: "Berhasil menambahkan jawaban ideal",
    data: question,
  });
};

export const removeIdealAnswer = async (req: Request, res: Response) => {
  const { id, idealAnswerId } = req.params;
  const question = await questionService.removeIdealAnswer(+id, +idealAnswerId);
  sendResponse(res, {
    status: 200,
    message: "Berhasil menghapus jawaban ideal",
    data: question,
  });
};

export const getAllCategories = async (req: Request, res: Response) => {
  const categories = await questionService.getAllCategories();
  sendResponse(res, {
    status: 200,
    message: "Berhasil mendapatkan semua kategori",
    data: categories,
  });
};

export default {
  getAllQuestions,
  getQuestionById,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  addIdealAnswer,
  removeIdealAnswer,
  getAllCategories,
};
