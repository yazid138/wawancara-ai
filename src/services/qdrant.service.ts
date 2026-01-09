import config from "@/config";
import { QdrantClient } from "@qdrant/js-client-rest";
import { v4 as uuidv4 } from "uuid";

const COLLECTION_NAME = "my-collection";

const client = new QdrantClient({
  url: config.qdrantHostUrl,
  apiKey: config.qdrantApiKey,
});

const upsertVector = async (vector: number[], payload: Record<string, any>) => {
  await client.upsert(COLLECTION_NAME, {
    points: [
      {
        id: uuidv4(),
        vector,
        payload,
      },
    ],
  });
};

const searchSimilarVectors = async (vector: number[], topK: number) => {
  const searchResult = await client.search(COLLECTION_NAME, {
    vector,
    limit: topK,
  });
  return searchResult;
};

const getMyCollection = async () => {
  return await client.getCollection(COLLECTION_NAME);
};

export default {
  upsertVector,
  searchSimilarVectors,
  getMyCollection,
};
