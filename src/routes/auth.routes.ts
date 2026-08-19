import { Router } from "express";
import authController from "@/controller/auth.controller";
import auth from "@/middleware/auth";
import role from "@/middleware/role";

// auth/* routes
const router = Router();

router.post("/login", authController.login);
router.delete("/logout", auth, authController.logout);
router.get("/me", auth, authController.me);
router.post("/register", authController.register);
router.get("/students", auth, role("ADMIN"), authController.getAllStudents);

export default router;
