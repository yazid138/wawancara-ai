import { normalizeText } from "./normalizeText";

export const hasWholeWord = (text: string, keyword: string) => {
  const normText = normalizeText(String(text || ""));
  const normKeyword = normalizeText(String(keyword || "")).trim();
  if (!normKeyword) return false;

  // try exact whole word match
  const escaped = normKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const wholeWordPattern = new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, "u");
  if (wholeWordPattern.test(normText)) return true;

  // fallback: substring match
  if (normText.includes(normKeyword)) return true;

  // fallback: if keyword has multiple words, check all words exist in text
  const parts = normKeyword.split(/\s+/).filter(Boolean);
  if (parts.length > 1 && parts.every((p) => normText.includes(p))) return true;

  return false;
};
