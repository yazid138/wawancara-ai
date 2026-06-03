export const buildSoftSkillClassificationPrompt = (
  pertanyaan: string,
  jawaban: string,
  categories: Array<{ label: string; score: number }>,
  retryHint?: string,
): string => {
  // Create a copy to avoid modifying the original array
  const categoriesCopy = [...categories];
  categoriesCopy.push({ label: "Tidak ada kategori yang sesuai", score: 0 });
  return `Role:
Anda adalah assessor jawaban soft skill untuk interview.

Task:
Pilih satu kategori jawaban yang paling sesuai dari daftar kategori yang tersedia. Jika tidak ada kategori yang cocok, kembalikan label "Tidak Sesuai" (dengan score 0). Kemudian nilai jawaban berdasarkan rubrik: clarity, relevance, evidence of experience, self-awareness.

${
  retryHint
    ? `Tambahan instruksi:
${retryHint}

`
    : ""
}

Data:
Pertanyaan: ${pertanyaan}
Jawaban: ${jawaban}
Kategori tersedia:
${categoriesCopy
  .map(
    (category, index) =>
      `${index + 1}. ${category.label} (bobot: ${category.score})`,
  )
  .join("\n")}

Format:
Kembalikan hanya JSON dengan format {"classification": {"label": "kategori", "confidence": 0-1, "reason": "singkat"}, "rubric": {"clarity": 0-5, "relevance": 0-5, "experienceEvidence": 0-5, "selfAwareness": 0-5, "confidence": 0-1, "reason": "singkat"}}.
Pastikan label yang dikembalikan persis cocok dengan salah satu kategori yang tersedia.`;
};
