import prisma from "@/database/prisma";
import {
  classifySoftSkillAnswer,
  createEmbedding,
  generateTechnicalRubricScore,
} from "@/services/ai.service";
import qdrantService from "@/services/qdrant.service";
import pineconeService from "./pinecone.service";

const LOW_CONFIDENCE_THRESHOLD = 0.65;

const buildTechnicalRubricPrompt = (
  pertanyaan: string,
  jawaban: string,
  retryHint?: string,
): string => {
  return `Role:
Anda adalah penilai jawaban interview teknis dengan fokus pada kualitas isi.

Task:
Nilai jawaban menggunakan rubrik Pemahaman Konsep, Ketepatan Teknis, Logika Berpikir, dan Komunikasi Jawaban.

${retryHint ? `Tambahan instruksi:
${retryHint}

` : ""}

Data:
Pertanyaan: ${pertanyaan}
Jawaban: ${jawaban}

Format:
Kembalikan hanya JSON dengan format {"pemahaman": 0-5, "teknis": 0-5, "logika": 0-5, "komunikasi": 0-5, "confidence": 0-1, "alasan": "singkat"}.`;
};

const buildSoftSkillClassificationPrompt = (
  pertanyaan: string,
  jawaban: string,
  categories: Array<{ label: string; score: number }>,
  retryHint?: string,
): string => {
  return `Role:
Anda adalah classifier jawaban soft skill untuk interview.

Task:
Pilih satu kategori jawaban yang paling sesuai dari daftar kategori yang tersedia.

${retryHint ? `Tambahan instruksi:
${retryHint}

` : ""}

Data:
Pertanyaan: ${pertanyaan}
Jawaban: ${jawaban}
Kategori tersedia:
${categories
  .map((category, index) => `${index + 1}. ${category.label} (bobot: ${category.score})`)
  .join("\n")}

Format:
Kembalikan hanya JSON dengan format {"label": "kategori", "confidence": 0-1, "alasan": "singkat"}.
Pastikan label yang dikembalikan persis cocok dengan salah satu kategori yang tersedia.`;
};

const clampConfidence = (value: unknown) => {
  const confidence = parseConfidence(value);
  if (Number.isNaN(confidence)) {
    return 0;
  }

  return Math.max(0, Math.min(confidence, 1));
};

const parseConfidence = (value: unknown) => {
  if (value == null) return 0;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const match = value.match(/\d+(?:\.\d+)?/);
    if (!match) return 0;

    const parsed = Number(match[0]);
    if (!Number.isFinite(parsed)) return 0;

    // Accept values like "82%" or "82" as 0.82, while preserving 0-1 values.
    return parsed > 1 ? parsed / 100 : parsed;
  }

  if (typeof value === "object") {
    const candidate =
      (value as any).confidence ??
      (value as any).confidence_score ??
      (value as any).confidenceScore ??
      (value as any).keyakinan;

    return parseConfidence(candidate);
  }

  return 0;
};

const parseRubricNumber = (v: unknown) => {
  if (v == null) return 0;
  if (typeof v === "number") return Math.max(0, Math.min(v, 5));
  if (typeof v === "string") {
    // extract first number (e.g. "4", "4/5", "4.0")
    const m = v.match(/\d+(?:\.\d+)?/);
    if (m) return Math.max(0, Math.min(Number(m[0]), 5));
    return 0;
  }
  return 0;
};

const pickBetterResult = <T extends { confidence?: number }>(current: T, next: T) => {
  const currentConfidence = clampConfidence(current.confidence);
  const nextConfidence = clampConfidence(next.confidence);

  return nextConfidence > currentConfidence ? next : current;
};

const buildCategoryOptions = (
  categories: Array<{ label: string; score: number }>,
) => categories.map((category) => ({ label: category.label, score: category.score }));

const retryIfLowConfidenceWithPrompt = async <T extends { confidence?: number }>(
  request: () => Promise<T>,
  retryRequest: () => Promise<T>,
  getPrompt: (isRetry: boolean) => string,
): Promise<{ result: T; prompt: string }> => {
  const firstResult = await request();
  const firstConfidence = clampConfidence((firstResult as any)?.confidence);

  if (firstConfidence >= LOW_CONFIDENCE_THRESHOLD) {
    return { result: firstResult, prompt: getPrompt(false) };
  }

  const retryResult = await retryRequest();
  const betterResult = pickBetterResult(firstResult, retryResult);
  const isRetry = betterResult === retryResult;
  
  return { result: betterResult, prompt: getPrompt(isRetry) };
};

const retryIfLowConfidence = async <T extends { confidence?: number }>(
  request: () => Promise<T>,
  retryRequest: () => Promise<T>,
) => {
  const firstResult = await request();
  const firstConfidence = clampConfidence((firstResult as any)?.confidence);

  if (firstConfidence >= LOW_CONFIDENCE_THRESHOLD) {
    return firstResult;
  }

  return pickBetterResult(firstResult, await retryRequest());
};

const normalizeText = (text: string) =>
  text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ");

