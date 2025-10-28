import Validator, { ValidationError } from "fastest-validator";
import BadRequestException from "@/exception/BadRequestException";

const v = new Validator();

export default <T>(schema: any, data: T) => {
  const check = v.compile(schema);
  const result = check(data || {});
  if (result !== true) {
    throw new BadRequestException("Validation Error", result as ValidationError[]);
  }
};
