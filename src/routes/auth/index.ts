import sendResponse from "@/utils/responseHandler";
import { Router, Request, Response } from "express";
import {login, logout, me} from "@/controller/auth.controller";
import auth from "@/middleware/auth";

const router = Router();

router.get("/login", login);
router.delete("/logout", logout);
router.get("/me", auth, me);

router.post("/register", (req: Request, res: Response) => {
	sendResponse(res, { status: 200, message: "Register successful" });
});


export default router;
