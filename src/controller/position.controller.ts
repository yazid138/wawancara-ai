import { Request, Response } from "express";
import sendResponse from "@/utils/responseHandler";
import positionService from "@/services/position.service";

export const getAllPositions = async (req: Request, res: Response) => {
  const positions = await positionService.getAllPositions();
  sendResponse(res, {
    status: 200,
    message: "Daftar posisi berhasil diambil",
    data: positions,
  });
};

export default {
  getAllPositions,
};
