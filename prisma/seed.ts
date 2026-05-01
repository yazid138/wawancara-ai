import { PrismaClient, Role, QuestionType } from "@/prisma/client";
import bcrypt from "bcrypt";
import { PrismaPg } from "@prisma/adapter-pg";

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
  await prisma.company.createMany({
    data: [
      { name: "Tokopedia" },
      { name: "Gojek" },
      { name: "Shopee" },
    ],
    skipDuplicates: true,
  });

  await prisma.position.createMany({
    data: [
      { name: "Backend Developer" },
      { name: "Frontend Developer" },
      { name: "Fullstack Developer" },
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
    await prisma.keyword.createMany({
      data: q.keywords.map((word: string) => ({
        questionId: question.id,
        word,
      })),
    });

    // ideal answer
    await prisma.idealAnswer.create({
      data: {
        questionId: question.id,
        content: q.idealAnswer,
        embedding: {},
      },
    });

    // SOFTSKILL CATEGORY (IMPORTANT)
    if (q.type === QuestionType.SOFTSKILL) {
      await prisma.answerCategory.createMany({
        data: [
          { questionId: question.id, label: "komunikasi", score: 4 },
          { questionId: question.id, label: "kerjasama", score: 5 },
          { questionId: question.id, label: "adaptasi", score: 3 },
          { questionId: question.id, label: "problem solving", score: 5 },
        ],
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
      keywords: ["diri", "pengalaman"],
      idealAnswer: "Menjelaskan latar belakang dan skill utama.",
    },
    {
      content: "Apa yang membuat Anda memilih karir ini?",
      type: QuestionType.INTRO,
      difficulty: "EASY",
      category: "Personal",
      keywords: ["motivasi"],
      idealAnswer: "Menjelaskan alasan memilih bidang ini.",
    },

    // GENERAL
    {
      content: "Mengapa Anda ingin bekerja di perusahaan ini?",
      type: QuestionType.GENERAL,
      difficulty: "EASY",
      category: "Motivation",
      keywords: ["perusahaan"],
      idealAnswer: "Menunjukkan ketertarikan terhadap perusahaan.",
    },
    {
      content: "Apa tujuan karir Anda?",
      type: QuestionType.GENERAL,
      difficulty: "MEDIUM",
      category: "Motivation",
      keywords: ["karir"],
      idealAnswer: "Menjelaskan rencana karir.",
    },

    // SOFTSKILL
    {
      content: "Ceritakan pengalaman kerja tim.",
      type: QuestionType.SOFTSKILL,
      difficulty: "MEDIUM",
      category: "Teamwork",
      keywords: ["tim"],
      idealAnswer: "Menjelaskan kontribusi dalam tim.",
    },
    {
      content: "Bagaimana menangani konflik?",
      type: QuestionType.SOFTSKILL,
      difficulty: "MEDIUM",
      category: "Teamwork",
      keywords: ["konflik"],
      idealAnswer: "Menggunakan komunikasi.",
    },
    {
      content: "Bagaimana mengatur waktu?",
      type: QuestionType.SOFTSKILL,
      difficulty: "MEDIUM",
      category: "Time Management",
      keywords: ["waktu"],
      idealAnswer: "Mengatur prioritas.",
    },
    {
      content: "Ceritakan saat harus adaptasi cepat.",
      type: QuestionType.SOFTSKILL,
      difficulty: "MEDIUM",
      category: "Adaptability",
      keywords: ["adaptasi"],
      idealAnswer: "Menunjukkan fleksibilitas.",
    },
    {
      content: "Bagaimana menghadapi tekanan?",
      type: QuestionType.SOFTSKILL,
      difficulty: "MEDIUM",
      category: "Stress Management",
      keywords: ["stress"],
      idealAnswer: "Tetap produktif.",
    },
    {
      content: "Ceritakan kegagalan Anda.",
      type: QuestionType.SOFTSKILL,
      difficulty: "HARD",
      category: "Personality",
      keywords: ["gagal"],
      idealAnswer: "Belajar dari kesalahan.",
    },

    // TECHNICAL
    {
      content: "Apa itu JWT?",
      type: QuestionType.TECHNICAL,
      difficulty: "MEDIUM",
      category: "Security",
      keywords: ["jwt"],
      idealAnswer: "Token autentikasi.",
    },
    {
      content: "Apa itu indexing?",
      type: QuestionType.TECHNICAL,
      difficulty: "MEDIUM",
      category: "Database",
      keywords: ["index"],
      idealAnswer: "Mempercepat query.",
    },
    {
      content: "Jelaskan REST API.",
      type: QuestionType.TECHNICAL,
      difficulty: "MEDIUM",
      category: "Backend",
      keywords: ["rest"],
      idealAnswer: "API berbasis HTTP.",
    },
    {
      content: "Bagaimana optimasi database?",
      type: QuestionType.TECHNICAL,
      difficulty: "HARD",
      category: "Database",
      keywords: ["query"],
      idealAnswer: "Indexing dan tuning.",
    },
    { content: "Jelaskan konsep MVC.", 
      type: QuestionType.TECHNICAL, 
      difficulty: "MEDIUM", 
      category: "Backend", 
      keywords: ["MVC"], 
      idealAnswer: "Memisahkan model, view, controller." 
    },
    { content: "Bagaimana mengamankan API?", 
      type: QuestionType.TECHNICAL, 
      difficulty: "HARD", 
      category: "Security", 
      keywords: ["auth", "security"], 
      idealAnswer: "Menggunakan auth, validation, rate limit." 
    }
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