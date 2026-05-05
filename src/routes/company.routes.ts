import { Router } from "express";
import companyController from "@/controller/company.controller";

const router = Router();
router.get("/", companyController.getAllCompanies);
router.get('/:id/positions', companyController.getCompanyPositions);

export default router;