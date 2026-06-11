# 🎤 Prompt Alur Interview — Wawancara AI

> Hanya prompt yang benar-benar digunakan selama sesi interview berlangsung,
> disusun sesuai urutan eksekusi.
>
> Sumber: [`src/services/ai.service.ts`](./src/services/ai.service.ts) ·
> [`src/services/interview.service.ts`](./src/services/interview.service.ts) ·
> [`src/services/scoring.service.ts`](./src/services/scoring.service.ts)

---

## Urutan Alur

```
1. Generate Intro Message        → Sapaan pembuka personal
2. Rephrase Pertanyaan           → Setiap pertanyaan diparafrasekan agar natural
3. Validasi Jawaban              → Cek relevansi & kesopanan jawaban
4. [Scoring paralel, background]
   ├─ TECHNICAL  → Rubrik Teknikal + Similarity + Keyword
   └─ SOFTSKILL  → Klasifikasi Kategori + Rubrik Soft Skill + Similarity + Keyword
5. Generate Resume Interview     → Ringkasan evaluatif akhir sesi
```

---

## 1. Generate Intro Message

**Kapan dipakai:** Awal interview — sebelum pertanyaan pertama dikirim.
**Fungsi:** `generateIntroMessage(userName, companyName, positionName)`

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

**Output:** `string` — satu pertanyaan sapaan pembuka

---

## 2. Rephrase Pertanyaan

**Kapan dipakai:** Setiap kali pertanyaan (GENERAL / SOFTSKILL / TECHNICAL) akan ditampilkan ke kandidat — pertanyaan dari DB diparafrasekan agar terdengar natural di konteks chat.
**Fungsi:** `rephraseQuestion(originalQuestion)`

```
Role:
Anda adalah HR atau User Interviewer yang sedang mewawancarai kandidat mahasiswa
secara lisan/chat.

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
> Prompt disimpan di kolom `prompt` tabel `ChatHistory`.

---

## 3. Validasi Jawaban

**Kapan dipakai:** Setiap kali kandidat mengirimkan jawaban — sebelum jawaban disimpan ke DB.
**Fungsi:** `validateInterviewInput(pertanyaan, jawaban)`

```
Role:
Anda adalah evaluator jawaban interview yang menilai kesesuaian antara pertanyaan
dan jawaban.

Task:
Periksa apakah jawaban relevan, sopan, dan benar-benar menjawab pertanyaan.

Data:
<start_of_data>
Pertanyaan: {{pertanyaan}}
Jawaban: {{jawaban}}
<end_of_data>

Format:
Kembalikan hanya JSON dengan format:
{"valid": true/false, "alasan": "alasan singkat jika tidak valid"}.
```

**Output:** `{ "valid": true/false, "alasan": "..." }`

---

## 4A. Scoring — Technical

**Kapan dipakai:** Background, setelah jawaban TECHNICAL tersimpan.
**Komponen:** Rubrik AI (50%) + Similarity (30%) + Keyword (20%)

### Rubrik Teknikal

**Fungsi:** `generateTechnicalRubricScore(pertanyaan, jawaban, questionCategory?, retryHint?)`

```
Role:
Anda adalah penilai jawaban teknikal untuk interview kerja di bidang teknologi
informasi.

Task:
Lakukan penilaian dalam 2 langkah berikut:

Langkah 1 — Cek relevansi terhadap kategori pertanyaan:
[Jika questionCategory tersedia]
Periksa apakah jawaban kandidat benar-benar menjawab pertanyaan yang berkaitan
dengan topik "{{questionCategory}}".
- Jika jawaban TIDAK berkaitan → beri semua rubrik nilai 0 dan confidence rendah
  (0.1–0.3).
- Jika jawaban BERKAITAN → lanjutkan ke Langkah 2.

Langkah 2 — Nilai rubrik secara objektif:
Nilai jawaban kandidat berdasarkan 4 rubrik berikut. Setiap rubrik dinilai 0-5.

Rubrik:
- understanding          (0-5): Kedalaman pemahaman konsep yang ditunjukkan dalam
                                jawaban.
- technicalAccuracy      (0-5): Kebenaran detail teknis, terminologi, dan fakta
                                yang digunakan.
- problemSolving         (0-5): Kualitas penalaran logis dan pendekatan dalam
                                menyelesaikan masalah.
- technicalCommunication (0-5): Kejelasan dan ketepatan dalam menjelaskan konsep
                                teknis.

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
  "reason": "alasan singkat — sebutkan relevansi dengan topik dan justifikasi skor"
}
```

**Retry Hint:** `"Penilaian sebelumnya kurang yakin. Fokus pada bukti teknis eksplisit dalam jawaban. Jangan memberikan skor tinggi tanpa justifikasi yang jelas."`

**Formula Final Score Technical:**
```
finalScore = (rubricScore×0.50 + similarityScore×0.30 + keywordScore×0.20) × 100
```

---

## 4B. Scoring — Soft Skill

**Kapan dipakai:** Background, setelah jawaban SOFTSKILL tersimpan.
**Komponen:** Rubrik AI (40%) + Category Score (30%) + Similarity (20%) + Keyword (10%)

### Klasifikasi Kategori

**Fungsi:** `classifySoftSkillAnswer(pertanyaan, jawaban, categories[], retryHint?)`

```
Role:
Anda adalah assessor jawaban soft skill untuk interview kerja.

