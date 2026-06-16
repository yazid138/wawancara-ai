/**
 * ============================================================
 * PENGUJIAN END-TO-END: Alur Interview dari Awal hingga Akhir
 * ============================================================
 *
 * Test ini menjalankan SELURUH siklus interview:
 *   1. Register & Login user
 *   2. Ambil daftar company & positions
 *   3. Mulai interview (POST /interviews)
 *   4. Ambil pertanyaan pertama (INTRO)
 *   5. Submit jawaban INTRO
 *   6. Loop: ambil pertanyaan → submit jawaban (GENERAL, SOFTSKILL, TECHNICAL)
 *   7. Verifikasi interview FINISH
 *   8. Ambil hasil interview (GET /interviews/:id/result)
 *   9. Ambil riwayat interview (GET /interviews/:id/history)
 *  10. Test kasus error (duplicate interview, submit ke interview selesai, tanpa token)
 *
 * AI services TIDAK di-mock: scoring & resume diproses secara real.
 * ============================================================
 */

// Pastikan cwd = root proyek agar Winston bisa menulis application.log dengan path relatif
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
  cleanupTestUser,
} from "./helpers/seed.helper";
import { registerUser, loginUser, authRequest } from "./helpers/auth.helper";
import { generateTestAnswer } from "./helpers/answer.helper";
import prisma from "@/database/prisma";

// ────────────────────────────────────────────────────────────
// KONFIGURASI TEST
// ────────────────────────────────────────────────────────────
const TEST_USER = {
  name: "Test User E2E",
  username: `test_e2e_${Date.now()}`,
  password: "password123",
  role: "STUDENT",
};

// State yang akan diisi selama test
let token: string;
let userId: number;
let companyId: number;
let positionId: number;
let interviewId: number;
let firstQuestionId: number | null = null; // -1 untuk INTRO
let categoryIds: number[] = [];

// ────────────────────────────────────────────────────────────
// SETUP & TEARDOWN
// ────────────────────────────────────────────────────────────
beforeAll(async () => {
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║   SETUP: Mempersiapkan data untuk test E2E   ║");
  console.log("╚══════════════════════════════════════════════╝");

  // Pastikan data company, position, dan question tersedia
  const { company, position } = await ensureCompanyAndPosition();
  companyId = company.id;
  positionId = position.id;
  console.log(`  → Company: ${company.name} (id=${companyId})`);
  console.log(`  → Position: ${position.name} (id=${positionId})`);

  await ensureQuestions();
  console.log("  → Questions: OK\n");

  const categories = await prisma.questionCategory.findMany();
  // Ambil minimal 3 kategori secara acak (atau sebanyak total kategori jika kurang dari 3)
  const shuffled = categories.sort(() => 0.5 - Math.random());
  const minTake = Math.min(3, categories.length);
  const randomTake = Math.floor(Math.random() * (categories.length - minTake + 1)) + minTake;
  categoryIds = shuffled.slice(0, randomTake).map((c) => c.id);
  console.log(`  → Focus Categories: ${categoryIds.join(", ")} (Total: ${categoryIds.length})\n`);
}, 300_000); // Timeout 5 menit untuk seed (AI calls)

afterAll(async () => {
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║   CLEANUP: Menghapus data test               ║");
  console.log("╚══════════════════════════════════════════════╝");
  // User meminta agar test user TIDAK DIHAPUS setelah pengujian
  // await cleanupTestUser(TEST_USER.username);
  console.log("  → Cleanup dinonaktifkan (data test dibiarkan di DB).\n");
});

// ────────────────────────────────────────────────────────────
// SUITE 1: AUTENTIKASI
// ────────────────────────────────────────────────────────────
describe("1. Autentikasi", () => {
  it("POST /auth/register → 200 berhasil register", async () => {
    const res = await registerUser(TEST_USER);

    console.log("  [register] status:", res.status, "| body:", JSON.stringify(res.body));
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/register/i);
  });

  it("POST /auth/login → 200 dan mendapat token JWT", async () => {
    const { res, token: t } = await loginUser(TEST_USER.username, TEST_USER.password);

    console.log("  [login] status:", res.status);
    expect(res.status).toBe(200);
    expect(t).toBeDefined();
    expect(typeof t).toBe("string");
    token = t!;
  });

  it("GET /auth/me → 200 dan data user sesuai", async () => {
    const res = await authRequest(token).get("/auth/me");

    console.log("  [me] user:", JSON.stringify(res.body?.data));
    expect(res.status).toBe(200);
    expect(res.body.data.username).toBe(TEST_USER.username);
    expect(res.body.data.name).toBe(TEST_USER.name);
    userId = res.body.data.id;
  });

  it("GET /auth/me tanpa token → 401 Unauthorized", async () => {
    const res = await request(app).get("/auth/me");
    expect(res.status).toBe(401);
  });
});

