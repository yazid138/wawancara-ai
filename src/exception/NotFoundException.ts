import HttpException from "@/types/httpException";

export default class NotFoundException extends HttpException<null> {
  constructor(message = "Not Found") {
    super(message);
    this.name = "NotFoundException";
    this.status = 404;
  }
}
