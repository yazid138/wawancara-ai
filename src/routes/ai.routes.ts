import { Router } from "express";
import auth from "@/middleware/auth";
import aiController from "@/controller/ai.controller";

// ai/* routes
const router = Router();

router.post("/message", auth, aiController.generateMessage);
router.post("/message2", auth, aiController.generateMessage2);
router.post("/embedding", auth, aiController.embedText);
router.post("/embedding-tanya-jawab", auth, aiController.embedTanyaJawab);
router.post("/search-text", auth, aiController.searchSimilarText);
router.get("/list-data", auth, aiController.listData);

export default router;