const stringSimilarity = (s1: string, s2: string): number => {
  const a = String(s1 || "").toLowerCase().trim();
  const b = String(s2 || "").toLowerCase().trim();

  if (a === b) return 1;
  if (!a || !b) return 0;

  // check if one is a substring of the other
  if (a.includes(b) || b.includes(a)) return 0.9;

  // split into words and check overlap
  const aWords = new Set(a.split(/\s+/));
  const bWords = new Set(b.split(/\s+/));
  const intersection = new Set([...aWords].filter((w) => bWords.has(w)));
  const union = new Set([...aWords, ...bWords]);

  return union.size > 0 ? intersection.size / union.size : 0;
};

const hasWholeWord = (text: string, keyword: string) => {
  const normText = normalizeText(String(text || ""));
  const normKeyword = normalizeText(String(keyword || "")).trim();
  if (!normKeyword) return false;

  // try exact whole word match
  const escaped = normKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const wholeWordPattern = new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, "u");
  if (wholeWordPattern.test(normText)) return true;

  // fallback: substring match
  if (normText.includes(normKeyword)) return true;

  // fallback: if keyword has multiple words, check all words exist in text
  const parts = normKeyword.split(/\s+/).filter(Boolean);
  if (parts.length > 1 && parts.every((p) => normText.includes(p))) return true;

  return false;
};

