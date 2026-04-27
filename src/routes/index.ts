import sendResponse from "@/utils/responseHandler";
import { Router, Request, Response } from "express";
import authRouter from "./auth.routes";
import aiRouter from "./ai.routes";
import interviewRouter from "./interview.route";
import answerRouter from "./answer.route";
import questionRouter from "./question.route";
import auth from '@/middleware/auth';

const router = Router();

router.get("/", (req: Request, res: Response) => {
  sendResponse(res, { status: 200, message: "Welcome to the API" });
});

router.use("/auth", authRouter);
router.use("/ai", auth, aiRouter);
router.use("/interview", auth, interviewRouter);
router.use("/answer", auth, answerRouter);
router.use("/question", auth, questionRouter);

export default router;
