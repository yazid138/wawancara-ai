import prisma from "@/database/prisma";
import NotFoundException from "@/exception/NotFoundException";
import { QuestionType } from "@/prisma/enums";
import {
  classifySoftSkillAnswer,
  createEmbedding,
  generateTechnicalRubricScore,
} from "@/services/ai.service";
import { getSimilarityScore, addIdealAnswer } from "@/services/question.service";
import {
  clampConfidence,
  stringSimilarity,
  parseRubricNumber,
  buildCategoryOptions,
  retryIfLowConfidenceWithPrompt,
  buildTechnicalRubricPrompt,
  buildSoftSkillClassificationPrompt,
  calculateKeywordScore,
} from "@/utils";

const scoreTechnicalAnswer = async (answerId: number) => {
  const answer = await prisma.answer.findUnique({
    where: { id: answerId },
    include: {
      question: {
        include: {
          keywords: true,
        },
      },
    },
  });

  if (!answer) throw new NotFoundException("Answer tidak ditemukan");

  const userAnswer = answer.content;
  const keywords = answer.question.keywords;
  const questionId = answer.question.id;
  const questionText = answer.question.content;
  const keywordScore = calculateKeywordScore(userAnswer, keywords);

  let similarityScore = 0;

  if (userAnswer) {
    const userEmbedding = await createEmbedding(userAnswer);
    similarityScore = await getSimilarityScore(userEmbedding, questionId);
  }

  const retryHint = "Jawaban sebelumnya kurang meyakinkan. Berikan penilaian yang lebih konservatif dan fokus pada bukti eksplisit dari jawaban. Jika ragu, turunkan confidence dan jangan memaksakan skor tinggi.";
  const aiRubric = await retryIfLowConfidenceWithPrompt(
    () => generateTechnicalRubricScore(questionText, userAnswer),
    () => generateTechnicalRubricScore(questionText, userAnswer, retryHint),
    (isRetry) => buildTechnicalRubricPrompt(questionText, userAnswer, isRetry ? retryHint : undefined),
  );

  const aiRubricResult = aiRubric.result;
  const technicalPrompt = aiRubric.prompt;

  const pemahamanNum = parseRubricNumber(aiRubricResult.pemahaman);
  const teknisNum = parseRubricNumber(aiRubricResult.teknis);
  const logikaNum = parseRubricNumber(
    aiRubricResult.logika ??
      aiRubricResult.problema_solving ??
      aiRubricResult.problem_solving,
  );
  const komunikasiNum = parseRubricNumber(aiRubricResult.komunikasi);

  const rubricScore = Math.max(
    0,
    Math.min((pemahamanNum + teknisNum + logikaNum + komunikasiNum) / 20, 1),
  );

  const rubricConfidence = clampConfidence((aiRubricResult as any).confidence);
  const keywordCoverage = keywordScore;
  const similarityConfidence = similarityScore;

  const finalScoreRaw =
    rubricScore * 0.55 + similarityScore * 0.25 + keywordScore * 0.20;

  const finalScore = finalScoreRaw * 100;

  const evidenceAlignment =
    rubricScore * 0.55 + similarityConfidence * 0.25 + keywordCoverage * 0.20;

  const confidenceScore = Math.max(
    0,
    Math.min(
      rubricConfidence * 0.45 +
        evidenceAlignment * 0.45 +
        (finalScoreRaw >= 0.5 ? 0.1 : 0),
      1,
    ),
  );

  const reasonParts = [
    `Rubrik AI: pemahaman ${aiRubricResult.pemahaman ?? 0}/5, teknis ${aiRubricResult.teknis ?? 0}/5, logika ${aiRubricResult.logika ?? 0}/5, komunikasi ${aiRubricResult.komunikasi ?? 0}/5`,
    `Confidence rubrik AI: ${Math.round(rubricConfidence * 100)}%`,
    `Similarity vector: ${Math.round(similarityScore * 100)}%`,
    `Keyword coverage: ${Math.round(keywordScore * 100)}%`,
    aiRubricResult.alasan ? `Alasan AI: ${aiRubricResult.alasan}` : null,
  ].filter(Boolean);

  const feedback =
    finalScoreRaw > 0.7
      ? "Jawaban sangat baik"
      : finalScoreRaw > 0.4
        ? "Jawaban cukup baik"
        : "Jawaban perlu diperbaiki";

  const scoreResult = await prisma.score.upsert({
    where: { answerId },
    update: {
      type: QuestionType.TECHNICAL,
      rubricScore,
      similarityScore,
      keywordScore,
      finalScore,
      confidenceScore,
      feedback,
      reason: reasonParts.join(" | "),
      prompt: technicalPrompt,
    },
    create: {
      answerId,
      type: QuestionType.TECHNICAL,
      rubricScore,
      similarityScore,
      keywordScore,
      finalScore,
      confidenceScore,
      feedback,
      reason: reasonParts.join(" | "),
      prompt: technicalPrompt,
    },
  });

  // Promote to ideal answer if finalScore >= 80
  if (finalScore >= 80) {
    try {
      await addIdealAnswer(answer.questionId, answer.content);
      console.log(`[Auto-Promotion] High-scoring technical answer (ID: ${answerId}, Score: ${finalScore.toFixed(2)}) promoted to Ideal Answer.`);
    } catch (err: any) {
      console.error(`[Auto-Promotion Error] Failed to promote technical answer to Ideal Answer:`, err.message);
    }
  }

  return scoreResult;
};

