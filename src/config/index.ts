import "dotenv/config";

export default {
  baseUrl: process.env.BASE_URL || "http://localhost",
  port: process.env.PORT || 3000,
  secretKey: process.env.SECRET_KEY || "secretkey",
  openAIKey: process.env.OPENAI_API_KEY || "",
  openAIModel: process.env.OPENAI_MODEL || "gpt-5",
  openAITemperature: Number(process.env.OPENAI_TEMPERATURE) || 0.7,
  openAIEmbeddingModel:
    process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
  hfKey: process.env.HF_KEY || "",
  hfModel: process.env.HF_MODEL || "Qwen/Qwen3-4B-Instruct-2507",
  pineConeKey: process.env.PINECONE_API_KEY || "",
  pineConeHostUrl: process.env.PINECONE_HOST_URL || "",
  pineConeIndex: process.env.PINECONE_INDEX_NAME || "index",
};
