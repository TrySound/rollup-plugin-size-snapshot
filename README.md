# rollup-plugin-size-snapshot [![Build Status][travis-img]][travis]

[travis-img]: https://travis-ci.org/TrySound/rollup-plugin-size-snapshot.svg
[travis]: https://travis-ci.org/TrySound/rollup-plugin-size-snapshot

## Usage

```js
import { sizeSnapshot } from "rollup-plugin-size-snapshot";

export default {
  input: "src/index.js",
  output: {
    file: "dist/index.js",
    format: "es"
  },
  plugins: [sizeSnapshot({ treeshake: true })]
};
```

If you use uglify plugin then make sure it is placed after this one

```js
import uglify from "rollup-plugin-uglify";
import { sizeSnapshot } from "rollup-plugin-size-snapshot";

export default {
  // ...
  plugins: [sizeSnapshot({ treeshake: true }), uglify({ toplevel: true })]
};
```

## Options

### treeshake

type: `boolean`  
default: `false`

Creates bundle with `import {} from 'bundle'` entry point to check treeshakability.

1.  run rollup to treeshake whatever it can analyze
1.  run uglify with `{ toplevel: true }` which looks for pure annotations and analyzes all toplevels which are isolated in bundle

### snapshotPath

type: `string`  
default: `'.size-snapshot.json'`

### updateSnapshot

Depending on this value snapshot is automatically updated or compared with runtime result. Usefull to check contributors on CI.

type: `boolean`  
default: `true`

### printInfo

Allows to disable log to terminal.

type: `boolean`  
default: `true`

# License

MIT &copy; [Bogdan Chadkin](mailto:trysound@yandex.ru)
