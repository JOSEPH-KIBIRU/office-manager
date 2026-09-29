/**
 * Terms & Conditions version.
 *
 * Bump this string whenever the Terms/Privacy change. Users who accepted an
 * older version (or who have never accepted) will be asked to accept again;
 * everyone else is only asked once.
 */
export const TERMS_VERSION = "2026-09-01";

/**
 * The version that acceptances made *before* versioning existed are treated as.
 * Kept fixed forever; do not change it, even when bumping TERMS_VERSION.
 */
export const TERMS_BASELINE_VERSION = "2026-09-01";
