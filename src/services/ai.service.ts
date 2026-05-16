import config from "@/config";
import Message from "@/types/aiMessage";
import { buildSoftSkillClassificationPrompt } from "@/utils/buildSoftSkillClassificationPrompt";
import { buildTechnicalRubricPrompt } from "@/utils/buildTechnicalRubricPrompt";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: config.openAIKey,
});

export const createEmbedding = async (text: string) => {
  const { data } = await client.embeddings.create({
    model: config.openAIEmbeddingModel,
    dimensions: 3072,
    encoding_format: "float",
    input: text,
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
Pertanyaan: ${pertanyaan}
Jawaban: ${jawaban}

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
Pertanyaan: ${pertanyaan}
Jawaban: ${jawaban}

Format:
Kembalikan hanya JSON dengan format {"pemahaman": 0-5, "logika": 0-5, "problem_solving": 0-5, "komunikasi": 0-5, "alasan": "singkat"}.`,
  });
  return JSON.parse(output_text);
};

export const generateTechnicalRubricScore = async (
  pertanyaan: string,
  jawaban: string,
  retryHint?: string,
) => {
  const { output_text } = await client.responses.create({
    model: config.openAIModel,
    input: buildTechnicalRubricPrompt(pertanyaan, jawaban, retryHint),
  });

  return JSON.parse(output_text);
};

export const classifySoftSkillAnswer = async (
  pertanyaan: string,
  jawaban: string,
  categories: Array<{ label: string; score: number }>,
  retryHint?: string,
) => {
  const { output_text } = await client.responses.create({
    model: config.openAIModel,
    input: buildSoftSkillClassificationPrompt(pertanyaan, jawaban, categories, retryHint),
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
Kembalikan hanya JSON array dengan format [{"label": "kategori", "score": 0-5}].`,
  });
  return JSON.parse(output_text);
};

export const generateIdealAnswer = async (pertanyaan: string) => {
  const { output_text } = await client.responses.create({
    model: config.openAIModel,
    input: `Role:
Anda adalah mahasiswa yang sedang menjawab pertanyaan interview kerja.

Task:
Buat jawaban ideal yang singkat, jelas, natural, dan meyakinkan.

Data:
Pertanyaan: ${pertanyaan}

Format:
Kembalikan hanya jawaban dalam teks biasa tanpa penjelasan tambahan.`,
  });
  return output_text;
};

export const generateInterviewResume = async (
  qnaList: Array<{ question: string; answer: string }>,
) => {
  const qnaText = qnaList
    .map(
      (qna, idx) => `Q${idx + 1}: ${qna.question}\nA${idx + 1}: ${qna.answer}`,
    )
    .join("\n\n");

  const { output_text } = await client.responses.create({
    model: config.openAIModel,
    input: `Role:
Anda adalah HR yang profesional dan ahli dalam mengevaluasi performa interview kandidat.

Task:
Buatlah resume (ringkasan) singkat dari hasil interview berikut. Evaluasi secara umum kelebihan, kekurangan, dan poin penting dari jawaban kandidat.

Data Interview:
${qnaText}

Format:
Kembalikan resume dalam bentuk teks paragraf biasa, gunakan bahasa yang profesional, jelas, dan memotivasi.`,
  });

  return output_text;
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
  const { output_text } = await client.responses.create({
    model: config.openAIModel,
    input: `Role:
Anda adalah HR atau User Interviewer yang sedang mewawancarai kandidat secara lisan/chat.

Task:
Tulis ulang (rephrase) pertanyaan interview berikut agar terdengar lebih natural, ramah, dan bervariasi layaknya percakapan nyata, tanpa mengubah inti kriteria pertanyaan tersebut.

Data:
Pertanyaan Asli: ${originalQuestion}

Format:
Kembalikan hanya teks pertanyaan hasil rephrase dalam bahasa Indonesia yang baik dan profesional, tanpa teks tambahan.`,
  });

  return output_text;
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
  classifySoftSkillAnswer,
  generateAnswerAI,
  generateAnswerCategories,
  generateIdealAnswer,
  generateInterviewResume,
  generateIntroMessage,
  rephraseQuestion,
};
