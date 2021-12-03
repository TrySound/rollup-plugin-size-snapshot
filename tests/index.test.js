// @flow

import * as path from "path";
import { readFileSync, unlinkSync } from "fs";
import { rollup } from "rollup";
import { terser } from "rollup-plugin-terser";
import { sizeSnapshot } from "../src";
import stripAnsi from "strip-ansi";

import { toMatchCloseTo } from "jest-matcher-deep-close-to";
expect.extend({ toMatchCloseTo });

process.chdir("tests");

const last = (arr) => arr[Math.max(0, arr.length - 1)];

const lastCallArg = (mockFn) => last(mockFn.mock.calls)[0];

const runRollup = async (options) => {
  const bundle = await rollup(options);
  const result = await bundle.generate(options.output);
  return result;
};

const pullSnapshot = (snapshotPath) => {
  const snapshot = JSON.parse(readFileSync(snapshotPath, "utf-8"));
  unlinkSync(snapshotPath);
  return snapshot;
};

test("fail on invalid options", () => {
  expect(() => {
    sizeSnapshot({
      minify: true,
      snapshot: "",
      matchSnapshot: false,
    });
  }).toThrowError(/Options "minify", "snapshot" are invalid/);

  expect(() => {
    sizeSnapshot({
      minify: true,
    });
  }).toThrowError(/Option "minify" is invalid/);
});

test("write bundled, minified and gzipped size of es bundle", async () => {
  const snapshotPath = "fixtures/basic.size-snapshot.json";
  await runRollup({
    input: "./fixtures/redux.js",
    plugins: [sizeSnapshot({ snapshotPath, printInfo: false })],
    output: { file: "fixtures/output.js", format: "cjs" },
  });
  const snapshot = pullSnapshot(snapshotPath);

  expect(snapshot).toMatchObject({
    "output.js": {
      bundled: 11138,
      minified: 5474,
      gzipped: 2093,
    },
  });
});

test("works with output.dir option", async () => {
  const snapshotPath = "fixtures/basic.size-snapshot.json";
  await runRollup({
    input: ["./fixtures/redux.js", "./fixtures/pure-annotated.js"],
    plugins: [sizeSnapshot({ snapshotPath, printInfo: false })],
    output: { dir: "fixtures/output", format: "cjs" },
  });
  const snapshot = pullSnapshot(snapshotPath);

  expect(snapshot).toMatchObject({
    "pure-annotated.js": {
      bundled: 1459,
      gzipped: 476,
      minified: 912,
    },
    "redux.js": {
      bundled: 11138,
      minified: 5474,
      gzipped: 2093,
    },
  });
});

test("print sizes", async () => {
  const consoleInfo = jest.spyOn(console, "info").mockImplementation(() => {});
  const snapshotPath = "fixtures/print.size-snapshot.json";
  const snapshot = await runRollup({
    input: "./fixtures/redux.js",
    output: { file: "fixtures/output.js", format: "cjs" },
    plugins: [sizeSnapshot({ snapshotPath })],
  });

  pullSnapshot(snapshotPath);

  expect(stripAnsi(lastCallArg(consoleInfo))).toContain(
    'Computed sizes of "output.js" with "cjs" format\n' +
      "  bundler parsing size: 11,138 B\n" +
      "  browser parsing size (minified with terser): 5,474 B\n" +
      "  download size (minified and gzipped): 2,093 B\n"
  );

  consoleInfo.mockRestore();
});

test("not affected by following terser plugin", async () => {
  const snapshotPath = "fixtures/terser.size-snapshot.json";
  await runRollup({
    input: "./fixtures/redux.js",
    output: { file: "fixtures/output.js", format: "cjs" },
    plugins: [sizeSnapshot({ snapshotPath, printInfo: false }), terser()],
  });

  expect(pullSnapshot(snapshotPath)).toMatchObject({
    "output.js": {
      bundled: 11138,
      minified: 5474,
      gzipped: 2093,
    },
  });
});

