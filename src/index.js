// @flow

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { rollup } from "rollup";
import { minify } from "uglify-es";
import gzipSize from "gzip-size";
import deepEqual from "fast-deep-equal";
import diff from "jest-diff";
import bytes from "bytes";
import chalk from "chalk";

type Options = {
  treeshake?: boolean,
  snapshotPath?: string,
  updateSnapshot?: boolean,
  printInfo?: boolean
};

type OutputOptions = {
  file: string
};

type Plugin = {
  name: string,
  transformBundle: (source: string, OutputOptions) => null | Promise<null>
};

const validateOptions = options => {
  const optionsKeys: $ReadOnlyArray<$Keys<Options>> = [
    "treeshake",
    "snapshotPath",
    "updateSnapshot",
    "printInfo"
  ];

  const invalidKeys = Object.keys(options).filter(
    d => !optionsKeys.includes(d)
  );

  if (invalidKeys.length) {
    throw Error(
      `Options ${invalidKeys.map(d => `"${d}"`).join(", ")} are invalid`
    );
  }
};

const readJsonSync = file => {
  try {
    const text = readFileSync(file, "utf-8");
    return JSON.parse(text);
  } catch (error) {
    return {};
  }
};

const treeshakeSize = code => {
  const input = "__size_snapshot_input__";
  const entry = "__size_snapshot_entry__";

  const isReservedId = id => id === input || id === entry;

  const config = {
    input,
    onwarn() {},
    plugins: [
      {
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
      }
    ]
  };

  return rollup(config)
    .then(bundle => bundle.generate({ format: "es" }))
    .then(result => minify(result.code, { toplevel: true }))
    .then(result => result.code.length);
};

const bytesConfig = { thousandsSeparator: ",", unitSeparator: " ", unit: "B" };

const formatSize = d => chalk.bold(bytes.format(d, bytesConfig));

export const sizeSnapshot = (options?: Options = {}): Plugin => {
  validateOptions(options);

  const shouldTreeshake = options.treeshake === true;
  const snapshotPath =
    options.snapshotPath || join(process.cwd(), ".size-snapshot.json");
  const shouldUpdateSnapshot = options.updateSnapshot !== false;
  const shouldPrintInfo = options.printInfo !== false;

  return {
    name: "size-snapshot",

    transformBundle(source, outputOptions) {
      const output = outputOptions.file;

      if (typeof output !== "string") {
        throw Error("output file in rollup options should be specified");
      }

      const minified = minify(source).code;

      return Promise.all([
        gzipSize(minified),
        shouldTreeshake ? treeshakeSize(source) : 0
      ]).then(([gzippedSize, treeshakedSize]) => {
        const sizes: Object = {
          bundled: source.length,
          minified: minified.length,
          gzipped: gzippedSize
        };

        let infoString =
          `Computed sizes of "${output}"\n` +
          `  bundled: ${formatSize(sizes.bundled)}\n` +
          `  minified with uglify: ${formatSize(sizes.minified)}\n` +
          `  minified and gzipped: ${formatSize(sizes.gzipped)}\n`;

        if (shouldTreeshake) {
          sizes.treeshaked = treeshakedSize;
          const msg = "treeshaked and uglified with toplevel option";
          infoString += `  ${msg}: ${formatSize(treeshakedSize)}\n`;
        }

        const snapshot = readJsonSync(snapshotPath);
        if (shouldUpdateSnapshot) {
          if (shouldPrintInfo) {
            console.info(infoString);
          }
          snapshot[outputOptions.file] = sizes;
          writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
        } else {
          const entry = snapshot[output] || {};
          if (!deepEqual(entry, sizes)) {
            console.error(diff(entry, sizes));
            throw Error("size snapshot is not matched");
          }
        }

        return null;
      });
    }
  };
};
