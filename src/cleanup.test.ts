import { suite, Test } from 'uvu';
import assert from 'uvu/assert';
import { runWithDefer } from './cleanup';
import { AggregateError } from './error';

function describe(test: string, handler: (it: Test) => void) {
  const testSuite = suite(test);

  handler(testSuite);

  testSuite.run();
}

describe('calls to withDefer without using defer', (it) => {
  it('will return a Promise that resolves to the return type of an async handler', async () => {
    const want = { result: true };
    const got = await runWithDefer(async () => {
      return want;
    });

    assert.equal(want, got);
  });

  it('will return a Promise that resolves to the return type of an sync handler', async () => {
    const want = { result: true };
    const got = await runWithDefer(() => {
      return want;
    });

    assert.equal(want, got);
  });

  it('will result in a rejected Promise when an async handler function throws', async () => {
    const want = new Error();

    let got;

    try {
      await runWithDefer(async () => {
        throw want;
      });
    } catch (err) {
      got = err;
    }

    assert.equal(want, got);
  });

  it('will result in a rejected Promise when a sync handler function throws', async () => {
    const want = new Error();

    let got;

    try {
      await runWithDefer(() => {
        throw want;
      });
    } catch (err) {
      got = err;
    }

    assert.equal(want, got);
  });
});

describe('calls to withDefer using defer', (it) => {
  it('will call deferred functions in LIFO order for a sync handler that does not throw', async () => {
    const want = [3, 2, 1];
    const got: number[] = [];

    await runWithDefer((defer) => {
      defer(() => got.push(1));
      defer(() => got.push(2));
      defer(() => got.push(3));
    });

    for (const i in want) {
      assert.equal(want[i], got[i]);
    }
  });

  it('will call deferred functions in LIFO order for an async handler that does not throw', async () => {
    const want = [3, 2, 1];
    const got: number[] = [];

    await runWithDefer(async (defer) => {
      defer(() => got.push(1));
      defer(() => got.push(2));
      defer(() => got.push(3));
    });

    for (const i in want) {
      assert.equal(want[i], got[i]);
    }
  });

  it('will call deferred functions in LIFO order for a sync handler that throws', async () => {
    const want = [3, 2, 1];
    const got: number[] = [];

    try {
      await runWithDefer((defer) => {
        defer(() => got.push(1));
        defer(() => got.push(2));
        defer(() => got.push(3));

        throw 'yoink';
      });
    } catch {
      // Don't care about errors in this test
    }
    for (const i in want) {
      assert.equal(want[i], got[i]);
    }
  });

  it('will call deferred functions in LIFO order for an async handler that throws', async () => {
    const want = [3, 2, 1];
    const got: number[] = [];

    try {
      await runWithDefer(async (defer) => {
        defer(() => got.push(1));
        defer(() => got.push(2));
        defer(() => got.push(3));

        throw 'yoink';
      });
    } catch {
      // Don't care about errors in this test
    }

    for (const i in want) {
      assert.equal(want[i], got[i]);
    }
  });

  it('will call deferred functions in LIFO order even if one throws', async () => {
    const want = [3, 2, 1];
    const got: number[] = [];

    try {
      await runWithDefer(async (defer) => {
        defer(() => got.push(1));
        defer(() => got.push(2));
        defer(() => {
          throw 'yoink';
        });
        defer(() => got.push(3));
      });
    } catch {
      // Don't care about errors in this test
    }

    for (const i in want) {
      assert.equal(want[i], got[i]);
    }
  });

  it('will return a Promise whose rejected value is an AggregateError whose errors property collects errors thrown by deferred functions', async () => {
    const want = [3, 2, 1];
    const wantThrow = true;
    let gotThrow = false;

    try {
      await runWithDefer(async (defer) => {
        defer(() => {
          throw 1;
        });
        defer(() => {
          throw 2;
        });
        defer(() => {
          throw 3;
        });
      });
    } catch (err) {
      assert.instance(err, AggregateError);

      const got = (err as AggregateError).errors;

      for (const i in want) {
        assert.equal(want[i], got[i]);
      }

      gotThrow = true;
    }

    assert.equal(wantThrow, gotThrow);
  });
});
