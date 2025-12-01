import { InferenceClient } from "@huggingface/inference";
import Message from "@/types/aiMessage";
import config from "@/config";

const client = new InferenceClient(config.hfKey);

const generateMessage = async (messages: Message[]) => {
  const out = await client.chatCompletion({
    model: config.hfModel,
    messages,
  });
  return out.choices[0].message.content;
};

export default { generateMessage };
