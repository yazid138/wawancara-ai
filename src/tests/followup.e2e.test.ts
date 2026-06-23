/**
 * ============================================================
 * PENGUJIAN END-TO-END: Alur Follow-up Question
 * ============================================================
 *
 * Test ini memvalidasi siklus hidup follow-up question:
 *   1. Register & Login user baru.
 *   2. Mulai interview baru.
 *   3. Jawab pertanyaan pembuka (INTRO).
 *   4. Jawab pertanyaan umum (GENERAL).
 *   5. Dapatkan pertanyaan teknis / softskill pertama.
 *   6. Kirim jawaban lemah (off-topic/singkat) untuk memicu follow-up.
 *   7. Tunggu (poll) sampai follow-up question digenerate di background.
 *   8. Verifikasi metadata follow-up question.
 *   9. Kirim jawaban kuat untuk follow-up question via POST /interviews/:id/answers.
 *  10. Verifikasi bahwa Score parent diupdate dengan formula pengaman & breakdown enriched.
 *  11. Verifikasi chat history dan resume akhir.
 *
 * AI services TIDAK di-mock untuk menguji integrasi real.
 * ============================================================
 */

import { join } from "path";
import { fileURLToPath } from "url";
const __dirname = fileURLToPath(new URL(".", import.meta.url));
process.chdir(join(__dirname, "../../.."));

import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import request from "supertest";
import app from "@/app";
import {
  ensureCompanyAndPosition,
  ensureQuestions,
} from "./helpers/seed.helper";
import { registerUser, loginUser, authRequest } from "./helpers/auth.helper";
import prisma from "@/database/prisma";

const TEST_USER = {
  name: "Test FollowUp E2E",
  username: `test_followup_${Date.now()}`,
  password: "password123",
  role: "STUDENT",
};

let token: string;
let companyId: number;
let positionId: number;
let interviewId: number;
let followUpQuestionId: number;
let categoryIds: number[] = [];

beforeAll(async () => {
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║  SETUP: Mempersiapkan data untuk test Follow-up ║");
  console.log("╚══════════════════════════════════════════════╝");

  const { company, position } = await ensureCompanyAndPosition();
  companyId = company.id;
  positionId = position.id;
  console.log(`  → Company: ${company.name} (id=${companyId})`);
  console.log(`  → Position: ${position.name} (id=${positionId})`);

  await ensureQuestions();
  console.log("  → Questions: OK\n");

  const categories = await prisma.questionCategory.findMany();
  categoryIds = categories.map((c) => c.id);
  console.log(`  → Categories: ${categoryIds.join(", ")}\n`);
}, 300_000);

