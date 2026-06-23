import prisma from "@/database/prisma";
import NotFoundException from "@/exception/NotFoundException";
import { QuestionType } from "@/prisma/enums";
import { generateFollowUpQuestion } from "@/services/ai.service";
import {
  generateTechnicalRubricScore,
  generateSoftSkillRubricScore,
} from "@/services/ai.service";
import {
  createEmbedding,
} from "@/services/ai.service";
import {
  getTop3SimilarityAverage,
} from "@/services/question.service";
import {
  calculateKeywordScore,
  clampConfidence,
  parseRubricNumber,
} from "@/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ShouldGenerateResult {
  shouldGenerate: boolean;
  reason: string;
}

interface FollowUpScoreComponent {
  rubric: number;
  similarity: number;
  keyword: number;
  confidence: number;
}

interface FollowUpEntry {
  question: string;
  answer: string;
  score: FollowUpScoreComponent;
  delta: { score: number; confidence: number };
}

// Struktur breakdown baru setelah follow-up
interface EnrichedBreakdown {
  main: { finalScore: number; confidence: number; [key: string]: any };
  followUps: FollowUpEntry[];
  final: { finalScore: number; confidence: number };
}

// ---------------------------------------------------------------------------
// Threshold constants
// ---------------------------------------------------------------------------

/** Confidence AI di bawah threshold ini dianggap kurang yakin */
const CONFIDENCE_THRESHOLD = 0.75;
/** Similarity score di bawah threshold ini dianggap kurang relevan */
const SIMILARITY_THRESHOLD = 0.65;
/** Rubric score di bawah threshold ini dianggap kurang kuat */
const RUBRIC_THRESHOLD = 0.70;

// ---------------------------------------------------------------------------
// shouldGenerateFollowUp
//
// Periksa apakah jawaban kandidat memerlukan follow-up question.
// Trigger jika SALAH SATU kondisi berikut terpenuhi:
//   - confidenceScore < 0.75
//   - similarityScore < 0.65
//   - rubricScore < 0.70
// ---------------------------------------------------------------------------

const shouldGenerateFollowUp = (score: {
  confidenceScore: number;
  similarityScore: number;
  rubricScore?: number | null;
}): ShouldGenerateResult => {
  const reasons: string[] = [];

  if (score.confidenceScore < CONFIDENCE_THRESHOLD) {
    reasons.push(`confidence rendah (${(score.confidenceScore * 100).toFixed(0)}% < ${CONFIDENCE_THRESHOLD * 100}%)`);
  }
  if (score.similarityScore < SIMILARITY_THRESHOLD) {
    reasons.push(`similarity rendah (${(score.similarityScore * 100).toFixed(0)}% < ${SIMILARITY_THRESHOLD * 100}%)`);
  }
  if (score.rubricScore != null && score.rubricScore < RUBRIC_THRESHOLD) {
    reasons.push(`rubric score rendah (${(score.rubricScore * 100).toFixed(0)}% < ${RUBRIC_THRESHOLD * 100}%)`);
  }

  return {
    shouldGenerate: reasons.length > 0,
    reason: reasons.length > 0 ? reasons.join("; ") : "Jawaban sudah cukup kuat",
  };
};

// ---------------------------------------------------------------------------
// generateFollowUp
//
// Generate dan simpan follow-up question untuk sebuah jawaban.
// Juga menyimpan ke ChatHistory agar muncul di chat flow.
// ---------------------------------------------------------------------------

