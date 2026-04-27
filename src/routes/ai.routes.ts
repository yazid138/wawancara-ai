import { Router } from "express";
import aiController from "@/controller/ai.controller";

// ai/* routes
const router = Router();

router.post("/message", aiController.generateMessage);
router.post("/message2", aiController.generateMessage2);
router.post("/embedding", aiController.embedText);
router.post("/embedding-tanya-jawab", aiController.embedTanyaJawab);
router.post("/search-text", aiController.searchSimilarText);
router.get("/list-data", aiController.listData);
router.get("/generate-question", aiController.generateQuestion);
router.post("/score-answer", aiController.scoreAnswer);

export default router;
