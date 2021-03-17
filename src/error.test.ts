import { suite, Test } from 'uvu';
import assert from 'uvu/assert';
import { AggregateError } from './error';

function describe(test: string, handler: (it: Test) => void) {
  const testSuite = suite(test);

  handler(testSuite);

  testSuite.run();
}

describe('The AggregateError class', (it) => {
  it('will result in an AggregateError instance', () => {
    assert.instance(new AggregateError([]), AggregateError);
  });

  it('will have an "AggregateError" name when instantiated', () => {
    const want = 'AggregateError';
    const got = new AggregateError([]).name;

    assert.equal(want, got);
  });

  it('will expose component errors on the errors property', () => {
    const want = [1, 2, 3];
    const got = new AggregateError(want).errors;

    assert.equal(want, got);
  });

  it('will expose the chosen message on the message property', () => {
    const want = 'No good Johnny!';
    const got = new AggregateError([], want).message;

    assert.equal(want, got);
  });
});
