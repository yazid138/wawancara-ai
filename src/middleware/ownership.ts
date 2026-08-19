import ForbiddenException from "@/exception/ForbiddenException";
import { Request, Response, NextFunction } from "express";
import interviewService from "@/services/interview.service";

export default async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as any;
    const interviewId = +req.params.id;

    if (user.role === "ADMIN" || user.role === "COMPANY") {
      const allowedPaths = ["/focus-categories", "/student-result", "/history"];
      const path = req.path.replace(/^\/\d+/, "");
      if (!allowedPaths.includes(path)) {
        throw new ForbiddenException("Admin/HR tidak dapat melakukan wawancara");
      }
      return next();
    }

    const interview = await interviewService.getInterviewById(interviewId);
    if (!interview) {
      throw new ForbiddenException("Interview tidak ditemukan");
    }

    if (interview.userId !== user.id) {
      throw new ForbiddenException("Anda tidak memiliki akses ke interview ini");
    }

    next();
  } catch (err) {
    next(err);
  }
};
