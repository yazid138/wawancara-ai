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

  await prisma.scoringComponent.createMany({
    data: [
      { key: 'similarity', name: "rule", weight: 0.5 },
      { key: 'rubric', name: "ai", weight: 0.5 },
      { key: 'min_length', name: "min length", weight: 0.3 },
      { key: 'keyword', name: "keyword", weight: 0.3 },
    ]
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