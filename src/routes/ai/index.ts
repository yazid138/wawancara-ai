import { Router } from "express";
import auth from "@/middleware/auth";
import { generateMessage, embedText } from "@/controller/ai.controller";

// ai/* routes
const router = Router();

router.post("/message", auth, generateMessage);
router.post("/embedding", auth, embedText);

export default router;
