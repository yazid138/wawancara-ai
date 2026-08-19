import { Request, Response } from "express";
import sendResponse from "@/utils/responseHandler";
import validate from "@/utils/validation";
import jobOpeningService from "@/services/jobOpening.service";

type CreateJobOpeningRequest = {
  name: string;
  description?: string;
  positionName: string;
  categoryIds: number[];
};

export const createJobOpening = async (req: Request, res: Response) => {
  const user = req.user as any;
  const companyId = user.companyId;

  if (!companyId) {
    return sendResponse(res, {
      status: 400,
      message: "User tidak terhubung dengan perusahaan",
    });
  }

  const { name, description, positionName, categoryIds } = validate<CreateJobOpeningRequest>(
    {
      name: "string",
      description: { type: "string", optional: true },
      positionName: "string",
      categoryIds: {
        type: "array",
        items: "number",
      },
    },
    req.body,
  );

  const jobOpening = await jobOpeningService.createJobOpening({
    name,
    description,
    companyId,
    positionName,
    createdById: user.id,
    categoryIds,
  });

  sendResponse(res, {
    status: 201,
    message: "Lamaran berhasil dibuat",
    data: jobOpening,
  });
};

export const getCompanyJobOpenings = async (req: Request, res: Response) => {
  const user = req.user as any;
  const companyId = user.companyId;

  if (!companyId) {
    return sendResponse(res, {
      status: 400,
      message: "User tidak terhubung dengan perusahaan",
    });
  }

  const jobOpenings = await jobOpeningService.getCompanyJobOpenings(companyId);

  sendResponse(res, {
    status: 200,
    message: "Daftar lamaran berhasil diambil",
    data: jobOpenings,
  });
};

export const getAllJobOpenings = async (req: Request, res: Response) => {
  const jobOpenings = await jobOpeningService.getAllJobOpenings();

  sendResponse(res, {
    status: 200,
    message: "Daftar semua lamaran berhasil diambil",
    data: jobOpenings,
  });
};

export const getJobOpeningById = async (req: Request, res: Response) => {
  const id = +req.params.id;
  const jobOpening = await jobOpeningService.getJobOpeningById(id);

  sendResponse(res, {
    status: 200,
    message: "Detail lamaran berhasil diambil",
    data: jobOpening,
  });
};

type UpdateJobOpeningRequest = {
  name?: string;
  description?: string;
  positionId?: number;
  isActive?: boolean;
  categoryIds?: number[];
};

export const updateJobOpening = async (req: Request, res: Response) => {
  const id = +req.params.id;
  const user = req.user as any;

  const existing = await jobOpeningService.getJobOpeningById(id);
  if (user.role === "COMPANY" && existing.companyId !== user.companyId) {
    return sendResponse(res, {
      status: 403,
      message: "Tidak memiliki akses ke lamaran ini",
    });
  }

  const { name, description, positionId, isActive, categoryIds } = validate<UpdateJobOpeningRequest>(
    {
      name: { type: "string", optional: true },
      description: { type: "string", optional: true },
      positionId: { type: "number", optional: true },
      isActive: { type: "boolean", optional: true },
      categoryIds: { type: "array", items: "number", optional: true },
    },
    req.body,
  );

  const jobOpening = await jobOpeningService.updateJobOpening(id, {
    name,
    description,
    positionId,
    isActive,
    categoryIds,
  });

  sendResponse(res, {
    status: 200,
    message: "Lamaran berhasil diperbarui",
    data: jobOpening,
  });
};

export const deleteJobOpening = async (req: Request, res: Response) => {
  const id = +req.params.id;
  const user = req.user as any;

  const existing = await jobOpeningService.getJobOpeningById(id);
  if (user.role === "COMPANY" && existing.companyId !== user.companyId) {
    return sendResponse(res, {
      status: 403,
      message: "Tidak memiliki akses ke lamaran ini",
    });
  }

  await jobOpeningService.deleteJobOpening(id);

  sendResponse(res, {
    status: 200,
    message: "Lamaran berhasil dihapus",
  });
};

export default {
  createJobOpening,
  getCompanyJobOpenings,
  getAllJobOpenings,
  getJobOpeningById,
  updateJobOpening,
  deleteJobOpening,
};
