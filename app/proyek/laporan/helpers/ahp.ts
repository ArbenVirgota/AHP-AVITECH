// app/proyek/laporan/helpers/ahp.ts

export const RI_MAP: Record<number, number> = {
  1: 0,
  2: 0,
  3: 0.58,
  4: 0.9,
  5: 1.12,
  6: 1.24,
  7: 1.32,
  8: 1.41,
  9: 1.45,
  10: 1.49,
};

export function getDefaultMatrix(size: number) {
  const matrix = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => 1),
  );

  for (let i = 0; i < size; i += 1) {
    matrix[i][i] = 1;
    for (let j = i + 1; j < size; j += 1) {
      matrix[i][j] = 1;
      matrix[j][i] = 1;
    }
  }

  return matrix;
}

export function cloneMatrix(matrix: number[][]) {
  return matrix.map((row) => [...row]);
}

export function normalizeMatrix(input: unknown, size: number) {
  const base = getDefaultMatrix(size);
  if (!Array.isArray(input)) return base;

  for (let i = 0; i < size; i += 1) {
    for (let j = 0; j < size; j += 1) {
      if (i === j) {
        base[i][j] = 1;
        continue;
      }

      const row = input[i];
      const value = Array.isArray(row) ? Number(row[j]) : NaN;
      if (!Number.isFinite(value) || value <= 0) continue;

      base[i][j] = value;
    }
  }

  for (let i = 0; i < size; i += 1) {
    base[i][i] = 1;
    for (let j = i + 1; j < size; j += 1) {
      base[j][i] = 1 / base[i][j];
    }
  }

  return base;
}

export function calculateAHP(matrix: number[][]) {
  const n = matrix.length;

  if (n === 0) {
    return { weights: [] as number[], lambdaMax: 0, ci: 0, cr: 0 };
  }

  if (n === 1) {
    return { weights: [1], lambdaMax: 1, ci: 0, cr: 0 };
  }

  const colSums = Array.from({ length: n }, (_, j) =>
    matrix.reduce((sum, row) => sum + Number(row[j] || 0), 0),
  );

  const normalized = matrix.map((row) =>
    row.map((value, j) => value / (colSums[j] || 1)),
  );

  const weights = normalized.map(
    (row) => row.reduce((sum, value) => sum + value, 0) / n,
  );

  const weightedSum = matrix.map((row) =>
    row.reduce((sum, value, j) => sum + value * weights[j], 0),
  );

  const lambdaValues = weightedSum.map((v, i) => v / (weights[i] || 1));
  const lambdaMax =
    lambdaValues.reduce((sum, value) => sum + value, 0) /
    lambdaValues.length;

  const ci = n <= 2 ? 0 : (lambdaMax - n) / (n - 1);
  const ri = RI_MAP[n] ?? 1.49;
  const cr = n <= 2 || ri === 0 ? 0 : ci / ri;

  return { weights, lambdaMax, ci, cr };
}

export function formatNumber(value: number, digits = 4) {
  if (!Number.isFinite(value)) return '-';
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(digits);
}

export function formatMatrixValue(value: number) {
  if (value === 1) return '1';
  if (value > 1) return Number.isInteger(value) ? String(value) : value.toFixed(2);

  const reciprocal = 1 / value;
  const rounded = Math.round(reciprocal);

  if (Math.abs(reciprocal - rounded) < 0.0001) {
    return `1/${rounded}`;
  }

  return value.toFixed(3);
}