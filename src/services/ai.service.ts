import config from "@/config";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: config.openAIKey,
});

export default client;
