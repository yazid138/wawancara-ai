import { Pinecone } from '@pinecone-database/pinecone';
import config from '@/config';

const pc = new Pinecone({ apiKey: config.pineConeKey });

export const pineconeIndex = pc.Index(config.pineConeIndex, config.pineConeHostUrl);

export const searchVector = async (vector: number[], topK = 5) => {
  const queryResponse = await pineconeIndex.query({
    vector,
    topK,
    includeMetadata: true,
  });
  return queryResponse.matches;
};

export default pineconeIndex;
