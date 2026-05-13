import { PrismaClient, Role, QuestionType } from "@/prisma/client";
import bcrypt from "bcrypt";
import { PrismaPg } from "@prisma/adapter-pg";
import aiService from "@/services/ai.service";
import pineconeService from "@/services/pinecone.service";
import qdrantService from "@/services/qdrant.service";

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  }),
});

const main = async () => {
  console.log("Seeding...");

  // ADMIN
  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      name: "Admin",
      username: "admin",
      password: await bcrypt.hash("admin", 10),
      role: Role.ADMIN,
    },
  });

  // COMPANY & POSITION
  const companies = await prisma.company.createManyAndReturn({
    data: [{ name: "Tokopedia" }, { name: "Gojek" }, { name: "Shopee" }],
    skipDuplicates: true,
  });

  await prisma.position.createMany({
    data: [
      { name: "Backend Developer", companyId: companies[0].id },
      { name: "Frontend Developer", companyId: companies[1].id },
      { name: "Fullstack Developer", companyId: companies[2].id },
    ],
    skipDuplicates: true,
  });

  // QUESTION CATEGORY
  const categoryNames = [
    "Personal",
    "Motivation",
    "Personality",
    "Teamwork",
    "Time Management",
    "Adaptability",
    "Stress Management",
    "Backend",
    "Database",
    "Security",
  ];

  await prisma.questionCategory.createMany({
    data: categoryNames.map((name) => ({ name })),
    skipDuplicates: true,
  });

  const categories = await prisma.questionCategory.findMany();

  const getCategoryId = (name: string) => {
    const cat = categories.find((c) => c.name === name);
    if (!cat) throw new Error(`Category not found: ${name}`);
    return cat.id;
  };

  // HELPER
  const createQuestion = async (q: any) => {
    const existing = await prisma.question.findFirst({
      where: { content: q.content },
    });

    if (existing) return;

    const question = await prisma.question.create({
      data: {
        content: q.content,
        type: q.type,
        difficulty: q.difficulty,
        categoryId: getCategoryId(q.category),
      },
    });

    // keywords
    const keywords = await aiService.generateKeyword(q.content);
    await prisma.keyword.createMany({
      data: keywords.map((word: string) => ({
        questionId: question.id,
        word,
      })),
    });

    // ideal answer
    await Promise.all(
      Array.from({ length: 3 }).map(async () => {
        const idealAnswer = await aiService.generateIdealAnswer(q.content);
        const embedding = await aiService.createEmbedding(idealAnswer);
        const idealAnswerRecord = await prisma.idealAnswer.create({
          data: {
            questionId: question.id,
            content: idealAnswer,
            embedding,
          },
        });
        await Promise.all([
          pineconeService.upsertVector(
            embedding,
            {
              questionId: question.id,
              answer: idealAnswer,
              type: "ideal_answer",
            },
            `ideal_${idealAnswerRecord.id}`,
          ),
          qdrantService.upsertVector(
            embedding,
            {
              questionId: question.id,
              answer: idealAnswer,
              type: "ideal_answer",
            },
            idealAnswerRecord.id,
          ),
        ]);
      }),
    );

    // SOFTSKILL CATEGORY (IMPORTANT)
    if (q.type === QuestionType.SOFTSKILL) {
      const answerCategories: { label: string; score: number }[] =
        await aiService.generateAnswerCategories(q.content);
      await prisma.answerCategory.createMany({
        data: answerCategories.map((cat) => ({
          questionId: question.id,
          label: cat.label,
          score: cat.score,
        })),
      });
    }
  };

  // QUESTIONS
  const questions = [
    // INTRO
    {
      content: "Ceritakan tentang diri Anda secara singkat.",
      type: QuestionType.INTRO,
      difficulty: "EASY",
      category: "Personal",
    },
    {
      content: "Apa yang membuat Anda memilih karir ini?",
      type: QuestionType.INTRO,
      difficulty: "EASY",
      category: "Personal",
    },

    // GENERAL
    {
      content: "Mengapa Anda ingin bekerja di perusahaan ini?",
      type: QuestionType.GENERAL,
      difficulty: "EASY",
      category: "Motivation",
    },
    {
      content: "Apa tujuan karir Anda?",
      type: QuestionType.GENERAL,
      difficulty: "MEDIUM",
      category: "Motivation",
    },

    // SOFTSKILL
    {
      content: "Ceritakan pengalaman kerja tim.",
      type: QuestionType.SOFTSKILL,
      difficulty: "MEDIUM",
      category: "Teamwork",
    },
    {
      content: "Bagaimana menangani konflik?",
      type: QuestionType.SOFTSKILL,
      difficulty: "MEDIUM",
      category: "Teamwork",
    },
    {
      content: "Bagaimana mengatur waktu?",
      type: QuestionType.SOFTSKILL,
      difficulty: "MEDIUM",
      category: "Time Management",
    },
    {
      content: "Ceritakan saat harus adaptasi cepat.",
      type: QuestionType.SOFTSKILL,
      difficulty: "MEDIUM",
      category: "Adaptability",
    },
    {
      content: "Bagaimana menghadapi tekanan?",
      type: QuestionType.SOFTSKILL,
      difficulty: "MEDIUM",
      category: "Stress Management",
    },
    {
      content: "Ceritakan kegagalan Anda.",
      type: QuestionType.SOFTSKILL,
      difficulty: "HARD",
      category: "Personality",
    },

    // TECHNICAL
    {
      content: "Apa itu JWT?",
      type: QuestionType.TECHNICAL,
      difficulty: "MEDIUM",
      category: "Security",
    },
    {
      content: "Apa itu indexing?",
      type: QuestionType.TECHNICAL,
      difficulty: "MEDIUM",
      category: "Database",
    },
    {
      content: "Jelaskan REST API.",
      type: QuestionType.TECHNICAL,
      difficulty: "MEDIUM",
      category: "Backend",
    },
    {
      content: "Bagaimana optimasi database?",
      type: QuestionType.TECHNICAL,
      difficulty: "HARD",
      category: "Database",
    },
    {
      content: "Jelaskan konsep MVC.",
      type: QuestionType.TECHNICAL,
      difficulty: "MEDIUM",
      category: "Backend",
    },
    {
      content: "Bagaimana mengamankan API?",
      type: QuestionType.TECHNICAL,
      difficulty: "HARD",
      category: "Security",
    },
  ];

  for (const q of questions) {
    await createQuestion(q);
  }

  const total = await prisma.question.count();
  console.log("Total Questions:", total);

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