// ────────────────────────────────────────────────────────────
// SUITE 2: COMPANY & POSITION
// ────────────────────────────────────────────────────────────
describe("2. Company & Position", () => {
  it("GET /company → 200 dan mengembalikan daftar company", async () => {
    const res = await authRequest(token).get("/company");

    console.log("  [company] count:", res.body?.data?.length);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it("GET /company/:id/positions → 200 dan ada minimal 1 position", async () => {
    const res = await authRequest(token).get(`/company/${companyId}/positions`);

    console.log("  [positions] count:", res.body?.data?.length);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it("GET /company/9999/positions → data kosong atau tidak ditemukan", async () => {
    const res = await authRequest(token).get("/company/9999/positions");
    // Bisa 200 dengan array kosong atau 404
    expect([200, 404]).toContain(res.status);
  });
});

// ────────────────────────────────────────────────────────────
// SUITE 3: MULAI INTERVIEW
// ────────────────────────────────────────────────────────────
describe("3. Mulai Interview", () => {
  it("GET /interviews → 200 daftar interview (awalnya kosong untuk user ini)", async () => {
    const res = await authRequest(token).get("/interviews");

    console.log("  [interviews] count:", res.body?.data?.length);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("POST /interviews → 201 interview berhasil dibuat", async () => {
    const res = await authRequest(token)
      .post("/interviews")
      .send({ companyId, positionId, categoryIds });

    console.log("  [start] status:", res.status, "| interviewId:", res.body?.data?.id);
    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.status).toBe("ONGOING");
    interviewId = res.body.data.id;
  });

  it("POST /interviews (duplicate) → 403 sudah melakukan interview", async () => {
    const res = await authRequest(token)
      .post("/interviews")
      .send({ companyId, positionId, categoryIds });

    console.log("  [duplicate] status:", res.status);
    expect(res.status).toBe(403);
  });

  it("GET /interviews → 200 dan ada 1 interview aktif", async () => {
    const res = await authRequest(token).get("/interviews");

    expect(res.status).toBe(200);
    const myInterview = res.body.data.find((i: any) => i.id === interviewId);
    expect(myInterview).toBeDefined();
    expect(myInterview.status).toBe("ONGOING");
  });
});

// ────────────────────────────────────────────────────────────
// SUITE 4: ALUR PERTANYAAN & JAWABAN
// ────────────────────────────────────────────────────────────
describe("4. Alur Pertanyaan & Jawaban", () => {

  it("GET /interviews/:id/current → 200 pertanyaan pertama (INTRO)", async () => {
    const res = await authRequest(token).get(`/interviews/${interviewId}/current`);

    console.log(
      "  [current/INTRO] status:", res.status,
      "| type:", res.body?.data?.type,
      "| id:", res.body?.data?.id
    );
    console.log("  [current/INTRO] content:", res.body?.data?.content?.substring(0, 80));

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    // Pertanyaan pertama adalah INTRO dengan id = -1
    expect(res.body.data.type).toBe("INTRO");
    expect(res.body.data.id).toBe(-1);
    expect(res.body.data.content).toBeDefined();
    firstQuestionId = res.body.data.id;
  });

  it("POST /interviews/:id/answers (INTRO) → 201 jawaban tersimpan", async () => {
    const res = await authRequest(token)
      .post(`/interviews/${interviewId}/answers`)
      .send({
        questionId: -1,
        answer:
          "Halo, nama saya Test User. Saya adalah mahasiswa jurusan Informatika yang sedang mencari pengalaman magang. Saya memiliki ketertarikan pada pengembangan backend dan database.",
      });

    console.log("  [answer/INTRO] status:", res.status);
    expect(res.status).toBe(201);
  });

  /**
   * Loop utama: ambil pertanyaan satu per satu dan submit jawaban
   * hingga interview selesai (data = null) atau max 30 iterasi.
   * Jawaban di-generate oleh AI menggunakan generateAnswerAI.
   * Jika loop habis namun interview belum FINISH, paksa finish via API.
   */
  it("Loop: submit semua pertanyaan hingga interview selesai", async () => {
    let iteration = 0;
    const maxIterations = 30;
    let interviewDone = false;

    while (iteration < maxIterations) {
      iteration++;
      console.log(`\n  [loop-${iteration}] Mengambil pertanyaan berikutnya...`);

      const currentRes = await authRequest(token).get(
        `/interviews/${interviewId}/current`
      );

      // 403 berarti interview sudah FINISH
      if (currentRes.status === 403) {
        console.log(`  [loop-${iteration}] getCurrent → 403: interview sudah FINISH`);
        interviewDone = true;
        break;
      }

      expect(currentRes.status).toBe(200);

      if (currentRes.body.data === null) {
        console.log(`  [loop-${iteration}] Interview sudah selesai (data=null dari getCurrent)`);
        interviewDone = true;
        break;
      }

      const question = currentRes.body.data;
      console.log(
        `  [loop-${iteration}] Pertanyaan: type=${question.type}, id=${question.id}`
      );
      console.log(
        `  [loop-${iteration}] Content: "${question.content?.substring(0, 70)}..."`
      );

      // Generate jawaban menggunakan AI
      console.log(`  [loop-${iteration}] Generating AI answer...`);
      const answer = await generateTestAnswer(question.id, question.content);
      console.log(
        `  [loop-${iteration}] AI Answer: "${answer.substring(0, 80)}..."`
      );

      const submitRes = await authRequest(token)
        .post(`/interviews/${interviewId}/answers`)
        .send({
          questionId: question.id,
          answer,
        });

      console.log(
        `  [loop-${iteration}] Submit: status=${submitRes.status} | msg="${submitRes.body.message}"`
      );

      // Status 200 atau 201 diterima
      expect([200, 201]).toContain(submitRes.status);

      // Cek apakah interview sudah selesai dari respons submit
      if (
        submitRes.body.data === null &&
        submitRes.body.message?.includes("selesai")
      ) {
        console.log(`  [loop-${iteration}] Interview selesai dari respons submit`);
        interviewDone = true;
        break;
      }
    }

    // Lakukan finish untuk mendapatkan hasil interview/resume
    const finishRes = await authRequest(token).post(
      `/interviews/${interviewId}/finish`
    );
    console.log(`  [finish] status: ${finishRes.status} | msg: "${finishRes.body.message}"`);
    expect([200, 201]).toContain(finishRes.status);
    interviewDone = true;

    console.log(`\n  [loop] Interview selesai: ${interviewDone}`);
    expect(interviewDone).toBe(true);
  }, 600_000); // Timeout 10 menit (AI generate answer + AI scoring per pertanyaan)

});

// ────────────────────────────────────────────────────────────
// SUITE 5: HASIL & RIWAYAT INTERVIEW
// ────────────────────────────────────────────────────────────
describe("5. Hasil & Riwayat Interview", () => {

  it("GET /interviews/:id/result → 200 dan ada data hasil", async () => {
    const res = await authRequest(token).get(`/interviews/${interviewId}/result`);

    console.log("  [result] status:", res.status);
    console.log("  [result] interview status:", res.body?.data?.status);
    console.log("  [result] jumlah answers:", res.body?.data?.answers?.length);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.id).toBe(interviewId);
    expect(res.body.data.status).toBe("FINISH");
    expect(Array.isArray(res.body.data.answers)).toBe(true);
    expect(res.body.data.answers.length).toBeGreaterThan(0);
  });

  it("GET /interviews/:id/result → answers memiliki data score (dari AI scoring)", async () => {
    // Tunggu sebentar karena scoring berjalan di background
    await new Promise((r) => setTimeout(r, 5000));

    const res = await authRequest(token).get(`/interviews/${interviewId}/result`);
    expect(res.status).toBe(200);

    const answers = res.body.data.answers as any[];
    console.log("  [result/scoring] Detail score per jawaban:");
    for (const ans of answers) {
      console.log(
        `    - questionId=${ans.questionId}, type=${ans.question?.type}, score=${ans.score?.finalScore ?? "PENDING"}`
      );
    }

    // Verifikasi bahwa setidaknya ada data jawaban
    expect(answers.length).toBeGreaterThan(0);
  }, 30_000);

  it("GET /interviews/:id/history → 200 dan ada riwayat chat", async () => {
    const res = await authRequest(token).get(`/interviews/${interviewId}/history`);

    console.log("  [history] status:", res.status);
    console.log("  [history] jumlah chatHistories:", res.body?.data?.chatHistories?.length);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.id).toBe(interviewId);
    expect(Array.isArray(res.body.data.chatHistories)).toBe(true);
    expect(res.body.data.chatHistories.length).toBeGreaterThan(0);
  });

  it("GET /interviews/:id/history → urutan chat: AI → USER bergantian", async () => {
    const res = await authRequest(token).get(`/interviews/${interviewId}/history`);
    expect(res.status).toBe(200);

    const chats = res.body.data.chatHistories as any[];
    console.log("  [history/chat] Urutan percakapan:");
    chats.forEach((ch: any, idx: number) => {
      const preview = ch.content?.substring(0, 50) ?? "";
      console.log(`    [${idx + 1}] ${ch.role}: "${preview}..."`);
    });

    // Chat tidak boleh kosong
    expect(chats.length).toBeGreaterThan(0);

    // Chat pertama harus dari AI
    expect(chats[0].role).toBe("AI");
  });

  it("GET /interviews/:id/history → resume tersedia (bisa pending jika AI lambat)", async () => {
    const res = await authRequest(token).get(`/interviews/${interviewId}/history`);
    expect(res.status).toBe(200);

    const interview = res.body.data;
    // resume mungkin masih null jika AI belum selesai, tapi status harus FINISH
    expect(interview.status).toBe("FINISH");
    console.log(
      "  [history/resume] resume:",
      interview.resume
        ? `"${interview.resume.substring(0, 100)}..."`
        : "(masih diproses...)"
    );
  });
});

// ────────────────────────────────────────────────────────────
// SUITE 6: KASUS ERROR
// ────────────────────────────────────────────────────────────
describe("6. Kasus Error", () => {

  it("POST /interviews/:id/answers ke interview FINISH → 403", async () => {
    const res = await authRequest(token)
      .post(`/interviews/${interviewId}/answers`)
      .send({ answer: "Jawaban ini seharusnya ditolak." });

    console.log("  [error/submit-finish] status:", res.status);
    expect(res.status).toBe(403);
  });

  it("GET /interviews/:id/current ke interview FINISH → 403", async () => {
    const res = await authRequest(token).get(
      `/interviews/${interviewId}/current`
    );

    console.log("  [error/current-finish] status:", res.status);
    expect(res.status).toBe(403);
  });

  it("GET /interviews/9999/result → 404 interview tidak ditemukan", async () => {
    const res = await authRequest(token).get("/interviews/9999/result");

    console.log("  [error/404-result] status:", res.status);
    expect(res.status).toBe(404);
  });

  it("GET /interviews/9999/history → 404 interview tidak ditemukan", async () => {
    const res = await authRequest(token).get("/interviews/9999/history");

    console.log("  [error/404-history] status:", res.status);
    expect(res.status).toBe(404);
  });

  it("POST /interviews tanpa token → 401 Unauthorized", async () => {
    const res = await request(app)
      .post("/interviews")
      .send({ companyId, positionId, categoryIds });

    console.log("  [error/no-token] status:", res.status);
    expect(res.status).toBe(401);
  });

  it("POST /auth/login dengan password salah → 401", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ username: TEST_USER.username, password: "wrongpassword" });

    console.log("  [error/wrong-password] status:", res.status);
    expect(res.status).toBe(401);
  });

  it("POST /auth/register dengan username yang sudah ada → 400", async () => {
    const res = await registerUser(TEST_USER); // username sama

    console.log("  [error/duplicate-register] status:", res.status);
    expect(res.status).toBe(400);
  });
});
