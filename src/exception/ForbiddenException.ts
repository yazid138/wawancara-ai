import HttpException from "@/types/exception";

export default class ForbiddenException extends HttpException {
    constructor(message = 'Forbidden') {
        super(message);
        this.name = 'ForbiddenException';
        this.status = 403;
    }
}