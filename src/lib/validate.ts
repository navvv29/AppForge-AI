export function validateLevel(level: string): boolean {
  if (!level) return false;
  return /^L[0-9]+$/i.test(level);
}
