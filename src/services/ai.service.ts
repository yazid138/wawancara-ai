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
    input: `Tolong periksa apakah jawaban berikut sesuai dengan pertanyaan yang diajukan.\n\nPertanyaan: ${pertanyaan}\n\nJawaban: ${jawaban}\n\nKembalinkan jawaban dengan format {"valid": true atau false, "alasan": "alasan jika tidak valid"}.`,
  });
  return output_text;
};

export const generateMinLength = async (pertanyaan: string) => {
  const { output_text } = await client.responses.create({
    model: config.openAIModel,
    input: `Tolong periksa berapa panjang minimal jawaban yang sesuai untuk pertanyaan berikut.\n\nPertanyaan: ${pertanyaan}\n\nKembalinkan jawaban dalam bilangan integer.`,
  });
  return +output_text;
};

export const generateKeyword = async (pertanyaan: string) => {
  const { output_text } = await client.responses.create({
    model: config.openAIModel,
    input: `Tolong buatkan beberapa kata kunci yang relevan agar nantinya digunakan untuk kesesuaian jawaban untuk pertanyaan berikut.\n\nPertanyaan: ${pertanyaan}\n\nKembalinkan jawaban dengan format ["kata kunci 1", "kata kunci 2"]`,
  });
  return JSON.parse(output_text);
};

export const generateQuestion = async () => {
  const { output_text } = await client.responses.create({
    model: config.openAIModel,
    input: `Tolong buatkan satu pertanyaan yang relevan untuk wawancara kerja di bidang teknologi informasi.\n\nKembalinkan jawaban dalam bentuk teks biasa.`,
  });
  return output_text;
};

export const generateAnswerAI = async (
  pertanyaan: string,
  keyword: string[],
) => {
  const { output_text } = await client.responses.create({
    model: config.openAIModel,
    input: `Tolong buatkan jawaban yang relevan untuk pertanyaan berikut dengan memasukkan beberapa kata kunci berikut.\n\nPertanyaan: ${pertanyaan}\n\nKata Kunci: ${keyword.join(", ")}\n\nKembalinkan jawaban dalam bentuk teks biasa.`,
  });
  return output_text;
};

export const generateAIScore = async (pertanyaan: string, jawaban: string) => {
  const { output_text } = await client.responses.create({
    model: config.openAIModel,
    input: `Nilai jawaban mahasiswa berdasarkan rubrik berikut:
- Pemahaman Konsep (0-5)
- Logika Berpikir (0-5)
- Problem Solving (0-5)
- Komunikasi Teknis (0-5)

Aturan:
- Abaikan panjang jawaban
- Jangan beri nilai tinggi jika konsep dangkal
- Berikan alasan singkat

Jawaban mahasiswa:
${jawaban}

Pertanyaan:
${pertanyaan}

Output berformat JSON dengan format berikut:
{
  pemahaman: nilai,
  logika: nilai,
  problem_solving: nilai,
  komunikasi: nilai,
  alasan: "alasan singkat"
}`,
  });
  return JSON.parse(output_text);
};

export default {
  createEmbedding,
  generateMessage,
  validateInterviewInput,
  generateMinLength,
  generateKeyword,
  generateQuestion,
  generateAIScore,
  generateAnswerAI,
};
