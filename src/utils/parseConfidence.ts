export const parseConfidence = (value: unknown): number => {
  if (value == null) return 0;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const match = value.match(/\d+(?:\.\d+)?/);
    if (!match) return 0;

    const parsed = Number(match[0]);
    if (!Number.isFinite(parsed)) return 0;

    // Accept values like "82%" or "82" as 0.82, while preserving 0-1 values.
    return parsed > 1 ? parsed / 100 : parsed;
  }

  if (typeof value === "object") {
    const candidate =
      (value as any).confidence ??
      (value as any).confidence_score ??
      (value as any).confidenceScore ??
      (value as any).keyakinan;

    return parseConfidence(candidate);
  }

  return 0;
};
