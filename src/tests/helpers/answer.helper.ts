import "dotenv/config";
import { generateAnswerAI } from "@/services/ai.service";
import prisma from "@/database/prisma";

/**
 * Generate jawaban menggunakan AI berdasarkan konten pertanyaan.
 * Mengambil keyword dari DB jika ada, lalu memanggil generateAnswerAI.
 */
export const generateTestAnswer = async (
  questionId: number,
  questionContent: string
): Promise<string> => {
  // Ambil keyword dari DB untuk kualitas jawaban yang lebih baik
  let keywords: string[] = [];

  if (questionId !== -1) {
    try {
      const kwRows = await prisma.keyword.findMany({
        where: { questionId },
        select: { word: true },
      });
      keywords = kwRows.map((k) => k.word);
    } catch {
      // Jika gagal ambil keyword, lanjut tanpa keyword
    }
  }

  // Fallback keyword jika tidak ada di DB
  if (keywords.length === 0) {
    keywords = ["profesional", "pengalaman", "kemampuan", "tim", "belajar"];
  }

  const answer = await generateAnswerAI(questionContent, keywords);
  return answer;
};
