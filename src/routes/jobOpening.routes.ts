import { Router } from "express";
import jobOpeningController from "@/controller/jobOpening.controller";
import role from "@/middleware/role";

const router = Router();

router.post("/", role(["COMPANY", "ADMIN"]), jobOpeningController.createJobOpening);
router.get("/company", role(["COMPANY"]), jobOpeningController.getCompanyJobOpenings);
router.get("/all", role(["ADMIN"]), jobOpeningController.getAllJobOpenings);
router.get("/:id", jobOpeningController.getJobOpeningById);
router.put("/:id", role(["COMPANY", "ADMIN"]), jobOpeningController.updateJobOpening);
router.delete("/:id", role(["COMPANY", "ADMIN"]), jobOpeningController.deleteJobOpening);

export default router;
