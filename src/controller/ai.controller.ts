import { Request, Response } from "express";
import sendResponse from "@/utils/responseHandler";
import aiService from "@/services/ai.service";
import hfService from "@/services/huggingface.service";
import validate from "@/utils/validation";
import pineconeService from "@/services/pinecone.service";

type GenerateMessageRequest = { message: string };
const generateMessage = async (req: Request, res: Response) => {
  validate<GenerateMessageRequest>(
    {
      message: "string",
    },
    req.body,
  );
  const { message } = req.body as GenerateMessageRequest;
  const result = await aiService.validateInterviewInput(
    "kamu tinggal dimana?",
    message,
  );
  const resultObj = JSON.parse(result);
  if (resultObj.valid !== true) {
    return sendResponse(res, {
      status: 400,
      message: "Input tidak sesuai dengan ketentuan wawancara",
      error: resultObj.keterangan,
    });
  }
  const data = await aiService.generateMessage([
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: message },
  ]);
  sendResponse(res, {
    status: 200,
    message: "berhasil generate message",
    data,
  });
};

const generateMessage2 = async (req: Request, res: Response) => {
  validate<GenerateMessageRequest>(
    {
      message: "string",
    },
    req.body,
  );
  const { message } = req.body as GenerateMessageRequest;
  const data = await hfService.generateMessage([
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
const embedText = async (req: Request, res: Response) => {
  validate<EmbedTextRequest>(
    {
      text: "string",
    },
    req.body,
  );
  const { text } = req.body as EmbedTextRequest;
  const dataEmbed = await aiService.createEmbedding(text);
  await pineconeService.upsertVector(dataEmbed, { text });
  sendResponse(res, {
    status: 200,
    message: "berhasil embed text",
    data: dataEmbed,
  });
};

type EmbedTanyaJawabRequest = { pertanyaan: string; jawaban: string };
const embedTanyaJawab = async (req: Request, res: Response) => {
  validate<EmbedTanyaJawabRequest>(
    {
      pertanyaan: "string",
      jawaban: "string",
    },
    req.body,
  );
  const { pertanyaan, jawaban } = req.body as EmbedTanyaJawabRequest;
  const dataEmbed = await aiService.createEmbedding(
    `pertanyaan: ${pertanyaan}, jawaban: ${jawaban}`,
  );
  await pineconeService.upsertVector(dataEmbed, { pertanyaan, jawaban });
  sendResponse(res, {
    status: 200,
    message: "berhasil embed pertanyaan dan jawaban",
    data: dataEmbed,
  });
};

type SearchTextRequest = { vector: number[] };
const searchSimilarText = async (req: Request, res: Response) => {
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
  const data = await pineconeService.searchVector(vector);
  sendResponse(res, {
    status: 200,
    message: "berhasil search similar text",
    data,
  });
};

const listData = async (req: Request, res: Response) => {
  const data = await pineconeService.listData();
  sendResponse(res, {
    status: 200,
    message: "berhasil list data",
    data,
  });
};

export default {
  generateMessage,
  generateMessage2,
  embedText,
  embedTanyaJawab,
  searchSimilarText,
  listData,
};
