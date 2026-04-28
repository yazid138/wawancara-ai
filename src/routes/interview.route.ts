import { Router } from "express";
import InterviewController from "@/controller/interview.controller";

const router = Router();

router.get("/:id/questions", InterviewController.getQuestions);
router.get("/:id/current", InterviewController.getCurrent);
router.get("/:id/next", InterviewController.getNext);
router.get("/:id/finish", InterviewController.getFinish);
router.get("/:id/result", InterviewController.getResult);

export default router