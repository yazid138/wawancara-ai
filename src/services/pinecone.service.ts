import { Pinecone, RecordMetadata } from "@pinecone-database/pinecone";
import { v4 as uuidv4 } from "uuid";
import config from "@/config";

const pc = new Pinecone({ apiKey: config.pineConeKey });

export const pineconeIndex = pc.Index(
  config.pineConeIndex,
  config.pineConeHostUrl,
);

export const upsertVector = async (
  vector: number[],
  metadata: RecordMetadata,
) => {
  await pineconeIndex.upsert([
    {
      id: uuidv4(),
      // id: 'ed02ea29-b2ff-4c4e-9ade-5def036311c0',
      values: vector,
      metadata,
    },
  ]);
};

export const searchVector = async (vector: number[], topK = 5) => {
  const queryResponse = await pineconeIndex.query({
    vector,
    topK,
    includeMetadata: true,
    // filter: {
    //   pertanyaan: 'Kamu tinggal dimana?',
    // }
  });
  return queryResponse.matches;
};

export const listData = async () => {
  return await pineconeIndex.listPaginated();
};

export default pineconeIndex;
