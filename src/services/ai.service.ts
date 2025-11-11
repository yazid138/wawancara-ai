import config from "@/config";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: config.openAIKey,
});

export const validateInterviewInput = async (pertanyaan: string, jawaban: string) => {
  const { output_text } = await client.responses.create({
    model: config.openAIModel,
    input: `Tolong periksa apakah jawaban berikut sesuai dengan pertanyaan yang diajukan.\n\nPertanyaan: ${pertanyaan}\n\nJawaban: ${jawaban}\n\nKembalinkan jawaban dengan format {"valid": true atau false, "alasan": "alasan jika tidak valid"}.`,
  });
  return output_text;
}

export default client;
