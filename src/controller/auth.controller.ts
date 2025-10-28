import { NextFunction, Request, Response } from "express";
import sendResponse from "@/utils/responseHandler";
import passport from "passport";
import validate from "@/utils/validation";
import BadRequestException from "@/exception/BadRequestException";
import UnauthorizedException from "@/exception/UnauthorizedException";
import config from "@/config";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { UserModel } from "@/model/user.model";

export const login = (req: Request, res: Response, next: NextFunction) => {
	validate(
		res,
		{
			username: "string",
			password: "string",
		},
		req.body
	);
	passport.authenticate("local", (err: any, user: any, info: any) => {
		try {
			if (err) {
				throw new BadRequestException("Authentication failed", err);
			}
			if (!user) {
				throw new UnauthorizedException(info.message);
			}
			req.login(user, { session: false }, (loginErr) => {
				if (loginErr) {
					throw new UnauthorizedException("Login failed");
				}
				const token = jwt.sign({ id: user.dataValues }, config.secretKey, { expiresIn: "1d" });
				sendResponse(res, { status: 200, message: info.message, data: { token } });
			});
		} catch (err) {
			next(err);
		}
	})(req, res, next);
};

export const me = (req: Request, res: Response) => {
	sendResponse(res, { status: 200, message: "User info", data: req.user });
};

export const register = async (req: Request, res: Response) => {
	validate(
		res,
		{
			name: "string",
			username: "string",
			password: "string",
		},
		req.body
	);
	const { name, username, password } = req.body;
	const existingUser = await UserModel.findOne({ where: { username } });
	if (existingUser) {
		throw new BadRequestException("Username already exists");
	}
	const hashedPassword = await bcrypt.hash(password, 10);
	await UserModel.create({ name, username, password: hashedPassword });
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
