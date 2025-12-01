import { NextFunction, Request, Response } from "express";
import sendResponse from "@/utils/responseHandler";
import passport from "passport";
import validate from "@/utils/validation";
import BadRequestException from "@/exception/BadRequestException";
import UnauthorizedException from "@/exception/UnauthorizedException";
import config from "@/config";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import userService from "@/services/user.service";
import { User } from "@prisma/client";

type LoginRequest = {
  username: string;
  password: string;
};
const login = (req: Request, res: Response, next: NextFunction) => {
  validate<LoginRequest>(
    {
      username: "string",
      password: "string",
    },
    req.body,
  );
  passport.authenticate(
    "local",
    (err: boolean, user?: User, info?: { message: string }) => {
      try {
        if (!user) {
          throw new UnauthorizedException(info?.message);
        }
        if (err) {
          throw new BadRequestException("Authentication failed");
        }
        req.login(user, { session: false }, (loginErr) => {
          if (loginErr) {
            throw new UnauthorizedException("Login failed");
          }
          const token = jwt.sign({ id: user.id }, config.secretKey, {
            expiresIn: "1d",
          });
          sendResponse(res, {
            status: 200,
            message: info?.message || "Berhasil Login",
            data: { token },
          });
        });
      } catch (err) {
        next(err);
      }
    },
  )(req, res, next);
};

const me = (req: Request, res: Response) => {
  sendResponse(res, { status: 200, message: "User info", data: req.user });
};

type RegisterRequest = {
  name: string;
  username: string;
  password: string;
};
const register = async (req: Request, res: Response) => {
  validate<RegisterRequest>(
    {
      name: "string",
      username: "string",
      password: "string",
    },
    req.body,
  );
  const { name, username, password } = req.body as RegisterRequest;
  const existingUser = await userService.findUserByUsername(username);
  if (existingUser) {
    throw new BadRequestException("Username already exists");
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  await userService.createUser({ name, username, password: hashedPassword });
  sendResponse(res, { status: 200, message: "Register successful" });
};

const logout = (req: Request, res: Response) => {
  req.logout((errLogout) => {
    if (errLogout) {
      throw new BadRequestException(
        "Logout failed",
        errLogout.message || errLogout,
      );
    }
    sendResponse(res, { status: 200, message: "Logout successful" });
  });
};

export default {
  login,
  me,
  register,
  logout,
};
