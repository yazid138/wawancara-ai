import { Request, Response } from "express";
import sendResponse from "@/utils/responseHandler";
import ai, {validateInterviewInput} from "@/services/ai.service";
import hf from "@/services/huggingface.service";
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
  const result = await validateInterviewInput('kamu tinggal dimana?', message);
  const resultObj = JSON.parse(result);
  if (resultObj.valid !== true) {
    return sendResponse(res, {
      status: 400,
      message: "Input tidak sesuai dengan ketentuan wawancara",
      error: resultObj.keterangan,
    });
  }
  const { output_text } = await ai.responses.create({
    model: config.openAIModel,
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

export const generateMessage2 = async (req: Request, res: Response) => {
  validate<GenerateMessageRequest>(
    {
      message: "string",
    },
    req.body,
  );
  const { message } = req.body as GenerateMessageRequest;
  const out = await hf.chatCompletion({
    model: 'Qwen/Qwen3-4B-Instruct-2507',
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: message },
    ]
  })
  sendResponse(res, {
    status: 200,
    message: "berhasil generate message",
    data: out.choices[0].message.content,
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
