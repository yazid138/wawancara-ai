import { Socket } from "socket.io";
import passport from "passport";

export default (socket: Socket, next: (err?: Error) => void) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication error: No token provided"));
    }

    // Attach token to request headers so passport-jwt can extract it
    const req = socket.request as any;
    req.headers = req.headers || {};
    req.headers.authorization = `Bearer ${token}`;

    passport.authenticate("jwt", { session: false }, (err: any, user: any) => {
      if (err || !user) {
        return next(new Error("Authentication error: Invalid token"));
      }
      socket.data.user = user;
      next();
    })(req, {} as any, next);
  }