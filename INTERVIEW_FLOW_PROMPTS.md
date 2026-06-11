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

### Contoh Prompt (Terisi)

```
Role:
Anda adalah HR yang ramah dan sedang memulai sesi interview dengan seorang kandidat.

Task:
Buatlah satu pertanyaan sapaan pembuka (Intro) yang menyapa kandidat,
menyebutkan nama perusahaan, dan posisi yang dilamar.
Mintalah kandidat untuk memperkenalkan diri secara singkat dan alasan mengapa
mereka tertarik dengan posisi ini.

Data:
Nama Kandidat: Yazid
Perusahaan: TechCorp Indonesia
Posisi: Backend Developer Intern

Format:
Kembalikan hanya teks pertanyaan dalam bahasa Indonesia yang natural dan ramah,
tanpa teks tambahan.
```

**Contoh Output:**
```
Halo Yazid, selamat datang di sesi wawancara untuk posisi Backend Developer Intern di TechCorp Indonesia! Senang sekali bisa mengobrol dengan Anda hari ini. Untuk memulai, silakan perkenalkan diri Anda secara singkat dan ceritakan alasan mengapa Anda tertarik untuk bergabung dengan kami di posisi ini.
```

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

### Contoh Prompt (Terisi)

```
Role:
Anda adalah HR atau User Interviewer yang sedang mewawancarai kandidat mahasiswa
secara lisan/chat.

Task:
Tulis ulang (rephrase) pertanyaan interview berikut agar terdengar lebih natural,
ramah dan bervariasi layaknya percakapan nyata,
tanpa mengubah inti kriteria pertanyaan tersebut.

Data:
Pertanyaan Asli: Apa perbedaan antara query SELECT dan UPDATE dalam database SQL, dan kapan Anda menggunakan masing-masing?

Format:
PENTING: Kembalikan HANYA 1 (satu) kalimat pertanyaan hasil rephrase.
Jangan memberikan daftar, variasi, atau teks tambahan apapun.
```

**Contoh Output:**
```
Bisa jelaskan tidak, menurut kamu apa sih perbedaan utama antara perintah SELECT dan UPDATE di SQL, serta dalam situasi apa kamu memakai keduanya?
```

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

### Contoh Prompt (Terisi)

**Kasus 1: Jawaban Valid**
```
Role:
Anda adalah evaluator jawaban interview yang menilai kesesuaian antara pertanyaan
dan jawaban.

Task:
Periksa apakah jawaban relevan, sopan, dan benar-benar menjawab pertanyaan.

Data:
<start_of_data>
Pertanyaan: Bisa jelaskan tidak, menurut kamu apa sih perbedaan utama antara perintah SELECT dan UPDATE di SQL, serta dalam situasi apa kamu memakai keduanya?
Jawaban: SELECT digunakan untuk mengambil data dari tabel, sedangkan UPDATE digunakan untuk mengubah data yang sudah ada di tabel database.
<end_of_data>

Format:
Kembalikan hanya JSON dengan format:
{"valid": true/false, "alasan": "alasan singkat jika tidak valid"}.
```

*Contoh Output:*
```json
{
  "valid": true,
  "alasan": "Jawaban relevan dan menjelaskan perbedaan mendasar antara SELECT dan UPDATE secara tepat."
}
```

**Kasus 2: Jawaban Tidak Valid (Tidak Relevan/OOT)**
```
Role:
Anda adalah evaluator jawaban interview yang menilai kesesuaian antara pertanyaan
dan jawaban.

Task:
Periksa apakah jawaban relevan, sopan, dan benar-benar menjawab pertanyaan.

Data:
<start_of_data>
Pertanyaan: Bisa jelaskan tidak, menurut kamu apa sih perbedaan utama antara perintah SELECT dan UPDATE di SQL, serta dalam situasi apa kamu memakai keduanya?
Jawaban: Saya suka sekali makan bakso karena rasanya sangat lezat dan pedas.
<end_of_data>

Format:
Kembalikan hanya JSON dengan format:
{"valid": true/false, "alasan": "alasan singkat jika tidak valid"}.
```

