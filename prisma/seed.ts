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

  // QUESTION SEEDING
  // 1. Categories
  await prisma.questionCategory.createMany({
    data: [
      { name: "Personal" },
      { name: "Motivation" },
      { name: "Personality" },
      { name: "Teamwork" },
      { name: "Time Management" },
      { name: "Backend" },
      { name: "Database" },
      { name: "Security" }
    ],
    skipDuplicates: true
  });

  const categories = await prisma.questionCategory.findMany();

  const getCategoryId = (name: string) =>
    categories.find(c => c.name === name)?.id!;

  const createQuestion = async ({
    content,
    type,
    difficulty,
    category,
    keywords,
    idealAnswer
  }: any) => {
    const q = await prisma.question.create({
      data: {
        content,
        type,
        difficulty,
        categoryId: getCategoryId(category)
      }
    });

    // keyword
    await prisma.keyword.createMany({
      data: keywords.map((word: string) => ({
        questionId: q.id,
        word
      }))
    });

    // ideal answer
    await prisma.idealAnswer.create({
      data: {
        questionId: q.id,
        content: idealAnswer,
        embedding: {}
      }
    });
  };

  // QUESTIONS

  // INTRO
  await createQuestion({
    content: "Ceritakan tentang diri Anda secara singkat.",
    type: "INTRO",
    difficulty: "EASY",
    category: "Personal",
    keywords: ["diri", "pengalaman", "skill"],
    idealAnswer:
      "Menjelaskan latar belakang, pengalaman, dan keahlian utama secara singkat."
  });

  // GENERAL
  await createQuestion({
    content: "Mengapa Anda ingin bekerja di perusahaan ini?",
    type: "GENERAL",
    difficulty: "EASY",
    category: "Motivation",
    keywords: ["motivasi", "perusahaan", "karir"],
    idealAnswer:
      "Menunjukkan pemahaman tentang perusahaan dan kesesuaian dengan tujuan karir."
  });

  await createQuestion({
    content: "Apa kelebihan dan kekurangan Anda?",
    type: "GENERAL",
    difficulty: "MEDIUM",
    category: "Personality",
    keywords: ["kelebihan", "kekurangan"],
    idealAnswer:
      "Menyebutkan kelebihan relevan dan kekurangan yang disertai perbaikan."
  });

  // SOFTSKILL
  await createQuestion({
    content: "Ceritakan pengalaman Anda bekerja dalam tim.",
    type: "SOFTSKILL",
    difficulty: "MEDIUM",
    category: "Teamwork",
    keywords: ["tim", "kolaborasi", "komunikasi"],
    idealAnswer:
      "Menjelaskan kontribusi dalam tim dan bagaimana berkomunikasi dengan anggota lain."
  });

  await createQuestion({
    content: "Bagaimana Anda mengatur waktu saat banyak deadline?",
    type: "SOFTSKILL",
    difficulty: "MEDIUM",
    category: "Time Management",
    keywords: ["deadline", "prioritas", "waktu"],
    idealAnswer:
      "Menggunakan prioritas, to-do list, dan manajemen waktu yang efektif."
  });

  // TECHNICAL
  await createQuestion({
    content: "Jelaskan perbedaan REST API dan GraphQL.",
    type: "TECHNICAL",
    difficulty: "MEDIUM",
    category: "Backend",
    keywords: ["REST", "GraphQL", "API"],
    idealAnswer:
      "REST menggunakan endpoint tetap, GraphQL memungkinkan query fleksibel."
  });

  await createQuestion({
    content: "Bagaimana cara mengoptimasi query database?",
    type: "TECHNICAL",
    difficulty: "HARD",
    category: "Database",
    keywords: ["index", "query", "optimasi"],
    idealAnswer:
      "Menggunakan indexing, caching, dan query optimization."
  });

  await createQuestion({
    content: "Apa itu JWT dan bagaimana cara kerjanya?",
    type: "TECHNICAL",
    difficulty: "MEDIUM",
    category: "Security",
    keywords: ["JWT", "token", "auth"],
    idealAnswer:
      "JWT adalah token berbasis JSON untuk autentikasi stateless."
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

