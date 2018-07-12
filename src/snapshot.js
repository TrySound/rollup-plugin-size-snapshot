// @flow

import { readFileSync, writeFileSync } from "fs";
import diff from "jest-diff";

type Params = {|
  snapshotPath: string,
  name: string,
  data: Object,
  threshold: number
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

const isObject = d => typeof d === "object" && d != null;

const isNumber = d => typeof d === "number";

const compareWithThreshold = (_1, _2, threshold) => {
  const keys1 = Object.keys(_1);
  const keys2 = Object.keys(_2);

  if (keys1.length !== keys2.length) {
    return false;
  }

  return keys1.every((key, i) => {
    const value1 = _1[key];
    const value2 = _2[key];

    if (isNumber(value1) && isNumber(value2)) {
      return Math.abs(value1 - value2) <= threshold;
    }

    if (isObject(value1) && isObject(value2)) {
      return compareWithThreshold(value1, value2, threshold);
    }

    return false;
  });
};

export const match = ({ snapshotPath, name, data, threshold }: Params) => {
  const snapshot = readJsonSync(snapshotPath);
  if (snapshot == null) {
    throw Error("Size snapshot is missing. Please run rollup to create one.");
  }
  const prevData = snapshot[name] || {};
  if (!compareWithThreshold(prevData, data, threshold)) {
    console.error(diff(prevData, data));
    throw Error("Size snapshot is not matched. Run rollup to rebuild one.");
  }
};

export const write = ({ snapshotPath, name, data }: Params) => {
  const snapshot = readJsonSync(snapshotPath) || {};
  snapshot[name] = data;
  writeJsonSync(snapshotPath, snapshot);
};
