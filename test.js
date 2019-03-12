import util from 'util';
import fs from 'fs';

import test from 'ava';

import createState from './examples/state';
import createPrompt from './examples/shift0-reset';
import createAsyncAwait from './examples/async-await';
import {inst, handler, execute} from '.';

test('inst', t => {
  const eff1 = inst();
  t.is(typeof eff1, 'function');

  const eff2 = inst();
  t.not(eff1.toString(), eff2.toString());

  const fooEff = inst('foo');
  t.regex(fooEff.toString(), /foo/);
});

test('inst: inspect', t => {
  const eff = inst();
  t.is(util.inspect(eff, {colors: true}), `\u001B[36m${eff}\u001B[39m`);
});

test('handler: continuation cannot be called twice', async t => {
  const eff = inst();

  await t.throwsAsync(async () => {
    const h = handler(
      eff,
      async function*() {},
      async function*(k) {
        yield* k(1);
        yield* k(2);
      }
    );
    await execute(
      h(async function*() {
        yield eff();
      })
    );
  }, 'continuation cannot be called twice');
});

test('handler: invalid invocation is found (number)', async t => {
  const eff = inst();

  await t.throwsAsync(async () => {
    const h = handler(eff, async function*() {}, async function*() {});
    await execute(
      h(async function*() {
        yield 1;
      })
    );
  }, 'invalid invocation is found');
});

test('handler: invalid invocation is found (object)', async t => {
  const eff = inst();

  await t.throwsAsync(async () => {
    const h = handler(eff, async function*() {}, async function*() {});
    await execute(
      h(async function*() {
        yield {};
      })
    );
  }, 'invalid invocation is found');
});

test('execute: uncaught effect is found', async t => {
  const eff = inst();

  await t.throwsAsync(async () => {
    const gf = async function*() {
      yield eff();
    };

    await execute(gf());
  }, 'uncaught effect is found');
});

test('execute: uncaught effect is found (resend)', async t => {
  const eff1 = inst();
  const eff2 = inst();

  await t.throwsAsync(async () => {
    const h = handler(eff1, async function*() {}, async function*() {});
    await execute(
      h(async function*() {
        yield eff2();
      })
    );
  }, 'uncaught effect is found');
});

test('execute: invalid invocation is found', async t => {
  await t.throwsAsync(async () => {
    const gf = async function*() {
      yield 1;
    };

    await execute(gf());
  }, 'invalid invocation is found');
});

test('state', async t => {
  t.plan(16);

  const s1 = createState();
  const s2 = createState();
  const s3 = createState();

  const g = s1.run(0, async function*() {
    t.is(yield s1.get(), 0);
    yield s1.put(1);
    t.is(yield s1.get(), 1);

    const v2 = yield* s2.run(10, async function*() {
      t.is(yield s1.get(), 1);
      t.is(yield s2.get(), 10);
      yield s2.put(11);
      t.is(yield s2.get(), 11);
      yield s1.put(2);
      t.is(yield s1.get(), 2);

      const v11 = yield* s1.run(20, async function*() {
        t.is(yield s1.get(), 20);
        yield s1.put(21);
        t.is(yield s1.get(), 21);
        yield s2.put(12);
        t.is(yield s2.get(), 12);
        return yield s1.get();
      });

      const v3 = yield* s3.run(100, async function*() {
        t.is(yield s3.get(), 100);
        yield s1.put(3);
        t.is(yield s1.get(), 3);
        yield s2.put(13);
        t.is(yield s2.get(), 13);
        yield s3.put(101);
        return yield s3.get();
      });

      t.is(yield s1.get(), 3);
      t.is(yield s2.get(), 13);
      const v2 = yield s2.get();

      return v11 + v2 + v3;
    });

    t.is(yield s1.get(), 3);
    const v1 = yield s1.get();

    return v1 + v2;
  });

  const v = await execute(g);
  t.is(v, 138);
});

test('shift0/reset', async t => {
  t.plan(5);

  const p = createPrompt();

  const g = p.reset(async function*() {
    const v1 = yield p.shift0(async function*(k) {
      t.is(yield* k(1), 4);
      return 5;
    });
    t.is(v1, 1);
    const v2 = yield p.shift0(async function*(k) {
      t.is(yield* k(2), 3);
      return 4;
    });
    t.is(v2, 2);
    return v1 + v2;
  });

  const v = await execute(g);
  t.is(v, 5);
});

test('async/await', async t => {
  t.plan(2);
  const aa = createAsyncAwait();

  const g = aa.async(async function*() {
    const readme = yield aa.await(fs.promises.readFile('README.md', 'utf8'));
    t.regex(readme, /eff\.js/);
    return readme;
  });

  const readme = await execute(g);
  t.regex(readme, /eff\.js/);
});

test('shift0/reset & state', async t => {
  t.plan(2);

  const p = createPrompt();
  const s = createState();

  const g = s.run(0, async function*() {
    return yield* p.reset(async function*() {
      const v = yield p.shift0(async function*(k) {
        t.is(yield* k(1), 1);
        yield s.put(2);
        return yield s.get();
      });
      yield s.put(v);
      return yield s.get();
    });
  });

  const v = await execute(g);
  t.is(v, 2);
});

test('async/await & state', async t => {
  t.plan(2);

  const aa = createAsyncAwait();
  const s = createState();

  const g = s.run('', async function*() {
    yield s.put('README.md');
    yield* aa.async(async function*() {
      const readme = yield aa.await(
        fs.promises.readFile(yield s.get(), 'utf8')
      );
      t.regex(readme, /eff\.js/);
      yield s.put(readme);
    });
    return yield s.get();
  });

  const readme = await execute(g);
  t.regex(readme, /eff\.js/);
});
