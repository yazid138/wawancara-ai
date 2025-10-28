import HttpException from "@/types/httpException";

export default class ForbiddenException extends HttpException<null> {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenException";
    this.status = 403;
  }
}
