import prisma from "@/database/prisma";

export const getAllPositions = () => {
  return prisma.position.findMany({
    include: {
      company: true,
    },
  });
};

export const getCompanyPositions = (companyId: number) => {
  return prisma.position.findMany({
    where: {
      companyId,
    },
  });
};

export default {
  getAllPositions,
  getCompanyPositions,
};
