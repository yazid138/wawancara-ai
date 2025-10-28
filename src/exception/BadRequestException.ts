import HttpException from "@/types/httpException";

export default class BadRequestException<T> extends HttpException<T> {
  constructor(message = "Bad Request", error: T | null = null) {
    super(message);
    this.name = "BadRequestException";
    this.status = 400;
    this.error = error;
  }
}
