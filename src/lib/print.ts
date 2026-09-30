/**
 * Print helpers.
 *
 * Printable pages live on URLs that contain the record's database id
 * (e.g. /invoice/<id>). Browsers print the page URL in the header/footer of the
 * saved PDF, which would expose that id. `printDocument` first rewrites the
 * address bar to a clean, id-free path (without navigating) so the printed
 * footer no longer leaks the id.
 */
export function cleanUrl(path: string): void {
  if (typeof window === "undefined") return;
  try {
    const current = window.location.pathname + window.location.search;
    if (current !== path) window.history.replaceState(null, "", path);
  } catch {
    /* ignore — printing still works with the original URL */
  }
}

/** Rewrite the URL to `path` (id-free) and open the print dialog. */
export function printDocument(path = "/"): void {
  cleanUrl(path);
  if (typeof window !== "undefined") window.print();
}
