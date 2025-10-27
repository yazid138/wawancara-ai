import HttpException from "@/types/exception";

export default class UnauthorizedException extends HttpException {
    constructor(message = 'Unauthorized') {
        super(message);
        this.name = 'UnauthorizedException';
        this.status = 401;
    }
}