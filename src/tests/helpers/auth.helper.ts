import "dotenv/config";
import request from "supertest";
import app from "@/app";

/**
 * Register user baru ke API
 */
export const registerUser = async (data: {
  name: string;
  username: string;
  password: string;
  role: string;
}) => {
  return request(app).post("/auth/register").send(data);
};

/**
 * Login user dan return token JWT
 */
export const loginUser = async (username: string, password: string) => {
  const res = await request(app).post("/auth/login").send({ username, password });
  return {
    res,
    token: res.body?.data?.token as string | undefined,
  };
};

/**
 * Helper untuk membuat request dengan Authorization header
 */
export const authRequest = (token: string) => ({
  get: (url: string) =>
    request(app).get(url).set("Authorization", `Bearer ${token}`),
  post: (url: string) =>
    request(app).post(url).set("Authorization", `Bearer ${token}`),
  patch: (url: string) =>
    request(app).patch(url).set("Authorization", `Bearer ${token}`),
  delete: (url: string) =>
    request(app).delete(url).set("Authorization", `Bearer ${token}`),
});
