import { Router } from "express";
import FollowUpController from "@/controller/followUp.controller";

const router = Router();

// POST /follow-up/:id/answer — Submit jawaban untuk follow-up question
router.post("/:id/answer", FollowUpController.answerFollowUp);

export default router;