const generateFollowUp = async (interviewId: number, answerId: number) => {
  // ── 1. Load score untuk jawaban ini (dengan polling hingga 30 detik jika belum ada) ──
  let score = null;
  const maxRetries = 30;
  for (let i = 0; i < maxRetries; i++) {
    score = await prisma.score.findUnique({
      where: { answerId },
      include: {
        answer: {
          include: {
            question: {
              include: { keywords: true },
            },
          },
        },
      },
    });
    if (score) {
      break;
    }
    // Tunda 1 detik sebelum coba lagi
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Jika skor belum ada (scoring belum selesai), lewati
  if (!score) {
    return { generated: false, reason: "Score belum tersedia" };
  }

  const questionType = score.type;

  // ── 2. Hanya proses TECHNICAL dan SOFTSKILL ──────────────────────────────
  if (questionType === QuestionType.INTRO || questionType === QuestionType.GENERAL) {
    return { generated: false, reason: "Follow-up tidak berlaku untuk tipe ini" };
  }

  // ── 3. Cek apakah perlu follow-up ────────────────────────────────────────
  const check = shouldGenerateFollowUp({
    confidenceScore: score.confidenceScore,
    similarityScore: score.similarityScore,
    rubricScore:     score.rubricScore,
  });

  if (!check.shouldGenerate) {
    return { generated: false, reason: check.reason };
  }

  // ── 4. Guard: jangan duplikasi jika sudah ada PENDING follow-up ───────────
  const existingFollowUp = await prisma.question.findFirst({
    where: {
      parentAnswerId: answerId,
      followUpStatus: "PENDING",
    },
  });

  if (existingFollowUp) {
    return {
      generated: false,
      reason: "Follow-up question sudah ada dan belum dijawab",
    };
  }

  const question     = score.answer.question;
  const answerContent = score.answer.content;
  const breakdownStr = JSON.stringify(score.breakdown ?? {}, null, 2);

  // ── 5. Generate follow-up via AI ─────────────────────────────────────────
  const { output: aiResult, prompt } = await generateFollowUpQuestion(
    question.content,
    answerContent,
    breakdownStr,
    score.confidenceScore,
  );

  // ── 6. Simpan ke database dalam satu transaksi ────────────────────────────
  const [followUpQuestion] = await prisma.$transaction(async (tx) => {
    // Simpan follow-up question sebagai Question baru dengan flag isFollowUp
    const savedQuestion = await tx.question.create({
      data: {
        content:        aiResult.followUpQuestion,
        type:           question.type, // Warisi tipe dari soal utama (TECHNICAL/SOFTSKILL)
        categoryId:     question.categoryId,
        isFollowUp:     true,
        parentAnswerId: answerId,
        followUpReason: aiResult.reason,
        followUpStatus: "PENDING",
        expectedSignal: aiResult.expectedSignal,
        promptFollowUp: prompt,
      },
    });

    // Simpan ke ChatHistory agar follow-up muncul di chat flow (role=AI)
    await tx.chatHistory.create({
      data: {
        interviewId,
        role:       "AI",
        content:    aiResult.followUpQuestion,
        questionId: savedQuestion.id,
      },
    });

    return [savedQuestion];
  });

  return {
    generated: true,
    followUpQuestion: {
      id:             followUpQuestion.id,
      content:        followUpQuestion.content,
      reason:         aiResult.reason,
      expectedSignal: aiResult.expectedSignal,
    },
  };
};

// ---------------------------------------------------------------------------
// _scoreFollowUpAnswer (internal helper)
//
// Hitung komponen skor untuk jawaban follow-up menggunakan pipeline
// yang sama dengan scoring utama — tanpa membuat record Score baru.
// ---------------------------------------------------------------------------

const _scoreFollowUpAnswer = async (
  followUpQuestionId: number,
  answerContent: string,
  questionType: QuestionType,
): Promise<FollowUpScoreComponent> => {
  // Load follow-up question dengan keywords
  const followUpQ = await prisma.question.findUnique({
    where: { id: followUpQuestionId },
    include: {
      keywords: true,
      parentAnswer: {
        include: { question: true },
      },
    },
  });

  if (!followUpQ) throw new NotFoundException("Follow-up question tidak ditemukan");

  const keywords = followUpQ.keywords ?? [];

  // Keyword score (0–1)
  const keywordScore = calculateKeywordScore(answerContent, keywords);

  // Embedding + similarity score via pgvector (gunakan soal UTAMA sebagai referensi)
  const parentQuestionId = followUpQ.parentAnswer?.question?.id ?? followUpQ.parentAnswerId ?? followUpQ.id;
  const userEmbedding = await createEmbedding(answerContent);
  const similarityScore = await getTop3SimilarityAverage(userEmbedding, parentQuestionId);

  // Rubric score via AI (dispatch berdasarkan tipe)
  let rubricRaw: number;
  let aiConfidence: number;

  if (questionType === QuestionType.TECHNICAL) {
    const rubricResult = await generateTechnicalRubricScore(
      followUpQ.content,
      answerContent,
    );
    const u = parseRubricNumber(rubricResult.understanding);
    const t = parseRubricNumber(rubricResult.technicalAccuracy);
    const p = parseRubricNumber(rubricResult.problemSolving);
    const c = parseRubricNumber(rubricResult.technicalCommunication);
    rubricRaw    = (u + t + p + c) / 20; // 0–1
    aiConfidence = clampConfidence(rubricResult.confidence);
  } else {
    // SOFTSKILL
    const rubricResult = await generateSoftSkillRubricScore(
      followUpQ.content,
      answerContent,
    );
    const comm = parseRubricNumber(rubricResult.communication);
    const self = parseRubricNumber(rubricResult.selfAwareness);
    const beh  = parseRubricNumber(rubricResult.behaviorEvidence);
    const grow = parseRubricNumber(rubricResult.growthMindset);
    rubricRaw    = (comm + self + beh + grow) / 20; // 0–1
    aiConfidence = clampConfidence(rubricResult.confidence);
  }

  const rubric     = Math.max(0, Math.min(rubricRaw, 1));
  const confidence = Math.max(0, Math.min((aiConfidence + similarityScore + keywordScore) / 3, 1));

  return {
    rubric:     Math.round(rubric     * 100) / 100,
    similarity: Math.round(similarityScore * 100) / 100,
    keyword:    Math.round(keywordScore    * 100) / 100,
    confidence: Math.round(confidence      * 100) / 100,
  };
};

// ---------------------------------------------------------------------------
// submitFollowUpAnswer
//
// Proses jawaban follow-up:
//   1. Score jawaban follow-up (tanpa membuat Score record baru)
//   2. Update Score utama dengan formula perlindungan skor
//   3. Update breakdown JSON ke struktur enriched
//   4. Simpan FollowUpAnswer di Answer table
//   5. Simpan ke ChatHistory (role=USER)
//   6. Set followUpStatus = ANSWERED
//   Semua dalam satu Prisma transaction.
// ---------------------------------------------------------------------------

const submitFollowUpAnswer = async (
  followUpQuestionId: number,
  answerContent: string,
  interviewId: number,
  userId: number,
) => {
  // ── 1. Load follow-up question ─────────────────────────────────────────
  const followUpQ = await prisma.question.findUnique({
    where: { id: followUpQuestionId },
  });

  if (!followUpQ) throw new NotFoundException("Follow-up question tidak ditemukan");
  if (!followUpQ.isFollowUp) throw new NotFoundException("Bukan follow-up question");
  if (followUpQ.followUpStatus !== "PENDING") {
    throw new NotFoundException("Follow-up sudah dijawab atau dilewati");
  }
  if (!followUpQ.parentAnswerId) {
    throw new NotFoundException("Follow-up question tidak memiliki parent answer");
  }

  const parentAnswerId = followUpQ.parentAnswerId;

  // ── 2. Load skor utama (parent answer) ───────────────────────────────────
  const parentScore = await prisma.score.findUnique({
    where: { answerId: parentAnswerId },
  });

  if (!parentScore) throw new NotFoundException("Skor utama belum tersedia");

  const questionType = parentScore.type;

  // ── 3. Score jawaban follow-up ────────────────────────────────────────────
  const followUpScoreComponents = await _scoreFollowUpAnswer(
    followUpQuestionId,
    answerContent,
    questionType,
  );

  // Hitung finalScore follow-up (0–100) dengan bobot sama seperti scoring utama
  const followUpFinalScore =
    (followUpScoreComponents.rubric * 0.5 +
      followUpScoreComponents.similarity * 0.3 +
      followUpScoreComponents.keyword * 0.2) * 100;

  // ── 4. Hitung score yang diperbarui (skor tidak boleh turun) ─────────────
  //
  //   updatedConfidence = mainConfidence * 0.7 + followUpConfidence * 0.3
  //   updatedFinalScore = max(finalScore, finalScore * 0.85 + followUpScore * 0.15)
  const originalFinalScore   = parentScore.finalScore;
  const originalConfidence   = parentScore.confidenceScore;

  const updatedConfidence = Math.max(
    0,
    Math.min(originalConfidence * 0.7 + followUpScoreComponents.confidence * 0.3, 1),
  );

  const updatedFinalScore = Math.max(
    originalFinalScore,
    originalFinalScore * 0.85 + followUpFinalScore * 0.15,
  );

  const deltaScore      = Math.round((updatedFinalScore - originalFinalScore) * 100) / 100;
  const deltaConfidence = Math.round((updatedConfidence - originalConfidence)  * 100) / 100;

  // ── 5. Bangun breakdown JSON yang diperkaya ───────────────────────────────
  //
  // Jika breakdown sudah dalam format enriched, append ke followUps.
  // Jika masih format lama (flat), wrap di bawah 'main'.
  const existingBreakdown = parentScore.breakdown as any;

  let mainSection: EnrichedBreakdown["main"];
  let existingFollowUps: FollowUpEntry[];

  if (existingBreakdown && existingBreakdown.main && existingBreakdown.final) {
    // Sudah enriched — pertahankan main, append ke followUps
    mainSection       = existingBreakdown.main;
    existingFollowUps = existingBreakdown.followUps ?? [];
  } else {
    // Format lama — wrap breakdown asli sebagai main
    mainSection = {
      ...(existingBreakdown ?? {}),
      finalScore:  originalFinalScore,
      confidence:  originalConfidence,
    };
    existingFollowUps = [];
  }

  const newFollowUpEntry: FollowUpEntry = {
    question: followUpQ.content,
    answer:   answerContent,
    score: {
      rubric:     followUpScoreComponents.rubric,
      similarity: followUpScoreComponents.similarity,
      keyword:    followUpScoreComponents.keyword,
      confidence: followUpScoreComponents.confidence,
    },
    delta: {
      score:      deltaScore,
      confidence: deltaConfidence,
    },
  };

  const enrichedBreakdown: EnrichedBreakdown = {
    main:      mainSection,
    followUps: [...existingFollowUps, newFollowUpEntry],
    final: {
      finalScore:  Math.round(updatedFinalScore * 100) / 100,
      confidence:  Math.round(updatedConfidence * 100) / 100,
    },
  };

  // ── 6. Simpan semua dalam satu transaksi ─────────────────────────────────
  const [updatedScore, savedAnswer] = await prisma.$transaction(async (tx) => {
    // 6a. Update skor utama
    const score = await tx.score.update({
      where: { answerId: parentAnswerId },
      data: {
        finalScore:     updatedFinalScore,
        confidenceScore: updatedConfidence,
        breakdown:      enrichedBreakdown as any,
      },
    });

    // 6b. Simpan jawaban follow-up sebagai Answer baru
    //     (questionId = followUpQuestionId, sehingga terhubung ke soal follow-up)
    const answer = await tx.answer.create({
      data: {
        content:     answerContent,
        questionId:  followUpQuestionId,
        interviewId,
        userId,
      },
    });

    // 6c. Simpan ke ChatHistory sebagai pesan USER
    await tx.chatHistory.create({
      data: {
        interviewId,
        role:       "USER",
        content:    answerContent,
        questionId: followUpQuestionId,
      },
    });

    // 6d. Tandai follow-up question sebagai ANSWERED
    await tx.question.update({
      where: { id: followUpQuestionId },
      data: { followUpStatus: "ANSWERED" },
    });

    return [score, answer];
  });

  return { updatedScore, answer: savedAnswer, breakdown: enrichedBreakdown };
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export default {
  shouldGenerateFollowUp,
  generateFollowUp,
  submitFollowUpAnswer,
};
