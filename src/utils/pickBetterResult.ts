import { clampConfidence } from "./clampConfidence";

export const pickBetterResult = <T extends { confidence?: number }>(
  current: T,
  next: T,
) => {
  const currentConfidence = clampConfidence(current.confidence);
  const nextConfidence = clampConfidence(next.confidence);

  return nextConfidence > currentConfidence ? next : current;
};
