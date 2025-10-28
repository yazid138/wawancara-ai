import sendResponse from "@/utils/responseHandler";
import { Router, Request, Response } from "express";
import authRouter from "./auth";

const router = Router();

router.get("/", (req: Request, res: Response) => {
	sendResponse(res, { status: 200, message: "Welcome to the API" });
});

router.use("/auth", authRouter);

export default router;
