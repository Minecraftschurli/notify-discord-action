import * as core from "@actions/core";

export function getStringInput(name: string, options?: core.InputOptions): string | undefined {
  return core.getInput(name, options) || undefined;
}

export function getIntegerInput(name: string, options?: core.InputOptions): number | undefined;
// eslint-disable-next-line no-redeclare
export function getIntegerInput(
  name: string,
  radix?: core.InputOptions | number,
  options?: core.InputOptions
): number | undefined {
  if (typeof radix !== "number") {
    options = radix;
    radix = 10;
  }
  const stringInput = getStringInput(name, options);
  if (stringInput === undefined) return undefined;
  try {
    return parseInt(stringInput, radix);
  } catch (e) {
    return undefined;
  }
}

export function getFloatInput(name: string, options?: core.InputOptions): number | undefined {
  const stringInput = getStringInput(name, options);
  if (stringInput === undefined) return undefined;
  try {
    return parseFloat(stringInput);
  } catch (e) {
    return undefined;
  }
}

export function getJsonInput(name: string, options?: core.InputOptions): unknown | undefined {
  const stringInput = getStringInput(name, options);
  if (stringInput === undefined) return undefined;
  try {
    return JSON.parse(stringInput);
  } catch (e) {
    return undefined;
  }
}

export function getMultilineInput(name: string, options?: core.InputOptions): string[] {
  return core.getMultilineInput(name, options);
}
