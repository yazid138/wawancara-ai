import config from "@/config";
import Message from "@/types/aiMessage";
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
Buat beberapa kata kunci yang spesifik, relevan, dan benar-benar mencerminkan inti jawaban yang baik.

Data:
Pertanyaan: ${pertanyaan}

Format:
Kembalikan hanya JSON array string, misalnya ["kata kunci 1", "kata kunci 2"].`,
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
) => {
  const { output_text } = await client.responses.create({
    model: config.openAIModel,
    input: `Role:
Anda adalah penilai jawaban interview teknis dengan fokus pada kualitas isi.

Task:
Nilai jawaban menggunakan rubrik Pemahaman Konsep, Ketepatan Teknis, Logika Berpikir, dan Komunikasi Jawaban.

Data:
Pertanyaan: ${pertanyaan}
Jawaban: ${jawaban}

Format:
Kembalikan hanya JSON dengan format {"pemahaman": 0-5, "teknis": 0-5, "logika": 0-5, "komunikasi": 0-5, "confidence": 0-1, "alasan": "singkat"}.`,
  });

  return JSON.parse(output_text);
};

export const classifySoftSkillAnswer = async (
  pertanyaan: string,
  jawaban: string,
  categories: Array<{ label: string; score: number }>,
) => {
  const { output_text } = await client.responses.create({
    model: config.openAIModel,
    input: `Role:
Anda adalah classifier jawaban soft skill untuk interview.

Task:
Pilih satu kategori jawaban yang paling sesuai dari daftar kategori yang tersedia.

Data:
Pertanyaan: ${pertanyaan}
Jawaban: ${jawaban}
Kategori tersedia:
${categories
  .map((category, index) => `${index + 1}. ${category.label} (bobot: ${category.score})`)
  .join("\n")}

Format:
Kembalikan hanya JSON dengan format {"label": "kategori", "confidence": 0-1, "alasan": "singkat"}.
Pastikan label yang dikembalikan persis cocok dengan salah satu kategori yang tersedia.`,
  });

  return JSON.parse(output_text);
};

export const generateAnswerCategories = async (pertanyaan: string) => {
  const { output_text } = await client.responses.create({
    model: config.openAIModel,
    input: `Role:
Anda adalah perancang kategori penilaian untuk pertanyaan interview soft skill.

Task:
Buat beberapa kategori jawaban yang realistis, berurutan, dan memiliki bobot yang masuk akal.

Data:
Pertanyaan: ${pertanyaan}
Contoh kategori yang baik:
[
  { "label": "Mudah beradaptasi", "score": 4 },
  { "label": "Bisa beradaptasi", "score": 3 },
  { "label": "Sulit beradaptasi", "score": 2 },
  { "label": "Tidak mau beradaptasi", "score": 1 }
]

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
}

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
};
