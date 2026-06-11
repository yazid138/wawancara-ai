import config from "@/config";
import Message from "@/types/aiMessage";
import OpenAI from "openai";
import { cleanWhitespace } from "@/utils";

const client = new OpenAI({
  apiKey: config.openAIKey,
});

export const createEmbedding = async (text: string) => {
  const cleanedText = cleanWhitespace(text);
  const { data } = await client.embeddings.create({
    model: config.openAIEmbeddingModel,
    dimensions: 3072,
    encoding_format: "float",
    input: cleanedText,
  });
  return data[0].embedding;
};

export const generateMessage = async (input: Message[]) => {
  const { output_text } = await client.responses.create({
    model: config.openAIModel,
    input,
  });
  return output_text;
};

export const validateInterviewInput = async (
  pertanyaan: string,
  jawaban: string,
) => {
  const { output_text } = await client.responses.create({
    model: config.openAIModel,
    input: `Role:
Anda adalah evaluator jawaban interview yang menilai kesesuaian antara pertanyaan dan jawaban.

Task:
Periksa apakah jawaban relevan, sopan, dan benar-benar menjawab pertanyaan.

Data:
<start_of_data>
Pertanyaan: ${pertanyaan}
Jawaban: ${jawaban}
<end_of_data>

Format:
Kembalikan hanya JSON dengan format {"valid": true/false, "alasan": "alasan singkat jika tidak valid"}.`,
  });
  return output_text;
};

export const generateMinLength = async (pertanyaan: string) => {
  const { output_text } = await client.responses.create({
    model: config.openAIModel,
    input: `Role:
Anda membantu menentukan standar minimum panjang jawaban interview.

Task:
Tentukan estimasi panjang minimal jawaban yang masih memadai untuk menjawab pertanyaan.

Data:
Pertanyaan: ${pertanyaan}

Format:
Kembalikan hanya bilangan integer.`,
  });
  return +output_text;
};

export const generateKeyword = async (pertanyaan: string) => {
  const { output_text } = await client.responses.create({
    model: config.openAIModel,
    input: `Role:
Anda menyusun kata kunci untuk mengevaluasi kualitas jawaban interview.

Task:
Buat 5 kata kunci yang spesifik, relevan, dan benar-benar mencerminkan inti jawaban yang baik dari pertanyaan ini. hindari penggunaan simbol, untuk garis miring (/), pisahkan jadi 2 kata kunci.

Data:
Pertanyaan: ${pertanyaan}

Example:
Input: "Apa itu API?"
Output: ["API", "Antarmuka", "Komunikasi", "Software", "Data"]

Format:
Kembalikan hanya JSON array string dengan 5 kata kunci. Dilarang menambahkan karakter lain selain JSON array string.`,
  });
  return JSON.parse(output_text);
};

export const generateQuestion = async () => {
  const { output_text } = await client.responses.create({
    model: config.openAIModel,
    input: `Role:
Anda adalah pembuat pertanyaan interview untuk bidang teknologi informasi.

Task:
Buat satu pertanyaan yang natural, relevan, dan berguna untuk menilai kandidat.

Data:
Gunakan gaya pertanyaan interview yang singkat dan jelas.

Format:
Kembalikan hanya satu pertanyaan dalam teks biasa.`,
  });
  return output_text;
};

export const generateAnswerAI = async (
  pertanyaan: string,
  keyword: string[],
) => {
  const { output_text } = await client.responses.create({
    model: config.openAIModel,
    input: `Role:
Anda adalah kandidat interview yang harus menjawab secara profesional dan natural.

Task:
Buat jawaban yang relevan, ringkas, dan menyatu secara wajar dengan kata kunci yang tersedia.

Data:
Pertanyaan: ${pertanyaan}
Kata Kunci: ${keyword.join(", ")}

Format:
Kembalikan hanya jawaban dalam teks biasa tanpa daftar kata kunci atau penjelasan tambahan.`,
  });
  return output_text;
};

