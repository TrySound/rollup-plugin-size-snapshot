// @flow

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { minify } from "uglify-es";
import gzipSize from "gzip-size";
import deepEqual from "fast-deep-equal";
import diff from "jest-diff";
import bytes from "bytes";
import chalk from "chalk";
import { treeshakeWithRollup } from "./treeshakeWithRollup.js";
import { treeshakeWithWebpack } from "./treeshakeWithWebpack.js";

type Options = {
  treeshake?: boolean,
  snapshotPath?: string,
  updateSnapshot?: boolean,
  printInfo?: boolean
};

type OutputOptions = {
  format: string,
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

const writeJsonSync = (file, data) => {
  return writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
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
      const format = outputOptions.format;
      const output = outputOptions.file;

      if (typeof output !== "string") {
        throw Error("output file in rollup options should be specified");
      }

      const getSize = code => code.length;
      const minified = minify(source).code;
      const treeshakeSize = code =>
        Promise.all([
          treeshakeWithRollup(code).then(getSize),
          treeshakeWithWebpack(code).then(getSize)
        ]);

      return Promise.all([
        gzipSize(minified),
        shouldTreeshake ? treeshakeSize(source) : [0, 0]
      ]).then(([gzippedSize, [rollupSize, webpackSize]]) => {
        const sizes: Object = {
          bundled: getSize(source),
          minified: getSize(minified),
          gzipped: gzippedSize
        };

        let infoString =
          "\n" +
          `Computed sizes of "${output}" with "${format}" format\n` +
          `  bundled: ${formatSize(sizes.bundled)}\n` +
          `  minified with uglify: ${formatSize(sizes.minified)}\n` +
          `  minified and gzipped: ${formatSize(sizes.gzipped)}\n`;

        const getMsg = (bundler, size) => {
          const msg = `treeshaked with ${bundler} and uglified`;
          return `  ${msg}: ${formatSize(size)}\n`;
        };

        if (shouldTreeshake) {
          sizes.treeshaked = {
            rollup: rollupSize,
            webpack: webpackSize
          };

          infoString += getMsg("rollup", rollupSize);
          infoString += getMsg("webpack", webpackSize);
        }

        infoString += "\n";

        const snapshot = readJsonSync(snapshotPath);
        if (shouldUpdateSnapshot) {
          if (shouldPrintInfo) {
            console.info(infoString);
          }
          snapshot[outputOptions.file] = sizes;
          writeJsonSync(snapshotPath, snapshot);
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
