import { Router } from "express";
import InterviewController from "@/controller/interview.controller";

const router = Router();

router.get("/", InterviewController.getUserInterviews);
router.post("/", InterviewController.startInterview);
router.get("/:id/current", InterviewController.getCurrent);
router.post("/:id/answers", InterviewController.submitAnswer);
router.put("/:id/final-resume", InterviewController.updateFinalResume);
router.post("/:id/finish", InterviewController.finishInterview);
router.get("/:id/result", InterviewController.getResult);
router.get("/:id/history", InterviewController.getInterviewHistory);

export default router;
