/* eslint-disable @typescript-eslint/no-explicit-any */
export interface ServiceResponse<T = any> {
  success: boolean;
  message?: string;
  statusCode: number;
  data?: T;
}
