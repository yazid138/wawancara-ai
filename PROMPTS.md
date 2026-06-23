# 📋 Dokumentasi Prompt AI — Proyek Wawancara AI

> Semua prompt yang digunakan dalam sistem wawancara berbasis AI.
> Sumber utama: [`src/services/ai.service.ts`](./src/services/ai.service.ts)

---

## Daftar Isi

1. [Validasi Jawaban Interview](#1-validasi-jawaban-interview)
2. [Generate Panjang Minimum Jawaban](#2-generate-panjang-minimum-jawaban)
3. [Generate Kata Kunci](#3-generate-kata-kunci)
4. [Generate Pertanyaan Interview](#4-generate-pertanyaan-interview)
5. [Generate Jawaban AI (Contoh)](#5-generate-jawaban-ai-contoh)
6. [Generate Skor AI (Legacy)](#6-generate-skor-ai-legacy)
7. [Generate Skor Rubrik Teknikal](#7-generate-skor-rubrik-teknikal)
8. [Generate Skor Rubrik Soft Skill](#8-generate-skor-rubrik-soft-skill)
9. [Klasifikasi Jawaban Soft Skill](#9-klasifikasi-jawaban-soft-skill)
10. [Generate Kategori Jawaban](#10-generate-kategori-jawaban)
11. [Generate Jawaban Ideal](#11-generate-jawaban-ideal)
12. [Generate Resume Interview](#12-generate-resume-interview)
13. [Generate Pesan Pembuka (Intro)](#13-generate-pesan-pembuka-intro)
14. [Rephrase Pertanyaan](#14-rephrase-pertanyaan)
15. [Template Prompt Umum](#15-template-prompt-umum)
16. [Generate Follow-Up Question](#16-generate-follow-up-question)

---

## 1. Validasi Jawaban Interview

**Fungsi:** `validateInterviewInput(pertanyaan, jawaban)`
**File:** [`src/services/ai.service.ts` — L35](./src/services/ai.service.ts)
**Tujuan:** Memeriksa apakah jawaban relevan, sopan, dan menjawab pertanyaan yang diberikan.

```
Role:
Anda adalah evaluator jawaban interview yang menilai kesesuaian antara pertanyaan dan jawaban.

Task:
Periksa apakah jawaban relevan, sopan, dan benar-benar menjawab pertanyaan.

Data:
<start_of_data>
Pertanyaan: {{pertanyaan}}
Jawaban: {{jawaban}}
<end_of_data>

Format:
Kembalikan hanya JSON dengan format {"valid": true/false, "alasan": "alasan singkat jika tidak valid"}.
```

**Output:** `{ "valid": true/false, "alasan": "..." }`

---

## 2. Generate Panjang Minimum Jawaban

**Fungsi:** `generateMinLength(pertanyaan)`
**File:** [`src/services/ai.service.ts` — L54](./src/services/ai.service.ts)
**Tujuan:** Menentukan estimasi panjang minimal karakter/kata jawaban yang masih memadai.

```
Role:
Anda membantu menentukan standar minimum panjang jawaban interview.

Task:
Tentukan estimasi panjang minimal jawaban yang masih memadai untuk menjawab pertanyaan.

Data:
Pertanyaan: {{pertanyaan}}

Format:
Kembalikan hanya bilangan integer.
```

**Output:** `integer` (jumlah karakter minimum)

---

## 3. Generate Kata Kunci

**Fungsi:** `generateKeyword(pertanyaan)`
**File:** [`src/services/ai.service.ts` — L72](./src/services/ai.service.ts)
**Tujuan:** Membuat 5 kata kunci spesifik yang mencerminkan inti jawaban yang baik.

```
Role:
Anda menyusun kata kunci untuk mengevaluasi kualitas jawaban interview.

Task:
Buat 5 kata kunci yang spesifik, relevan, dan benar-benar mencerminkan inti jawaban yang baik
dari pertanyaan ini. Hindari penggunaan simbol, untuk garis miring (/), pisahkan jadi 2 kata kunci.

Data:
Pertanyaan: {{pertanyaan}}

Example:
Input: "Apa itu API?"
Output: ["API", "Antarmuka", "Komunikasi", "Software", "Data"]

Format:
Kembalikan hanya JSON array string dengan 5 kata kunci.
Dilarang menambahkan karakter lain selain JSON array string.
```

**Output:** `["kata1", "kata2", "kata3", "kata4", "kata5"]`

---

## 4. Generate Pertanyaan Interview

**Fungsi:** `generateQuestion()`
**File:** [`src/services/ai.service.ts` — L94](./src/services/ai.service.ts)
**Tujuan:** Membuat satu pertanyaan interview untuk bidang teknologi informasi.

```
Role:
Anda adalah pembuat pertanyaan interview untuk bidang teknologi informasi.

Task:
Buat satu pertanyaan yang natural, relevan, dan berguna untuk menilai kandidat.

Data:
Gunakan gaya pertanyaan interview yang singkat dan jelas.

Format:
Kembalikan hanya satu pertanyaan dalam teks biasa.
```

**Output:** `string` (satu pertanyaan)

---

## 5. Generate Jawaban AI (Contoh)

**Fungsi:** `generateAnswerAI(pertanyaan, keyword[])`
**File:** [`src/services/ai.service.ts` — L112](./src/services/ai.service.ts)
**Tujuan:** Membuat jawaban contoh yang profesional dan natural berdasarkan kata kunci yang tersedia.

```
Role:
Anda adalah kandidat interview yang harus menjawab secara profesional dan natural.

Task:
Buat jawaban yang relevan, ringkas, dan menyatu secara wajar dengan kata kunci yang tersedia.

Data:
Pertanyaan: {{pertanyaan}}
Kata Kunci: {{keyword1}}, {{keyword2}}, ...

Format:
Kembalikan hanya jawaban dalam teks biasa tanpa daftar kata kunci atau penjelasan tambahan.
```

**Output:** `string` (jawaban teks)

---

## 6. Generate Skor AI (Legacy)

**Fungsi:** `generateAIScore(pertanyaan, jawaban)`
**File:** [`src/services/ai.service.ts` — L134](./src/services/ai.service.ts)
**Tujuan:** Menilai jawaban berdasarkan 4 rubrik dasar *(fungsi lama, sudah digantikan rubrik baru)*.

```
Role:
Anda adalah penilai jawaban interview teknis.

Task:
Nilai jawaban berdasarkan rubrik Pemahaman Konsep, Logika Berpikir,
Problem Solving, dan Komunikasi Teknis.

Data:
<start_of_data>
Pertanyaan: {{pertanyaan}}
Jawaban: {{jawaban}}
<end_of_data>

Format:
Kembalikan hanya JSON dengan format:
{
  "pemahaman": 0-5,
  "logika": 0-5,
  "problem_solving": 0-5,
  "komunikasi": 0-5,
  "alasan": "singkat"
}
```

**Output:** `{ pemahaman, logika, problem_solving, komunikasi, alasan }`

---

## 7. Generate Skor Rubrik Teknikal

**Fungsi:** `generateTechnicalRubricScore(pertanyaan, jawaban, questionCategory?, retryHint?)`
**Builder:** `buildTechnicalRubricPrompt(pertanyaan, jawaban, questionCategory?, retryHint?)`
**File:** [`src/services/ai.service.ts` — L481](./src/services/ai.service.ts)
**Tujuan:** Menilai jawaban teknikal dengan 2 langkah: cek relevansi topik → nilai 4 rubrik (skor 0–5 masing-masing).

```
Role:
Anda adalah penilai jawaban teknikal untuk interview kerja di bidang teknologi informasi.

Task:
Lakukan penilaian dalam 2 langkah berikut:

Langkah 1 — Cek relevansi terhadap kategori pertanyaan:
[Jika questionCategory tersedia]
Periksa apakah jawaban kandidat benar-benar menjawab pertanyaan yang berkaitan dengan topik "{{questionCategory}}".
- Jika jawaban TIDAK berkaitan → beri semua rubrik nilai 0 dan confidence rendah (0.1–0.3).
- Jika jawaban BERKAITAN → lanjutkan ke Langkah 2.

Langkah 2 — Nilai rubrik secara objektif:
Nilai jawaban kandidat berdasarkan 4 rubrik berikut. Setiap rubrik dinilai 0-5.

Rubrik:
- understanding          (0-5): Kedalaman pemahaman konsep yang ditunjukkan dalam jawaban.
- technicalAccuracy      (0-5): Kebenaran detail teknis, terminologi, dan fakta yang digunakan.
- problemSolving         (0-5): Kualitas penalaran logis dan pendekatan dalam menyelesaikan masalah.
- technicalCommunication (0-5): Kejelasan dan ketepatan dalam menjelaskan konsep teknis.

[Opsional — jika confidence < 0.65 pada percobaan pertama]:
Tambahan instruksi:
{{retryHint}}

Data:
[Jika questionCategory tersedia]
Kategori Pertanyaan: {{questionCategory}}
Pertanyaan: {{pertanyaan}}
Jawaban: {{jawaban}}

Format:
Kembalikan HANYA JSON dengan format berikut, tanpa teks lain:
{
  "understanding": 0-5,
  "technicalAccuracy": 0-5,
  "problemSolving": 0-5,
  "technicalCommunication": 0-5,
  "confidence": 0-1,
  "reason": "alasan singkat — sebutkan relevansi dengan topik dan justifikasi skor rubrik"
}
```

**Retry Hint (dipakai jika `confidence < 0.65`):**
> "Penilaian sebelumnya kurang yakin. Fokus pada bukti teknis eksplisit dalam jawaban. Jangan memberikan skor tinggi tanpa justifikasi yang jelas."

**Output:** `{ understanding, technicalAccuracy, problemSolving, technicalCommunication, confidence, reason }`

**Formula Skor Akhir (Technical):**
| Komponen | Bobot |
|---|---|
| Rubrik AI (`rubricScore`) | 50% |
| Similarity Score (pgvector top-3 avg) | 30% |
| Keyword Score | 20% |

---

## 8. Generate Skor Rubrik Soft Skill

**Fungsi:** `generateSoftSkillRubricScore(pertanyaan, jawaban, questionCategory?, retryHint?)`
**Builder:** `buildSoftSkillRubricPrompt(pertanyaan, jawaban, questionCategory?, retryHint?)`
**File:** [`src/services/ai.service.ts` — L427](./src/services/ai.service.ts)
**Tujuan:** Menilai jawaban soft skill dengan 2 langkah: cek relevansi topik → nilai 4 rubrik (skor 0–5 masing-masing).

```
Role:
Anda adalah penilai jawaban soft skill untuk interview kerja.

Task:
Lakukan penilaian dalam 2 langkah berikut:

Langkah 1 — Cek relevansi terhadap kategori pertanyaan:
[Jika questionCategory tersedia]
Periksa apakah jawaban kandidat benar-benar menjawab pertanyaan yang berkaitan dengan topik "{{questionCategory}}".
- Jika jawaban TIDAK berkaitan → beri semua rubrik nilai 0 dan confidence rendah (0.1–0.3).
- Jika jawaban BERKAITAN → lanjutkan ke Langkah 2.

Langkah 2 — Nilai rubrik secara objektif:
Nilai jawaban kandidat berdasarkan 4 rubrik berikut. Setiap rubrik dinilai 0-5.

Rubrik:
- communication    (0-5): Seberapa jelas dan terstruktur kandidat menyampaikan jawaban.
- selfAwareness    (0-5): Seberapa baik kandidat mengenali kelebihan dan keterbatasan diri.
- behaviorEvidence (0-5): Apakah kandidat memberikan contoh konkret perilaku di masa lalu
                          untuk mendukung klaimnya?
- growthMindset    (0-5): Apakah kandidat menunjukkan kesadaran akan area pengembangan
                          dan keinginan untuk belajar?

[Opsional — jika confidence < 0.65 pada percobaan pertama]:
Tambahan instruksi:
{{retryHint}}

Data:
[Jika questionCategory tersedia]
Kategori Pertanyaan: {{questionCategory}}
Pertanyaan: {{pertanyaan}}
Jawaban: {{jawaban}}

Format:
Kembalikan HANYA JSON dengan format berikut, tanpa teks lain:
{
  "communication": 0-5,
  "selfAwareness": 0-5,
  "behaviorEvidence": 0-5,
  "growthMindset": 0-5,
  "confidence": 0-1,
  "reason": "alasan singkat — sebutkan relevansi dengan topik dan justifikasi skor rubrik"
}
```

**Retry Hint (dipakai jika `confidence < 0.65`):**
> "Penilaian sebelumnya kurang meyakinkan. Fokus pada bukti eksplisit komunikasi, kesadaran diri, dan relevansi jawaban."

**Output:** `{ communication, selfAwareness, behaviorEvidence, growthMindset, confidence, reason }`

**Formula Skor Akhir (Soft Skill):**
| Komponen | Bobot |
|---|---|
| Rubrik AI (`rubricScore`) | 40% |
| Category Score | 30% |
| Similarity Score (pgvector top-3 avg, per kategori) | 20% |
| Keyword Score | 10% |

---

## 9. Klasifikasi Jawaban Soft Skill

**Fungsi:** `classifySoftSkillAnswer(pertanyaan, jawaban, categories[], questionCategory?, retryHint?)`
**Builder:** `buildSoftSkillClassificationPrompt(pertanyaan, jawaban, categories[], questionCategory?, retryHint?)`
**File:** [`src/services/ai.service.ts` — L380](./src/services/ai.service.ts)
**Tujuan:** Memilih satu kategori dari daftar yang paling sesuai dengan isi jawaban kandidat.

```
Role:
Anda adalah assessor jawaban soft skill untuk interview kerja.

Task:
Pilih SATU kategori dari daftar yang tersedia yang paling sesuai dengan isi jawaban kandidat.
Anda DILARANG membuat kategori baru. Jika tidak ada yang cocok, pilih "Tidak ada kategori yang sesuai".

[Optional retry hint jika confidence < 0.70]:
Tambahan instruksi:
{{retryHint}}

Data:
[Jika questionCategory tersedia]
Kategori Pertanyaan: {{questionCategory}}
Pertanyaan: {{pertanyaan}}
Jawaban: {{jawaban}}

Kategori tersedia:
1. {{label_kategori_1}} [categoryId:1](bobot: {{score_1}})
2. {{label_kategori_2}} [categoryId:2](bobot: {{score_2}})
...
N. Tidak ada kategori yang sesuai [categoryId:0](bobot: 0)

Format:
Kembalikan HANYA JSON dengan format berikut, tanpa teks lain:
{
  "categoryId": <id kategori terpilih>,
  "label": "<label kategori persis seperti dalam daftar>",
  "confidence": 0-1,
  "reason": "alasan singkat dalam satu kalimat"
}
Pastikan nilai "label" persis sama (termasuk huruf besar/kecil) dengan salah satu label dalam daftar.
```

**Retry Hint (dipakai jika `confidence < 0.70`):**
> "Klasifikasi sebelumnya kurang yakin. Pilih kategori berdasarkan bukti eksplisit dalam jawaban. Jangan membuat asumsi."

**Output:** `{ categoryId, label, confidence, reason }`

---

## 10. Generate Kategori Jawaban

**Fungsi:** `generateAnswerCategories(pertanyaan)`
**File:** [`src/services/ai.service.ts` — L213](./src/services/ai.service.ts)
**Tujuan:** Membuat beberapa kategori jawaban realistis dengan bobot skor untuk pertanyaan soft skill.

```
Role:
Anda adalah perancang kategori penilaian untuk pertanyaan interview soft skill.

Task:
Buat beberapa kategori jawaban yang realistis, berurutan, dan memiliki bobot yang masuk akal
dari pertanyaan ini. Label harus singkat dan jelas. Score 1-5.

Data:
Pertanyaan: {{pertanyaan}}

Example:
<start_of_example>
input: Bagaimana anda menyesuaikan diri dengan aturan yang berlaku di tempat magang?
output: [
  { "label": "Mudah Beradaptasi", "score": 4 },
  { "label": "Bisa beradaptasi", "score": 3 },
  { "label": "Sulit beradaptasi", "score": 2 },
  { "label": "Tidak mau beradaptasi", "score": 1 }
]

input: Bagaimana Anda menilai diri sendiri dibandingkan dengan teman-teman Anda
       dalam bidang yang Anda lamar saat ini?
output: [
  { "label": "Sangat Unggul", "score": 4 },
  { "label": "Unggul", "score": 3 },
  { "label": "Rata-rata", "score": 2 },
  { "label": "Dibawah rata-rata", "score": 1 }
]

input: Jika anda memiliki tugas yang sudah tenggat waktu, Apa yang anda lakukan?
output: [
  { "label": "Berusaha menyelesaikan", "score": 3 },
  { "label": "Mencoba menyelesaikan lalu kumpulkan seadanya", "score": 2 },
  { "label": "Menyerah", "score": 1 }
]

input: Seberapa sering anda memimpin sebuah tim atau kelompok?
output: [
  { "label": "Sangat sering", "score": 5 },
  { "label": "Sering", "score": 4 },
  { "label": "Jarang", "score": 3 },
  { "label": "Sangat jarang", "score": 2 },
  { "label": "Tidak pernah", "score": 1 }
]
</end_of_example>

Format:
PENTING: Kembalikan HANYA 1 JSON array. Tidak boleh ada teks lain.
Format: [{"label": "kategori", "score": 0-5}].
```

**Output:** `[{ "label": "...", "score": 0-5 }, ...]`

---

## 11. Generate Jawaban Ideal

**Fungsi:** `generateIdealAnswer(pertanyaan, kategori?)`
**File:** [`src/services/ai.service.ts` — L266](./src/services/ai.service.ts)
**Tujuan:** Membuat satu contoh jawaban ideal. Ada dua varian tergantung apakah kategori disertakan.

### Varian A — Dengan Kategori

```
Role:
Anda adalah mahasiswa yang sedang menjawab pertanyaan interview kerja.

Task:
Buat contoh jawaban wawancara yang secara akurat mencerminkan karakteristik
kategori: "{{kategori}}".
Jawaban harus natural, realistis, dan dalam bahasa Indonesia sehari-hari.

Data:
Pertanyaan: {{pertanyaan}}

Format:
PENTING: Kembalikan HANYA 1 (satu) kalimat jawaban dalam teks biasa.
Jangan memberikan daftar, variasi, atau teks tambahan apapun.
```

### Varian B — Tanpa Kategori (Jawaban Ideal Umum)

```
Role:
Anda adalah mahasiswa yang sedang menjawab pertanyaan interview kerja.

Task:
Buat jawaban ideal yang singkat, jelas, natural, dan meyakinkan.

Data:
Pertanyaan: {{pertanyaan}}

Format:
PENTING: Kembalikan HANYA 1 (satu) kalimat jawaban dalam teks biasa.
Jangan memberikan daftar, variasi, atau teks tambahan apapun.
```

**Output:** `string` (satu kalimat jawaban)

---

## 12. Generate Resume Interview

**Fungsi:** `generateInterviewResume(qnaList[])`
**File:** [`src/services/ai.service.ts` — L301](./src/services/ai.service.ts)
**Tujuan:** Membuat ringkasan evaluatif dari keseluruhan hasil sesi interview. Setiap item Q&A disertai kategori pertanyaan untuk evaluasi yang lebih kontekstual.

```
Role:
Anda adalah HR yang profesional dan ahli dalam mengevaluasi performa interview
kandidat mahasiswa.

Task:
Buatlah resume (ringkasan) singkat dari hasil interview berikut.
Evaluasi secara umum kelebihan, kekurangan, dan poin penting dari jawaban kandidat.
Setiap pertanyaan memiliki kategori yang menunjukkan topik atau kompetensi yang
diuji. Gunakan informasi ini untuk memberikan evaluasi yang lebih kontekstual dan
tepat sasaran.

Data:
<start_of_data>
Hasil Wawancara:
Pertanyaan 1 [Kategori: {{kategori_1}}]: {{pertanyaan_1}}
Jawaban 1: {{jawaban_1}}

Pertanyaan 2 [Kategori: {{kategori_2}}]: {{pertanyaan_2}}
Jawaban 2: {{jawaban_2}}

Pertanyaan 3: {{pertanyaan_3}}          ← (tanpa [Kategori] jika pertanyaan tidak punya kategori, mis. INTRO)
Jawaban 3: {{jawaban_3}}

...
<end_of_data>

Format:
Kembalikan resume dalam bentuk teks paragraf biasa,
gunakan bahasa yang profesional, jelas, dan memotivasi.
```

**Output:** `{ resume: string, prompt: string }`
> Prompt yang digunakan disimpan di kolom `resumePrompt` pada tabel `Interview`.

---

## 13. Generate Pesan Pembuka (Intro)

**Fungsi:** `generateIntroMessage(userName, companyName, positionName)`
**File:** [`src/services/ai.service.ts` — L331](./src/services/ai.service.ts)
**Tujuan:** Membuat pertanyaan sapaan pembuka interview yang personal dan ramah.

```
Role:
Anda adalah HR yang ramah dan sedang memulai sesi interview dengan seorang kandidat.

Task:
Buatlah satu pertanyaan sapaan pembuka (Intro) yang menyapa kandidat,
menyebutkan nama perusahaan, dan posisi yang dilamar.
Mintalah kandidat untuk memperkenalkan diri secara singkat dan alasan mengapa
mereka tertarik dengan posisi ini.

Data:
Nama Kandidat: {{userName}}
Perusahaan: {{companyName}}
Posisi: {{positionName}}

Format:
Kembalikan hanya teks pertanyaan dalam bahasa Indonesia yang natural dan ramah,
tanpa teks tambahan.
```

**Output:** `string` (satu pertanyaan pembuka)

---

## 14. Rephrase Pertanyaan

**Fungsi:** `rephraseQuestion(originalQuestion)`
**File:** [`src/services/ai.service.ts` — L356](./src/services/ai.service.ts)
**Tujuan:** Menulis ulang pertanyaan interview agar lebih natural dan bervariasi seperti percakapan nyata.

```
Role:
Anda adalah HR atau User Interviewer yang sedang mewawancarai kandidat mahasiswa secara lisan/chat.

Task:
Tulis ulang (rephrase) pertanyaan interview berikut agar terdengar lebih natural,
ramah dan bervariasi layaknya percakapan nyata,
tanpa mengubah inti kriteria pertanyaan tersebut.

Data:
Pertanyaan Asli: {{originalQuestion}}

Format:
PENTING: Kembalikan HANYA 1 (satu) kalimat pertanyaan hasil rephrase.
Jangan memberikan daftar, variasi, atau teks tambahan apapun.
```

**Output:** `{ rephrase: string, prompt: string }`
> Prompt yang digunakan disimpan di kolom `prompt` pada tabel `ChatHistory`.

---

## 15. Template Prompt Umum

**File:** [`src/prompt/template.prompt.txt`](./src/prompt/template.prompt.txt)
**Tujuan:** Template dasar untuk menilai kesesuaian kandidat berdasarkan posisi dan kriteria.

```
{{candidate_name}} is a {{candidate_position}} with {{candidate_experience}} years of experience.
Assess their suitability for the role based on the following criteria: {{criteria}}.
```

---

## 16. Generate Follow-Up Question

**Fungsi:** `generateFollowUpQuestion(question, answer, breakdown, confidence)`
**Builder:** `buildFollowUpPrompt(question, answer, breakdown, confidence)`
**File:** [`src/services/ai.service.ts`](./src/services/ai.service.ts)
**Tujuan:** Membuat pertanyaan follow-up yang tajam dan kontekstual berdasarkan jawaban kandidat yang dinilai kurang meyakinkan.

```
Role:
Kamu adalah AI interviewer yang sedang mewawancarai kandidat.

Task:
Buat SATU follow-up question berdasarkan pertanyaan dan jawaban berikut.
Rules:
- Gali bagian yang kurang jelas atau kurang didukung bukti konkret
- Jangan mengulang pertanyaan sebelumnya
- Maksimal 1 kalimat
- Fokus pada bukti konkret atau pengalaman nyata
- Hindari leading question

Data:
Pertanyaan: {{question}}
Jawaban kandidat: {{answer}}
Score breakdown: {{breakdown}}
Confidence: {{confidence}}

Format:
Kembalikan HANYA JSON dengan format berikut, tanpa teks lain:
{
  "followUpQuestion": "...",
  "reason": "alasan singkat mengapa follow-up ini perlu",
  "expectedSignal": "sinyal/bukti konkret yang diharapkan dari jawaban"
}
```

**Output:** `{ followUpQuestion: string, reason: string, expectedSignal: string }`

---

## Ringkasan Prompt per Fitur

| # | Prompt | Fungsi | Bahasa Output |
|---|--------|--------|---------------|
| 1 | Validasi Jawaban | Cek relevansi & kesopanan jawaban | JSON |
| 2 | Min. Panjang Jawaban | Estimasi min. karakter jawaban | Integer |
| 3 | Generate Keyword | 5 kata kunci evaluasi jawaban | JSON Array |
| 4 | Generate Pertanyaan | Buat pertanyaan interview baru | Teks |
| 5 | Jawaban AI Contoh | Contoh jawaban berbasis keyword | Teks |
| 6 | Skor AI (Legacy) | 4 rubrik skor dasar | JSON |
| 7 | Rubrik Teknikal | Cek relevansi topik + skor 4 dimensi teknikal (0–5) — **Bahasa Indonesia** | JSON |
| 8 | Rubrik Soft Skill | Cek relevansi topik + skor 4 dimensi soft skill (0–5) | JSON |
| 9 | Klasifikasi Soft Skill | Pilih kategori terbaik untuk jawaban | JSON |
| 10 | Kategori Jawaban | Buat daftar kategori + bobot skor | JSON Array |
| 11 | Jawaban Ideal | Contoh jawaban ideal (dengan/tanpa kategori) | Teks |
| 12 | Resume Interview | Ringkasan evaluatif keseluruhan interview | Teks Paragraf |
| 13 | Pesan Intro | Sapaan pembuka personal interview | Teks |
| 14 | Rephrase Pertanyaan | Variasi pertanyaan yang lebih natural | Teks |
| 15 | Template Umum | Template penilaian dasar kandidat | Teks |
| 16 | Generate Follow-Up Question | Membuat satu pertanyaan follow-up untuk jawaban lemah | JSON |

---

## Mekanisme Retry (Low Confidence)

Beberapa prompt menggunakan mekanisme **retry otomatis** jika nilai `confidence` yang dikembalikan AI kurang dari **0.65** (`LOW_CONFIDENCE_THRESHOLD`). Dalam hal ini, prompt diulang dengan tambahan instruksi (`retryHint`) untuk mendorong evaluasi yang lebih kritis.

Prompt yang menggunakan retry:
- [Rubrik Teknikal](#7-generate-skor-rubrik-teknikal) — `retryHint`: fokus pada bukti teknis eksplisit
- [Rubrik Soft Skill](#8-generate-skor-rubrik-soft-skill) — `retryHint`: fokus pada bukti komunikasi & kesadaran diri
- [Klasifikasi Soft Skill](#9-klasifikasi-jawaban-soft-skill) — `retryHint`: pilih kategori berdasarkan bukti eksplisit

Implementasi: [`src/utils/index.ts`](./src/utils/) — fungsi `retryIfLowConfidenceWithPrompt`

> **Catatan:** Untuk Rubrik Teknikal dan Soft Skill, AI juga terlebih dahulu mengecek relevansi jawaban terhadap `questionCategoryName` (Langkah 1) sebelum menilai rubrik (Langkah 2). Jawaban yang tidak relevan langsung mendapat semua rubrik bernilai **0** dan confidence rendah (0.1–0.3) tanpa perlu retry.

---

*Diperbarui: Juni 2026*
