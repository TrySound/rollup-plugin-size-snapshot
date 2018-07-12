// @flow

import { readFileSync, unlinkSync } from "fs";
import { rollup } from "rollup";
import { terser } from "rollup-plugin-terser";
import { sizeSnapshot } from "../src";
import stripAnsi from "strip-ansi";

process.chdir("tests");

const last = arr => arr[Math.max(0, arr.length - 1)];

const lastCallArg = mockFn => last(mockFn.mock.calls)[0];

const runRollup = async options => {
  const bundle = await rollup(options);
  const result = await bundle.generate(options.output);
  return result;
};

const pullSnapshot = snapshotPath => {
  const snapshot = JSON.parse(readFileSync(snapshotPath, "utf-8"));
  unlinkSync(snapshotPath);
  return snapshot;
};

test("fail on invalid options", () => {
  expect(() => {
    sizeSnapshot({
      minify: true,
      snapshot: "",
      matchSnapshot: false
    });
  }).toThrowError(/Options "minify", "snapshot" are invalid/);

  expect(() => {
    sizeSnapshot({
      minify: true
    });
  }).toThrowError(/Option "minify" is invalid/);
});

test("write bundled, minified and gzipped size of es bundle", async () => {
  const snapshotPath = "fixtures/basic.size-snapshot.json";
  await runRollup({
    input: "./fixtures/redux.js",
    plugins: [sizeSnapshot({ snapshotPath, printInfo: false })],
    output: { file: "output.js", format: "cjs" }
  });
  const snapshot = pullSnapshot(snapshotPath);

  expect(snapshot).toMatchObject({
    "output.js": {
      bundled: 11160,
      minified: 5464,
      gzipped: 2091
    }
  });
});

test("print sizes", async () => {
  const consoleInfo = jest.spyOn(console, "info").mockImplementation(() => {});
  const snapshotPath = "fixtures/print.size-snapshot.json";
  const snapshot = await runRollup({
    input: "./fixtures/redux.js",
    output: { file: "output.js", format: "cjs" },
    plugins: [sizeSnapshot({ snapshotPath })]
  });

  pullSnapshot(snapshotPath);

  expect(stripAnsi(lastCallArg(consoleInfo))).toContain(
    'Computed sizes of "output.js" with "cjs" format\n' +
      "  bundler parsing size: 11,160 B\n" +
      "  browser parsing size (minified with terser): 5,464 B\n" +
      "  download size (minified and gzipped): 2,091 B\n"
  );

  consoleInfo.mockRestore();
});

test("not affected by following terser plugin", async () => {
  const snapshotPath = "fixtures/terser.size-snapshot.json";
  await runRollup({
    input: "./fixtures/redux.js",
    output: { file: "output.js", format: "cjs" },
    plugins: [sizeSnapshot({ snapshotPath, printInfo: false }), terser()]
  });

  expect(pullSnapshot(snapshotPath)).toMatchObject({
    "output.js": {
      bundled: 11160,
      minified: 5464,
      gzipped: 2091
    }
  });
});

test("fail if output.file is not specified", async () => {
  try {
    await runRollup({
      input: "./fixtures/redux.js",
      output: { file: undefined, format: "esm" },
      plugins: [sizeSnapshot()]
    });
    expect(true).toBe(false);
  } catch (error) {
    expect(error.message).toContain(
      "output file in rollup options should be specified"
    );
  }
});

test("match bundled, minified or gziped sizes", async () => {
  const consoleError = jest
    .spyOn(console, "error")
    .mockImplementation(() => {});
  const snapshotPath = "fixtures/mismatch.size-snapshot.json";
  try {
    await runRollup({
      input: "./fixtures/redux.js",
      output: { file: "output.js", format: "esm" },
      plugins: [sizeSnapshot({ snapshotPath, matchSnapshot: true })]
    });
    expect(true).toBe(false);
  } catch (error) {
    expect(error.message).toContain(
      "Size snapshot is not matched. Run rollup to rebuild one."
    );
  }
  const arg = lastCallArg(consoleError);
  expect(arg).toContain(`+   "bundled": 10971`);
  expect(arg).toContain(`+   "minified": 5293`);
  expect(arg).toContain(`+   "gzipped": 2032`);
  consoleError.mockRestore();
});

test("pass matched sizes", async () => {
  const snapshotPath = "fixtures/matched.size-snapshot.json";
  await runRollup({
    input: "./fixtures/redux.js",
    output: { file: "output.js", format: "esm" },
    plugins: [sizeSnapshot({ snapshotPath, matchSnapshot: true })]
  });
});

test("print sizes with treeshaked size for 'esm' format", async () => {
  const consoleInfo = jest.spyOn(console, "info").mockImplementation(() => {});
  const snapshotPath = "fixtures/print-with-treeshaking.size-snapshot.json";
  const snapshot = await runRollup({
    input: "./fixtures/redux.js",
    output: { file: "output.js", format: "esm" },
    plugins: [sizeSnapshot({ snapshotPath })]
  });

  pullSnapshot(snapshotPath);

  const arg = stripAnsi(lastCallArg(consoleInfo));
  expect(arg).toContain('Computed sizes of "output.js" with "esm" format\n');
  expect(arg).toContain(
    "  treeshaked with rollup with production NODE_ENV and minified: 0 B\n"
  );
  expect(arg).toContain(
    "  treeshaked with webpack in production mode: 951 B\n"
  );

  consoleInfo.mockRestore();
});

test("write treeshaked with rollup and webpack sizes for 'esm' format", async () => {
  const snapshotPath = "fixtures/rollupTreeshake.size-snapshot.json";
  const snapshot = await runRollup({
    input: "./fixtures/redux.js",
    output: { file: "output.js", format: "esm" },
    plugins: [sizeSnapshot({ snapshotPath, printInfo: false })]
  });

  expect(pullSnapshot(snapshotPath)).toMatchObject({
    "output.js": expect.objectContaining({
      treeshaked: {
        rollup: expect.objectContaining({ code: 0 }),
        webpack: expect.objectContaining({ code: 951 })
      }
    })
  });
});

