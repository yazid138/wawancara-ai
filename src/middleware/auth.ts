import UnauthorizedException from "@/exception/UnauthorizedException";
import passport from "passport";
import { Request, Response, NextFunction } from "express";

export default (req: Request, res: Response, next: NextFunction) =>
	passport.authenticate("jwt", (err: any, payload: any) => {
		try {
			if (err || !payload) throw new UnauthorizedException();
			req.user = payload;
			next();
		} catch (err) {
			next(err);
		}
	})(req, res, next);
