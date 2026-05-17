import { hasWholeWord } from "./hasWholeWord";
import { normalizeText } from "./normalizeText";

export const calculateKeywordScore = (userAnswer: string, keywords: any[]) => {
  if (!userAnswer || !keywords || keywords.length === 0) return 0;
  const normalizedAnswer = normalizeText(userAnswer);
  const coreKeywords = [...keywords]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, Math.min(5, keywords.length));

  let matchedWeight = 0;
  let totalCoreWeight = 0;
  let matchedCount = 0;

  for (const k of coreKeywords) {
    totalCoreWeight += k.weight;
    if (hasWholeWord(normalizedAnswer, normalizeText(k.word))) {
      matchedWeight += k.weight;
      matchedCount += 1;
    }
  }

  const weightCoverage = totalCoreWeight ? matchedWeight / totalCoreWeight : 0;
  const countCoverage = coreKeywords.length
    ? matchedCount / coreKeywords.length
    : 0;
  return Math.min(1, weightCoverage * 0.7 + countCoverage * 0.3);
};
