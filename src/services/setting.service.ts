import fs from "fs";

const templatePath = "src/prompt/template.prompt.txt";
const settingPath = "src/data/setting.json";

export const getPromptTemplate = () => {
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Prompt template file not found at path: ${templatePath}`);
  }
  return fs.readFileSync(templatePath, "utf-8");
};

export const updatePromptTemplate = (template: string) => {
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Prompt template file not found at path: ${templatePath}`);
  }
  fs.writeFileSync(templatePath, template, "utf-8");
};

export const getSetting = () => {
  if (!fs.existsSync(settingPath)) {
    throw new Error(`Setting file not found at path: ${settingPath}`);
  }
  return JSON.parse(fs.readFileSync(settingPath, "utf-8"));
};

export const updateSetting = (newSetting: any) => {
  if (!fs.existsSync(settingPath)) {
    throw new Error(`Setting file not found at path: ${settingPath}`);
  }
  fs.writeFileSync(settingPath, JSON.stringify(newSetting), "utf-8");
};

export default {
  updatePromptTemplate,
  getPromptTemplate,
  getSetting,
  updateSetting,
};
