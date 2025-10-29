import HttpException from "@/exception/HttpException";

export default class NotFoundException extends HttpException {
  constructor(message = "Not Found") {
    super(message);
    this.name = "NotFoundException";
    this.status = 404;
  }
}
