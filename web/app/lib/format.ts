export function formatCount(
  value: number | null | undefined
): string {
  if (value === null || value === undefined) {
    return "—";
  }

  return Math.round(value).toLocaleString();
}

export function formatMW(
  value: number | null | undefined
): string {
  if (value === null || value === undefined) {
    return "Not reported";
  }

  return `${value.toLocaleString()} MW`;
}

export function formatMiles(value: number): string {
  return `${value.toFixed(1)} mi`;
}
