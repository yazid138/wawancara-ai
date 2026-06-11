import prisma from "@/database/prisma";
import NotFoundException from "@/exception/NotFoundException";
import { QuestionType } from "@/prisma/enums";
import {
  classifySoftSkillAnswer,
  createEmbedding,
  generateSoftSkillRubricScore,
  generateTechnicalRubricScore,
  buildSoftSkillClassificationPrompt,
  buildSoftSkillRubricPrompt,
  buildTechnicalRubricPrompt,
} from "@/services/ai.service";
import {
  addIdealAnswer,
  getTop3SimilarityAverage,
  getTop3SimilarityAverageByCategory,
} from "@/services/question.service";
import {
  buildCategoryOptions,
  calculateKeywordScore,
  clampConfidence,
  parseRubricNumber,
  retryIfLowConfidenceWithPrompt,
  stringSimilarity,
} from "@/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SoftSkillRubric {
  communication: number;
  selfAwareness: number;
  behaviorEvidence: number;
  growthMindset: number;
}

interface SoftSkillBreakdown {
  rubric: SoftSkillRubric & { rubricScore: number };
  categoryScore: number;
  similarityScore: number;
  keywordScore: number;
  aiReason: string;
}

interface TechnicalRubric {
  understanding: number;
  technicalAccuracy: number;
  problemSolving: number;
  technicalCommunication: number;
}

interface TechnicalBreakdown {
  rubric: TechnicalRubric & { rubricScore: number };
  similarityScore: number;
  keywordScore: number;
  aiReason: string;
}

// ---------------------------------------------------------------------------
// Technical scoring
//
// Formula:
//   finalScore (0–100) =
//     rubricScore    × 0.50   (understanding + technicalAccuracy + problemSolving + technicalCommunication / 20)
//     similarityScore× 0.30   (top-3 pgvector cosine similarity average)
//     keywordScore   × 0.20   (matchedWeight / totalWeight)
//
//   confidenceScore = (aiConfidence + similarityScore + keywordScore) / 3
// ---------------------------------------------------------------------------

