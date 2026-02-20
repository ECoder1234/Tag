export const clamp = (value: number, min: number, max: number): number => {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
};

export const assertFinite = (value: number, label: string): number => {
  if (!Number.isFinite(value)) {
    throw new Error(`Non-finite value for ${label}`);
  }
  return value;
};

export const assertUnreachable = (_value: never): never => {
  throw new Error("Unreachable state");
};