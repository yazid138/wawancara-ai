import { Router } from "express";
import auth from "@/middleware/auth";
import { generateMessageController, embedTextController, generateMessage2Controller, searchSimilarTextController } from "@/controller/ai.controller";

// ai/* routes
const router = Router();

router.post("/message", auth, generateMessageController);
router.post("/message2", auth, generateMessage2Controller);
router.post("/embedding", auth, embedTextController);
router.post("/search-text", auth, searchSimilarTextController);

export default router;
