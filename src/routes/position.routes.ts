import { Router } from "express";
import positionController from "@/controller/position.controller";

const router = Router();

router.get("/", positionController.getAllPositions);

export default router;