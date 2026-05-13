import { Request, Response } from "express";
import sendResponse from "@/utils/responseHandler";
import aiService from "@/services/ai.service";
import hfService from "@/services/huggingface.service";
import validate from "@/utils/validation";
import pineconeService from "@/services/pinecone.service";
import qdrantService from "@/services/qdrant.service";

type GenerateMessageRequest = { message: string };
const generateMessage = async (req: Request, res: Response) => {
  const { message } = validate<GenerateMessageRequest>(
    {
      message: "string",
    },
    req.body,
  );
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
  const { message } = validate<GenerateMessageRequest>(
    {
      message: "string",
    },
    req.body,
  );
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
  const { text } = validate<EmbedTextRequest>(
    {
      text: "string",
    },
    req.body,
  );
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
  const { pertanyaan, jawaban } = validate<EmbedTanyaJawabRequest>(
    {
      pertanyaan: "string",
      jawaban: "string",
    },
    req.body,
  );
  const dataEmbed = await aiService.createEmbedding(
    `pertanyaan: ${pertanyaan}, jawaban: ${jawaban}`,
  );
  // await pineconeService.upsertVector(dataEmbed, { pertanyaan, jawaban });
  await qdrantService.upsertVector(dataEmbed, { pertanyaan, jawaban });
  sendResponse(res, {
    status: 200,
    message: "berhasil embed pertanyaan dan jawaban",
    data: dataEmbed,
  });
};

type SearchTextRequest = { vector: number[] };
const searchSimilarText = async (req: Request, res: Response) => {
  const { vector } = validate<SearchTextRequest>(
    {
      vector: {
        type: "array",
        items: "number",
      },
    },
    req.body,
  );
  // const data = await pineconeService.searchVector(vector);
  const data = await qdrantService.searchSimilarVectors(vector, 5);
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

const generateQuestion = async (req: Request, res: Response) => {
  const question = await aiService.generateQuestion();
  const keywordResult = await aiService.generateKeyword(question);
  const answer = await aiService.generateAnswerAI(question, keywordResult);
  sendResponse(res, {
    status: 200,
    message: "berhasil generate question",
    data: {
      question,
      answer
    },
  });
};

const ruleLengthScore = (jawaban: string, minLength: number) => {
  if (jawaban.length >= minLength) {
    return 1;
  } else {
    return jawaban.length / minLength;
  }
};

const ruleKeywordScore = (jawaban: string, keywords: string[]) => {
  const keywordCount = keywords.reduce((count, keyword) => {
    if (jawaban.toLowerCase().includes(keyword.toLowerCase())) {
      return count + 1;
    }
    return count;
  }, 0);

  if (keywordCount >= 2) {
    return 1;
  } else {
    return keywordCount / 2;
  }
};

const ruleAIScore = ({ pemahaman, logika, problem_solving, komunikasi }: any) => {
  const aiScore = (pemahaman + logika + problem_solving + komunikasi) / 20;
  return aiScore;
}

const scoreAnswer = async (req: Request, res: Response) => {
  type EvaluateAnswerRequest = { pertanyaan: string; jawaban: string };
  validate<EvaluateAnswerRequest>(
    {
      pertanyaan: "string",
      jawaban: "string",
    },
    req.body,
  );
  const { pertanyaan, jawaban } = req.body as EvaluateAnswerRequest;

  const minLengthResult = await aiService.generateMinLength(pertanyaan)
  const keywordResult = await aiService.generateKeyword(pertanyaan);
  const aiScoreResult = await aiService.generateAIScore(pertanyaan, jawaban);

  const aiScore = ruleAIScore(aiScoreResult) * 0.4;
  const ruleScore = ruleLengthScore(jawaban, minLengthResult) * 0.3 + ruleKeywordScore(jawaban, keywordResult) * 0.3;

  const finalScoreRaw = ruleScore + aiScore;
  const finalScore = finalScoreRaw * 100;

  sendResponse(res, {
    status: 200,
    message: "berhasil ",
    data: { finalScore, aiScore: aiScore * 100, ruleScore: ruleScore * 100, finalScoreRaw, alasan: aiScoreResult.alasan },
  });
};

export default {
  generateMessage,
  generateMessage2,
  embedText,
  embedTanyaJawab,
  searchSimilarText,
  listData,
  generateQuestion,
  scoreAnswer,
};
