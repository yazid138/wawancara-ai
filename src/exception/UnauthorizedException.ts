import HttpException from "@/types/httpException";

export default class UnauthorizedException extends HttpException {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedException";
    this.status = 401;
  }
}
