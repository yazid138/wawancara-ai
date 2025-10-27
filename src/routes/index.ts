import sendResponse from "@/utils/responseHandler";
import { validate } from "@/utils/validation";
import { Router, Request, Response } from "express";
const router = Router();

router.get("/", (req: Request, res: Response) => {
    validate(res, {name: 'string'}, req.query);
    sendResponse(res, { status: 200, message: "Welcome to the API" });
});

export default router;