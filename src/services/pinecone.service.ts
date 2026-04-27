import { Pinecone, RecordMetadata } from "@pinecone-database/pinecone";
import { v4 as uuidv4 } from "uuid";
import config from "@/config";

const pc = new Pinecone({ apiKey: config.pineConeKey });

const pineconeIndex = pc.Index(config.pineConeIndex, config.pineConeHostUrl);

export const upsertVector = async (vector: number[], metadata: RecordMetadata, id?: string) => {
  await pineconeIndex.upsert([
    {
      id: id || uuidv4(),
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

export const deleteVector = async (id: string) => {
  await pineconeIndex.deleteOne(id);
};

export default { upsertVector, searchVector, listData, deleteVector };
