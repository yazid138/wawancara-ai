/**
 * Builds the AI prompt for soft skill category classification.
 *
 * The AI must pick exactly ONE category from the provided list and return
 * a confidence score (0–1). It must NOT invent new categories.
 *
 * A "Tidak ada kategori yang sesuai" option (score 0) is appended as a
 * safe fallback so the model always has a valid escape hatch.
 */
export const buildSoftSkillClassificationPrompt = (
  pertanyaan: string,
  jawaban: string,
  categories: Array<{ label: string; score: number }>,
  retryHint?: string,
): string => {
  // Append the escape-hatch category without mutating the caller's array
  const categoriesWithFallback = [
    ...categories,
    { label: "Tidak ada kategori yang sesuai", score: 0 },
  ];

  return `Role:
Anda adalah assessor jawaban soft skill untuk interview kerja.

Task:
Pilih SATU kategori dari daftar yang tersedia yang paling sesuai dengan isi jawaban kandidat.
Anda DILARANG membuat kategori baru. Jika tidak ada yang cocok, pilih "Tidak ada kategori yang sesuai".
${
  retryHint
    ? `
Tambahan instruksi:
${retryHint}

`
    : ""
}
Data:
Pertanyaan: ${pertanyaan}
Jawaban: ${jawaban}

Kategori tersedia:
${categoriesWithFallback
  .map(
    (cat, idx) => `${idx + 1}. ${cat.label} (bobot: ${cat.score})`,
  )
  .join("\n")}

Format:
Kembalikan HANYA JSON dengan format berikut, tanpa teks lain:
{
  "categoryId": <nomor urut kategori terpilih (1-based)>,
  "label": "<label kategori persis seperti dalam daftar>",
  "confidence": 0-1,
  "reason": "alasan singkat dalam satu kalimat"
}
Pastikan nilai "label" persis sama (termasuk huruf besar/kecil) dengan salah satu label dalam daftar.`;
};
