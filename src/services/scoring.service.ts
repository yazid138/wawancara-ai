import prisma from "@/database/prisma";

const scoreTechnicalAnswer = async (answerId: number) => {
  const answer = await prisma.answer.findUnique({
    where: { id: answerId },
    include: {
      question: {
        include: {
          keywords: true,
          idealAnswer: true,
        },
      },
    },
  });

  if (!answer) throw new Error("Answer tidak ditemukan");

  const userAnswer = answer.content;
  const keywords = answer.question.keywords;
  const ideal = answer.question.idealAnswer?.content || "";

  let keywordScore = 0;
  let totalWeight = 0;

  for (const k of keywords) {
    totalWeight += k.weight;
    if (userAnswer.toLowerCase().includes(k.word.toLowerCase())) {
      keywordScore += k.weight;
    }
  }

  keywordScore = totalWeight ? keywordScore / totalWeight : 0;

  const similarityScore = userAnswer && ideal
    ? Math.min(userAnswer.length / ideal.length, 1)
    : 0;

  const rubricScore = Math.min(userAnswer.length / 100, 1);

  const finalScore =
    rubricScore * 0.4 +
    similarityScore * 0.3 +
    keywordScore * 0.3;

  const confidenceScore = (rubricScore + similarityScore + keywordScore) / 3;

  const feedback =
    finalScore > 0.7
      ? "Jawaban sangat baik"
      : finalScore > 0.4
      ? "Jawaban cukup baik"
      : "Jawaban perlu diperbaiki";

  return prisma.scoreTechnical.upsert({
    where: { answerId },
    update: {
      rubricScore,
      similarityScore,
      keywordScore,
      finalScore,
      confidenceScore,
      feedback,
      breakdown: {
        rubricScore,
        similarityScore,
        keywordScore,
      },
    },
    create: {
      answerId,
      rubricScore,
      similarityScore,
      keywordScore,
      finalScore,
      confidenceScore,
      feedback,
      breakdown: {
        rubricScore,
        similarityScore,
        keywordScore,
      },
    },
  });
};

const scoreSoftSkillAnswer = async (answerId: number) => {
  const answer = await prisma.answer.findUnique({
    where: { id: answerId },
    include: {
      question: {
        include: {
          categories: true,
        },
      },
    },
  });

  if (!answer) throw new Error("Answer tidak ditemukan");

  const categories = answer.question.categories;

  if (!categories.length) {
    return null;
  }

  const userAnswer = answer.content.toLowerCase();

  let bestCategory = categories.find((cat) =>
    userAnswer.includes(cat.label.toLowerCase())
  );

  if (!bestCategory) {
    bestCategory = categories[0];
  }

  return prisma.scoreSoftSkill.upsert({
    where: { answerId },
    update: {
      categoryId: bestCategory.id,
      categoryLabel: bestCategory.label,
      finalScore: bestCategory.score,
      confidenceScore: 0.7,
      reason: "Matched by keyword",
    },
    create: {
      answerId,
      categoryId: bestCategory.id,
      categoryLabel: bestCategory.label,
      finalScore: bestCategory.score,
      confidenceScore: 0.7,
      reason: "Matched by keyword",
    },
  });
};

export default {
  scoreTechnicalAnswer,
  scoreSoftSkillAnswer
};