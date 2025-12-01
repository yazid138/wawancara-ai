import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { ExtractJwt, Strategy as JwtStrategy } from "passport-jwt";
import config from "@/config";
import userService from "@/services/user.service";
import bcrypt from "bcrypt";
import { User } from "@prisma/client";
import UserResponse from "@/types/userResponse";
import logger from "@/utils/logger";

passport.use(
  new LocalStrategy(
    { usernameField: "username", passwordField: "password" },
    async (
      username: string,
      password: string,
      done: (error: boolean, user?: User, info?: { message: string }) => void,
    ) => {
      try {
        const user = await userService.findUserByUsername(username);
        if (!user) {
          return done(true, undefined, { message: "Username tidak ditemukan" });
        }
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
          return done(true, undefined, { message: "Password salah" });
        }
        return done(false, user, { message: "Berhasil Login" });
      } catch (err) {
        logger.error(err);
        return done(true);
      }
    },
  ),
);

passport.use(
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        ExtractJwt.fromUrlQueryParameter("token"),
      ]),
      secretOrKey: config.secretKey,
    },
    async (
      payload: { id: number },
      done: (err: boolean, user?: UserResponse) => void,
    ) => {
      try {
        const user = await userService.findUserById(payload.id);
        if (!user) {
          return done(true);
        }
        done(false, user);
      } catch (err) {
        logger.error(err);
        return done(true);
      }
    },
  ),
);
