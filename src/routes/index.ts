import sendResponse from "@/utils/responseHandler";
import { Router, Request, Response } from "express";
import authRouter from "./auth.routes";
import aiRouter from "./ai.routes";
import interviewRouter from "./interview.route";
import answerRouter from "./answer.route";

const router = Router();

router.get("/", (req: Request, res: Response) => {
  sendResponse(res, { status: 200, message: "Welcome to the API" });
});

router.use("/auth", authRouter);
router.use("/ai", aiRouter);
router.use("/interview", interviewRouter);
router.use("/answer", answerRouter);

export default router;
