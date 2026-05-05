export function unique(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}

export function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function toRoute(name: string): string {
  const slug = toSlug(name);
  return slug ? `/${slug}` : "/";
}

export function singularize(value: string): string {
  const clean = value.trim().toLowerCase();
  if (clean.endsWith("ies")) {
    return `${clean.slice(0, -3)}y`;
  }
  if (clean.endsWith("s")) {
    return clean.slice(0, -1);
  }
  return clean;
}

export function normalizeName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
