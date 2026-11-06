"use client";

import { useEffect, useState } from "react";
import { loadEncryptedFile } from "@/lib/clientEncryption";

const PLACEHOLDER =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

interface Props {
  fileKey?: string | null;
  src?: string | null;
  alt: string;
  className?: string;
}

/** Image that transparently decrypts client-side encrypted task photos. */
export default function SecureImage({ fileKey, src, alt, className }: Props) {
  const [url, setUrl] = useState<string | null>(fileKey ? null : src ?? null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    if (!fileKey) {
      setUrl(src ?? null);
      return;
    }

    (async () => {
      try {
        const loaded = await loadEncryptedFile(fileKey);
        if (cancelled) return;
        if (!loaded) {
          setUrl(src ?? null);
          return;
        }
        objectUrl = URL.createObjectURL(loaded.blob);
        setUrl(objectUrl);
      } catch {
        if (!cancelled) setUrl(src ?? null);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileKey, src]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url ?? PLACEHOLDER} alt={alt} className={className} />
  );
}
