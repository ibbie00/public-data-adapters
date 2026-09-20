export class SafeFetchError extends Error {
  constructor(
    public readonly code: string,
    message = code
  ) {
    super(message);
    this.name = "SafeFetchError";
  }
}
