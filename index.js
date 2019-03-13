const util = require('util');

/**
 * A `Symbol` denotes effect invocation.
 *
 * @private
 * @type {symbol}
 */
const Eff = Symbol('Eff');
/**
 * A `Symbol` denotes resend invocation.
 *
 * @private
 * @type {symbol}
 */
const Resend = Symbol('Resend');

/**
 * Creates a resend invocation.
 *
 * @private
 * @function
 * @param {function} eff an effect instance
 * @param {Array} values arguments passing to an handler of the effect `eff`
 * @param {AsyncGeneratorFunction} k an one-shot continuation
 * @returns {object} the resend invocation
 */
const resend = (eff, values, k) => ({[Resend]: undefined, eff, values, k});

/**
 * The next unique id for the next effect instance.
 *
 * @private
 * @type {number}
 */
let uid = 0;

/**
 * Returns a new effect instance.
 *
 * @function
 * @param {?string} name an effect name
 * @returns {function} the effect instance
 * @example
 * // Creates a new effect instance.
 * const eff = inst();
 *
 * // Creates a new effect instance with a name.
 * const fooEff = inst('foo');
 *
 * // An effect instance is a function returning an object.
 * // It calls *effect invocation*.
 * eff(1); // => {eff: inst%0, values: [1]}
 */
const inst = (name = '') => {
  const thisUid = uid++;
  const eff = (...values) => ({[Eff]: undefined, eff, values});
  eff.toString = () => `inst%${thisUid}${name ? `(${name})` : ''}`;
  eff[util.inspect.custom] = (_depth, ctx) =>
    ctx.stylize(eff.toString(), 'special');
  return eff;
};

/**
 * Returns a handler for the given effect.
 *
 * It is just a shortcut to `handlers(vh, {[eff]: effh})`.
 *
 * @function
 * @param {Function} eff an effect instance
 * @param {AsyncGeneratorFunction} vh a return value handler
 * @param {AsyncGeneratorFunction} effh an effect handler
 * @returns {AsyncGeeneratorFunction} the handlar for the given effect
 * @example
 * const write = inst();
 *
 * const handleWrite = handler(
 *   // An effect instance:
 *   // It is target to handle.
 *   write,
 *   // A return value handler:
 *   // It is called when `main` is finished.
 *   async function* (v) {
 *     return v;
 *   },
 *   // An effect handler:
 *   // It is called on each `yield write(...args)` with the continuation from
 *   // here and the given `args`.
 *   async function* (k, ...args) {
 *     console.log(...args);
 *     return yield* k();
 *   },
 * );
 *
 * const main = async function* () {
 *   yield write('hello world');
 * };
 *
 * execute(handleWrite(main));
 * // Outputs:
 * // hello world
 */
const handler = (eff, vh, effh) => handlers(vh, {[eff]: effh});

/**
 * Returns a handler for the given effects.
 *
 * @function
 * @param {AsyncGeneratorFunction} vh a return value handler
 * @param {object} effhs effect handlers
 * @returns {AsyncGeneratorFunction} the handlar for the given effects
 * @example
 * // Implements `State` monad like effect:
 *
 * const get = inst();
 * const put = inst();
 *
 * const handleState = async function* (init, main) {
 *   const f = yield* handler(
 *     async function* (v) {
 *       return async function* (_) {
 *         return v;
 *       };
 *     },
 *     {
 *       async *[get](k) {
 *         return async function* (s) {
 *           return yield* k(s)(s);
 *         };
 *       },
 *       async *[put](k, s) {
 *         return async function* (_) {
 *           return yield* k()(s);
 *         },
 *       },
 *     },
 *   )(main);
 *
 *   return yield* f(init);
 * };
 *
 * const main = async function* () {
 *   yield put(42);
 *   return yield get();
 * };
 *
 * execute(handleState(0, main)).then(console.log);
 * // Outputs:
 * // 42
 */
const handlers = (vh, effhs) =>
  async function*(gf) {
    /**
     * A generator of `gf`.
     *
     * @private
     * @type {AsyncIterator}
     */
    const g = gf();

    /**
     * Gets a one-shot continuation from the given generator.
     *
     * @private
     * @function
     * @param {AsyncIterator} g a generator
     * @returns {AsyncGeneratorFunction} the one-shot continuation
     */
    const cont = g => {
      let called = false;

      return async function*(arg = undefined) {
        if (called) {
          throw new Error('continuation cannot be called twice');
        }

        called = true;

        const {value: r, done} = await g.next(arg);
        if (done) {
          return yield* vh(r);
        }

        return yield* handles(r);
      };
    };

    /**
     * Wraps the given one-shot continuation by the current effects again.
     *
     * @private
     * @function
     * @param {AsyncGeneratorFunction} k one-shot continuation
     * @returns {AsyncGeneratorFunction} the wrapped one-shot continuation
     */
    const rehandles = k =>
      async function*(arg = undefined) {
        return yield* handlers(cont(g), effhs)(async function*() {
          return yield* k(arg);
        });
      };

    /**
     * Handles or resends the given effect invocation.
     *
     * @private
     * @function
     * @param {object} op an effect or resend invocation
     * @returns {AsyncIterator} the generator that returns a effect handler or yields resend invocation
     */
    const handles = async function*(op) {
      if (typeof op === 'object') {
        if (Eff in op) {
          const effh = effhs[op.eff];
          if (effh) {
            return yield* effh(cont(g), ...op.values);
          }

          return yield resend(op.eff, op.values, cont(g));
        }

        if (Resend in op) {
          const effh = effhs[op.eff];
          if (effh) {
            return yield* effh(rehandles(op.k), ...op.values);
          }

          return yield resend(op.eff, op.values, rehandles(op.k));
        }
      }

      throw new Error('invalid invocation is found');
    };

    return yield* cont(g)();
  };

/**
 * Combines some handlers to one handler.
 *
 * @param  {...AsyncGeneratorFunction} hs effect handlers returned by `handler` or `handlers` function
 * @returns {AsyncGeneratorFunction} the combined handler
 */
const combineHandlers = (...hs) => {
  if (hs.length === 0) {
    return async function*(gf) {
      return yield* gf();
    };
  }

  const [h, ...rhs] = hs;
  const rh = combineHandlers(...rhs);
  return async function*(gf) {
    return yield* h(async function*() {
      return yield* rh(gf);
    });
  };
};

/**
 * Runs the given generator and returns its result.
 *
 * @function
 * @param {AsyncIterator} g a generator
 * @returns {Promise<*>} the generator's result
 */
const execute = async g => {
  const {value, done} = await g.next();
  if (!done) {
    if (typeof value === 'object' && (Eff in value || Resend in value)) {
      throw new Error('uncaught effect is found');
    } else {
      throw new Error('invalid invocation is found');
    }
  }

  return value;
};

module.exports = {inst, handler, handlers, combineHandlers, execute};
