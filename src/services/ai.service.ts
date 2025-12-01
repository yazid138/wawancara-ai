import config from "@/config";
import Message from "@/types/aiMessage";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: config.openAIKey,
});

const createEmbedding = async (text: string) => {
  const { data } = await client.embeddings.create({
    model: config.openAIEmbeddingModel,
    dimensions: 1024,
    encoding_format: "float",
    input: text,
  });
  return data[0].embedding;
};

const generateMessage = async (input: Message[]) => {
  const { output_text } = await client.responses.create({
    model: config.openAIModel,
    input,
  });
  return output_text;
};

const validateInterviewInput = async (pertanyaan: string, jawaban: string) => {
  const { output_text } = await client.responses.create({
    model: config.openAIModel,
    input: `Tolong periksa apakah jawaban berikut sesuai dengan pertanyaan yang diajukan.\n\nPertanyaan: ${pertanyaan}\n\nJawaban: ${jawaban}\n\nKembalinkan jawaban dengan format {"valid": true atau false, "alasan": "alasan jika tidak valid"}.`,
  });
  return output_text;
};

export default { createEmbedding, generateMessage, validateInterviewInput };
