class HttpException extends Error {
    public status: number;
    public error: any;

    constructor(message: string) {
        super(message);
        this.status = 500;
        this.error = null;
    }
}
export default HttpException;