import prisma from "@/database/prisma";
import NotFoundException from "@/exception/NotFoundException";
import ForbiddenException from "@/exception/ForbiddenException";

type CreateJobOpeningInput = {
  name: string;
  description?: string;
  companyId: number;
  positionName: string;
  createdById: number;
  categoryIds: number[];
};

export const createJobOpening = async (data: CreateJobOpeningInput) => {
  const { name, description, companyId, positionName, createdById, categoryIds } = data;

  const listPosition = await prisma.position.findMany({
    where: {
      companyId,
    },
  });

  let position = listPosition.find(
    (pos) => pos.name.trim().toLowerCase() === positionName.trim().toLowerCase(),
  );

  if (!position) {
    position = await prisma.position.create({
      data: {
        name: positionName.trim(),
        companyId,
      },
    });
  }

  const jobOpening = await prisma.jobOpening.create({
    data: {
      name,
      description,
      companyId,
      positionId: position.id,
      createdById,
      categories: {
        create: categoryIds.map((categoryId) => ({
          categoryId,
        })),
      },
    },
    include: {
      company: true,
      position: true,
      categories: {
        include: {
          category: true,
        },
      },
    },
  });

  return jobOpening;
};

export const getCompanyJobOpenings = async (companyId: number) => {
  return prisma.jobOpening.findMany({
    where: { companyId },
    include: {
      company: true,
      position: true,
      categories: {
        include: {
          category: true,
        },
      },
      _count: {
        select: { interviews: true },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
};

export const getAllJobOpenings = async () => {
  return prisma.jobOpening.findMany({
    where: { isActive: true },
    include: {
      company: true,
      position: true,
      categories: {
        include: {
          category: true,
        },
      },
      _count: {
        select: { interviews: true },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
};

export const getJobOpeningById = async (id: number) => {
  const jobOpening = await prisma.jobOpening.findUnique({
    where: { id },
    include: {
      company: true,
      position: true,
      categories: {
        include: {
          category: true,
        },
      },
      _count: {
        select: { interviews: true },
      },
    },
  });

  if (!jobOpening) {
    throw new NotFoundException(`Job opening with id ${id} not found`);
  }

  return jobOpening;
};

export const updateJobOpening = async (
  id: number,
  data: {
    name?: string;
    description?: string;
    positionId?: number;
    isActive?: boolean;
    categoryIds?: number[];
  },
) => {
  const { name, description, positionId, isActive, categoryIds } = data;

  const existing = await prisma.jobOpening.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundException(`Job opening with id ${id} not found`);
  }

  if (positionId !== undefined && positionId !== existing.positionId) {
    const position = await prisma.position.findUnique({
      where: { id: positionId },
    });

    if (!position) {
      throw new NotFoundException(`Position with id ${positionId} not found`);
    }

    if (position.companyId !== existing.companyId) {
      throw new ForbiddenException("Position does not belong to the specified company");
    }
  }

  const jobOpening = await prisma.jobOpening.update({
    where: { id },
    data: {
      name,
      description,
      positionId,
      isActive,
      ...(categoryIds !== undefined
        ? {
            categories: {
              deleteMany: {},
              create: categoryIds.map((categoryId) => ({
                categoryId,
              })),
            },
          }
        : {}),
    },
    include: {
      company: true,
      position: true,
      categories: {
        include: {
          category: true,
        },
      },
    },
  });

  return jobOpening;
};

export const deleteJobOpening = async (id: number) => {
  const existing = await prisma.jobOpening.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundException(`Job opening with id ${id} not found`);
  }

  await prisma.jobOpening.delete({
    where: { id },
  });

  return existing;
};

export default {
  createJobOpening,
  getCompanyJobOpenings,
  getAllJobOpenings,
  getJobOpeningById,
  updateJobOpening,
  deleteJobOpening,
};
