import config from "@/config";
import OpenAI from "openai";

export const client = new OpenAI({
  apiKey: config.openAIKey,
});

export const createEmbedding = async (text: string) => {
  const { data } = await client.embeddings.create({
      model: config.openAIEmbeddingModel,
      dimensions: 1024,
      encoding_format: 'float',
      input: text,
    });
  return data[0].embedding;
}

type Message = { role: "system" | "user" | "assistant", content: string };
export const generateMessage = async (input: Message[]) => {
  const { output_text } = await client.responses.create({
    model: config.openAIModel,
    input,
  });
  return output_text;
}

export const validateInterviewInput = async (pertanyaan: string, jawaban: string) => {
  const { output_text } = await client.responses.create({
    model: config.openAIModel,
    input: `Tolong periksa apakah jawaban berikut sesuai dengan pertanyaan yang diajukan.\n\nPertanyaan: ${pertanyaan}\n\nJawaban: ${jawaban}\n\nKembalinkan jawaban dengan format {"valid": true atau false, "alasan": "alasan jika tidak valid"}.`,
  });
  return output_text;
}

export default client;
