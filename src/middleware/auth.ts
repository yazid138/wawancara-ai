import UnauthorizedException from "@/exception/UnauthorizedException";
import passport from "passport";
import { Request, Response, NextFunction } from "express";

export default (req: Request, res: Response, next: NextFunction) =>
	passport.authenticate("jwt", { session: false }, (err: any, payload: any) => {
		if (err || !payload) throw new UnauthorizedException();
	});
