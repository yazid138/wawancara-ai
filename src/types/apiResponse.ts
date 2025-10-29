export default interface ApiResponse<T> {
  status: number;
  message: string;
  metadata?: {
    total: number;
    page: number;
    limit: number;
  };
  data?: T;
  error?: T;
}
