export function normalizeCategoryNameKey(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function normalizeCategoryDisplayName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

/**
 * Returns the canonical display name if the normalized key already exists.
 * Otherwise returns a normalized display name (trimmed/collapsed whitespace).
 */
export function canonicalizeCategoryName(
  inputName: string,
  existingByKey: Map<string, string>
): string {
  const display = normalizeCategoryDisplayName(inputName);
  const key = normalizeCategoryNameKey(display);
  return existingByKey.get(key) ?? display;
}

/**
 * Deduplicate names by normalized key (case/whitespace-insensitive).
 * Keeps first occurrence's display form (trimmed/collapsed whitespace).
 */
export function uniqueCategoryNamesByKey(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of names) {
    if (!raw || typeof raw !== 'string') continue;
    const display = normalizeCategoryDisplayName(raw);
    if (!display) continue;
    const key = normalizeCategoryNameKey(display);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(display);
  }

  return out;
}
