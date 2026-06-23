import { Router } from "express";
import InterviewController from "@/controller/interview.controller";
import FollowUpController from "@/controller/followUp.controller";

const router = Router();

router.get("/", InterviewController.getUserInterviews);
router.post("/", InterviewController.startInterview);
router.get("/:id/current", InterviewController.getCurrent);
router.post("/:id/answers", InterviewController.submitAnswer);
router.post("/:id/finish", InterviewController.finishInterview);
router.get("/:id/result", InterviewController.getResult);
router.get("/:id/history", InterviewController.getInterviewHistory);
router.patch("/:id/final-resume", InterviewController.updateFinalResume);
// Generate follow-up question untuk jawaban yang lemah
router.post("/:id/follow-up", FollowUpController.generateFollowUp);

export default router;
