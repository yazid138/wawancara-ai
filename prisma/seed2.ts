import { PrismaClient, QuestionType } from "@/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import aiService from "@/services/ai.service";

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  }),
});

const main = async () => {
  console.log("Seeding...");

  // const questionsKeywords = await prisma.question.findMany({
  //   where: {
  //     type: QuestionType.TECHNICAL,
  //   },
  // });

  // // keywords
  // await prisma.keyword.deleteMany();
  // await Promise.all(
  //   questionsKeywords.map(async (q) => {
  //     const keywords = await aiService.generateKeyword(q.content);
  //     await prisma.keyword.createMany({
  //       data: keywords.map((word: string) => ({
  //         questionId: q.id,
  //         word,
  //       })),
  //     });
  //   }),
  // );

  const questionsAnswerCategory = await prisma.question.findMany({
    where: {
      type: QuestionType.SOFTSKILL,
    },
  });

  // answer category
  await prisma.answerCategory.deleteMany();
  await Promise.all(
    questionsAnswerCategory.map(async (q) => {
      const answerCategories: { label: string; score: number }[] =
        await aiService.generateAnswerCategories(q.content);
      await prisma.answerCategory.createMany({
        data: answerCategories.map((cat) => ({
          questionId: q.id,
          label: cat.label,
          score: cat.score,
        })),
      });
    }),
  );

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
