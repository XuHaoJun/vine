export class PaymentsError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'PaymentsError'
  }
}

export class ConfigError extends PaymentsError {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

export class VerificationError extends PaymentsError {
  constructor(message: string, cause?: unknown) {
    super(message, cause)
    this.name = 'VerificationError'
  }
}

export class IntegrationError extends PaymentsError {
  constructor(message: string, cause?: unknown) {
    super(message, cause)
    this.name = 'IntegrationError'
  }
}
