export const buildSoftSkillClassificationPrompt = (
  pertanyaan: string,
  jawaban: string,
  categories: Array<{ label: string; score: number }>,
  retryHint?: string,
): string => {
  return `Role:
Anda adalah classifier jawaban soft skill untuk interview.

Task:
Pilih satu kategori jawaban yang paling sesuai dari daftar kategori yang tersedia.  Jika tidak ada kategori yang cocok, kembalikan label "Tidak Sesuai" (dengan score 0).

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
${categories
  .map(
    (category, index) =>
      `${index + 1}. ${category.label} (bobot: ${category.score})`,
  )
  .join("\n")}

Format:
Kembalikan hanya JSON dengan format {"label": "kategori", "confidence": 0-1, "alasan": "singkat"}.
Pastikan label yang dikembalikan persis cocok dengan salah satu kategori yang tersedia.`;
};
