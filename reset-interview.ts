import prisma from "@/database/prisma";

(async () => {
  console.log("start");
  await prisma.chatHistory.deleteMany();
  await prisma.score.deleteMany();
  await prisma.answer.deleteMany();
  await prisma.interview.deleteMany();
  console.log("finish");
})();
