/* eslint-disable require-yield */

const {inst, handlers} = require('..');

const createState = () => {
  const get = inst('State#get');
  const put = inst('State#put');

  return {
    get,
    put,
    *run(init, gf) {
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
    }
  };
};

module.exports = createState;
