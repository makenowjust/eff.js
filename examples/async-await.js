/* eslint-disable require-yield */

const {inst, handler} = require('..');

const createAsyncAwait = () => {
  const awaitEff = inst('AsyncAwait#await');

  return {
    await: awaitEff,
    async *async(gf) {
      return yield* handler(
        awaitEff,
        async function*(v) {
          return v;
        },
        async function*(k, p) {
          const v = await p;
          return yield* k(v);
        }
      )(gf);
    }
  };
};

module.exports = createAsyncAwait;
