import { InferenceClient } from "@huggingface/inference";
import config from "@/config";
    
const client = new InferenceClient(config.hfKey);

export default client;