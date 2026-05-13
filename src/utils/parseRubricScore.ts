export const parseRubricNumber = (v: unknown) => {
  if (v == null) return 0;
  if (typeof v === "number") return Math.max(0, Math.min(v, 5));
  if (typeof v === "string") {
    // extract first number (e.g. "4", "4/5", "4.0")
    const m = v.match(/\d+(?:\.\d+)?/);
    if (m) return Math.max(0, Math.min(Number(m[0]), 5));
    return 0;
  }
  return 0;
};
