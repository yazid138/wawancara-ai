import prisma from "@/database/prisma";

const scoreAnswer = async (answerId: number) => {
  const answer = await prisma.answer.findUnique({
    where: { id: answerId },
    include: {
      question: {
        include: {
          keywords: true,
          idealAnswer: true,
          categories: true,
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

  
  const result = await prisma.scoreTechnical.upsert({
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

  return result;
};

export default {
  scoreAnswer,
};