import { Router } from "express";
import { login, logout, me, register } from "@/controller/auth.controller";
import auth from "@/middleware/auth";

// auth/* routes
const router = Router();

router.post("/login", login);
router.delete("/logout", auth, logout);
router.get("/me", auth, me);
router.post("/register", register);

export default router;
