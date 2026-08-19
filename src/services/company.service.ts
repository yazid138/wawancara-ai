import prisma from "@/database/prisma";

export const allCompanies = () => {
  return prisma.company.findMany();
};

export const createCompany = (name: string) => {
  return prisma.company.create({
    data: { name },
  });
};

export const getCompanyById = (id: number) => {
  return prisma.company.findUnique({
    where: { id },
  });
};

export default {
  allCompanies,
  createCompany,
  getCompanyById,
};
