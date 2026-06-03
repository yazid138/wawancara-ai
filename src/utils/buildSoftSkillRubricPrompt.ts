/**
 * Builds the AI prompt for soft skill rubric scoring.
 *
 * Evaluates 4 criteria (scale 1–5 each):
 *   - communication   : Clarity and structure of the answer
 *   - selfAwareness   : Candidate's insight into their own strengths/limits
 *   - evidence        : Concrete examples or specific past experiences cited
 *   - relevance       : How directly the answer addresses the question asked
 *
 * Also requests an overall confidence (0–1) so the caller can decide
 * whether to trigger a retry.
 */
export const buildSoftSkillRubricPrompt = (
  pertanyaan: string,
  jawaban: string,
  retryHint?: string,
): string => {
  return `Role:
Anda adalah penilai jawaban soft skill untuk interview kerja.

Task:
Nilai jawaban kandidat berdasarkan 4 rubrik berikut. Setiap rubrik dinilai 1-5.

Rubrik:
- communication   (1-5): Seberapa jelas dan terstruktur kandidat menyampaikan jawaban.
- selfAwareness   (1-5): Seberapa baik kandidat mengenali kelebihan dan keterbatasan diri.
- evidence        (1-5): Seberapa konkret contoh atau pengalaman nyata yang disebutkan.
- relevance       (1-5): Seberapa langsung jawaban menjawab pertanyaan yang diajukan.
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

Format:
Kembalikan HANYA JSON dengan format berikut, tanpa teks lain:
{
  "communication": 0-5,
  "selfAwareness": 0-5,
  "evidence": 0-5,
  "relevance": 0-5,
  "confidence": 0-1,
  "reason": "alasan singkat dalam satu kalimat"
}`;
};
