import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { ExtractJwt, Strategy as JwtStrategy } from "passport-jwt";
import config from "@/config";
import prisma from "@/database/prisma";
import bcrypt from "bcrypt";
import { User } from "@prisma/client";

passport.use(
  new LocalStrategy(
    { usernameField: "username", passwordField: "password" },
    async (
      username: string,
      password: string,
      done: (error: boolean, user?: User, info?: { message: string }) => void,
    ) => {
      try {
        const user = await prisma.user.findUnique({ where: { username } });
        if (!user) {
          return done(true, undefined, { message: "Username tidak ditemukan" });
        }
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
          return done(true, undefined, { message: "Password salah" });
        }
        return done(false, user, { message: "Berhasil Login" });
      } catch (err) {
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
      done: (
        err: boolean,
        user?: { id: number; name: string; username: string; createdAt: Date },
      ) => void,
    ) => {
      const user = await prisma.user.findUnique({
        where: { id: payload.id },
        select: { id: true, name: true, username: true, createdAt: true },
      });
      if (!user) {
        return done(true);
      }
      done(false, user);
    },
  ),
);
