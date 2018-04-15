// @flow

import { readFileSync, unlinkSync } from "fs";
import { rollup } from "rollup";
import uglify from "rollup-plugin-uglify";
import { sizeSnapshot } from "../src";
import stripAnsi from "strip-ansi";

process.chdir("tests");

const last = arr => arr[Math.max(0, arr.length - 1)];

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
});

test("write bundled, minified and gzipped size of es bundle", async () => {
  const snapshotPath = "fixtures/basic.size-snapshot.json";
  await runRollup({
    input: "fixtures/redux.js",
    plugins: [sizeSnapshot({ snapshotPath, printInfo: false })],
    output: { file: "output.js", format: "cjs" }
  });
  const snapshot = pullSnapshot(snapshotPath);

  expect(snapshot).toEqual(
    expect.objectContaining({
      "output.js": {
        bundled: 11160,
        minified: 5464,
        gzipped: 2091
      }
    })
  );
});

test("print sizes", async () => {
  const consoleInfo = jest.spyOn(console, "info").mockImplementation(() => {});
  const snapshotPath = "fixtures/print.size-snapshot.json";
  const snapshot = await runRollup({
    input: "fixtures/redux.js",
    output: { file: "output.js", format: "cjs" },
    plugins: [sizeSnapshot({ snapshotPath })]
  });

  pullSnapshot(snapshotPath);

  expect(last(consoleInfo.mock.calls).map(stripAnsi)).toEqual([
    expect.stringContaining(
      'Computed sizes of "output.js" with "cjs" format\n' +
        "  bundled: 11,160 B\n" +
        "  minified with uglify: 5,464 B\n" +
        "  minified and gzipped: 2,091 B\n"
    )
  ]);

  consoleInfo.mockRestore();
});

test("not affected by following uglify plugin", async () => {
  const snapshotPath = "fixtures/uglify.size-snapshot.json";
  await runRollup({
    input: "fixtures/redux.js",
    output: { file: "output.js", format: "cjs" },
    plugins: [sizeSnapshot({ snapshotPath, printInfo: false }), uglify()]
  });

  expect(pullSnapshot(snapshotPath)).toEqual(
    expect.objectContaining({
      "output.js": {
        bundled: 11160,
        minified: 5464,
        gzipped: 2091
      }
    })
  );
});

test("fail if output.file is not specified", async () => {
  try {
    await runRollup({
      input: "fixtures/redux.js",
      output: { file: undefined, format: "es" },
      plugins: [sizeSnapshot()]
    });
    expect(true).toBe(false);
  } catch (error) {
    expect(error.message).toEqual(
      expect.stringContaining(
        "output file in rollup options should be specified"
      )
    );
  }
});

test("fail with update false if bundled, minified or gziped sizes are not matched", async () => {
  const consoleError = jest
    .spyOn(console, "error")
    .mockImplementation(() => {});
  const snapshotPath = "fixtures/mismatch.size-snapshot.json";
  try {
    await runRollup({
      input: "fixtures/redux.js",
      output: { file: "output.js", format: "es" },
      plugins: [sizeSnapshot({ snapshotPath, matchSnapshot: true })]
    });
    expect(true).toBe(false);
  } catch (error) {
    expect(error.message).toEqual(
      expect.stringContaining("size snapshot is not matched")
    );
  }
  expect(consoleError).lastCalledWith(
    expect.stringContaining(`+   "bundled": 10971`)
  );
  expect(consoleError).lastCalledWith(
    expect.stringContaining(`+   "minified": 5293`)
  );
  expect(consoleError).lastCalledWith(
    expect.stringContaining(`+   "gzipped": 2032`)
  );
  consoleError.mockRestore();
});

test("print sizes with treeshaked size for 'es' format", async () => {
  const consoleInfo = jest.spyOn(console, "info").mockImplementation(() => {});
  const snapshotPath = "fixtures/print-with-treeshaking.size-snapshot.json";
  const snapshot = await runRollup({
    input: "fixtures/redux.js",
    output: { file: "output.js", format: "es" },
    plugins: [sizeSnapshot({ snapshotPath })]
  });

  pullSnapshot(snapshotPath);

  expect(last(consoleInfo.mock.calls).map(stripAnsi)).toEqual([
    expect.stringContaining(
      'Computed sizes of "output.js" with "es" format\n' +
        "  bundled: 10,971 B\n" +
        "  minified with uglify: 5,293 B\n" +
        "  minified and gzipped: 2,032 B\n" +
        "  treeshaked with rollup and uglified: 0 B\n" +
        "  treeshaked with webpack in production mode: 566 B\n"
    )
  ]);

  consoleInfo.mockRestore();
});

test("write treeshaked with rollup and webpack sizes for 'es' format", async () => {
  const snapshotPath = "fixtures/rollupTreeshake.size-snapshot.json";
  const snapshot = await runRollup({
    input: "fixtures/redux.js",
    output: { file: "output.js", format: "es" },
    plugins: [sizeSnapshot({ snapshotPath, printInfo: false })]
  });

  expect(pullSnapshot(snapshotPath)).toEqual(
    expect.objectContaining({
      "output.js": expect.objectContaining({
        treeshaked: {
          rollup: 0,
          webpack: 566
        }
      })
    })
  );
});

test("treeshake pure annotations with rollup and uglify or webpack", async () => {
  const snapshotPath = "fixtures/pure-annotated.size-snapshot.json";
  await runRollup({
    input: "fixtures/pure-annotated.js",
    output: { file: "output.js", format: "es" },
    plugins: [sizeSnapshot({ snapshotPath, printInfo: false })]
  });

  expect(pullSnapshot(snapshotPath)).toEqual(
    expect.objectContaining({
      "output.js": expect.objectContaining({
        treeshaked: {
          rollup: 0,
          webpack: 566
        }
      })
    })
  );
});

test("treeshake with both rollup or webpack and external modules", async () => {
  const snapshotPath = "fixtures/externals.size-snapshot.json";
  await runRollup({
    input: "fixtures/externals.js",
    external: ["react"],
    output: { file: "output.js", format: "es" },
    plugins: [sizeSnapshot({ snapshotPath, printInfo: false })]
  });

  expect(pullSnapshot(snapshotPath)).toEqual(
    expect.objectContaining({
      "output.js": expect.objectContaining({
        treeshaked: {
          rollup: 14,
          webpack: 613
        }
      })
    })
  );
});
