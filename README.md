# rollup-plugin-size-snapshot [![Build Status][travis-img]][travis]

[travis-img]: https://travis-ci.org/TrySound/rollup-plugin-size-snapshot.svg
[travis]: https://travis-ci.org/TrySound/rollup-plugin-size-snapshot

This plugins allows to track sizes of

* actual bundle size
* minified with uglify size
* minified and gzipped size

For `es` format it also produces sizes of treeshaked bundle by importing nothing

```js
import {} from "bundle";
```

There are two treeshake points

* webpack in production mode
* rollup + uglify with enabled toplevel option

## Usage

```js
import { sizeSnapshot } from "rollup-plugin-size-snapshot";

export default {
  input: "src/index.js",
  output: {
    file: "dist/index.js",
    format: "es"
  },
  plugins: [sizeSnapshot()]
};
```

If you use uglify plugin then make sure it is placed after this one

```js
import uglify from "rollup-plugin-uglify";
import { sizeSnapshot } from "rollup-plugin-size-snapshot";

export default {
  // ...
  plugins: [sizeSnapshot(), uglify({ toplevel: true })]
};
```

## Options

### snapshotPath

type: `string`  
default: `'.size-snapshot.json'`

### matchSnapshot

If this value is `true` new snapshot is compared with existing one and is not written to the disk. Usefull to check contributors on CI.

type: `boolean`  
default: `false`

### printInfo

Allows to disable log to terminal.

type: `boolean`  
default: `true`

# License

MIT &copy; [Bogdan Chadkin](mailto:trysound@yandex.ru)
