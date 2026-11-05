/** Stable same-origin URL for an UploadThing file; the proxy checks the session
 * and organization before streaming the file from UploadThing. */
export function uploadThingProxyPath(key: string): string {
  return `/api/files/u/${encodeURIComponent(key)}`;
}
