import prisma from "@/database/prisma";

(async () => {
  console.log("start");
  await prisma.chatHistory.deleteMany();
  await prisma.scoreSoftSkill.deleteMany();
  await prisma.scoreTechnical.deleteMany();
  await prisma.answer.deleteMany();
  await prisma.interview.deleteMany();
  console.log("finish");
})();
