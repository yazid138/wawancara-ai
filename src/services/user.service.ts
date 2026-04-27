import prisma from "@/database/prisma";
import { Role } from "@/prisma/client";

type CreateUserData = {
  name: string;
  username: string;
  password: string;
  role: Role;
};
export const createUser = async ({ name, username, password, role }: CreateUserData) => {
  const user = await prisma.user.create({
    data: { name, username, password, role },
  });
  return user;
};

export const findUserByUsername = async (username: string) => {
  const user = await prisma.user.findUnique({
    where: { username },
  });
  return user;
};

export const findUserById = async (id: number) => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, username: true, role: true, createdAt: true },
  });
  return user;
};

export default { createUser, findUserByUsername, findUserById };
