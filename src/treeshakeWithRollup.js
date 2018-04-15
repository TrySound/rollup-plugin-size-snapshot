// @flow

import { rollup } from "rollup";
import { minify } from "uglify-es";
import replace from "rollup-plugin-replace";
import { isExternal } from "./utils.js";

const inputName = "__size_snapshot_input__.js";
const bundleName = "__size_snapshot_bundle__.js";

const isReservedId = id => id.includes(inputName) || id.includes(bundleName);

const resolvePlugin = ({ code }) => ({
  resolveId(importee) {
    if (isReservedId(importee)) {
      return importee;
    }
    return null;
  },

  load(id) {
    if (id.includes(inputName)) {
      return `import {} from "/${bundleName}";`;
    }
    if (id.includes(bundleName)) {
      return code;
    }
    return null;
  }
});

export const treeshakeWithRollup = (code: string) => {
  const config = {
    input: `/${inputName}`,
    onwarn() {},
    external: isExternal,
    plugins: [
      resolvePlugin({ code }),
      replace({ "process.env.NODE_ENV": JSON.stringify("production") })
    ]
  };

  return rollup(config)
    .then(bundle => bundle.generate({ format: "es" }))
    .then(result => minify(result.code, { toplevel: true }))
    .then(result => result.code);
};
