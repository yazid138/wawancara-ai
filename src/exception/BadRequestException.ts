import HttpException from "@/exception/HttpException";

export default class BadRequestException<T> extends HttpException {
  constructor(message = "Bad Request", error: T | null = null) {
    super(message);
    this.name = "BadRequestException";
    this.status = 400;
    this.error = error;
  }
}