Task:
Pilih SATU kategori dari daftar yang tersedia yang paling sesuai dengan isi
jawaban kandidat.
Anda DILARANG membuat kategori baru. Jika tidak ada yang cocok, pilih
"Tidak ada kategori yang sesuai".

[Opsional — jika confidence < 0.65]:
Tambahan instruksi:
{{retryHint}}

Data:
Pertanyaan: {{pertanyaan}}
Jawaban: {{jawaban}}

Kategori tersedia:
1. {{label_kategori_1}} (bobot: {{score_1}})
2. {{label_kategori_2}} (bobot: {{score_2}})
...
N. Tidak ada kategori yang sesuai (bobot: 0)

Format:
Kembalikan HANYA JSON dengan format berikut, tanpa teks lain:
{
  "categoryId": <nomor urut kategori terpilih (1-based)>,
  "label": "<label kategori persis seperti dalam daftar>",
  "confidence": 0-1,
  "reason": "alasan singkat dalam satu kalimat"
}
Pastikan nilai "label" persis sama (termasuk huruf besar/kecil) dengan salah satu
label dalam daftar.
```

**Retry Hint:** `"Klasifikasi sebelumnya kurang yakin. Pilih kategori berdasarkan bukti eksplisit dalam jawaban. Jangan membuat asumsi."`

---

### Rubrik Soft Skill

**Fungsi:** `generateSoftSkillRubricScore(pertanyaan, jawaban, questionCategory?, retryHint?)`

```
Role:
Anda adalah penilai jawaban soft skill untuk interview kerja.

Task:
Lakukan penilaian dalam 2 langkah berikut:

Langkah 1 — Cek relevansi terhadap kategori pertanyaan:
[Jika questionCategory tersedia]
Periksa apakah jawaban kandidat benar-benar menjawab pertanyaan yang berkaitan
dengan topik "{{questionCategory}}".
- Jika jawaban TIDAK berkaitan → beri semua rubrik nilai 0 dan confidence rendah
  (0.1–0.3).
- Jika jawaban BERKAITAN → lanjutkan ke Langkah 2.

Langkah 2 — Nilai rubrik secara objektif:
Nilai jawaban kandidat berdasarkan 4 rubrik berikut. Setiap rubrik dinilai 0-5.

Rubrik:
- communication    (0-5): Seberapa jelas dan terstruktur kandidat menyampaikan
                          jawaban.
- selfAwareness    (0-5): Seberapa baik kandidat mengenali kelebihan dan
                          keterbatasan diri.
- behaviorEvidence (0-5): Apakah kandidat memberikan contoh konkret perilaku di
                          masa lalu untuk mendukung klaimnya?
- growthMindset    (0-5): Apakah kandidat menunjukkan kesadaran akan area
                          pengembangan dan keinginan untuk belajar?

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
  "reason": "alasan singkat — sebutkan relevansi dengan topik dan justifikasi skor"
}
```

**Retry Hint:** `"Penilaian sebelumnya kurang meyakinkan. Fokus pada bukti eksplisit komunikasi, kesadaran diri, dan relevansi jawaban."`

**Formula Final Score Soft Skill:**
```
finalScore = (rubricScore×0.40 + categoryScore×0.30 + similarityScore×0.20 + keywordScore×0.10) × 100
```

---

## 5. Generate Resume Interview (Final)

**Kapan dipakai:** Setelah interview selesai (`Status.FINISH`) — dipanggil oleh `processResume()`.
**Fungsi:** `generateInterviewResume(qnaList[])`

```
Role:
Anda adalah HR yang profesional dan ahli dalam mengevaluasi performa interview
kandidat mahasiswa.

Task:
Buatlah resume (ringkasan) singkat dari hasil interview berikut.
Evaluasi secara umum kelebihan, kekurangan, dan poin penting dari jawaban kandidat.

Data:
<start_of_data>
Hasil Wawancara:
Question 1: {{pertanyaan_1}}
Answer 1: {{jawaban_1}}

Question 2: {{pertanyaan_2}}
Answer 2: {{jawaban_2}}

...
<end_of_data>

Format:
Kembalikan resume dalam bentuk teks paragraf biasa,
gunakan bahasa yang profesional, jelas, dan memotivasi.
```

**Output:** `{ resume: string, prompt: string }`
> Hasil disimpan di kolom `resume` dan `resumePrompt` tabel `Interview`.

---

## Ringkasan

| # | Prompt | Dipanggil Oleh | Waktu Eksekusi |
|---|---|---|---|
| 1 | Generate Intro | `getNextQuestion()` | Awal sesi — sebelum pertanyaan pertama |
| 2 | Rephrase Pertanyaan | `getNextQuestion()` | Setiap pertanyaan baru (GENERAL / SOFTSKILL / TECHNICAL) |
| 3 | Validasi Jawaban | Controller `submitAnswer` | Saat kandidat submit jawaban |
| 4A | Rubrik Teknikal | `scoreTechnicalAnswer()` | Background setelah jawaban TECHNICAL tersimpan |
| 4B | Klasifikasi + Rubrik SoftSkill | `scoreSoftSkillAnswer()` | Background setelah jawaban SOFTSKILL tersimpan |
| 5 | Resume Interview | `processResume()` | Setelah interview selesai (FINISH) |

---

*Diperbarui: Juni 2026*
