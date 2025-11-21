import { InferenceClient } from "@huggingface/inference";
import config from "@/config";
    
export const client = new InferenceClient(config.hfKey);

export default client;