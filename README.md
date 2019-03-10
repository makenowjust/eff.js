# eff.js

> One-Shot Algebric Effects on JavaScript Generators

It is JavaScript port of [eff.lua](https://github.com/Nymphium/eff.lua).
Many thanks to @Nymphium!

[![Build Status][travis-badge]][travis]
[![Coverage][codecov-badge]][codecov]
[![NPM version][npm-version-badge]][npm]

## API

See [API.md](./API.md).

## Technical Note

### What's difference between this and eff.lua?

eff.lua is built on Lua's asymmetric coroutines. It is more powerful than
JavaScript generators: Lua's one can do `yield` from anywhere, but JavaScript's
one can do `yield` only from generator functions (`function *`). Thus, eff.js
is less convenient than eff.lua. However this porting is interesting and
important technically.

### How to emulate stackful coroutine on stackless coroutine.

According to Moura et al [1], both of coroutines call *asymmetric*. Lua's
coroutine calls *stackful* that can `yield` over call stacks, and JavaScript
generator calls *stackless* on the other hand. In general, stackful coroutine
is more powerful than stackless one. So, it is important how to emulate stackful
coroutine on stackless coroutine.

Of course, it is impossible that usual stackless corutine emulates stackful
coroutine. Therefore, considering restricted JavaScript is needed. This
JavaScript has only generator functions, but generator operations are exception,
then relations between asymmetric coroutine operation and JavaScript shows the
following table:

|                     | Asymmetric coroutine | JavaScript   |
|---------------------|----------------------|--------------|
| Creates a coroutine | `co = create f`      | `co = f()`   |
| Calls a function    | `f()`                | `yield* f()` |
| Yields a coroutine  | `yield v`            | `yield v`    |
| Resumes a coroutine | `resume co v`        | `co.next(v)` |

I implemented eff.js in accordance with this table. The interesting point is
`vh` of `handler` function is generator function on eff.js. It is important to
work `resend` invocation correctly.

### Reference

1. Moura, Ana Lúcia De, and Roberto Ierusalimschy. "Revisiting coroutines."
   ACM Transactions on Programming Languages and Systems (TOPLAS) 31.2 (2009):
   6.

## License

MIT

(C) 2019 TSUYUSATO "MakeNowJust" Kitsune

[travis-badge]: https://img.shields.io/travis/MakeNowJust/eff.js/master.svg?style=for-the-badge&logo=travis&colorA=8B6858
[travis]: https://travis-ci.org/MakeNowJust/eff.js
[codecov-badge]: https://img.shields.io/codecov/c/github/MakeNowJust/eff.js/master.svg?style=for-the-badge&colorA=FF005E&logo=codecov&logoColor=white
[codecov]: https://codecov.io/gh/MakeNowJust/eff.js/branch/master
[npm-version-badge]: https://img.shields.io/npm/v/eff.js.svg?style=for-the-badge&logo=npm
[npm]: https://www.npmjs.com/package/eff.js
