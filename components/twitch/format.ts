export function formatDate(value: string | number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.max(0, Math.round(value)));
}

export function matchesQuery(
  item: { name: string; login: string },
  query: string,
): boolean {
  return (
    item.name.toLowerCase().includes(query) ||
    item.login.toLowerCase().includes(query)
  );
}
