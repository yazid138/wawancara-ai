import { Router } from "express";
import auth from "@/middleware/auth";
import { generateMessage, embedText, generateMessage2 } from "@/controller/ai.controller";

// ai/* routes
const router = Router();

router.post("/message", auth, generateMessage);
router.post("/message2", auth, generateMessage2);
router.post("/embedding", auth, embedText);

export default router;