test("treeshake pure annotations with rollup and terser or webpack", async () => {
  const snapshotPath = "fixtures/pure-annotated.size-snapshot.json";
  await runRollup({
    input: "./fixtures/pure-annotated.js",
    output: { file: "output.js", format: "esm" },
    plugins: [sizeSnapshot({ snapshotPath, printInfo: false })]
  });

  expect(pullSnapshot(snapshotPath)).toMatchObject({
    "output.js": expect.objectContaining({
      treeshaked: {
        rollup: expect.objectContaining({ code: 0 }),
        webpack: expect.objectContaining({ code: 951 })
      }
    })
  });
});

test("treeshake with both rollup or webpack and external modules", async () => {
  const snapshotPath = "fixtures/externals.size-snapshot.json";
  await runRollup({
    input: "./fixtures/externals.js",
    external: ["react"],
    output: { file: "output.js", format: "esm" },
    plugins: [sizeSnapshot({ snapshotPath, printInfo: false })]
  });

  expect(pullSnapshot(snapshotPath)).toMatchObject({
    "output.js": expect.objectContaining({
      treeshaked: {
        rollup: expect.objectContaining({ code: 14 }),
        webpack: expect.objectContaining({ code: 998 })
      }
    })
  });
});

test("rollup treeshake should replace NODE_ENV in symmetry to webpack", async () => {
  const snapshotPath = "fixtures/node_env.size-snapshot.json";
  await runRollup({
    input: "./fixtures/node_env.js",
    output: { file: "output.js", format: "esm" },
    plugins: [sizeSnapshot({ snapshotPath, printInfo: false })]
  });

  expect(pullSnapshot(snapshotPath)).toMatchObject({
    "output.js": expect.objectContaining({
      treeshaked: {
        rollup: expect.objectContaining({ code: 0 }),
        webpack: expect.objectContaining({ code: 951 })
      }
    })
  });
});

test("webpack does not provide node shims", async () => {
  const snapshotPath = "fixtures/node-shims.size-snapshot.json";
  await runRollup({
    input: "./fixtures/node-shims.js",
    output: { file: "output.js", format: "esm" },
    plugins: [sizeSnapshot({ snapshotPath, printInfo: false })]
  });

  expect(pullSnapshot(snapshotPath)).toMatchObject({
    "output.js": expect.objectContaining({
      treeshaked: expect.objectContaining({
        webpack: { code: 1087 }
      })
    })
  });
});

test("rollup treeshaker shows imports size", async () => {
  const snapshotPath = "fixtures/import-statements-size.size-snapshot.json";
  const infoFn = jest.spyOn(console, "info").mockImplementation(() => {});
  await runRollup({
    input: "./fixtures/import-statements-size.js",
    output: { file: "output.js", format: "esm" },
    external: id => !id.startsWith(".") && !id.startsWith("/"),
    plugins: [sizeSnapshot({ snapshotPath })]
  });

  expect(pullSnapshot(snapshotPath)).toMatchObject({
    "output.js": expect.objectContaining({
      treeshaked: expect.objectContaining({
        rollup: { code: 338, import_statements: 338 }
      })
    })
  });
  // $FlowFixMe
  expect(infoFn).toBeCalledTimes(1);
  expect(stripAnsi(lastCallArg(infoFn))).toContain(
    "  treeshaked with rollup with production NODE_ENV and minified: 338 B\n" +
      "    import statements size of it: 338 B\n"
  );
});

test("fail when matching missing snapshot", async () => {
  const snapshotPath = "fixtures/missing.size-snapshot.json";

  try {
    await runRollup({
      input: "./fixtures/redux.js",
      output: { file: "output.js", format: "esm" },
      plugins: [
        sizeSnapshot({ snapshotPath, matchSnapshot: true, printInfo: false })
      ]
    });

    expect(true).toBe(false);
  } catch (error) {
    expect(error.message).toContain(
      "Size snapshot is missing. Please run rollup to create one."
    );
  }
});

test("match snapshot with threshold", async () => {
  const snapshotPath = "fixtures/threshold.size-snapshot.json";
  const errorFn = jest.spyOn(console, "error").mockImplementation(() => {});

  await runRollup({
    input: "./fixtures/redux.js",
    output: { file: "output.js", format: "esm" },
    plugins: [
      sizeSnapshot({
        snapshotPath,
        matchSnapshot: true,
        threshold: 1000,
        printInfo: false
      })
    ]
  });

  try {
    await runRollup({
      input: "./fixtures/redux.js",
      output: { file: "output.js", format: "esm" },
      plugins: [
        sizeSnapshot({
          snapshotPath,
          matchSnapshot: true,
          threshold: 100,
          printInfo: false
        })
      ]
    });

    expect(true).toBe(false);
  } catch (error) {
    expect(error.message).toContain("Size snapshot is not matched");
  }

  errorFn.mockRestore();
});

test("throw if webpack has compilation errors", async () => {
  const snapshotPath = "fixtures/failed-webpack.size-snapshot.json";
  const errorFn = jest.spyOn(console, "error").mockImplementation(() => {});

  try {
    await runRollup({
      input: "./fixtures/failed-webpack.js",
      output: { file: "output.js", format: "esm" },
      plugins: [sizeSnapshot({ snapshotPath, printInfo: false })]
    });

    expect(true).toBe(false);
  } catch (error) {
    expect(error.message).toContain("Can't resolve './missing.js'");
  }

  errorFn.mockRestore();
});
