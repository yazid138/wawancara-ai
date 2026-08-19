import prisma from "@/database/prisma";
import { Role } from "@/prisma/client";

type CreateUserData = {
  name: string;
  username: string;
  password: string;
  role: Role;
  companyId?: number;
};
export const createUser = async ({
  name,
  username,
  password,
  role,
  companyId,
}: CreateUserData) => {
  const user = await prisma.user.create({
    data: { name, username, password, role, companyId },
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
    select: {
      id: true,
      name: true,
      username: true,
      role: true,
      companyId: true,
      createdAt: true,
    },
  });
  return user;
};

export const getAllStudents = async () => {
  const students = await prisma.user.findMany({
    where: { role: "STUDENT" },
    select: {
      id: true,
      name: true,
      username: true,
    },
    orderBy: { name: "asc" },
  });
  return students;
};

export default { createUser, findUserByUsername, findUserById, getAllStudents };
