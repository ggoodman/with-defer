import { AggregateError } from './error';

/**
 * CleanupCallback functions will be automatically called when the handler's returned promise
 * settles.
 *
 * These can be used to perform some resource clean-up and will be completed before yielding
 * control back to the caller.
 */
interface CleanupCallback {
  (): any;
}

/**
 * DeferFunction is a function that can be used to register clean-up functions to be called
 * before control is yielded back to the caller.
 */
interface DeferFunction {
  (deferredFn: CleanupCallback): void;
}

/**
 * FunctionWithCleanup is a function that will be run with an injected `defer` argument.
 */
interface FunctionWithCleanup {
  (defer: DeferFunction): any;
}

type ReturnedPromise<TFunc extends FunctionWithCleanup> = Promise<
  ReturnType<TFunc> extends PromiseLike<infer U> ? U : ReturnType<TFunc>
>;

/**
 * Run a handler function (`func`) such that any callbacks registered with the `defer` argument
 * passed to it will be called in LIFO order when the function completes.
 *
 * This is conceptually similar to the `defer` statement in Go in that you can use it to register
 * resources for disposal as they are created. Each deferred callback will be await in LIFO order.
 * Any errors thrown while calling these deferred callbacks will be collected without preventing
 * other callback from executing. If any errors are thrown an
 * [`AggregateError`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AggregateError)
 * will be thrown with these errors.
 *
 * @param func Function that will be called with a single `defer` argument that is itself a function that an be called to register callbacks that will be called in LIFO whenever the handler completes.
 * @returns A `Promise` whose settled value will match the result of executing the handler `func`.
 *
 * Example:
 *
 * ```ts
 * import * as Fs from "fs";
 * import { runWithDefer } from "with-defer";
 *
 * async function main() {
 *   await runWithDefer(async (defer) => {
 *     // Open a file hande and make sure we close it.
 *     const handle1 = await Fs.promises.open("path/to/file", "r+");
 *     defer(() => handle1.close());
 *
 *     const content = await handle1.readFile("utf8");
 *
 *     // We open a 2nd handle here and register its close function. Notice we don't have to deal
 *     // with crazy nesting of try / catch blocks and can co-locate clean-up with obtaining the
 *     // resource.
 *     const handle2 = await Fs.promises.open("path/to/file2", "w+");
 *     defer(() => handle2.close());
 *
 *     await handle2.writeFile(content);
 *   });
 * }
 * ```
 */
export async function runWithDefer<TFunc extends FunctionWithCleanup>(
  func: TFunc
): ReturnedPromise<TFunc> {
  const onCleanup: CleanupCallback[] = [];
  const defer: DeferFunction = (deferredFn) => {
    onCleanup.unshift(deferredFn);
  };

  try {
    return await func(defer);
  } finally {
    let errors = [];
    for (const onCleanupFn of onCleanup) {
      try {
        await onCleanupFn();
      } catch (err) {
        errors.push(err);
      }
    }
    if (errors.length) {
      throw new AggregateError(
        errors,
        'One or more exceptions caught while executing deferred clean-up functions'
      );
    }
  }
}
