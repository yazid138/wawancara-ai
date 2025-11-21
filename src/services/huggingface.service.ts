import { InferenceClient } from "@huggingface/inference";
import Message from "@/types/aiMessage";
import config from "@/config";

export const client = new InferenceClient(config.hfKey);

export const generateMessage = async (messages: Message[]) => {
  const out = await client.chatCompletion({
    model: config.hfModel,
    messages,
  });
  return out.choices[0].message.content;
};

export default client;
