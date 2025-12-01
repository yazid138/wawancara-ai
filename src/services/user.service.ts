import prisma from "@/database/prisma";

type CreateUserData = {
  name: string;
  username: string;
  password: string;
};
const createUser = async ({ name, username, password }: CreateUserData) => {
  const user = await prisma.user.create({
    data: { name, username, password },
  });
  return user;
};

const findUserByUsername = async (username: string) => {
  const user = await prisma.user.findUnique({
    where: { username },
  });
  return user;
};

const findUserById = async (id: number) => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, username: true, createdAt: true },
  });
  return user;
};

export default { createUser, findUserByUsername, findUserById };