*Contoh Output:*
```json
{
  "valid": false,
  "alasan": "Jawaban sama sekali tidak relevan dengan pertanyaan tentang SELECT dan UPDATE di database SQL."
}
```

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

### Contoh Prompt (Terisi)

```
Role:
Anda adalah penilai jawaban teknikal untuk interview kerja di bidang teknologi
informasi.

Task:
Lakukan penilaian dalam 2 langkah berikut:

Langkah 1 — Cek relevansi terhadap kategori pertanyaan:
Periksa apakah jawaban kandidat benar-benar menjawab pertanyaan yang berkaitan
dengan topik "Database".
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

Data:
Kategori Pertanyaan: Database
Pertanyaan: Bagaimana Anda mengelola concurrency atau race condition di database?
Jawaban: Kita bisa pakai locking mechanism seperti pessimistic locking atau optimistic locking. Kalau pessimistic locking, baris database di-lock sampai transaksi selesai. Kalau optimistic, kita pakai kolom versi untuk deteksi konflik waktu update.

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

**Contoh Output:**
```json
{
  "understanding": 4,
  "technicalAccuracy": 4,
  "problemSolving": 4,
  "technicalCommunication": 4,
  "confidence": 0.95,
  "reason": "Jawaban relevan dengan kategori Database. Kandidat menunjukkan pemahaman yang baik mengenai race condition serta mampu membedakan pessimistic dan optimistic locking secara akurat dengan penyampaian yang terstruktur."
}
```

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

#### Contoh Prompt Klasifikasi (Terisi)

```
Role:
Anda adalah assessor jawaban soft skill untuk interview kerja.

Task:
Pilih SATU kategori dari daftar yang tersedia yang paling sesuai dengan isi
jawaban kandidat.
Anda DILARANG membuat kategori baru. Jika tidak ada yang cocok, pilih
"Tidak ada kategori yang sesuai".

Data:
Pertanyaan: Ceritakan pengalaman Anda saat harus memimpin kelompok di perkuliahan.
Jawaban: Saat itu ada tugas besar, tapi satu anggota pasif. Saya mengobrol dengannya secara personal untuk membagi tugas kembali yang sesuai dengan kemampuannya, sehingga tugas selesai tepat waktu.

Kategori tersedia:
1. Leadership (bobot: 5)
2. Conflict Resolution (bobot: 5)
3. Communication (bobot: 4)
4. Tidak ada kategori yang sesuai (bobot: 0)

Format:
Kembalikan HANYA JSON dengan format berikut, tanpa teks lain:
{
  "categoryId": 1,
  "label": "Leadership",
  "confidence": 0-1,
  "reason": "alasan singkat dalam satu kalimat"
}
Pastikan nilai "label" persis sama (termasuk huruf besar/kecil) dengan salah satu
label dalam daftar.
```

**Contoh Output Klasifikasi:**
```json
{
  "categoryId": 1,
  "label": "Leadership",
  "confidence": 0.9,
  "reason": "Jawaban kandidat secara langsung menceritakan tindakan kepemimpinan dalam membagi ulang tugas kelompok demi mengatasi masalah internal."
}
```

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

#### Contoh Prompt Rubrik Soft Skill (Terisi)

```
Role:
Anda adalah penilai jawaban soft skill untuk interview kerja.

Task:
Lakukan penilaian dalam 2 langkah berikut:

Langkah 1 — Cek relevansi terhadap kategori pertanyaan:
Periksa apakah jawaban kandidat benar-benar menjawab pertanyaan yang berkaitan
dengan topik "Teamwork".
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