describe("E2E Follow-up Question Flow", () => {
  it("1. Register & Login", async () => {
    const regRes = await registerUser(TEST_USER);
    expect(regRes.status).toBe(200);

    const { res: loginRes, token: t } = await loginUser(TEST_USER.username, TEST_USER.password);
    expect(loginRes.status).toBe(200);
    expect(t).toBeDefined();
    token = t!;
  });

  it("2. Mulai Interview", async () => {
    const res = await authRequest(token)
      .post("/interviews")
      .send({ companyId, positionId, categoryIds });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
    interviewId = res.body.data.id;
  });

  it("3. Jawab INTRO & GENERAL", async () => {
    // 3a. Ambil INTRO
    const introRes = await authRequest(token).get(`/interviews/${interviewId}/current`);
    expect(introRes.status).toBe(200);
    expect(introRes.body.data.type).toBe("INTRO");

    // Jawab INTRO
    const ansIntroRes = await authRequest(token)
      .post(`/interviews/${interviewId}/answers`)
      .send({
        questionId: -1,
        answer: "Halo, saya adalah Test User. Saya sangat tertarik dengan posisi Backend Developer di perusahaan Anda.",
      });
    expect(ansIntroRes.status).toBe(201);

    // 3b. Ambil GENERAL
    const genRes = await authRequest(token).get(`/interviews/${interviewId}/current`);
    expect(genRes.status).toBe(200);
    expect(genRes.body.data.type).toBe("GENERAL");

    // Jawab GENERAL
    const ansGenRes = await authRequest(token)
      .post(`/interviews/${interviewId}/answers`)
      .send({
        questionId: genRes.body.data.id,
        answer: "Saya ingin bergabung karena saya ingin berkembang dan memberikan kontribusi nyata bagi tim.",
      });
    expect([200, 201]).toContain(ansGenRes.status);
  }, 60_000);

  it("4. Kirim Jawaban Lemah untuk Memicu Follow-up", async () => {
    // Ambil pertanyaan utama berikutnya (SOFTSKILL atau TECHNICAL)
    const currentRes = await authRequest(token).get(`/interviews/${interviewId}/current`);
    expect(currentRes.status).toBe(200);
    const mainQuestion = currentRes.body.data;
    expect(["SOFTSKILL", "TECHNICAL"]).toContain(mainQuestion.type);
    console.log(`  → Pertanyaan Utama: "${mainQuestion.content}" (Type: ${mainQuestion.type})`);

    // Kirim jawaban yang sangat lemah/off-topic agar memicu follow-up (score rendah)
    const weakAnswer = "Saya kurang tahu dan tidak punya pengalaman mengenai hal tersebut.";
    console.log(`  → Mengirim jawaban lemah: "${weakAnswer}"`);
    
    const ansMainRes = await authRequest(token)
      .post(`/interviews/${interviewId}/answers`)
      .send({
        questionId: mainQuestion.id,
        answer: weakAnswer,
      });
    expect([200, 201]).toContain(ansMainRes.status);

    const parentAnswerId = ansMainRes.body.data?.answer?.id;
    expect(parentAnswerId).toBeDefined();

    // 5. Polling /current endpoint sampai follow-up question digenerate (karena async 3s delay + AI time)
    console.log("  → Menunggu background follow-up generator...");
    let followUpQuestion: any = null;
    const maxPolls = 30;
    
    for (let i = 0; i < maxPolls; i++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const pollRes = await authRequest(token).get(`/interviews/${interviewId}/current`);
      
      if (pollRes.status === 200 && pollRes.body.data && pollRes.body.data.isFollowUp) {
        followUpQuestion = pollRes.body.data;
        break;
      }
      console.log(`    [poll-${i + 1}] Belum ada follow-up. Mencoba lagi...`);
    }

    expect(followUpQuestion).not.toBeNull();
    followUpQuestionId = followUpQuestion.id;
    expect(followUpQuestion.isFollowUp).toBe(true);
    expect(followUpQuestion.parentAnswerId).toBe(parentAnswerId);
    expect(followUpQuestion.followUpStatus).toBe("PENDING");
    expect(followUpQuestion.content).toBeDefined();
    console.log(`  → Follow-up dideteksi: "${followUpQuestion.content}"`);
    console.log(`  → Alasan AI: "${followUpQuestion.followUpReason}"`);
    console.log(`  → Sinyal yang Diharapkan: "${followUpQuestion.expectedSignal}"`);

    // 6. Jawab Follow-up Question via endpoint utama /interviews/:id/answers
    const strongFollowUpAnswer = "Meskipun belum memiliki pengalaman langsung, saya selalu berinisiatif membaca dokumentasi resmi, mencoba membuat project sederhana sendiri, dan berdiskusi dengan komunitas online untuk memecahkan masalah.";
    console.log(`  → Mengirim jawaban follow-up: "${strongFollowUpAnswer}"`);

    const ansFollowUpRes = await authRequest(token)
      .post(`/interviews/${interviewId}/answers`)
      .send({
        questionId: followUpQuestion.id,
        answer: strongFollowUpAnswer,
      });

    expect(ansFollowUpRes.status).toBe(200);
    expect(ansFollowUpRes.body.message).toContain("berhasil");

    // 7. Verifikasi pembaruan nilai & breakdown pada parent score
    const resultRes = await authRequest(token).get(`/interviews/${interviewId}/result`);
    expect(resultRes.status).toBe(200);

    const parentAnswer = resultRes.body.data.answers.find((a: any) => a.id === parentAnswerId);
    expect(parentAnswer).toBeDefined();
    expect(parentAnswer.score).toBeDefined();

    const score = parentAnswer.score;
    console.log(`  → Skor Akhir Terupdate: ${score.finalScore} (Confidence: ${score.confidenceScore})`);
    
    // Verifikasi format breakdown enriched
    const breakdown = score.breakdown;
    expect(breakdown).toBeDefined();
    expect(breakdown.main).toBeDefined();
    expect(breakdown.final).toBeDefined();
    expect(Array.isArray(breakdown.followUps)).toBe(true);
    expect(breakdown.followUps.length).toBe(1);

    const followUpEntry = breakdown.followUps[0];
    expect(followUpEntry.question).toBe(followUpQuestion.content);
    expect(followUpEntry.answer).toBe(strongFollowUpAnswer);
    expect(followUpEntry.score).toBeDefined();
    expect(followUpEntry.delta).toBeDefined();
    console.log(`  → Delta Skor: +${followUpEntry.delta.score} | Delta Confidence: +${followUpEntry.delta.confidence}`);

    // Pastikan finalScore dan confidenceScore di DB sinkron dengan breakdown.final (dengan toleransi pembulatan)
    expect(Math.round(score.finalScore * 100) / 100).toBe(breakdown.final.finalScore);
    expect(Math.round(score.confidenceScore * 100) / 100).toBe(breakdown.final.confidence);
  }, 120_000); // Timeout 2 menit untuk scoring & follow-up generation

  it("5. Verifikasi Chat History", async () => {
    const historyRes = await authRequest(token).get(`/interviews/${interviewId}/history`);
    expect(historyRes.status).toBe(200);

    const history = historyRes.body.data;
    expect(Array.isArray(history.chatHistories)).toBe(true);

    // Filter chat yang berkaitan dengan follow-up
    const followUpChats = history.chatHistories.filter((ch: any) => ch.questionId === followUpQuestionId);
    // Harus ada 2 entry: AI menanyakan follow-up & USER menjawab
    expect(followUpChats.length).toBe(2);

    const aiChat = followUpChats.find((ch: any) => ch.role === "AI");
    const userChat = followUpChats.find((ch: any) => ch.role === "USER");

    expect(aiChat).toBeDefined();
    expect(userChat).toBeDefined();
    expect(userChat.content).toContain("Meskipun belum memiliki pengalaman");
  }, 30_000);
});
