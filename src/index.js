// @flow

import { join } from "path";
import { minify } from "terser";
import gzipSize from "gzip-size";
import bytes from "bytes";
import chalk from "chalk";
import { treeshakeWithRollup } from "./treeshakeWithRollup.js";
import { treeshakeWithWebpack } from "./treeshakeWithWebpack.js";
import * as snapshot from "./snapshot.js";

type Options = {
  snapshotPath?: string,
  matchSnapshot?: boolean,
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
    "snapshotPath",
    "matchSnapshot",
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

const bytesConfig = { thousandsSeparator: ",", unitSeparator: " ", unit: "B" };

const formatSize = d => chalk.bold(bytes.format(d, bytesConfig));

export const sizeSnapshot = (options?: Options = {}): Plugin => {
  validateOptions(options);

  const snapshotPath =
    options.snapshotPath || join(process.cwd(), ".size-snapshot.json");
  const shouldMatchSnapshot = options.matchSnapshot === true;
  const shouldPrintInfo = options.printInfo !== false;

  return {
    name: "size-snapshot",

    transformBundle(source, outputOptions) {
      const format = outputOptions.format;
      const output = outputOptions.file;
      const shouldTreeshake = format === "es";

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
          `  minified with terser: ${formatSize(sizes.minified)}\n` +
          `  minified and gzipped: ${formatSize(sizes.gzipped)}\n`;

        const formatMsg = (msg, size) => {
          return `  ${msg}: ${formatSize(size)}\n`;
        };

        if (shouldTreeshake) {
          sizes.treeshaked = {
            rollup: rollupSize,
            webpack: webpackSize
          };

          infoString += formatMsg(
            "treeshaked with rollup and minified",
            rollupSize
          );
          infoString += formatMsg(
            "treeshaked with webpack in production mode",
            webpackSize
          );
        }

        const snapshotParams = { snapshotPath, name: output, data: sizes };
        if (shouldMatchSnapshot) {
          snapshot.match(snapshotParams);
        } else {
          if (shouldPrintInfo) {
            console.info(infoString);
          }
          snapshot.write(snapshotParams);
        }

        return null;
      });
    }
  };
};