export const generateAIScore = async (pertanyaan: string, jawaban: string) => {
  const { output_text } = await client.responses.create({
    model: config.openAIModel,
    input: `Role:
Anda adalah penilai jawaban interview teknis.

Task:
Nilai jawaban berdasarkan rubrik Pemahaman Konsep, Logika Berpikir, Problem Solving, dan Komunikasi Teknis.

Data:
<start_of_data>
Pertanyaan: ${pertanyaan}
Jawaban: ${jawaban}
<end_of_data>

Format:
Kembalikan hanya JSON dengan format {"pemahaman": 0-5, "logika": 0-5, "problem_solving": 0-5, "komunikasi": 0-5, "alasan": "singkat"}.`,
  });
  return JSON.parse(output_text);
};

export const generateTechnicalRubricScore = async (
  pertanyaan: string,
  jawaban: string,
  questionCategory?: string,
  retryHint?: string,
): Promise<{
  understanding: number;
  technicalAccuracy: number;
  problemSolving: number;
  technicalCommunication: number;
  confidence: number;
  reason: string;
}> => {
  const { output_text } = await client.responses.create({
    model: config.openAIModel,
    input: buildTechnicalRubricPrompt(pertanyaan, jawaban, questionCategory, retryHint),
  });

  return JSON.parse(output_text);
};

export const classifySoftSkillAnswer = async (
  pertanyaan: string,
  jawaban: string,
  categories: Array<{ label: string; score: number, id: number }>,
  questionCategory?: string,
  retryHint?: string,
) => {
  const { output_text } = await client.responses.create({
    model: config.openAIModel,
    input: buildSoftSkillClassificationPrompt(
      pertanyaan,
      jawaban,
      categories,
      questionCategory,
      retryHint,
    ),
  });

  return JSON.parse(output_text);
};

/**
 * Evaluates a softskill answer against the 4-criterion rubric:
 *   communication, selfAwareness, evidence, relevance (each 1–5)
 * Returns an overall `confidence` (0–1) used by the retry mechanism.
 */
export const generateSoftSkillRubricScore = async (
  pertanyaan: string,
  jawaban: string,
  questionCategory?: string,
  retryHint?: string,
): Promise<{
  communication: number;
  selfAwareness: number;
  behaviorEvidence: number;
  growthMindset: number;
  confidence: number;
  reason: string;
}> => {
  const { output_text } = await client.responses.create({
    model: config.openAIModel,
    input: buildSoftSkillRubricPrompt(pertanyaan, jawaban, questionCategory, retryHint),
  });

  return JSON.parse(output_text);
};

export const generateAnswerCategories = async (pertanyaan: string) => {
  const { output_text } = await client.responses.create({
    model: config.openAIModel,
    input: `Role:
Anda adalah perancang kategori penilaian untuk pertanyaan interview soft skill.

Task:
Buat beberapa kategori jawaban yang realistis, berurutan, dan memiliki bobot yang masuk akal dari pertanyaan ini. label harus singkat dan jelas. score 1-5.

Data:
Pertanyaan: ${pertanyaan}

Example:
<start_of_example>
input: Bagaimana anda menyesuaikan diri dengan aturan yang berlaku di tempat magang?
output: [
  { "label": "Mudah Beradaptasi", "score": 4 },
  { "label": "Bisa beradaptasi", "score": 3 },
  { "label": "Sulit beradaptasi", "score": 2 },
  { "label": "Tidak mau beradaptasi", "score": 1 }
]

input: Bagaimana Anda menilai diri sendiri dibandingkan dengan teman-teman Anda dalam bidang yang Anda lamar saat ini?
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
PENTING: Kembalikan HANYA 1 JSON array. Tidak boleh ada teks lain. Format: [{"label": "kategori", "score": 0-5}].`,
  });
  return JSON.parse(output_text);
};

