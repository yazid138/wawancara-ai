import { Request, Response } from "express";
import sendResponse from "@/utils/responseHandler";
import {
  validateInterviewInput,
  createEmbedding,
  generateMessage,
} from "@/services/ai.service";
import { generateMessage as generateMessageHF } from "@/services/huggingface.service";
import validate from "@/utils/validation";
import { listData, searchVector, upsertVector } from "@/services/pinecone.service";

type GenerateMessageRequest = { message: string };
export const generateMessageController = async (
  req: Request,
  res: Response,
) => {
  validate<GenerateMessageRequest>(
    {
      message: "string",
    },
    req.body,
  );
  const { message } = req.body as GenerateMessageRequest;
  const result = await validateInterviewInput("kamu tinggal dimana?", message);
  const resultObj = JSON.parse(result);
  if (resultObj.valid !== true) {
    return sendResponse(res, {
      status: 400,
      message: "Input tidak sesuai dengan ketentuan wawancara",
      error: resultObj.keterangan,
    });
  }
  const data = await generateMessage([
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: message },
  ]);
  sendResponse(res, {
    status: 200,
    message: "berhasil generate message",
    data,
  });
};

export const generateMessage2Controller = async (
  req: Request,
  res: Response,
) => {
  validate<GenerateMessageRequest>(
    {
      message: "string",
    },
    req.body,
  );
  const { message } = req.body as GenerateMessageRequest;
  const data = await generateMessageHF([
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: message },
  ]);
  sendResponse(res, {
    status: 200,
    message: "berhasil generate message",
    data,
  });
};

type EmbedTextRequest = { text: string };
export const embedTextController = async (req: Request, res: Response) => {
  validate<EmbedTextRequest>(
    {
      text: "string",
    },
    req.body,
  );
  const { text } = req.body as EmbedTextRequest;
  const dataEmbed = await createEmbedding(text);
  await upsertVector(dataEmbed, { text });
  sendResponse(res, {
    status: 200,
    message: "berhasil embed text",
    data: dataEmbed,
  });
};

type EmbedTanyaJawabRequest = { pertanyaan: string; jawaban: string };
export const embedTanyaJawabController = async (req: Request, res: Response) => {
  validate<EmbedTanyaJawabRequest>(
    {
      pertanyaan: "string",
      jawaban: "string",
    },
    req.body,
  );
  const { pertanyaan, jawaban } = req.body as EmbedTanyaJawabRequest;
  const dataEmbed = await createEmbedding(JSON.stringify({ pertanyaan, jawaban }));
  // await upsertVector(dataEmbed, { pertanyaan, jawaban });
  sendResponse(res, {
    status: 200,
    message: "berhasil embed pertanyaan dan jawaban",
    data: dataEmbed,
  });
};

type SearchTextRequest = { vector: number[] };
export const searchSimilarTextController = async (
  req: Request,
  res: Response,
) => {
  validate<SearchTextRequest>(
    {
      vector: {
        type: "array",
        items: "number",
      },
    },
    req.body,
  );
  const { vector } = req.body as SearchTextRequest;
  const data = await searchVector(vector);
  sendResponse(res, {
    status: 200,
    message: "berhasil search similar text",
    data,
  });
};

export const listDataController = async (req: Request, res: Response) => {
  const data = await listData();
  sendResponse(res, {
    status: 200,
    message: "berhasil list data",
    data,
  });
};