test("match bundled, minified or gziped sizes", async () => {
  const consoleError = jest
    .spyOn(console, "error")
    .mockImplementation(() => {});
  const snapshotPath = "fixtures/mismatch.size-snapshot.json";
  try {
    await runRollup({
      input: "./fixtures/redux.js",
      output: { file: "fixtures/output.js", format: "esm" },
      plugins: [sizeSnapshot({ snapshotPath, matchSnapshot: true })],
    });
    expect(true).toBe(false);
  } catch (error) {
    expect(error.message).toContain(
      "Size snapshot is not matched. Run rollup to rebuild one."
    );
  }
  const arg = lastCallArg(consoleError);
  expect(arg).toContain(`+   "bundled": 10949`);
  expect(arg).toContain(`+   "minified": 5303`);
  expect(arg).toContain(`+   "gzipped": 2034`);
  consoleError.mockRestore();
});

test("pass matched sizes", async () => {
  const snapshotPath = "fixtures/matched.size-snapshot.json";
  await runRollup({
    input: "./fixtures/redux.js",
    output: { file: "fixtures/output.js", format: "esm" },
    plugins: [sizeSnapshot({ snapshotPath, matchSnapshot: true })],
  });
});

test("print sizes with treeshaked size for 'esm' format", async () => {
  const consoleInfo = jest.spyOn(console, "info").mockImplementation(() => {});
  const snapshotPath = "fixtures/print-with-treeshaking.size-snapshot.json";
  const snapshot = await runRollup({
    input: "./fixtures/redux.js",
    output: { file: "fixtures/output.js", format: "esm" },
    plugins: [sizeSnapshot({ snapshotPath })],
  });

  pullSnapshot(snapshotPath);

  const arg = stripAnsi(lastCallArg(consoleInfo));
  expect(arg).toContain('Computed sizes of "output.js" with "esm" format\n');
  expect(arg).toContain(
    "  treeshaked with rollup with production NODE_ENV and minified: 0 B\n"
  );
  expect(arg).toContain("  treeshaked with webpack in production mode: 0 B\n");

  consoleInfo.mockRestore();
});

test("write treeshaked with rollup and webpack sizes for 'esm' format", async () => {
  const snapshotPath = "fixtures/rollupTreeshake.size-snapshot.json";
  const snapshot = await runRollup({
    input: "./fixtures/redux.js",
    output: { file: "fixtures/output.js", format: "esm" },
    plugins: [sizeSnapshot({ snapshotPath, printInfo: false })],
  });

  expect(pullSnapshot(snapshotPath)).toMatchObject({
    "output.js": expect.objectContaining({
      treeshaked: {
        rollup: expect.objectContaining({ code: 0 }),
        webpack: expect.objectContaining({ code: 0 }),
      },
    }),
  });
});

test("treeshake pure annotations with rollup and terser or webpack", async () => {
  const snapshotPath = "fixtures/pure-annotated.size-snapshot.json";
  await runRollup({
    input: "./fixtures/pure-annotated.js",
    output: { file: "fixtures/output.js", format: "esm" },
    plugins: [sizeSnapshot({ snapshotPath, printInfo: false })],
  });

  expect(pullSnapshot(snapshotPath)).toMatchObject({
    "output.js": expect.objectContaining({
      treeshaked: {
        rollup: expect.objectContaining({ code: 0 }),
        webpack: expect.objectContaining({ code: 0 }),
      },
    }),
  });
});

test("treeshake with both rollup or webpack and external modules", async () => {
  const snapshotPath = "fixtures/externals.size-snapshot.json";
  await runRollup({
    input: "./fixtures/externals.js",
    external: ["react"],
    output: { file: "fixtures/output.js", format: "esm" },
    plugins: [sizeSnapshot({ snapshotPath, printInfo: false })],
  });

  expect(pullSnapshot(snapshotPath)).toMatchObject({
    "output.js": expect.objectContaining({
      treeshaked: {
        rollup: expect.objectContaining({ code: 14 }),
        webpack: expect.objectContaining({ code: 40 }),
      },
    }),
  });
});

test("rollup treeshake should replace NODE_ENV in symmetry to webpack", async () => {
  const snapshotPath = "fixtures/node_env.size-snapshot.json";
  await runRollup({
    input: "./fixtures/node_env.js",
    output: { file: "fixtures/output.js", format: "esm" },
    plugins: [sizeSnapshot({ snapshotPath, printInfo: false })],
  });

  expect(pullSnapshot(snapshotPath)).toMatchObject({
    "output.js": expect.objectContaining({
      treeshaked: {
        rollup: expect.objectContaining({ code: 0 }),
        webpack: expect.objectContaining({ code: 0 }),
      },
    }),
  });
});

