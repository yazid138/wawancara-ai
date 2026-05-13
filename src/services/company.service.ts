import prisma from "@/database/prisma";

export const allCompanies = () => {
  return prisma.company.findMany();
};

export default {
  allCompanies,
};
