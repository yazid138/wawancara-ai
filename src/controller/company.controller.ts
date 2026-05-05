import { Request, Response } from "express";
import sendResponse from "@/utils/responseHandler";
import companyService from "@/services/company.service";
import positionService from "@/services/position.service";

export const getAllCompanies = async (req: Request, res: Response) => {
    const companies = await companyService.allCompanies();
    sendResponse(res, {
        status: 200,
        message: "Daftar perusahaan berhasil diambil",
        data: companies,
    });
};

export const getCompanyPositions = async (req: Request, res: Response) => {
    const companyId = +req.params.id;
    const positions = await positionService.getCompanyPositions(companyId);
    sendResponse(res, {
        status: 200,
        message: "Daftar posisi perusahaan berhasil diambil",
        data: positions,
    });
}

export default {
    getAllCompanies,
    getCompanyPositions,
};