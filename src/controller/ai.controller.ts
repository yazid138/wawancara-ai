import { Request, Response } from "express";
import sendResponse from "@/utils/responseHandler";
import ai from "@/services/ai.service";
import config from "@/config";
import validate from "@/utils/validation";

type GenerateMessageRequest = { message: string };
export const generateMessage = async (req: Request, res: Response) => {
  validate<GenerateMessageRequest>(
    {
      message: "string",
    },
    req.body,
  );
  const { message } = req.body as GenerateMessageRequest;
  const { output_text } = await ai.responses.create({
    model: config.openAIModel,
    temperature: config.openAITemperature,
    input: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: message },
    ],
  });
  sendResponse(res, {
    status: 200,
    message: "berhasil generate message",
    data: output_text,
  });
};

type EmbedTextRequest = { text: string };
export const embedText = async (req: Request, res: Response) => {
  validate<EmbedTextRequest>(
    {
      text: "string",
    },
    req.body,
  );
  const { text } = req.body as EmbedTextRequest;
  const { data } = await ai.embeddings.create({
    model: config.openAIEmbeddingModel,
    input: text,
  });
  sendResponse(res, {
    status: 200,
    message: "berhasil embed text",
    data: data[0].embedding,
  });
};