export const generateIdealAnswer = async (pertanyaan: string, kategori?: string) => {
  const inputPrompt = kategori
    ? `Role:
Anda adalah mahasiswa yang sedang menjawab pertanyaan interview kerja.

Task:
Buat contoh jawaban wawancara yang secara akurat mencerminkan karakteristik kategori: "${kategori}".
Jawaban harus natural, realistis, dan dalam bahasa Indonesia sehari-hari.

Data:
Pertanyaan: ${pertanyaan}

Format:
PENTING: Kembalikan HANYA 1 (satu) kalimat jawaban dalam teks biasa. Jangan memberikan daftar, variasi, atau teks tambahan apapun.`
    : `Role:
Anda adalah mahasiswa yang sedang menjawab pertanyaan interview kerja.

Task:
Buat jawaban ideal yang singkat, jelas, natural, dan meyakinkan.

Data:
Pertanyaan: ${pertanyaan}

Format:
PENTING: Kembalikan HANYA 1 (satu) kalimat jawaban dalam teks biasa. Jangan memberikan daftar, variasi, atau teks tambahan apapun.`;

  const { output_text } = await client.responses.create({
    model: config.openAIModel,
    input: inputPrompt,
  });
  return output_text;
};

export const generateInterviewResume = async (
  qnaList: Array<{ question: string; answer: string; category?: string }>,
) => {
  const qnaText = qnaList
    .map(
      (qna, idx) =>
        `Pertanyaan ${idx + 1}${qna.category ? ` [Kategori: ${qna.category}]` : ""}: ${qna.question}\nJawaban ${idx + 1}: ${qna.answer}`,
    )
    .join("\n\n");

  const prompt = `Role:
Anda adalah HR yang profesional dan ahli dalam mengevaluasi performa interview kandidat mahasiswa.

Task:
Buatlah resume (ringkasan) singkat dari hasil interview berikut. Evaluasi secara umum kelebihan, kekurangan, dan poin penting dari jawaban kandidat.
Setiap pertanyaan memiliki kategori yang menunjukkan topik atau kompetensi yang diuji. Gunakan informasi ini untuk memberikan evaluasi yang lebih kontekstual dan tepat sasaran.

Data:
<start_of_data>
Hasil Wawancara:
${qnaText}
<end_of_data>

Format:
Kembalikan resume dalam bentuk teks paragraf biasa, gunakan bahasa yang profesional, jelas, dan memotivasi.`;

  const { output_text } = await client.responses.create({
    model: config.openAIModel,
    input: prompt,
  });

  return { resume: output_text, prompt };
};

export const generateIntroMessage = async (
  userName: string,
  companyName: string,
  positionName: string,
) => {
  const { output_text } = await client.responses.create({
    model: config.openAIModel,
    input: `Role:
Anda adalah HR yang ramah dan sedang memulai sesi interview dengan seorang kandidat.

Task:
Buatlah satu pertanyaan sapaan pembuka (Intro) yang menyapa kandidat, menyebutkan nama perusahaan, dan posisi yang dilamar. Mintalah kandidat untuk memperkenalkan diri secara singkat dan alasan mengapa mereka tertarik dengan posisi ini.

Data:
Nama Kandidat: ${userName}
Perusahaan: ${companyName}
Posisi: ${positionName}

Format:
Kembalikan hanya teks pertanyaan dalam bahasa Indonesia yang natural dan ramah, tanpa teks tambahan.`,
  });

  return output_text;
};

export const rephraseQuestion = async (originalQuestion: string) => {
  const inputPrompt = `Role:
Anda adalah HR atau User Interviewer yang sedang mewawancarai kandidat mahasiswa secara lisan/chat.

Task:
Tulis ulang (rephrase) pertanyaan interview berikut agar terdengar lebih natural, ramah dan bervariasi layaknya percakapan nyata, tanpa mengubah inti kriteria pertanyaan tersebut.

Data:
Pertanyaan Asli: ${originalQuestion}

Format:
PENTING: Kembalikan HANYA 1 (satu) kalimat pertanyaan hasil rephrase. Jangan memberikan daftar, variasi, atau teks tambahan apapun.`;
  const { output_text } = await client.responses.create({
    model: config.openAIModel,
    input: inputPrompt,
  });

  return { rephrase: output_text, prompt: inputPrompt };
};

