// @flow

import { readFileSync, writeFileSync } from "fs";
import deepEqual from "fast-deep-equal";
import diff from "jest-diff";

type Params = {|
  snapshotPath: string,
  name: string,
  data: Object
|};

const readJsonSync = file => {
  try {
    const text = readFileSync(file, "utf-8");
    try {
      return JSON.parse(text);
    } catch (error) {
      return {};
    }
  } catch (error) {
    return null;
  }
};

const writeJsonSync = (file, data) =>
  writeFileSync(file, JSON.stringify(data, null, 2) + "\n");

export const match = ({ snapshotPath, name, data }: Params) => {
  const snapshot = readJsonSync(snapshotPath);
  if (snapshot == null) {
    throw Error("Size snapshot is missing. Please run rollup to create one.");
  }
  const prevData = snapshot[name] || {};
  if (!deepEqual(prevData, data)) {
    console.error(diff(prevData, data));
    throw Error("Size snapshot is not matched. Run rollup to rebuild one.");
  }
};

export const write = ({ snapshotPath, name, data }: Params) => {
  const snapshot = readJsonSync(snapshotPath) || {};
  snapshot[name] = data;
  writeJsonSync(snapshotPath, snapshot);
};
