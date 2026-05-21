import { PrismaClient, Role, QuestionType } from "@/prisma/client";
import bcrypt from "bcrypt";
import { PrismaPg } from "@prisma/adapter-pg";
import aiService from "@/services/ai.service";
// import pineconeService from "@/services/pinecone.service";
// import qdrantService from "@/services/qdrant.service";

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
    "Communication",
    "Problem Solving",
    "Leadership",
    "Self Confidence",
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
        const idealAnswerResult = await prisma.$queryRaw`
        INSERT INTO "IdealAnswer" ("questionId", "content", "embedding", "createdAt", "updatedAt") 
        VALUES (${question.id}, ${idealAnswer}, ${`[${embedding.join(",")}]`}::vector, NOW(), NOW())
        RETURNING id
        ` as { id: number }[];
        const id = idealAnswerResult[0].id;
        // await Promise.all([
        //   pineconeService.upsertVector(
        //     embedding,
        //     {
        //       questionId: question.id,
        //       answer: idealAnswer,
        //       type: "ideal_answer",
        //     },
        //     `ideal_${id}`,
        //   ),
        //   qdrantService.upsertVector(
        //     embedding,
        //     {
        //       questionId: question.id,
        //       answer: idealAnswer,
        //       type: "ideal_answer",
        //     },
        //     id,
        //   ),
        // ]);
      }),
    );

    // SOFTSKILL CATEGORY (IMPORTANT)
    if (q.type === QuestionType.SOFTSKILL) {
      let answerCategories: { label: string; score: number }[] = [];
      if (q.categoryAnswer) {
        answerCategories = q.categoryAnswer;
      } else {
        answerCategories =
          await aiService.generateAnswerCategories(q.content);
      }
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
      content: "Bagaimana anda menyesuaikan diri dengan aturan yang berlaku di tempat magang?",
      type: QuestionType.SOFTSKILL,
      difficulty: "MEDIUM",
      category: "Adaptability", 
      categoryAnswer: [
        { label: "Mudah Beradaptasi", score: 5 }, 
        { label: "Bisa Beradaptasi", score: 3 }, 
        { label: "Sulit Beradaptasi", score: 2 }, 
        { label: "Tidak Mau Beradaptasi", score: 1 }
      ],
    },
    {
      content: "Apakah anda membutuhkan waktu untuk penyesuaian dengan rekan kerja?",
      type: QuestionType.SOFTSKILL,
      difficulty: "MEDIUM",
      category: "Adaptability", 
      categoryAnswer: [
        { label: "Saya tidak membutuhkan waktu untuk penyesuaian dengan rekan kerja", score: 5 },
        { label: "Saya membutuhkan waktu yang singkat untuk penyesuaian dengan rekan kerja", score: 3 },
        { label: "Saya membutuhkan waktu yang cukup lama untuk penyesuaian dengan rekan kerja", score: 2 },
        { label: "Saya tidak bisa beradaptasi dengan rekan kerja", score: 1 }
      ],
    },
    {
      content: "Bagaimana Anda menghadapi perubahan yang terjadi pada situasi kerja?",
      type: QuestionType.SOFTSKILL,
      difficulty: "MEDIUM",
      category: "Adaptability", 
      categoryAnswer: [
        { label: "Saya dapat menyesuaikan diri, percaya diri dengan perubahan", score: 5 },
        { label: "Saya biasa/cuek menyesuaikan diri dengan perubahan", score: 3 },
        { label: "Saya takut/grogi menyesuaikan diri dengan perubahan", score: 2 },
        { label: "Saya tidak bisa menyesuaikan diri dengan perubahan", score: 1 }
      ],
    },
    {
      content: "Bagaimana jika perusahaan membutuhkan skill yang diluar kemampuanmu, apakah kamu siap untuk belajar?",
      type: QuestionType.SOFTSKILL,
      difficulty: "MEDIUM",
      category: "Adaptability", 
      categoryAnswer: [
        { label: "Saya sangat siap untuk belajar dan mengembangkan skill baru", score: 5 },
        { label: "Saya siap untuk belajar dan mengembangkan skill baru", score: 3 },
        { label: "Saya kurang siap untuk belajar dan mengembangkan skill baru", score: 2 },
        { label: "Saya tidak siap untuk belajar dan mengembangkan skill baru", score: 1 }
      ],
    },
    {
      content: "Bagaimana cara anda menyampaikan pendapat dalam tim?",
      type: QuestionType.SOFTSKILL,
      difficulty: "MEDIUM",
      category: "Communication",
      categoryAnswer: [
        { label: "Saya sangat percaya diri dalam menyampaikan pendapat dalam tim", score: 5 },
        { label: "Saya percaya diri dalam menyampaikan pendapat dalam tim", score: 4 },
        { label: "Saya kurang percaya diri dalam menyampaikan pendapat dalam tim", score: 3 },
        { label: "Saya tidak percaya diri dalam menyampaikan pendapat dalam tim", score: 2 },
        { label: "Saya hanya diam tidak mau menyampaikan pendapat dalam tim", score: 1 }
      ],
    },
    {
      content: "Bagaimana cara anda menyampaikan pendapat kepada supervisor anda?",
      type: QuestionType.SOFTSKILL,
      difficulty: "MEDIUM",
      category: "Communication",
      categoryAnswer: [
        { label: "Saya sangat percaya diri dalam menyampaikan pendapat kepada supervisor saya", score: 5 },
        { label: "Saya percaya diri dalam menyampaikan pendapat kepada supervisor saya", score: 4 },
        { label: "Saya kurang percaya diri dalam menyampaikan pendapat kepada supervisor saya", score: 3 },
        { label: "Saya tidak percaya diri dalam menyampaikan pendapat kepada supervisor saya", score: 2 },
        { label: "Saya hanya diam tidak mau menyampaikan pendapat kepada supervisor saya", score: 1 }
      ],
    },
    {
      content: "bagaimana cara anda menyampaikan pendapat di depan umum?",
      type: QuestionType.SOFTSKILL,
      difficulty: "MEDIUM",
      category: "Communication",
      categoryAnswer: [
        { label: "Saya sangat percaya diri dalam menyampaikan pendapat di depan umum", score: 5 },
        { label: "Saya percaya diri dalam menyampaikan pendapat di depan umum", score: 4 },
        { label: "Saya kurang percaya diri dalam menyampaikan pendapat di depan umum", score: 3 },
        { label: "Saya tidak percaya diri dalam menyampaikan pendapat di depan umum", score: 2 },
        { label: "Saya hanya diam tidak mau menyampaikan pendapat di depan umum", score: 1 }
      ],
    },
    {
      content: "Seberapa yakin anda dapat menyelesaikan masalah yang menimpa anda?",
      type: QuestionType.SOFTSKILL,
      difficulty: "MEDIUM",
      category: "Problem Solving",
      categoryAnswer: [
        { label: "Saya sangat yakin dapat menyelesaikan masalah yang menimpa saya", score: 5 },
        { label: "Saya yakin dapat menyelesaikan masalah yang menimpa saya", score: 4 },
        { label: "Saya kurang yakin dapat menyelesaikan masalah yang menimpa saya", score: 3 },
        { label: "Saya tidak yakin dapat menyelesaikan masalah yang menimpa saya", score: 2 },
        { label: "Saya tidak dapat menyelesaikan masalah yang menimpa saya", score: 1 }
      ]
    },
    {
      content: "Apa langkah pertama jika anda dihadapkan dengan maslah baru yang belum pernah anda hadapi sebelumnya?",
      type: QuestionType.SOFTSKILL,
      difficulty: "MEDIUM",
      category: "Problem Solving",
      categoryAnswer: [
        { label: "Saya langsung mencari solusi", score: 5 },
        { label: "Saya membutuhkan waktu untuk berpikir", score: 3 },
        { label: "Saya langsung mencari pertolongan orang lain", score: 2 },
        { label: "Saya langsung menyerah/tidak melakukan apapun", score: 1 }
      ]
    },
    {
      content: "Situai tersulit apa yang pernah anda alami, bagaimana anda mengatasinya?",
      type: QuestionType.SOFTSKILL,
      difficulty: "MEDIUM",
      category: "Problem Solving",
      categoryAnswer: [
        { label: "Saya mengatasi masalah sendiri", score: 5 },
        { label: "Saya mencoba mengatasi masalah lalu meminta bantuan orang lain", score: 3 },
        { label: "Saya butuh bantuan orang lain untuk mengatasi masalah", score: 2 },
        { label: "Saya tidak melakukan apapun untuk mengatasi masalah", score: 1 }
      ]
    },
    {
      content: "Apakah anda yakin bahwa anda memiliki jiwa kepemimpinan yang kuat? Ceritakan pengalaman anda secara singkat dalam memimpin tim!",
      type: QuestionType.SOFTSKILL,
      difficulty: "MEDIUM",
      category: "Leadership",
      categoryAnswer: [
        { label: "Saya sangat yakin memiliki jiwa kepemimpinan yang kuat", score: 5 },
        { label: "Saya yakin memiliki jiwa kepemimpinan yang kuat", score: 4 },
        { label: "Saya kurang yakin memiliki jiwa kepemimpinan yang kuat", score: 3 },
        { label: "Saya tidak yakin memiliki jiwa kepemimpinan yang kuat", score: 2 },
        { label: "Saya tidak memiliki jiwa kepemimpinan yang kuat", score: 1 }
      ]
    },
    {
      content: "Bagaimana Anda membangkitkan semangat tim ketika menghadapi hambatan?",
      type: QuestionType.SOFTSKILL,
      difficulty: "MEDIUM",
      category: "Leadership",
      categoryAnswer: [
        { label: "Saya memberikan alternatif solusi dan memotivasi tim", score: 5 },
        { label: "Saya memberikan solusi namun sisanya terserah pada tim", score: 4 },
        { label: "Saya hanya memotivasi tim dan mengajak tim untuk mencari solusi bersama", score: 3 },
        { label: "Saya membagi beban tugas dengan tim", score: 2 },
        { label: "Saya tidak melakukan apa-apa untuk membangkitkan semangat tim", score: 1 }
      ]
    },
    {
      content: "Bagaimana sikap anda terkait saingan dan kompetitor anda?",
      type: QuestionType.SOFTSKILL,
      difficulty: "MEDIUM",
      category: "Leadership",
      categoryAnswer: [
        { label: "Saya melihat saingan sebagai motivasi untuk terus berkembang", score: 5 },
        { label: "Saya tidak terlalu memikirkan kompetitor", score: 3 },
        { label: "Saya merasa tersaingi ketika menghadapi kompetitor", score: 2 },
        { label: "Saya berusaha menjatuhkan kompetitor", score: 1 },
      ]
    },
    {
      content: "Seberapa sering anda memimpin sebuah tim atau kelompok?",
      type: QuestionType.SOFTSKILL,
      difficulty: "MEDIUM",
      category: "Leadership",
      categoryAnswer: [
        { label: "Saya sangat sering memimpin sebuah tim atau kelompok", score: 5 },
        { label: "Saya sering memimpin sebuah tim atau kelompok", score: 4 },
        { label: "Saya kadang-kadang memimpin sebuah tim atau kelompok", score: 3 },
        { label: "Saya jarang memimpin sebuah tim atau kelompok", score: 2 },
        { label: "Saya tidak pernah memimpin sebuah tim atau kelompok", score: 1 },
      ]
    },
    {
      content: "Bagaimana anda mengatur jadwal keseharian anda?",
      type: QuestionType.SOFTSKILL,
      difficulty: "MEDIUM",
      category: "Time Management",
      categoryAnswer: [
        { label: "Saya terbiasa mengatur jadwal keseharian saya", score: 5 },
        { label: "Saya hanya mengatur jadwal yang penting saja", score: 3 },
        { label: "Saya jarang mengatur jadwal keseharian saya", score: 2 },
        { label: "Saya tidak pernah mengatur jadwal keseharian saya", score: 1 },
      ]
    },
    {
      content: "Jika anda memiliki tugas yang sudah tenggat waktu, Apa yang anda lakukan?",
      type: QuestionType.SOFTSKILL,
      difficulty: "MEDIUM",
      category: "Time Management",
      categoryAnswer: [
        { label: "Saya berusaha menyelesaikan tugas tersebut tepat waktu", score: 5 },
        { label: "Saya mencoba menyelesaikan tugas tersebut lalu dikumpulkan seadanya", score: 3 },
        { label: "Saya terlambat dalam menyelesaikan tugas", score: 2 },
        { label: "Saya menyerah untuk menyelesaikan tugas tersebut", score: 1 },
      ]
    },
    {
      content: "Apakah anda suka menunda pekerjaan?",
      type: QuestionType.SOFTSKILL,
      difficulty: "MEDIUM",
      category: "Time Management",
      categoryAnswer: [
        { label: "Saya tidak pernah menunda pekerjaan dan selesai tepat waktu", score: 5 },
        { label: "Saya suka menunda pekerjaan tetapi selesai tepat waktu", score: 3 },
        { label: "Saya suka menunda pekerjaan dan terkadang tidak selesai tepat waktu", score: 2 },
        { label: "Saya suka menunda pekerjaan dan tidak selesai tepat waktu", score: 1 },
      ]
    },
    {
      content: "Bagaimana Anda menilai diri sendiri dibandingkan dengan teman-teman Anda dalam bidang yang Anda lamar saat ini?",
      type: QuestionType.SOFTSKILL,
      difficulty: "MEDIUM",
      category: "Self Confidence",
      categoryAnswer: [
        { label: "Saya sangat unggul dibandingkan teman-teman saya", score: 5 },
        { label: "Saya unggul dibandingkan teman-teman saya", score: 4 },
        { label: "Saya setara dengan teman-teman saya", score: 3 },
        { label: "Saya sedikit lebih buruk dibandingkan teman-teman saya", score: 2 },
        { label: "Saya jauh lebih buruk dibandingkan teman-teman saya", score: 1 },
      ]
    },
    {
      content: "Bagaimana sikap anda ketika melihat orang yang lebih ahli atau menguasai bidang yang anda lamar sekarang?",
      type: QuestionType.SOFTSKILL,
      difficulty: "MEDIUM",
      category: "Self Confidence",
      categoryAnswer: [
        { label: "Saya merasa termotivasi untuk belajar lebih banyak dan meningkatkan kemampuan saya", score: 5 },
        { label: "Saya merasa biasa saja dan tetap fokus pada pengembangan diri saya", score: 3 },
        { label: "Saya merasa minder dan kurang percaya diri dengan kemampuan saya", score: 2 },
        { label: "Saya merasa tidak percaya diri dan ragu untuk melamar pekerjaan di bidang ini", score: 1 },
      ]
    },
    {
      content: "Seberapa yakin anda menguasai materi terkait posisi yang anda lamar?",
      type: QuestionType.SOFTSKILL,
      difficulty: "MEDIUM",
      category: "Self Confidence",
      categoryAnswer: [
        { label: "Saya sangat yakin menguasai materi terkait posisi yang saya lamar", score: 5 },
        { label: "Saya yakin menguasai materi terkait posisi yang saya lamar", score: 4 },
        { label: "Saya kurang yakin menguasai materi terkait posisi yang saya lamar", score: 3 },
        { label: "Saya tidak yakin menguasai materi terkait posisi yang saya lamar", score: 2 },
        { label: "Saya tidak menguasai materi terkait posisi yang saya lamar", score: 1 },
      ]
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
