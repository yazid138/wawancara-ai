import "dotenv/config";
import prisma from "@/database/prisma";
import { QuestionType } from "@/prisma/client";
import aiService from "@/services/ai.service";

/**
 * Memastikan ada minimal 1 company dan 1 position di database.
 * Jika belum ada, akan dibuat.
 */
export const ensureCompanyAndPosition = async () => {
  let company = await prisma.company.findFirst();
  if (!company) {
    company = await prisma.company.create({
      data: { name: "Test Company E2E" },
    });
    console.log("  [seed] Created company:", company.name);
  }

  let position = await prisma.position.findFirst({
    where: { companyId: company.id },
  });
  if (!position) {
    position = await prisma.position.create({
      data: { name: "Backend Developer", companyId: company.id },
    });
    console.log("  [seed] Created position:", position.name);
  }

  return { company, position };
};

/**
 * Memastikan ada cukup question di database.
 * Flow interview: INTRO(1) + GENERAL(1) + SOFTSKILL(<=9, 3/category) + TECHNICAL(3)
 * Minimal: 1 GENERAL, 6 SOFTSKILL (2 kategori × 3), 3 TECHNICAL
 */
export const ensureQuestions = async () => {
  const counts = await prisma.question.groupBy({
    by: ["type"],
    _count: { id: true },
  });

  const countMap: Record<string, number> = {};
  for (const c of counts) {
    countMap[c.type] = c._count.id;
  }

  console.log("  [seed] Existing question counts:", countMap);

  // Helper: buat atau skip question
  const createQuestion = async (q: {
    content: string;
    type: QuestionType;
    difficulty: string;
    categoryName: string;
    categoryAnswer?: { label: string; score: number }[];
  }) => {
    const existing = await prisma.question.findFirst({
      where: { content: q.content },
    });
    if (existing) return existing;

    // Pastikan category ada
    let category = await prisma.questionCategory.findFirst({
      where: { name: q.categoryName },
    });
    if (!category) {
      category = await prisma.questionCategory.create({
        data: { name: q.categoryName },
      });
    }

    console.log(`  [seed] Creating question: "${q.content.substring(0, 50)}..."`);

    const question = await prisma.question.create({
      data: {
        content: q.content,
        type: q.type,
        difficulty: q.difficulty,
        categoryId: category.id,
      },
    });

    // Generate keywords
    try {
      const keywords = await aiService.generateKeyword(q.content);
      await prisma.keyword.createMany({
        data: keywords.map((word: string) => ({
          questionId: question.id,
          word,
        })),
      });
    } catch (e) {
      console.warn("  [seed] Warning: gagal generate keyword:", e);
    }

    // Untuk SOFTSKILL: buat answer categories & ideal answers
    if (q.type === QuestionType.SOFTSKILL) {
      const answerCategories = q.categoryAnswer || (await aiService.generateAnswerCategories(q.content)) || [];

      const createdCategories = await prisma.answerCategory.createManyAndReturn({
        data: answerCategories.map((cat) => ({
          questionId: question.id,
          label: cat.label,
          score: cat.score,
        })),
      });

      // Generate ideal answer per answer category
      for (const cat of createdCategories) {
        try {
          const idealAnswer = await aiService.generateIdealAnswer(q.content, cat.label);
          const embedding = await aiService.createEmbedding(idealAnswer);
          await prisma.$queryRaw`
            INSERT INTO "IdealAnswer" ("questionId", "answerCategoryId", "content", "embedding", "createdAt", "updatedAt") 
            VALUES (${question.id}, ${cat.id}, ${idealAnswer}, ${`[${embedding.join(",")}]`}::vector, NOW(), NOW())
          `;
        } catch (e) {
          console.warn("  [seed] Warning: gagal generate ideal answer:", e);
        }
      }
    }

    // Untuk TECHNICAL: buat 3 ideal answers
    if (q.type === QuestionType.TECHNICAL) {
      for (let i = 0; i < 3; i++) {
        try {
          const idealAnswer = await aiService.generateIdealAnswer(q.content);
          const embedding = await aiService.createEmbedding(idealAnswer);
          await prisma.$queryRaw`
            INSERT INTO "IdealAnswer" ("questionId", "answerCategoryId", "content", "embedding", "createdAt", "updatedAt") 
            VALUES (${question.id}, ${null}, ${idealAnswer}, ${`[${embedding.join(",")}]`}::vector, NOW(), NOW())
          `;
        } catch (e) {
          console.warn("  [seed] Warning: gagal generate ideal answer technical:", e);
        }
      }
    }

    return question;
  };

  // Pastikan minimal ada 1 GENERAL question
  if (!countMap["GENERAL"] || countMap["GENERAL"] < 1) {
    await createQuestion({
      content: "Mengapa Anda ingin bekerja di perusahaan ini?",
      type: QuestionType.GENERAL,
      difficulty: "EASY",
      categoryName: "Motivation",
    });
  }

  // Pastikan ada SOFTSKILL question (minimal 2 kategori × 3 soal = 6)
  if (!countMap["SOFTSKILL"] || countMap["SOFTSKILL"] < 6) {
    const softskillQuestions = [
      {
        content: "Bagaimana anda menyesuaikan diri dengan aturan yang berlaku di tempat kerja?",
        type: QuestionType.SOFTSKILL,
        difficulty: "MEDIUM",
        categoryName: "Adaptability",
        categoryAnswer: [
          { label: "Mudah Beradaptasi", score: 5 },
          { label: "Bisa Beradaptasi", score: 3 },
          { label: "Sulit Beradaptasi", score: 2 },
          { label: "Tidak Mau Beradaptasi", score: 1 },
        ],
      },
      {
        content: "Apakah anda membutuhkan waktu untuk penyesuaian dengan rekan kerja?",
        type: QuestionType.SOFTSKILL,
        difficulty: "MEDIUM",
        categoryName: "Adaptability",
        categoryAnswer: [
          { label: "Tidak membutuhkan waktu penyesuaian", score: 5 },
          { label: "Membutuhkan waktu singkat", score: 3 },
          { label: "Membutuhkan waktu cukup lama", score: 2 },
          { label: "Tidak bisa beradaptasi", score: 1 },
        ],
      },
      {
        content: "Bagaimana Anda menghadapi perubahan yang terjadi pada situasi kerja?",
        type: QuestionType.SOFTSKILL,
        difficulty: "MEDIUM",
        categoryName: "Adaptability",
        categoryAnswer: [
          { label: "Dapat menyesuaikan diri dengan percaya diri", score: 5 },
          { label: "Biasa menyesuaikan diri", score: 3 },
          { label: "Takut menyesuaikan diri", score: 2 },
          { label: "Tidak bisa menyesuaikan diri", score: 1 },
        ],
      },
      {
        content: "Bagaimana cara anda menyampaikan pendapat dalam tim?",
        type: QuestionType.SOFTSKILL,
        difficulty: "MEDIUM",
        categoryName: "Communication",
        categoryAnswer: [
          { label: "Sangat percaya diri dalam menyampaikan pendapat", score: 5 },
          { label: "Percaya diri dalam menyampaikan pendapat", score: 4 },
          { label: "Kurang percaya diri", score: 3 },
          { label: "Tidak percaya diri", score: 2 },
          { label: "Diam tidak mau berpendapat", score: 1 },
        ],
      },
      {
        content: "Bagaimana cara anda menyampaikan pendapat kepada atasan anda?",
        type: QuestionType.SOFTSKILL,
        difficulty: "MEDIUM",
        categoryName: "Communication",
        categoryAnswer: [
          { label: "Sangat percaya diri dalam menyampaikan pendapat ke atasan", score: 5 },
          { label: "Percaya diri ke atasan", score: 4 },
          { label: "Kurang percaya diri ke atasan", score: 3 },
          { label: "Tidak percaya diri ke atasan", score: 2 },
          { label: "Tidak mau berpendapat ke atasan", score: 1 },
        ],
      },
      {
        content: "Bagaimana cara anda menyampaikan pendapat di depan umum?",
        type: QuestionType.SOFTSKILL,
        difficulty: "MEDIUM",
        categoryName: "Communication",
        categoryAnswer: [
          { label: "Sangat percaya diri di depan umum", score: 5 },
          { label: "Percaya diri di depan umum", score: 4 },
          { label: "Kurang percaya diri di depan umum", score: 3 },
          { label: "Tidak percaya diri di depan umum", score: 2 },
          { label: "Tidak mau berbicara di depan umum", score: 1 },
        ],
      },
    ];

    for (const q of softskillQuestions) {
      await createQuestion(q);
    }
  }

  // Pastikan ada TECHNICAL question (minimal 3)
  if (!countMap["TECHNICAL"] || countMap["TECHNICAL"] < 3) {
    const technicalQuestions = [
      {
        content: "Apa itu REST API dan bagaimana cara kerjanya?",
        type: QuestionType.TECHNICAL,
        difficulty: "MEDIUM",
        categoryName: "Backend",
      },
      {
        content: "Apa itu JWT dan bagaimana cara menggunakannya untuk autentikasi?",
        type: QuestionType.TECHNICAL,
        difficulty: "MEDIUM",
        categoryName: "Security",
      },
      {
        content: "Jelaskan apa itu database indexing dan manfaatnya.",
        type: QuestionType.TECHNICAL,
        difficulty: "MEDIUM",
        categoryName: "Database",
      },
    ];

    for (const q of technicalQuestions) {
      await createQuestion(q);
    }
  }

  const finalCounts = await prisma.question.groupBy({
    by: ["type"],
    _count: { id: true },
  });
  console.log("  [seed] Final question counts:", 
    finalCounts.reduce((acc, c) => ({ ...acc, [c.type]: c._count.id }), {})
  );
};

/**
 * Hapus data user test dan interview yang dibuat selama pengujian
 */
export const cleanupTestUser = async (username: string) => {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return;

  // Hapus semua interview user (cascade ke answers, chatHistories, focusQuestions)
  const interviews = await prisma.interview.findMany({ where: { userId: user.id } });
  for (const interview of interviews) {
    await prisma.chatHistory.deleteMany({ where: { interviewId: interview.id } });
    await prisma.focusQuestion.deleteMany({ where: { interviewId: interview.id } });

    const answers = await prisma.answer.findMany({ where: { interviewId: interview.id } });
    for (const answer of answers) {
      await prisma.score.deleteMany({ where: { answerId: answer.id } });
    }
    await prisma.answer.deleteMany({ where: { interviewId: interview.id } });
    await prisma.interview.delete({ where: { id: interview.id } });
  }

  await prisma.user.delete({ where: { id: user.id } });
  console.log("  [cleanup] Deleted test user:", username);
};
