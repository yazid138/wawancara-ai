export const normalizeText = (text: string) =>
  text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ");
