import { Request, Response } from "express";
import sendResponse from "@/utils/responseHandler";
import passport from "passport";
import validate from "@/utils/validation";
import BadRequestException from "@/exception/BadRequestException";
import UnauthorizedException from "@/exception/UnauthorizedException";
import config from "@/config";
import jwt from "jsonwebtoken";

export const login = (req: Request, res: Response) => {
	validate(
		res,
		{
			username: "string",
			password: "string",
		},
		req.body
	);
	passport.authenticate("local", { session: false }, (err: any, user: any, info: any) => {
		if (err) {
			throw new BadRequestException("Authentication failed", err);
		}
		if (!user) {
			throw new UnauthorizedException("Invalid username or password");
		}
		req.login(user, (loginErr) => {
			if (loginErr) {
				throw new UnauthorizedException("Login failed");
			}
			const token = jwt.sign({ id: user._id }, config.secretKey, { expiresIn: "1d" });
			sendResponse(res, { status: 200, message: info.message, data: { token } });
		});
	});
};

export const me = (req: Request, res: Response) => {
	sendResponse(res, { status: 200, message: "User info", data: req.user });
};

export const register = (req: Request, res: Response) => {
	sendResponse(res, { status: 200, message: "Register successful" });
};

export const logout = (req: Request, res: Response) => {
    req.logout((errLogout) => {
        if (errLogout) {
            throw new BadRequestException("Logout failed", errLogout);
        }
        sendResponse(res, { status: 200, message: "Logout successful" });
    });
};
