import HttpException from "@/types/httpException";

export default class BadRequestException extends HttpException {
  constructor(message = "Bad Request", error = null) {
    super(message);
    this.name = "BadRequestException";
    this.status = 400;
    this.error = error;
  }
}
