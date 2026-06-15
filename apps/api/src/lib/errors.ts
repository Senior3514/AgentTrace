// Typed application errors that map cleanly to HTTP responses.

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, "bad_request", message, details);

export const unauthorized = (message = "Missing or invalid API key") =>
  new AppError(401, "unauthorized", message);

export const notFound = (message = "Resource not found") =>
  new AppError(404, "not_found", message);

export const conflict = (message: string, details?: unknown) =>
  new AppError(409, "conflict", message, details);

export const unprocessable = (message: string, details?: unknown) =>
  new AppError(422, "unprocessable", message, details);
