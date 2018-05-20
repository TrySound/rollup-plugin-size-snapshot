# rollup-plugin-size-snapshot [![Build Status][travis-img]][travis]

[travis-img]: https://travis-ci.org/TrySound/rollup-plugin-size-snapshot.svg
[travis]: https://travis-ci.org/TrySound/rollup-plugin-size-snapshot

This provides the information about

* actual bundle size which will consume user bundler
* minified bundle size which will parse browsers in production
* gzipped size which will be loaded in production

All these sizes are improtant criteria to choose the library and user will see these criteria in `.size-snapshot.json` file.

Also there is a nice feature for `es` output format which provides sizes of treeshaked bundle with both rollup and webpack, so if your library have more than one independant parts you can track that user will not consume dead code.

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

If you use uglify or terser plugins then make sure they are placed after this one

```js
import { uglify } from "rollup-plugin-uglify";
// or import { terser } from "rollup-plugin-terser";
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

This option allows to check that contributor do not forget to build or to commit `.size-snapshot.json` file. If this is `true` the plugin will match existing snapshot and the new one.

type: `boolean`  
default: `false`

### printInfo

Allows to disable log to terminal.

type: `boolean`  
default: `true`

# License

MIT &copy; [Bogdan Chadkin](mailto:trysound@yandex.ru)
