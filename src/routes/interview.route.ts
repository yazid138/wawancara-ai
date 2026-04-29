import { Router } from "express";
import InterviewController from "@/controller/interview.controller";

const router = Router();

router.post("/", InterviewController.startInterview);
router.post("/:id/answers", InterviewController.submitAnswer);

router.get("/:id/questions", InterviewController.getQuestions);
router.get("/:id/current", InterviewController.getCurrent);
router.get("/:id/next", InterviewController.getNext);
router.post("/:id/finish", InterviewController.finishInterview);
router.get("/:id/result", InterviewController.getResult);

export default router