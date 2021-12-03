// @flow

import webpack from "webpack";
import MemoryFileSystem from "memory-fs";

const inputName = "__size_snapshot_input__.js";
const bundleName = "__size_snapshot_bundle__.js";
const outputName = "__size_snapshot_output__.js";

const isReservedId = (id) => id.includes(inputName) || id.includes(bundleName);

type Output = {
  code: number,
};

export const treeshakeWithWebpack = (code: string): Promise<Output> => {
  const inputFS = new MemoryFileSystem();
  const outputFS = new MemoryFileSystem();

  const compiler = webpack({
    entry: `/${inputName}`,
    output: {
      path: "/",
      filename: outputName,
    },
    mode: "production",
    // disable all node shims
    // https://webpack.js.org/configuration/node/
    node: false,
    externals: [
      ({ context, request }, callback) => {
        if (isReservedId(request)) {
          callback();
        } else {
          callback(null, "commonjs " + request);
        }
      },
    ],
  });

  inputFS.writeFileSync(`/${inputName}`, `import {} from '/${bundleName}'`);
  inputFS.writeFileSync(`/${bundleName}`, code);

  compiler.inputFileSystem = inputFS;
  compiler.outputFileSystem = outputFS;

  return new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      if (err) {
        reject(err);
      } else if (stats.compilation.errors.length !== 0) {
        const messages = stats.compilation.errors.map((error) => String(error));
        reject(Error(messages.join("\n")));
      } else {
        resolve({
          code: outputFS.readFileSync(`/${outputName}`, "utf8").length,
        });
      }
    });
  });
};