export const buildSoftSkillClassificationPrompt = (
  pertanyaan: string,
  jawaban: string,
  categories: Array<{ label: string; score: number, id: number }>,
  questionCategory?: string,
  retryHint?: string,
): string => {
  // Append the escape-hatch category without mutating the caller's array
  const categoriesWithFallback = [
    ...categories,
    { label: "Tidak ada kategori yang sesuai", score: 0, id: 0 },
  ];

  return `Role:
Anda adalah assessor jawaban soft skill untuk interview kerja.

Task:
Pilih SATU kategori dari daftar yang tersedia yang paling sesuai dengan isi jawaban kandidat.
Anda DILARANG membuat kategori baru. Jika tidak ada yang cocok, pilih "Tidak ada kategori yang sesuai".
${
  retryHint
    ? `
Tambahan instruksi:
${retryHint}

`
    : ""
}
Data:
${questionCategory ? `Kategori Pertanyaan: ${questionCategory}\n` : ""}Pertanyaan: ${pertanyaan}
Jawaban: ${jawaban}

Kategori tersedia:
${categoriesWithFallback
  .map(
    (cat, idx) => `${idx + 1}. ${cat.label} [categoryId:${cat.id}](bobot: ${cat.score})`,
  )
  .join("\n")}

Format:
Kembalikan HANYA JSON dengan format berikut, tanpa teks lain:
{
  "categoryId": <id kategori terpilih>,
  "label": "<label kategori persis seperti dalam daftar>",
  "confidence": 0-1,
  "reason": "alasan singkat dalam satu kalimat"
}
Pastikan nilai "label" persis sama (termasuk huruf besar/kecil) dengan salah satu label dalam daftar.`;
};

export const buildSoftSkillRubricPrompt = (
  pertanyaan: string,
  jawaban: string,
  questionCategory?: string,
  retryHint?: string,
): string => {
  return `Role:
Anda adalah penilai jawaban soft skill untuk interview kerja.

Task:
Lakukan penilaian dalam 2 langkah berikut:

Langkah 1 — Cek relevansi terhadap kategori pertanyaan:
${questionCategory
  ? `Periksa apakah jawaban kandidat benar-benar menjawab pertanyaan yang berkaitan dengan topik "${questionCategory}".
- Jika jawaban TIDAK berkaitan dengan topik "${questionCategory}" (misalnya: menjawab topik lain, asal-asalan, atau tidak relevan sama sekali), beri semua rubrik nilai 0 dan confidence rendah (0.1–0.3).
- Jika jawaban BERKAITAN, lanjutkan ke Langkah 2.`
  : `Periksa apakah jawaban kandidat relevan dengan pertanyaan yang diajukan.
- Jika tidak relevan sama sekali, beri semua rubrik nilai 0 dan confidence rendah.
- Jika relevan, lanjutkan ke Langkah 2.`}

Langkah 2 — Nilai rubrik secara objektif:
Nilai jawaban kandidat berdasarkan 4 rubrik berikut. Setiap rubrik dinilai 1-5.

Rubrik:
- communication    (0-5): Seberapa jelas dan terstruktur kandidat menyampaikan jawaban.
- selfAwareness    (0-5): Seberapa baik kandidat mengenali kelebihan dan keterbatasan diri.
- behaviorEvidence (0-5): Apakah kandidat memberikan contoh konkret perilaku di masa lalu untuk mendukung klaimnya?
- growthMindset    (0-5): Apakah kandidat menunjukkan kesadaran akan area pengembangan dan keinginan untuk belajar?
${
  retryHint
    ? `
Tambahan instruksi:
${retryHint}

`
    : ""
}
Data:
${questionCategory ? `Kategori Pertanyaan: ${questionCategory}\n` : ""}Pertanyaan: ${pertanyaan}
Jawaban: ${jawaban}

Format:
Kembalikan HANYA JSON dengan format berikut, tanpa teks lain:
{
  "communication": 0-5,
  "selfAwareness": 0-5,
  "behaviorEvidence": 0-5,
  "growthMindset": 0-5,
  "confidence": 0-1,
  "reason": "alasan singkat dalam satu kalimat — sebutkan apakah jawaban relevan dengan topik${questionCategory ? ` \"${questionCategory}\"` : ""} dan justifikasi skor rubrik"
}`;
};

export const buildTechnicalRubricPrompt = (
  pertanyaan: string,
  jawaban: string,
  questionCategory?: string,
  retryHint?: string,
): string => {
  return `Role:
