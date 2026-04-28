import { Request, Response } from "express";
import sendResponse from "@/utils/responseHandler";
import questionService from "@/services/question.service";

const getQuestions = async (req: Request, res: Response) => {
	const questions = await questionService.getAllQuestions();
	const orderedQuestions = [...questions].sort((left: any, right: any) => {
		const leftOrder = typeof left?.order === "number" ? left.order : Number.MAX_SAFE_INTEGER;
		const rightOrder = typeof right?.order === "number" ? right.order : Number.MAX_SAFE_INTEGER;
		return leftOrder - rightOrder;
	});

	sendResponse(res, {
		status: 200,
		message: "Berhasil mendapatkan pertanyaan interview",
		data: orderedQuestions,
	});
};

const notImplemented = async (req: Request, res: Response) => {
	sendResponse(res, {
		status: 501,
		message: "Belum diimplementasikan",
	});
};

export default {
	getQuestions,
	getCurrent: notImplemented,
	getNext: notImplemented,
	getFinish: notImplemented,
	getResult: notImplemented,
};

