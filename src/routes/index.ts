import sendResponse from "@/utils/responseHandler";
import { Router, Request, Response } from "express";
import authRouter from "./auth.routes";
import aiRouter from "./ai.routes";
import interviewRouter from "./interview.route";
import answerRouter from "./answer.route";
import questionRouter from "./question.route";
import auth from '@/middleware/auth';
import settingRouter from "./setting.route";
import role from "@/middleware/role";
import companyRouter from "./company.routes";
import positionRouter from "./position.routes";

const router = Router();

router.get("/", (req: Request, res: Response) => {
  sendResponse(res, { status: 200, message: "Welcome to the API" });
});

router.use("/auth", authRouter);
router.use("/ai", auth, aiRouter);
router.use("/interviews", auth, interviewRouter);
// router.use("/answer", auth, answerRouter);
router.use("/questions", auth, questionRouter);
router.use("/setting", auth, role('ADMIN'), settingRouter);
router.use("/company", auth, companyRouter);
router.use("/position", auth, positionRouter);

export default router;
