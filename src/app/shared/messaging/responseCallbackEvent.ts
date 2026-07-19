export interface ResponseCallbackEvent<T = any> {
  success: boolean; // Indicates if callback execution is success or not
  referer: string; // Unique request identifier
  response: T; // Result or error message
}