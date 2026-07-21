/**
 * Small presentation helpers shared by client components.
 *
 * @module lib/shared/format
 */

/**
 * Format a byte count as a human-readable size.
 *
 * @param bytes - Size in bytes.
 * @returns e.g. `"512 B"`, `"4.2 KB"`, `"3 MB"`.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
}
