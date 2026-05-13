import { clampConfidence } from "./clampConfidence";
import { pickBetterResult } from "./pickBetterResult";
import { LOW_CONFIDENCE_THRESHOLD } from "@/utils/constants";

export const retryIfLowConfidence = async <T extends { confidence?: number }>(
  request: () => Promise<T>,
  retryRequest: () => Promise<T>,
) => {
  const firstResult = await request();
  const firstConfidence = clampConfidence((firstResult as any)?.confidence);

  if (firstConfidence >= LOW_CONFIDENCE_THRESHOLD) {
    return firstResult;
  }

  return pickBetterResult(firstResult, await retryRequest());
};
