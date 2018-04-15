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
    return JSON.parse(text);
  } catch (error) {
    return {};
  }
};

const writeJsonSync = (file, data) =>
  writeFileSync(file, JSON.stringify(data, null, 2) + "\n");

export const match = ({ snapshotPath, name, data }: Params) => {
  const snapshot = readJsonSync(snapshotPath);
  const prevData = snapshot[name] || {};
  if (!deepEqual(prevData, data)) {
    console.error(diff(prevData, data));
    throw Error("size snapshot is not matched");
  }
};

export const write = ({ snapshotPath, name, data }: Params) => {
  const snapshot = readJsonSync(snapshotPath);
  snapshot[name] = data;
  writeJsonSync(snapshotPath, snapshot);
};
