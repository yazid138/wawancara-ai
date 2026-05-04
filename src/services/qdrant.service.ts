import config from "@/config";
import { QdrantClient } from "@qdrant/js-client-rest";
import { v4 as uuidv4 } from "uuid";

const COLLECTION_NAME = "my-collection";

const client = new QdrantClient({
  url: config.qdrantHostUrl,
  apiKey: config.qdrantApiKey,
});

export const upsertVector = async (vector: number[], payload: Record<string, any>, id?: string | number) => {
  await client.upsert(COLLECTION_NAME, {
    points: [
      {
        id: id || uuidv4(),
        vector,
        payload,
      },
    ],
  });
};

export const searchSimilarVectors = async (
  vector: number[],
  topK: number,
  filter?: Record<string, any>,
) => {
  const searchResult = await client.search(COLLECTION_NAME, {
    vector,
    limit: topK,
    filter,
  });
  return searchResult;
};

export const getMyCollection = async () => {
  return await client.getCollection(COLLECTION_NAME);
};

export const deleteVector = async (id: string | number) => {
  await client.delete(COLLECTION_NAME, {
    points: [id],
  });
}

export default {
  upsertVector,
  searchSimilarVectors,
  getMyCollection,
  deleteVector,
};
