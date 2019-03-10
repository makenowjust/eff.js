/* eslint-disable require-yield */

import * as util from 'util';

import test from 'ava';

import {inst, handler, handlers, execute} from '.';

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

test('handler: continuation cannot be called twice', t => {
  const eff = inst();

  t.throws(() => {
    execute(
      handler(
        eff,
        function*() {},
        function*(k) {
          yield* k(1);
          yield* k(2);
        }
      )(function*() {
        yield eff();
      })
    );
  }, 'continuation cannot be called twice');
});

test('handler: invalid invocation is found (number)', t => {
  const eff = inst();

  t.throws(() => {
    execute(
      handler(eff, function*() {}, function*() {})(function*() {
        yield 1;
      })
    );
  }, 'invalid invocation is found');
});

test('handler: invalid invocation is found (object)', t => {
  const eff = inst();

  t.throws(() => {
    execute(
      handler(eff, function*() {}, function*() {})(function*() {
        yield {};
      })
    );
  }, 'invalid invocation is found');
});

test('execute: uncaught effect is found', t => {
  const eff = inst();

  t.throws(() => {
    execute([eff()].values());
  }, 'uncaught effect is found');
});

test('execute: uncaught effect is found (resend)', t => {
  const eff1 = inst();
  const eff2 = inst();

  t.throws(() => {
    execute(
      handler(eff1, function*() {}, function*() {})(function*() {
        yield eff2();
      })
    );
  }, 'uncaught effect is found');
});

test('execute: invalid invocation is found', t => {
  t.throws(() => {
    execute([1].values());
  }, 'invalid invocation is found');
});

// State effect:

const newState = () => {
  const get = inst('State#get');
  const put = inst('State#put');

  const run = function*(init, gf) {
    const f = yield* handlers(
      function*(v) {
        return function*() {
          return v;
        };
      },
      {
        *[get](k) {
          return function*(v) {
            const f = yield* k(v);
            return yield* f(v);
          };
        },
        *[put](k, v) {
          return function*(_) {
            const f = yield* k();
            return yield* f(v);
          };
        }
      }
    )(gf);

    return yield* f(init);
  };

  return {
    get,
    put,
    run
  };
};

test('state', t => {
  t.plan(16);

  const s1 = newState();
  const s2 = newState();
  const s3 = newState();

  const g = s1.run(0, function*() {
    t.is(yield s1.get(), 0);
    yield s1.put(1);
    t.is(yield s1.get(), 1);

    const v2 = yield* s2.run(10, function*() {
      t.is(yield s1.get(), 1);
      t.is(yield s2.get(), 10);
      yield s2.put(11);
      t.is(yield s2.get(), 11);
      yield s1.put(2);
      t.is(yield s1.get(), 2);

      const v11 = yield* s1.run(20, function*() {
        t.is(yield s1.get(), 20);
        yield s1.put(21);
        t.is(yield s1.get(), 21);
        yield s2.put(12);
        t.is(yield s2.get(), 12);
        return yield s1.get();
      });

      const v3 = yield* s3.run(100, function*() {
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

  const v = execute(g);
  t.is(v, 138);
});

// Shift0/Reset effect:

const newPrompt = () => {
  const shift0 = inst('ShiftReset#shift0');

  return {
    *shift0(gf) {
      return yield shift0(gf);
    },
    *reset(gf) {
      return yield* handler(
        shift0,
        function*(v) {
          return v;
        },
        function*(k, f) {
          return yield* f(k);
        }
      )(gf);
    }
  };
};

test('shift0/reset', t => {
  t.plan(5);

  const p = newPrompt();

  const g = p.reset(function*() {
    const v1 = yield* p.shift0(function*(k) {
      t.is(yield* k(1), 4);
      return 5;
    });
    t.is(v1, 1);
    const v2 = yield* p.shift0(function*(k) {
      t.is(yield* k(2), 3);
      return 4;
    });
    t.is(v2, 2);
    return v1 + v2;
  });

  const v = execute(g);
  t.is(v, 5);
});
