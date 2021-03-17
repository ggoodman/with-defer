export class AggregateError extends Error {
  public readonly errors: unknown[];
  public readonly name = 'AggregateError';

  constructor(errors: Iterable<unknown>, readonly message: string = '') {
    super(message);
    this.errors = [...errors];
  }
}
