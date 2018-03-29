// @flow

import { rollup } from "rollup";
import { minify } from "uglify-es";

const input = "__size_snapshot_input__";
const entry = "__size_snapshot_entry__";

const isReservedId = id => id === input || id === entry;

const resolvePlugin = ({ code }) => ({
  resolveId(importee) {
    if (isReservedId(importee)) {
      return importee;
    }
    return null;
  },

  load(id) {
    if (id === input) {
      return `import {} from "${entry}";`;
    }
    if (id === entry) {
      return code;
    }
    return null;
  }
});

export const treeshakeWithRollup = (code: string) => {
  const config = {
    input,
    onwarn() {},
    plugins: [resolvePlugin({ code })]
  };

  return rollup(config)
    .then(bundle => bundle.generate({ format: "es" }))
    .then(result => minify(result.code, { toplevel: true }))
    .then(result => result.code);
};
