import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { ExtractJwt, Strategy as JwtStrategy } from "passport-jwt";
import config from "@/config";

passport.use(
	new LocalStrategy({ usernameField: "username", passwordField: "password" }, async (username: string, password: string, done: (error: any, user?: any, info?: any) => void) => {
		try {
			const user = {};
			return done(null, user, { message: "Berhasil Login" });
		} catch (err) {
			return done(err);
		}
	})
);

passport.use(
	new JwtStrategy(
		{
			jwtFromRequest: ExtractJwt.fromExtractors([ExtractJwt.fromAuthHeaderAsBearerToken(), ExtractJwt.fromUrlQueryParameter("token")]),
			secretOrKey: config.secretKey,
		},
		(payload: any, done: (error: any, user?: any) => void) => {
			try {
				return done(null, payload);
			} catch (err) {
				return done(err);
			}
		}
	)
);
