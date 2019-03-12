/* eslint-disable require-yield */

const {inst, handlers} = require('..');

const createState = () => {
  const get = inst('State#get');
  const put = inst('State#put');

  return {
    get,
    put,
    async *run(init, gf) {
      const f = yield* handlers(
        async function*(v) {
          return async function*() {
            return v;
          };
        },
        {
          async *[get](k) {
            return async function*(v) {
              const f = yield* k(v);
              return yield* f(v);
            };
          },
          async *[put](k, v) {
            return async function*(_) {
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
