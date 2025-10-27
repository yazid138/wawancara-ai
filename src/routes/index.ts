import sendResponse from "@/utils/responseHandler";
import { Router, Request, Response } from "express";
const router = Router();

router.get("/", (req: Request, res: Response) => {
    sendResponse(res, { status: 200, message: "Welcome to the API" });
});

export default router;