/* eslint-disable require-yield */

const {inst, handler} = require('..');

const createPrompt = () => {
  const shift0 = inst('Shift0Reset#shift0');

  return {
    shift0,
    async *reset(gf) {
      return yield* handler(
        shift0,
        async function*(v) {
          return v;
        },
        async function*(k, f) {
          return yield* f(k);
        }
      )(gf);
    }
  };
};

module.exports = createPrompt;