Data:
Kategori Pertanyaan: Teamwork
Pertanyaan: Ceritakan pengalaman Anda saat harus memimpin kelompok di perkuliahan.
Jawaban: Saat itu ada tugas besar, tapi satu anggota pasif. Saya mengobrol dengannya secara personal untuk membagi tugas kembali yang sesuai dengan kemampuannya, sehingga tugas selesai tepat waktu.

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

**Contoh Output Rubrik Soft Skill:**
```json
{
  "communication": 4,
  "selfAwareness": 3,
  "behaviorEvidence": 5,
  "growthMindset": 3,
  "confidence": 0.9,
  "reason": "Jawaban relevan dengan topik Teamwork. Kandidat berkomunikasi dengan runtut, memberikan bukti konkret perilaku masa lalu (mengobrol secara personal), namun aspek self-awareness dan growth mindset dinilai standar karena tidak menceritakan evaluasi diri pasca kejadian secara mendalam."
}
```

**Formula Final Score Soft Skill:**
```
finalScore = (rubricScore×0.40 + categoryScore×0.30 + similarityScore×0.20 + keywordScore×0.10) × 100
```

---

## 5. Generate Resume Interview (Final)

**Kapan dipakai:** Setelah interview selesai (`Status.FINISH`) — dipanggil oleh `processResume()`.
**Fungsi:** `generateInterviewResume(qnaList[])`
**qnaList type:** `Array<{ question: string; answer: string; category?: string }>`

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

Pertanyaan 3: {{pertanyaan_3}}    ← (tanpa [Kategori] jika tidak ada, mis. INTRO/GENERAL)
Jawaban 3: {{jawaban_3}}

...
<end_of_data>

Format:
Kembalikan resume dalam bentuk teks paragraf biasa,
gunakan bahasa yang profesional, jelas, dan memotivasi.
```

**Output:** `{ resume: string, prompt: string }`
> Hasil disimpan di kolom `resume` dan `resumePrompt` tabel `Interview`.

### Contoh Prompt (Terisi)

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
Pertanyaan 1: Halo Yazid, silakan perkenalkan diri Anda dan alasan melamar posisi ini.
Jawaban 1: Halo, saya Yazid, mahasiswa Teknik Informatika semester 6. Saya melamar sebagai Backend Intern karena tertarik mengembangkan REST API dengan Node.js dan ingin belajar langsung dari industri.

Pertanyaan 2 [Kategori: Database]: Bagaimana Anda mengelola concurrency atau race condition di database?
Jawaban 2: Kita bisa pakai locking mechanism seperti pessimistic locking atau optimistic locking. Kalau pessimistic locking, baris database di-lock sampai transaksi selesai. Kalau optimistic, kita pakai kolom versi untuk deteksi konflik waktu update.

Pertanyaan 3 [Kategori: Teamwork]: Ceritakan pengalaman Anda saat harus memimpin kelompok di perkuliahan.
Jawaban 3: Saat itu ada tugas besar, tapi satu anggota pasif. Saya mengobrol dengannya secara personal untuk membagi tugas kembali yang sesuai dengan kemampuannya, sehingga tugas selesai tepat waktu.
<end_of_data>

Format:
Kembalikan resume dalam bentuk teks paragraf biasa,
gunakan bahasa yang profesional, jelas, dan memotivasi.
```

**Contoh Output:**
```
Yazid menunjukkan motivasi yang kuat dan pemahaman dasar yang baik dalam sesi perkenalan diri. Di bidang teknis (Database), ia dapat menerangkan konsep race condition serta implementasi pessimistic dan optimistic locking dengan sangat terstruktur. Sementara pada aspek soft skill (Teamwork), Yazid memperlihatkan inisiatif kepemimpinan yang solutif dengan melakukan komunikasi personal untuk membagi ulang tugas anggota tim demi kelancaran proyek. Secara umum, Yazid merupakan kandidat yang memiliki landasan teori teknis yang solid dan kematangan interpersonal yang baik untuk ukuran mahasiswa magang.
```

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
