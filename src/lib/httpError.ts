/** HTTP error with a status code, shared by the auth and Convex client layers. */
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