const scoreTechnicalAnswer = async (answerId: number) => {
  // ── 1. Load answer with question context ────────────────────────────────
  const answer = await prisma.answer.findUnique({
    where: { id: answerId },
    include: {
      question: {
        include: {
          category: true,
          keywords: true,
        },
      },
    },
  });

  if (!answer) throw new NotFoundException("Answer tidak ditemukan");

  // ── 2. Guard: skip non-technical question types ──────────────────────────
  const qType = answer.question.type;
  if (qType === QuestionType.INTRO || qType === QuestionType.GENERAL || qType === QuestionType.SOFTSKILL) {
    return null;
  }

  const userAnswer = answer.content;
  const keywords = answer.question.keywords;
  const questionId = answer.question.id;
  const questionText = answer.question.content;
  const questionCategoryName = answer.question.category?.name;

  // ── 3. Keyword score ─────────────────────────────────────────────────────
  // Range: 0–1  (matchedWeight / totalWeight)
  const keywordScore = calculateKeywordScore(userAnswer, keywords);

  // ── 4. Similarity score (top-3 average via pgvector) ────────────────────
  // Range: 0–1  average(top3 cosine similarity against ReferenceAnswers)
  const userEmbedding = await createEmbedding(userAnswer);
  const similarityScore = userAnswer ? await getTop3SimilarityAverage(userEmbedding, questionId) : 0;

  // ── 5. Rubric scoring (with retry if confidence < 0.70) ─────────────────
  const retryHint =
    "Penilaian sebelumnya kurang yakin. Fokus pada bukti teknis eksplisit dalam jawaban. Jangan memberikan skor tinggi tanpa justifikasi yang jelas.";

  const aiRubric = await retryIfLowConfidenceWithPrompt(
    () => generateTechnicalRubricScore(questionText, userAnswer, questionCategoryName),
    () => generateTechnicalRubricScore(questionText, userAnswer, questionCategoryName, retryHint),
    (isRetry) =>
      buildTechnicalRubricPrompt(
        questionText,
        userAnswer,
        questionCategoryName,
        isRetry ? retryHint : undefined,
      ),
  );

  const aiRubricResult = aiRubric.result;
  const technicalPrompt = aiRubric.prompt;

  // ── 6. Parse rubric sub-scores (1–5 each) ───────────────────────────────
  const understandingNum       = parseRubricNumber(aiRubricResult.understanding);
  const technicalAccuracyNum   = parseRubricNumber(aiRubricResult.technicalAccuracy);
  const problemSolvingNum      = parseRubricNumber(aiRubricResult.problemSolving);
  const technicalCommNum       = parseRubricNumber(aiRubricResult.technicalCommunication);

  // rubricScore = (sum of 4 criteria) / 20  → range 0–1
  const rubricScore = Math.max(
    0,
    Math.min(
      (understandingNum + technicalAccuracyNum + problemSolvingNum + technicalCommNum) / 20,
      1,
    ),
  );

  // ── 7. Final score (0–100) ───────────────────────────────────────────────
  // rubricScore*0.50 + similarityScore*0.30 + keywordScore*0.20
  const finalScoreRaw =
    rubricScore * 0.5 + similarityScore * 0.3 + keywordScore * 0.2;

  const finalScore = Math.max(0, Math.min(finalScoreRaw * 100, 100));

  // ── 8. Confidence score (0–1) ────────────────────────────────────────────
  // (aiConfidence + similarityScore + keywordScore) / 3
  const aiConfidence = clampConfidence(aiRubricResult.confidence);
  const confidenceScore = Math.max(
    0,
    Math.min(
      (aiConfidence + similarityScore + keywordScore) / 3,
      1,
    ),
  );

  // ── 9. Feedback text ─────────────────────────────────────────────────────
  const feedback =
    finalScore >= 75
      ? "Jawaban sangat baik"
      : finalScore >= 50
        ? "Jawaban cukup baik"
        : "Jawaban perlu diperbaiki";

  // ── 10. Build breakdown ──────────────────────────────────────────────────
  const breakdown: TechnicalBreakdown = {
    rubric: {
      understanding:          understandingNum,
      technicalAccuracy:      technicalAccuracyNum,
      problemSolving:         problemSolvingNum,
      technicalCommunication: technicalCommNum,
      rubricScore:            Math.round(rubricScore * 100) / 100,
    },
    similarityScore: Math.round(similarityScore * 100) / 100,
    keywordScore:    Math.round(keywordScore    * 100) / 100,
    aiReason:        aiRubricResult.reason ?? "",
  };

  const reasonParts = [
    `Rubrik AI: understanding ${understandingNum}/5, technicalAccuracy ${technicalAccuracyNum}/5, problemSolving ${problemSolvingNum}/5, technicalCommunication ${technicalCommNum}/5`,
    `AI confidence: ${Math.round(aiConfidence * 100)}%`,
    `Similarity (top-3 avg): ${Math.round(similarityScore * 100)}%`,
    `Keyword coverage: ${Math.round(keywordScore * 100)}%`,
    aiRubricResult.reason ? `Alasan AI: ${aiRubricResult.reason}` : null,
  ].filter(Boolean);

  // ── 11. Persist score (upsert) ───────────────────────────────────────────
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
      breakdown: breakdown as any,
      promptRubric: technicalPrompt,
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
      breakdown: breakdown as any,
      promptRubric: technicalPrompt,
    },
  });

  // const existingSimilarity = userEmbedding ? await getTop3SimilarityAverage(
  //   userEmbedding,
  //   answer.question.id,
  // ) : 0;

  // ── 12. Auto-promotion ───────────────────────────────────────────────────
  // Promote to ReferenceAnswer knowledge base when ALL three quality gates pass
  if (finalScore >= 85 && confidenceScore >= 0.85 && similarityScore >= 0.8 && rubricScore >= 0.8) {
    try {
      await addIdealAnswer(answer.questionId, answer.content);
      console.log(
        `[Auto-Promotion] Technical answer promoted to ReferenceAnswer ` +
          `(ID: ${answerId}, finalScore: ${finalScore.toFixed(2)}, ` +
          `confidence: ${confidenceScore.toFixed(2)}, similarity: ${similarityScore.toFixed(2)})`,
      );
    } catch (err: any) {
      console.error(
        `[Auto-Promotion Error] Failed to promote technical answer:`,
        err.message,
      );
    }
  }

  return scoreResult;
};


