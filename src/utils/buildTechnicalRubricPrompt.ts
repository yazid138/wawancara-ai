export const buildTechnicalRubricPrompt = (
  pertanyaan: string,
  jawaban: string,
  retryHint?: string,
): string => {
  return `Role:
Anda adalah penilai jawaban interview teknis dengan fokus pada kualitas isi.

Task:
Nilai jawaban menggunakan rubrik Pemahaman Konsep, Ketepatan Teknis, Logika Berpikir, dan Komunikasi Jawaban.

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

Format:
Kembalikan hanya JSON dengan format {"pemahaman": 0-5, "teknis": 0-5, "logika": 0-5, "komunikasi": 0-5, "confidence": 0-1, "alasan": "singkat"}.`;
};