test("webpack does not provide node shims", async () => {
  const snapshotPath = "fixtures/node-shims.size-snapshot.json";
  await runRollup({
    input: "./fixtures/node-shims.js",
    output: { file: "fixtures/output.js", format: "esm" },
    plugins: [sizeSnapshot({ snapshotPath, printInfo: false })],
  });

  expect(pullSnapshot(snapshotPath)).toMatchObject({
    "output.js": expect.objectContaining({
      treeshaked: expect.objectContaining({
        webpack: expect.toMatchCloseTo({ code: 510 }, -1.7), // +/- ~25
      }),
    }),
  });
});

test("rollup treeshaker shows imports size", async () => {
  const snapshotPath = "fixtures/import-statements-size.size-snapshot.json";
  const infoFn = jest.spyOn(console, "info").mockImplementation(() => {});
  await runRollup({
    input: "./fixtures/import-statements-size.js",
    output: { file: "fixtures/output.js", format: "esm" },
    external: (id) => !id.startsWith(".") && !id.startsWith("/"),
    plugins: [sizeSnapshot({ snapshotPath })],
  });

  expect(pullSnapshot(snapshotPath)).toMatchObject({
    "output.js": expect.objectContaining({
      treeshaked: expect.objectContaining({
        rollup: { code: 303, import_statements: 303 },
      }),
    }),
  });
  // $FlowFixMe
  expect(infoFn).toBeCalledTimes(1);
  expect(stripAnsi(lastCallArg(infoFn))).toContain(
    "  treeshaked with rollup with production NODE_ENV and minified: 303 B\n" +
      "    import statements size of it: 303 B\n"
  );
});

test("fail when matching missing snapshot", async () => {
  const snapshotPath = "fixtures/missing.size-snapshot.json";

  try {
    await runRollup({
      input: "./fixtures/redux.js",
      output: { file: "fixtures/output.js", format: "esm" },
      plugins: [
        sizeSnapshot({ snapshotPath, matchSnapshot: true, printInfo: false }),
      ],
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
    output: { file: "fixtures/output.js", format: "esm" },
    plugins: [
      sizeSnapshot({
        snapshotPath,
        matchSnapshot: true,
        threshold: 1000,
        printInfo: false,
      }),
    ],
  });

  try {
    await runRollup({
      input: "./fixtures/redux.js",
      output: { file: "fixtures/output.js", format: "esm" },
      plugins: [
        sizeSnapshot({
          snapshotPath,
          matchSnapshot: true,
          threshold: 100,
          printInfo: false,
        }),
      ],
    });

    expect(true).toBe(false);
  } catch (error) {
    expect(error.message).toContain("Size snapshot is not matched");
  }

  errorFn.mockRestore();
});

test("write relative path when output is absolute", async () => {
  const consoleInfo = jest.spyOn(console, "info").mockImplementation(() => {});
  const snapshotPath = "fixtures/relative.size-snapshot.json";
  await runRollup({
    input: "./fixtures/redux.js",
    plugins: [sizeSnapshot({ snapshotPath })],
    output: { file: path.resolve("fixtures/output.js"), format: "cjs" },
  });
  const snapshot = pullSnapshot(snapshotPath);

  expect(stripAnsi(lastCallArg(consoleInfo))).toContain(
    'Computed sizes of "output.js" with "cjs" format\n' +
      "  bundler parsing size: 11,138 B\n" +
      "  browser parsing size (minified with terser): 5,474 B\n" +
      "  download size (minified and gzipped): 2,093 B\n"
  );

  consoleInfo.mockRestore();

  expect(snapshot).toMatchObject({
    "output.js": {
      bundled: 11138,
      minified: 5474,
      gzipped: 2093,
    },
  });
});

test("handle umd with esm", async () => {
  const snapshotPath = "fixtures/umd.size-snapshot.json";
  await runRollup({
    input: "./fixtures/umd.js",
    plugins: [sizeSnapshot({ snapshotPath })],
    output: { file: path.resolve("fixtures/output.js"), format: "esm" },
  });
  const snapshot = pullSnapshot(snapshotPath);

  expect(snapshot).toMatchObject({
    "output.js": {
      bundled: 330,
      minified: 206,
      gzipped: 139,
      treeshaked: {
        rollup: { code: 162 },
        webpack: expect.toMatchCloseTo({ code: 550 }, -1.7), // +/- ~25
      },
    },
  });
});