const searchVector = async (userEmbedding: number[], questionId: number) => {
  const idealAnswers = await prisma.idealAnswer.findMany({
      where: { questionId }
    });

    if (idealAnswers.length > 0) {
      let maxSim = 0;
      for (const ia of idealAnswers) {
        const iaEmb = ia.embedding as number[];
        if (Array.isArray(iaEmb) && iaEmb.length === userEmbedding.length) {
          let dotProduct = 0;
          let normA = 0;
          let normB = 0;
          for (let i = 0; i < userEmbedding.length; i++) {
            dotProduct += userEmbedding[i] * iaEmb[i];
            normA += userEmbedding[i] * userEmbedding[i];
            normB += iaEmb[i] * iaEmb[i];
          }
          if (normA > 0 && normB > 0) {
            const sim = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
            if (sim > maxSim) maxSim = sim;
          }
        }
      }
      return Math.max(0, Math.min(maxSim, 1));
    }
    return 0;
}

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

  if (!answer) throw new Error("Answer tidak ditemukan");

  const userAnswer = answer.content;
  const keywords = answer.question.keywords;
  const questionId = answer.question.id;
  const questionText = answer.question.content;
  const normalizedAnswer = normalizeText(userAnswer);
  const coreKeywords = [...keywords]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, Math.min(5, keywords.length));

  let matchedWeight = 0;
  let totalCoreWeight = 0;
  let matchedCount = 0;

  for (const k of coreKeywords) {
    totalCoreWeight += k.weight;
    if (hasWholeWord(normalizedAnswer, normalizeText(k.word))) {
      matchedWeight += k.weight;
      matchedCount += 1;
    }
  }

  const weightCoverage = totalCoreWeight ? matchedWeight / totalCoreWeight : 0;
  const countCoverage = coreKeywords.length ? matchedCount / coreKeywords.length : 0;
  const keywordScore = Math.min(1, weightCoverage * 0.7 + countCoverage * 0.3);

  let similarityScore = 0;

  if (userAnswer) {
    const userEmbedding = await createEmbedding(userAnswer);
    similarityScore = await searchVector(userEmbedding, questionId);
  }

  const aiRubric = await retryIfLowConfidenceWithPrompt(
    () => generateTechnicalRubricScore(questionText, userAnswer),
    () =>
      generateTechnicalRubricScore(
        questionText,
        userAnswer,
        "Jawaban sebelumnya kurang meyakinkan. Berikan penilaian yang lebih konservatif dan fokus pada bukti eksplisit dari jawaban. Jika ragu, turunkan confidence dan jangan memaksakan skor tinggi.",
      ),
    (isRetry) => buildTechnicalRubricPrompt(
      questionText,
      userAnswer,
      isRetry ? "Jawaban sebelumnya kurang meyakinkan. Berikan penilaian yang lebih konservatif dan fokus pada bukti eksplisit dari jawaban. Jika ragu, turunkan confidence dan jangan memaksakan skor tinggi." : undefined
    ),
  );
  
  const aiRubricResult = aiRubric.result;
  const technicalPrompt = aiRubric.prompt;
  
  const pemahamanNum = parseRubricNumber(aiRubricResult.pemahaman);
  const teknisNum = parseRubricNumber(aiRubricResult.teknis);
  const logikaNum = parseRubricNumber(aiRubricResult.logika ?? aiRubricResult.problema_solving ?? aiRubricResult.problem_solving);
  const komunikasiNum = parseRubricNumber(aiRubricResult.komunikasi);

  const rubricScore = Math.max(
    0,
    Math.min((pemahamanNum + teknisNum + logikaNum + komunikasiNum) / 20, 1),
  );

  const rubricConfidence = clampConfidence((aiRubricResult as any).confidence);
  const keywordCoverage = keywordScore;
  const similarityConfidence = similarityScore;

  const finalScoreRaw =
    rubricScore * 0.4 +
    similarityScore * 0.3 +
    keywordScore * 0.3;

  const finalScore = finalScoreRaw * 100;

  const evidenceAlignment =
    rubricScore * 0.5 + similarityConfidence * 0.25 + keywordCoverage * 0.25;

  const confidenceScore = Math.max(
    0,
    Math.min(
      rubricConfidence * 0.45 + evidenceAlignment * 0.45 + (finalScoreRaw >= 0.5 ? 0.1 : 0),
      1,
    ),
  );

  const reasonParts = [
    `Rubrik AI: pemahaman ${(aiRubricResult.pemahaman ?? 0)}/5, teknis ${(aiRubricResult.teknis ?? 0)}/5, logika ${(aiRubricResult.logika ?? 0)}/5, komunikasi ${(aiRubricResult.komunikasi ?? 0)}/5`,
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

  return prisma.scoreTechnical.upsert({
    where: { answerId },
    update: {
      rubricScore,
      similarityScore,
      keywordScore,
      finalScore,
      confidenceScore,
      feedback,
      prompt: technicalPrompt,
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
      prompt: technicalPrompt,
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

  const firstClassification = await classifySoftSkillAnswer(
    answer.question.content,
    answer.content,
    categories.map((category) => ({
      label: category.label,
      score: category.score,
    })),
  );

  const categoryOptions = buildCategoryOptions(categories);
  const classificationWithPrompt = await retryIfLowConfidenceWithPrompt(
    () =>
      classifySoftSkillAnswer(
        answer.question.content,
        answer.content,
        categoryOptions,
      ),
    () =>
      classifySoftSkillAnswer(
        answer.question.content,
        answer.content,
        categoryOptions,
        "Klasifikasi sebelumnya kurang yakin. Pilih kategori yang paling aman dan paling dekat dengan isi jawaban. Jangan membuat label baru, dan jika ragu pilih kategori yang paling umum namun masih relevan.",
      ),
    (isRetry) => buildSoftSkillClassificationPrompt(
      answer.question.content,
      answer.content,
      categoryOptions,
      isRetry ? "Klasifikasi sebelumnya kurang yakin. Pilih kategori yang paling aman dan paling dekat dengan isi jawaban. Jangan membuat label baru, dan jika ragu pilih kategori yang paling umum namun masih relevan." : undefined
    ),
  );

  const classification = classificationWithPrompt.result;
  const softSkillPrompt = classificationWithPrompt.prompt;

  // Find best matching category
  let bestCategory = categories.find(
    (category) =>
      category.label.toLowerCase() ===
      String(classification?.label || "").toLowerCase(),
  );

  // if no exact match, find most similar category
  if (!bestCategory && classification?.label) {
    let maxSimilarity = 0;
    for (const cat of categories) {
      const similarity = stringSimilarity(cat.label, classification.label);
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        bestCategory = cat;
      }
    }
  }

  // fallback if still not found
  if (!bestCategory) {
    bestCategory = { id: 0, label: "Uncategorized", score: 0, questionId: answer.question.id } as any;
  }

  // TypeScript type guard
  const matchedCategory = bestCategory!;

  const maxCategoryScore = Math.max(...categories.map((category) => category.score), 1);
  const categoryStrength = Math.max(0, Math.min(matchedCategory.score / maxCategoryScore, 1));
  const aiConfidence = clampConfidence(classification?.confidence);
  const exactLabelMatch =
    matchedCategory.label.toLowerCase() ===
    String(classification?.label || "").toLowerCase();

  const confidenceScore = Math.max(
    0,
    Math.min(
      aiConfidence * 0.6 + categoryStrength * 0.3 + (exactLabelMatch ? 0.1 : 0),
      1,
    ),
  );

  const reasonParts = [
    `Kategori terpilih: ${matchedCategory.label}`,
    `Bobot kategori: ${matchedCategory.score}`,
    `Keyakinan AI: ${Math.round(aiConfidence * 100)}%`,
    classification?.alasan ? `Alasan AI: ${classification.alasan}` : null,
    exactLabelMatch ? "Label cocok persis dengan hasil klasifikasi" : "Label diambil dari kategori terdekat yang tersedia",
  ].filter(Boolean);

  return prisma.scoreSoftSkill.upsert({
    where: { answerId },
    update: {
      categoryId: matchedCategory.id,
      categoryLabel: matchedCategory.label,
      finalScore: matchedCategory.score,
      confidenceScore,
      reason: reasonParts.join(" | "),
      prompt: softSkillPrompt,
    },
    create: {
      answerId,
      categoryId: matchedCategory.id,
      categoryLabel: matchedCategory.label,
      finalScore: matchedCategory.score,
      confidenceScore,
      reason: reasonParts.join(" | "),
      prompt: softSkillPrompt,
    },
  });
};

export default {
  scoreTechnicalAnswer,
  scoreSoftSkillAnswer
};