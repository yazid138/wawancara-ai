import ForbiddenException from "@/exception/ForbiddenException";
import { Request, Response, NextFunction } from "express";

export default (role: string | string[]) => (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as any;
    const userRole = user.role;
    if (!userRole) {
        throw new ForbiddenException("Access denied: No role found");
    }

    const roles = Array.isArray(role) ? role : [role];
    if (!roles.includes(userRole)) {
        throw new ForbiddenException("Access denied: Insufficient permissions");
    }

    next();
};