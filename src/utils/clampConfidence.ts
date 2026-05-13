import { parseConfidence } from "./parseConfidence";

export const clampConfidence = (value: unknown) => {
  const confidence = parseConfidence(value);
  if (Number.isNaN(confidence)) {
    return 0;
  }

  return Math.max(0, Math.min(confidence, 1));
};
