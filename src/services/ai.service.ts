import config from "@/config";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: config.openAIKey,
});

export const validateInterviewInput = async (pertanyaan: string, message: string) => {
  const { output_text } = await client.responses.create({
    model: config.openAIModel,
    input: [
      { role: "system", content: "kamu adalah seorang hrd yang akan mewawancarai mahasiswa untuk bekerja di perusahaan" },
      { role: "user", content: `apakah input berikut sudah sesuai dengan ketentuan wawancara?:
        [
      { role: "assistant", content: ${pertanyaan} },
      { role: "user", content: '${message}' },
    ]
      kembalikan dalam format {
        valid: true jika sesuai ketentuan wawancara, false jika tidak sesuai ketentuan wawancara,
        keterangan: penjelasan singkat mengapa input tersebut sesuai atau tidak sesuai dengan ketentuan wawancara
      }` },
    ],
  });
  return output_text;
}

export default client;
