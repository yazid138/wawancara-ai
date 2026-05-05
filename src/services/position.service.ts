import prisma from "@/database/prisma";

export const getCompanyPositions = (companyId: number) => {
  return prisma.position.findMany({
    where: {
      companyId,
    },
  });
}

export default {
  getCompanyPositions,
};