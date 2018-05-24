// @flow

import { rollup } from "rollup";
import { minify } from "terser";
import { parse } from "acorn";
import replace from "rollup-plugin-replace";
import { isExternal } from "./utils.js";

type Output = {
  code: number,
  import_statements: number
};

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

export const treeshakeWithRollup = (code: string): Promise<Output> => {
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
    .then((result): Output => {
      const ast = parse(result.code, { sourceType: "module" });
      const import_statements = ast.body
        // collect all toplevel import statements
        .filter(node => node.type === "ImportDeclaration")
        // endpos is the next character after node -> substract 1
        .map(node => node.end - node.start)
        .reduce((acc, size) => acc + size, 0);

      return {
        code: result.code.length,
        import_statements
      };
    });
};