Anda adalah penilai jawaban teknikal untuk interview kerja di bidang teknologi informasi.

Task:
Lakukan penilaian dalam 2 langkah berikut:

Langkah 1 — Cek relevansi terhadap kategori pertanyaan:
${questionCategory
  ? `Periksa apakah jawaban kandidat benar-benar menjawab pertanyaan yang berkaitan dengan topik "${questionCategory}".
- Jika jawaban TIDAK berkaitan dengan topik "${questionCategory}" (misalnya: menjawab topik lain, asal-asalan, atau tidak relevan sama sekali), beri semua rubrik nilai 0 dan confidence rendah (0.1–0.3).
- Jika jawaban BERKAITAN, lanjutkan ke Langkah 2.`
  : `Periksa apakah jawaban kandidat relevan dengan pertanyaan yang diajukan.
- Jika tidak relevan sama sekali, beri semua rubrik nilai 0 dan confidence rendah.
- Jika relevan, lanjutkan ke Langkah 2.`}

Langkah 2 — Nilai rubrik secara objektif:
Nilai jawaban kandidat berdasarkan 4 rubrik berikut. Setiap rubrik dinilai 0-5.

Rubrik:
- understanding          (0-5): Kedalaman pemahaman konsep yang ditunjukkan dalam jawaban.
- technicalAccuracy      (0-5): Kebenaran detail teknis, terminologi, dan fakta yang digunakan.
- problemSolving         (0-5): Kualitas penalaran logis dan pendekatan dalam menyelesaikan masalah.
- technicalCommunication (0-5): Kejelasan dan ketepatan dalam menjelaskan konsep teknis.
${
  retryHint
    ? `
Tambahan instruksi:
${retryHint}

`
    : ""
}
Data:
${questionCategory ? `Kategori Pertanyaan: ${questionCategory}\n` : ""}Pertanyaan: ${pertanyaan}
Jawaban: ${jawaban}

Format:
Kembalikan HANYA JSON dengan format berikut, tanpa teks lain:
{
  "understanding": 0-5,
  "technicalAccuracy": 0-5,
  "problemSolving": 0-5,
  "technicalCommunication": 0-5,
  "confidence": 0-1,
  "reason": "alasan singkat dalam satu kalimat — sebutkan apakah jawaban relevan dengan topik${questionCategory ? ` \"${questionCategory}\"` : ""} dan justifikasi skor rubrik"
}`;
};

export default {
  createEmbedding,
  generateMessage,
  validateInterviewInput,
  generateMinLength,
  generateKeyword,
  generateQuestion,
  generateAIScore,
  generateTechnicalRubricScore,
  generateSoftSkillRubricScore,
  classifySoftSkillAnswer,
  generateAnswerAI,
  generateAnswerCategories,
  generateIdealAnswer,
  generateInterviewResume,
  generateIntroMessage,
  rephraseQuestion,
  buildSoftSkillClassificationPrompt,
  buildSoftSkillRubricPrompt,
  buildTechnicalRubricPrompt,
};
