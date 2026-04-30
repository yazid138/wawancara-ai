import { Router } from "express";
import InterviewController from "@/controller/interview.controller";

const router = Router();

router.post("/", InterviewController.startInterview);
router.get("/:id/current", InterviewController.getCurrent);
router.post("/:id/answers", InterviewController.submitAnswer);
router.post("/:id/finish", InterviewController.finishInterview);
router.get("/:id/result", InterviewController.getResult);

export default router;