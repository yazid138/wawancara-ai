export const stringSimilarity = (s1: string, s2: string): number => {
  const a = String(s1 || "")
    .toLowerCase()
    .trim();
  const b = String(s2 || "")
    .toLowerCase()
    .trim();

  if (a === b) return 1;
  if (!a || !b) return 0;

  // check if one is a substring of the other
  if (a.includes(b) || b.includes(a)) return 0.9;

  // split into words and check overlap
  const aWords = new Set(a.split(/\s+/));
  const bWords = new Set(b.split(/\s+/));
  const intersection = new Set([...aWords].filter((w) => bWords.has(w)));
  const union = new Set([...aWords, ...bWords]);

  return union.size > 0 ? intersection.size / union.size : 0;
};
