import { PrismaClient, Role } from "@/prisma/client";
import bcrypt from "bcrypt";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

const main = async () => {
  await prisma.user.create({
    data: {
      name: "Admin",
      username: "admin",
      password: await bcrypt.hash('admin', 10),
      role: Role.ADMIN
    }
  });
};

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });