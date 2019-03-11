/* eslint-disable require-yield */

const {inst, handler} = require('..');

const createPrompt = () => {
  const shift0 = inst('Shift0Reset#shift0');

  return {
    shift0,
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

module.exports = createPrompt;
