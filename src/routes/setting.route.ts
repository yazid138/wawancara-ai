import { Router } from "express";
import serviceController from "@/controller/setting.controller";

const router = Router();

router.get("/prompt", serviceController.getPromptTemplate);
router.put("/prompt", serviceController.updatePromptTemplate);
router.get("/scoring", serviceController.getSetting);
router.put("/scoring", serviceController.updateSetting);

export default router;
