import { Router } from "express";
import InterviewController from "@/controller/interview.controller";
import FollowUpController from "@/controller/followUp.controller";
import role from "@/middleware/role";
import ownership from "@/middleware/ownership";

const router = Router();

router.get("/", InterviewController.getUserInterviews);
router.post("/", InterviewController.startInterview);

// Admin routes (must be before /:id routes)
router.get("/admin/all", role("ADMIN"), InterviewController.getAllInterviewsForAdmin);
router.post("/admin", role("ADMIN"), InterviewController.createInterviewByAdmin);

router.get("/:id/current", ownership, InterviewController.getCurrent);
router.post("/:id/answers", ownership, InterviewController.submitAnswer);
router.post("/:id/finish", ownership, InterviewController.finishInterview);
router.get("/:id/result", ownership, InterviewController.getResult);
router.get("/:id/history", ownership, InterviewController.getInterviewHistory);

router.patch("/:id/focus-categories", role("ADMIN"), InterviewController.setFocusCategories);
router.get("/:id/student-result", ownership, InterviewController.getStudentResult);
router.patch("/:id/final-resume", role("ADMIN"), InterviewController.updateFinalResume);
router.put("/:id", role("ADMIN"), InterviewController.updateInterviewByAdmin);
router.delete("/:id", role("ADMIN"), InterviewController.deleteInterviewByAdmin);
router.get("/:id/detail", role("ADMIN"), InterviewController.getInterviewDetailForAdmin);

router.post("/:id/follow-up", ownership, FollowUpController.generateFollowUp);

export default router;