// ---------------------------------------------------------------------------
// Soft skill scoring — Hybrid Scoring Formula
//
//   finalScore =
//     rubricScore    * 0.40   (AI rubric: communication + selfAwareness + evidence + relevance / 20)
//     categoryScore  * 0.30   (selectedCategory.score / maxCategoryScore)
//     similarityScore* 0.20   (top-3 pgvector cosine similarity average)
//     keywordScore   * 0.10   (matchedWeight / totalWeight)
//
//   confidenceScore = (aiCategoryConfidence + similarityScore + keywordScore) / 3
// ---------------------------------------------------------------------------

const scoreSoftSkillAnswer = async (answerId: number) => {
  // ── 1. Load answer with question context ────────────────────────────────
  const answer = await prisma.answer.findUnique({
    where: { id: answerId },
    include: {
      question: {
        include: {
          category: true,
          categories: true,
          keywords: true,
        },
      },
    },
  });

  if (!answer) throw new NotFoundException("Answer tidak ditemukan");

  // ── 2. Guard: skip non-softskill question types ─────────────────────────
  const qType = answer.question.type;
  if (
    qType === QuestionType.INTRO ||
    qType === QuestionType.GENERAL ||
    qType === QuestionType.TECHNICAL
  ) {
    return null;
  }

  // ── 3. Guard: skip if no answer categories defined ──────────────────────
  const categories = answer.question.categories;
  if (!categories.length) return null;

  const questionText = answer.question.content;
  const userAnswer = answer.content;
  const questionCategoryName = answer.question.category?.name;

  // ── 4. Keyword score ─────────────────────────────────────────────────────
  // Range: 0–1  (matchedWeight / totalWeight via existing util)
  const keywords = answer.question.keywords ?? [];
  const keywordScore = calculateKeywordScore(userAnswer, keywords);

  // ── 5. Generate embedding (similarity computed after category is resolved) ───
  // We need the embedding regardless of category, so create it early.
  const userEmbedding: number[] | null = userAnswer ? await createEmbedding(userAnswer) : null;

  // ── 6. Category classification (with retry if confidence < 0.7) ─────────
  const classificationRetryHint =
    "Klasifikasi sebelumnya kurang yakin. Pilih kategori berdasarkan bukti eksplisit dalam jawaban. Jangan membuat asumsi.";

  const categoryOptions = buildCategoryOptions(categories);

  const classificationWithPrompt = await retryIfLowConfidenceWithPrompt(
    () =>
      classifySoftSkillAnswer(
        questionText,
        userAnswer,
        categoryOptions,
        questionCategoryName,
      ),
    () =>
      classifySoftSkillAnswer(
        questionText,
        userAnswer,
        categoryOptions,
        questionCategoryName,
        classificationRetryHint,
      ),
    (isRetry) =>
      buildSoftSkillClassificationPrompt(
        questionText,
        userAnswer,
        categoryOptions,
        questionCategoryName,
        isRetry ? classificationRetryHint : undefined,
      ),
  );

  const classification = classificationWithPrompt.result;
  const softSkillCategoryPrompt = classificationWithPrompt.prompt;

  // ── 8. Rubric scoring (with retry if confidence < 0.7) ──────────────────
  const rubricRetryHint =
    "Penilaian sebelumnya kurang meyakinkan. Fokus pada bukti eksplisit komunikasi, kesadaran diri, dan relevansi jawaban.";

  const rubricWithPrompt = await retryIfLowConfidenceWithPrompt(
    () => generateSoftSkillRubricScore(questionText, userAnswer, questionCategoryName),
    () =>
      generateSoftSkillRubricScore(questionText, userAnswer, questionCategoryName, rubricRetryHint),
    (isRetry) =>
      buildSoftSkillRubricPrompt(
        questionText,
        userAnswer,
        questionCategoryName,
        isRetry ? rubricRetryHint : undefined,
      ),
  );

  const rubricResult = rubricWithPrompt.result;
  const softSkillRubricPrompt = rubricWithPrompt.prompt;

  // ── 9. Resolve best matching category ───────────────────────────────────
  // Priority: exact label match → fuzzy string similarity → score-0 fallback
  const classifiedLabel = String(classification?.label ?? "");
  const classifiedCategoryId = Number(classification?.categoryId ?? 0);

  let matchedCategory = categories.find(
    (cat) => cat.label.toLowerCase() === classifiedLabel.toLowerCase() || cat.id === classifiedCategoryId,
  );

  if (!matchedCategory && classifiedLabel) {
    let maxSimilarity = 0;
    let bestCat = null;
    for (const cat of categories) {
      const sim = stringSimilarity(cat.label, classifiedLabel);
      if (sim > maxSimilarity) {
        maxSimilarity = sim;
        bestCat = cat;
      }
    }
    if (bestCat && maxSimilarity >= 0.4) {
      matchedCategory = bestCat;
    }
  }

  if (!matchedCategory) {
    matchedCategory = { id: undefined as any, label: "Tidak ada kategori yang sesuai", score: 0, questionId: answer.question.id };
  }

  // ── 9. Compute component scores (all 0–1) ───────────────────────────────
  const maxCategoryScore = Math.max(...categories.map((c) => c.score), 1);
  const categoryScore = Math.max(
    0,
    Math.min(matchedCategory.score / maxCategoryScore, 1),
  );

  // ── 5a. Similarity score (top-3 average, category-scoped) ───────────────
  // Range: 0–1
  // Uses ReferenceAnswers that share the same AnswerCategory as the classified
  // answer, giving a semantically fairer comparison than question-wide lookup.
  // Falls back to question-wide top-3 when matchedCategory has no real id.
  let similarityScore = 0;
  if (userEmbedding) {
    if (matchedCategory.id != null) {
      similarityScore = await getTop3SimilarityAverageByCategory(
        userEmbedding,
        answer.question.id,
        matchedCategory.id,
      );
    } else {
      similarityScore = await getTop3SimilarityAverage(
        userEmbedding,
        answer.question.id,
      );
    }
  }

  const communicationNum = parseRubricNumber(rubricResult.communication);
  const selfAwarenessNum = parseRubricNumber(rubricResult.selfAwareness);
  const behaviorEvidenceNum = parseRubricNumber(rubricResult.behaviorEvidence);
  const growthMindsetNum = parseRubricNumber(rubricResult.growthMindset);

  const rubricScore = Math.max(
    0,
    Math.min(
      (communicationNum + selfAwarenessNum + behaviorEvidenceNum + growthMindsetNum) / 20,
      1,
    ),
  );

  // ── 10. Final score (0–100) ──────────────────────────────────────────────
  // rubricScore*0.40 + categoryScore*0.30 + similarityScore*0.20 + keywordScore*0.10
  const finalScoreRaw =
    rubricScore * 0.4 +
    categoryScore * 0.3 +
    similarityScore * 0.2 +
    keywordScore * 0.1;

  const finalScore = Math.max(0, Math.min(finalScoreRaw * 100, 100));

  // ── 11. Confidence score (0–1) ───────────────────────────────────────────
  // (aiCategoryConfidence + aiRubricConfidence + similarityScore + keywordScore) / 4
  const aiCategoryConfidence = clampConfidence(classification?.confidence);
  const aiRubricConfidence = clampConfidence(rubricResult.confidence);
  const confidenceScore = Math.max(
    0,
    Math.min(
      (aiCategoryConfidence * 0.4 + aiRubricConfidence * 0.3 + similarityScore * 0.2 + keywordScore * 0.1),
      1,
    ),
  );

  // ── 12. Feedback text ────────────────────────────────────────────────────
  const feedback =
    finalScore >= 75
      ? "Jawaban sangat baik"
      : finalScore >= 50
        ? "Jawaban cukup baik"
        : "Jawaban perlu diperbaiki";

  // ── 13. Build breakdown ──────────────────────────────────────────────────
  const exactLabelMatch =
    matchedCategory.label.toLowerCase() === classifiedLabel.toLowerCase();

  const breakdown: SoftSkillBreakdown = {
    rubric: {
      communication: communicationNum,
      selfAwareness: selfAwarenessNum,
      behaviorEvidence: behaviorEvidenceNum,
      growthMindset: growthMindsetNum,
      rubricScore: Math.round(rubricScore * 100) / 100,
    },
    categoryScore: Math.round(categoryScore * 100) / 100,
    similarityScore: Math.round(similarityScore * 100) / 100,
    keywordScore: Math.round(keywordScore * 100) / 100,
    aiReason: classification?.reason ?? rubricResult?.reason ?? "",
  };

  const reasonParts = [
    `Kategori terpilih: ${matchedCategory.label}`,
    `Bobot kategori: ${matchedCategory.score}/${maxCategoryScore}`,
    `Rubrik AI: communication ${communicationNum}/5, selfAwareness ${selfAwarenessNum}/5, behaviorEvidence ${behaviorEvidenceNum}/5, growthMindset ${growthMindsetNum}/5`,
    `Keyakinan AI: final ${Math.round(confidenceScore * 100)}%, rubrik ${Math.round(aiRubricConfidence * 100)}%, klasifikasi ${Math.round(aiCategoryConfidence * 100)}%`,
    `Similarity (top-3 avg): ${Math.round(similarityScore * 100)}%`,
    `Keyword coverage: ${Math.round(keywordScore * 100)}%`,
    (classification?.reason || rubricResult?.reason) ? `Alasan AI: ${classification?.reason ?? ""} ${rubricResult?.reason ?? ""}` : null,
    exactLabelMatch
      ? "Label cocok persis dengan hasil klasifikasi"
      : "Label diambil dari kategori terdekat yang tersedia",
  ].filter(Boolean);

  // ── 14. Persist score (upsert) ───────────────────────────────────────────
  const scoreResult = await prisma.score.upsert({
    where: { answerId },
    update: {
      type: QuestionType.SOFTSKILL,
      categoryId: matchedCategory.id ?? null,
      categoryLabel: matchedCategory.label,
      rubricScore,
      finalScore,
      similarityScore,
      keywordScore,
      confidenceScore,
      feedback,
      reason: reasonParts.join(" | "),
      breakdown: breakdown as any,
      promptRubric: softSkillRubricPrompt,
      promptCategory: softSkillCategoryPrompt,
    },
    create: {
      answerId,
      type: QuestionType.SOFTSKILL,
      categoryId: matchedCategory.id ?? null,
      categoryLabel: matchedCategory.label,
      rubricScore,
      finalScore,
      similarityScore,
      keywordScore,
      confidenceScore,
      feedback,
      reason: reasonParts.join(" | "),
      breakdown: breakdown as any,
      promptRubric: softSkillRubricPrompt,
      promptCategory: softSkillCategoryPrompt,
    },
  });

  // ── 15. Auto-promotion ─────────────────────────────────────────────────────
  // Promote answer to ReferenceAnswer knowledge base when ALL three
  // quality gates are satisfied (spec: finalScore >= 85 AND
  // confidenceScore >= 0.85 AND similarityScore >= 0.80)
  // The answerCategoryId is stored so future category-aware similarity
  // queries return only same-category reference answers.
  const existingSimilarity = userEmbedding ? await getTop3SimilarityAverageByCategory(
    userEmbedding,
    answer.question.id,
    matchedCategory.id
  ) : 0;

  if (
    existingSimilarity < 0.95 &&
    finalScore >= 85 &&
    confidenceScore >= 0.85 &&
    similarityScore >= 0.8 &&
    rubricScore >= 0.8
  ) {
    try {
      const promotedCategoryId = matchedCategory.id ?? null;
      await addIdealAnswer(answer.questionId, answer.content, promotedCategoryId, answerId);
      console.log(
        `[Auto-Promotion] Softskill answer promoted to ReferenceAnswer ` +
          `(ID: ${answerId}, category: "${matchedCategory.label}" [${promotedCategoryId}], ` +
          `finalScore: ${finalScore.toFixed(2)}, ` +
          `confidence: ${confidenceScore.toFixed(2)}, similarity: ${similarityScore.toFixed(2)})`,
      );
    } catch (err: any) {
      console.error(
        `[Auto-Promotion Error] Failed to promote softskill answer:`,
        err.message,
      );
    }
  }

  return scoreResult;
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export default {
  scoreTechnicalAnswer,
  scoreSoftSkillAnswer,
};
