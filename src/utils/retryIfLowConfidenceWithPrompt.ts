import { clampConfidence } from "./clampConfidence";
import { pickBetterResult } from "./pickBetterResult";
import { LOW_CONFIDENCE_THRESHOLD } from "@/utils/constants";

export const retryIfLowConfidenceWithPrompt = async <
  T extends { confidence?: number },
>(
  request: () => Promise<T>,
  retryRequest: () => Promise<T>,
  getPrompt: (isRetry: boolean) => string,
): Promise<{ result: T; prompt: string }> => {
  const firstResult = await request();
  const firstConfidence = clampConfidence((firstResult as any)?.confidence);

  if (firstConfidence >= LOW_CONFIDENCE_THRESHOLD) {
    return { result: firstResult, prompt: getPrompt(false) };
  }

  const retryResult = await retryRequest();
  const betterResult = pickBetterResult(firstResult, retryResult);
  const isRetry = betterResult === retryResult;

  return { result: betterResult, prompt: getPrompt(isRetry) };
};
