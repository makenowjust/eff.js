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
 * @param {GeneratorFunction} k an one-shot continuation
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
 * @return {function} the effect instance
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
 * @param {Function} eff a effect instance
 * @param {GeneratorFunction} vh a return value handler
 * @param {GeneratorFunction} effh effect handler
 * @returns {GeeneratorFunction} the handlar for the given effect
 */
const handler = (eff, vh, effh) => handlers(vh, {[eff]: effh});

/**
 * Returns a handler for the given effects.
 *
 * @function
 * @param {GeneratorFunction} vh a return value handler
 * @param {object} effhs effect handlers
 * @returns {GeeneratorFunction} the handlar for the given effects
 */
const handlers = (vh, effhs) =>
  function*(gf) {
    /**
     * A generator of `gf`.
     *
     * @private
     * @type {Generator}
     */
    const g = gf();

    /**
     * Gets a one-shot continuation from the given generator.
     *
     * @private
     * @function
     * @param {Generator} g a generator
     * @returns {GeneratorFunction} the one-shot continuation
     */
    const cont = g => {
      let called = false;

      return function*(arg = undefined) {
        if (called) {
          throw new Error('continuation cannot be called twice');
        }

        called = true;

        const {value: r, done} = g.next(arg);
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
     * @param {GeneratorFunction} k one-shot continuation
     * @returns {GeneratorFunction} the wrapped one-shot continuation
     */
    const rehandles = k =>
      function*(arg) {
        return yield* handlers(cont(g), effhs)(function*() {
          return yield* k(arg);
        });
      };

    /**
     * Handles or resends the given effect invocation.
     *
     * @private
     * @param {object} op an effect or resend invocation
     * @returns {Generator} the generator that returns a effect handler or yields resend invocation
     */
    const handles = function*(op) {
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
 * Runs the given generator and returns its result.
 *
 * @function
 * @param {Generator} g a generator
 * @return {any} the generator's result
 */
const execute = g => {
  const {value, done} = g.next();
  if (!done) {
    if (typeof value === 'object' && (Eff in value || Resend in value)) {
      throw new Error('uncaught effect is found');
    } else {
      throw new Error('invalid invocation is found');
    }
  }

  return value;
};

module.exports = {inst, handler, handlers, execute};