const scoreSoftSkillAnswer = async (answerId: number) => {
  const answer = await prisma.answer.findUnique({
    where: { id: answerId },
    include: {
      question: {
        include: {
          categories: true,
          keywords: true,
        },
      },
    },
  });

  if (!answer) throw new NotFoundException("Answer tidak ditemukan");

  if (
    answer.question.type === QuestionType.GENERAL ||
    answer.question.type === QuestionType.INTRO ||
    answer.question.type === QuestionType.TECHNICAL
  ) {
    return null;
  }

  const categories = answer.question.categories;

  if (!categories.length) {
    return null;
  }

  let similarityScore = 0;
  let keywordScore = 0;
  if (answer.content) {
    const userEmbedding = await createEmbedding(answer.content);
    similarityScore = await getSimilarityScore(userEmbedding, answer.question.id);

    const keywords = answer.question.keywords || [];
    keywordScore = calculateKeywordScore(answer.content, keywords);
  }

  const retryHint = "Klasifikasi sebelumnya kurang yakin. Pilih kategori yang paling aman dan paling dekat dengan isi jawaban. Jangan membuat label baru, dan jika ragu pilih kategori yang paling umum namun masih relevan.";
  const categoryOptions = buildCategoryOptions(categories);
  const classificationWithPrompt = await retryIfLowConfidenceWithPrompt(
    () => classifySoftSkillAnswer(answer.question.content, answer.content, categoryOptions),
    () => classifySoftSkillAnswer(answer.question.content, answer.content, categoryOptions, retryHint),
    (isRetry) => buildSoftSkillClassificationPrompt(answer.question.content, answer.content, categoryOptions, isRetry ? retryHint : undefined),
  );

  const { classification, rubric } = classificationWithPrompt.result;
  const softSkillPrompt = classificationWithPrompt.prompt;

  // Find best matching category
  let bestCategory = categories.find(
    (category) =>
      category.label.toLowerCase() ===
      String(classification?.label || "").toLowerCase(),
  );

  // if no exact match, find most similar category
  if (!bestCategory && classification?.label) {
    const categoriesCopy = [...categories];
    categoriesCopy.push({ label: "Tidak ada kategori yang sesuai", score: 0 } as any);
    let maxSimilarity = 0;
    for (const cat of categoriesCopy) {
      const similarity = stringSimilarity(cat.label, classification.label);
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        bestCategory = cat;
      }
    }
  }

  // fallback if still not found
  if (!bestCategory) {
    bestCategory = {
      label: "Uncategorized",
      score: 0,
    } as any;
  }

  // TypeScript type guard
  const matchedCategory = bestCategory!;

  const maxCategoryScore = Math.max(
    ...categories.map((category) => category.score),
    1,
  );
  const categoryStrength = Math.max(
    0,
    Math.min(matchedCategory.score / maxCategoryScore, 1),
  );
  const aiConfidence = clampConfidence(classification?.confidence);
  const exactLabelMatch =
    matchedCategory.label.toLowerCase() ===
    String(classification?.label || "").toLowerCase();

  const reasonParts = [
    `Kategori terpilih: ${matchedCategory.label}`,
    `Bobot kategori: ${matchedCategory.score}`,
    `Keyakinan AI: ${Math.round(aiConfidence * 100)}%`,
    `Similarity vector: ${Math.round(similarityScore * 100)}%`,
    `Keyword coverage: ${Math.round(keywordScore * 100)}%`,
    classification?.alasan ? `Alasan AI: ${classification.alasan}` : null,
    exactLabelMatch
      ? "Label cocok persis dengan hasil klasifikasi"
      : "Label diambil dari kategori terdekat yang tersedia",
  ].filter(Boolean);

  const categoryScoreRaw = matchedCategory.score / maxCategoryScore;
  
  const finalScoreRaw = categoryScoreRaw * 0.70 + similarityScore * 0.15 + keywordScore * 0.15;
  
  const finalScore = finalScoreRaw * 100;

  const evidenceAlignment = categoryStrength * 0.70 + similarityScore * 0.15 + keywordScore * 0.15;

  const confidenceScore = Math.max(
    0,
    Math.min(
      aiConfidence * 0.45 +
        evidenceAlignment * 0.45 +
        (finalScoreRaw >= 0.5 ? 0.1 : 0),
      1,
    ),
  );

  const feedback =
    finalScoreRaw > 0.7
      ? "Jawaban sangat baik"
      : finalScoreRaw > 0.4
        ? "Jawaban cukup baik"
        : "Jawaban perlu diperbaiki";

  const scoreResult = await prisma.score.upsert({
    where: { answerId },
    update: {
      type: QuestionType.SOFTSKILL,
      categoryId: matchedCategory.id,
      categoryLabel: matchedCategory.label,
      finalScore,
      similarityScore,
      keywordScore,
      confidenceScore,
      feedback,
      reason: reasonParts.join(" | "),
      prompt: softSkillPrompt,
    },
    create: {
      answerId,
      type: QuestionType.SOFTSKILL,
      categoryId: matchedCategory.id,
      categoryLabel: matchedCategory.label,
      finalScore,
      similarityScore,
      keywordScore,
      confidenceScore,
      feedback,
      reason: reasonParts.join(" | "),
      prompt: softSkillPrompt,
    },
  });

  // Promote to ideal answer if finalScore >= 80
  if (finalScore >= 80) {
    try {
      await addIdealAnswer(answer.questionId, answer.content);
      console.log(`[Auto-Promotion] High-scoring softskill answer (ID: ${answerId}, Score: ${finalScore.toFixed(2)}) promoted to Ideal Answer.`);
    } catch (err: any) {
      console.error(`[Auto-Promotion Error] Failed to promote softskill answer to Ideal Answer:`, err.message);
    }
  }

  return scoreResult;
};

export default {
  scoreTechnicalAnswer,
  scoreSoftSkillAnswer,
};
