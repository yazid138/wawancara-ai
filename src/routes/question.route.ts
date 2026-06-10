import { Router } from "express";
import QuestionController from "@/controller/question.controller";

const router = Router();

router.get("/", QuestionController.getAllQuestions);
router.get("/categories", QuestionController.getAllCategories);
router.get("/:id", QuestionController.getQuestionById);
router.post("/", QuestionController.createQuestion);
router.put("/:id", QuestionController.updateQuestion);
router.delete("/:id", QuestionController.deleteQuestion);
router.post("/:id/ideal-answer", QuestionController.addIdealAnswer);
router.delete(
  "/:id/ideal-answer/:idealAnswerId",
  QuestionController.removeIdealAnswer,
);

export default router;
