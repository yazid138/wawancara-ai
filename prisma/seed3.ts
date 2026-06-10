import { PrismaClient, QuestionType } from "@/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  }),
});

const main = async () => {
  console.log("Seeding...");

  const company = await prisma.company.findFirst({
    where: {
      name: "Tokopedia",
    },
  });

  if (!company) {
    throw new Error("Company not found");
  }

  await prisma.position.create({
    data: {
      name:"Management System Intern",
      company: {
        connect:{
          id: company.id
        }
      }
    }
  })

  console.log("Seed selesai!");
};

main()
  .catch((e) => {
    console.error("ERROR:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
