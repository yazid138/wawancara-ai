import settingService from "@/services/setting.service";
import { Request, Response } from "express";
import sendResponse from "@/utils/responseHandler";
import validate from "@/utils/validation";

export const getPromptTemplate = async (req: Request, res: Response) => {
  const template = settingService.getPromptTemplate();
  sendResponse(res, {
    status: 200,
    message: "Prompt template retrieved successfully",
    data: template,
  });
};

export const updatePromptTemplate = async (req: Request, res: Response) => {
  const { template } = validate<{ template: string }>(
    {
      template: "string",
    },
    req.body,
  );
  settingService.updatePromptTemplate(template);
  sendResponse(res, {
    status: 200,
    message: "Prompt template updated successfully",
  });
};

export const getSetting = async (req: Request, res: Response) => {
  const setting = settingService.getSetting();
  sendResponse(res, {
    status: 200,
    message: "Setting retrieved successfully",
    data: setting,
  });
};

export const updateSetting = async (req: Request, res: Response) => {
  const newSetting = validate<any>({}, req.body);
  settingService.updateSetting(newSetting);
  sendResponse(res, {
    status: 200,
    message: "Setting updated successfully",
  });
};

export default {
  updatePromptTemplate,
  getPromptTemplate,
  getSetting,
  updateSetting,
};
