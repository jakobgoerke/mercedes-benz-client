class AuthenticationError extends Error {
  constructor(message?: string) {
    super(message);

    this.name = this.constructor.name;

    Error.captureStackTrace(this, this.constructor);
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

export { AuthenticationError };
