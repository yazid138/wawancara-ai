export default class HttpException<T> extends Error {
  public status: number;
  public error: T | null;

  constructor(message: string) {
    super(message);
    this.status = 500;
    this.error = null;
  }
}
