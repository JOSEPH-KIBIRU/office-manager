"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import { useToast } from "@/components/toast";
import { loadEncryptedFile } from "@/lib/clientEncryption";
import { uploadThingProxyPath } from "@/lib/fileUrls";

interface Props {
  fileKey?: string | null;
  href?: string | null;
  name?: string | null;
  className?: string;
  children: ReactNode;
}

/** Link that downloads/decrypts a client-side encrypted document. */
export default function SecureFileLink({ fileKey, href, name, className, children }: Props) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function open(e: MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    if (busy) return;

    if (!fileKey) {
      const target = href || null;
      if (target) window.open(target, "_blank", "noopener,noreferrer");
      return;
    }

    setBusy(true);
    try {
      const loaded = await loadEncryptedFile(fileKey);
      if (!loaded) {
        window.open(href || uploadThingProxyPath(fileKey), "_blank", "noopener,noreferrer");
        return;
      }
      const url = URL.createObjectURL(loaded.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = loaded.name || name || "file";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open this file");
    } finally {
      setBusy(false);
    }
  }

  return (
    <a href={href || "#"} onClick={open} className={className}>
      {busy ? "Decrypting…" : children}
    </a>
  );
}
