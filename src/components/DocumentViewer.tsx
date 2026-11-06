"use client";

import { useEffect, useState } from "react";
import Spinner from "@/components/Spinner";
import { loadEncryptedFile } from "@/lib/clientEncryption";

interface Props {
  title: string;
  fileKey?: string | null;
  href?: string | null;
  fileName?: string | null;
  onClose: () => void;
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

export default function DocumentViewer({ title, fileKey, href, fileName, onClose }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [mime, setMime] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const name = fileName || "document";
  const ext = extensionOf(name);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    (async () => {
      setLoading(true);
      setError(null);
      setText(null);
      setMime("");
      setUrl(null);
      try {
        if (fileKey) {
          const loaded = await loadEncryptedFile(fileKey);
          if (loaded) {
            objectUrl = URL.createObjectURL(loaded.blob);
            if (cancelled) {
              URL.revokeObjectURL(objectUrl);
              return;
            }
            const type = loaded.blob.type || "";
            setMime(type);
            if (type.startsWith("text/") || [".txt", ".md"].includes(extensionOf(loaded.name))) {
              const body = await loaded.blob.text();
              if (!cancelled) setText(body);
            }
            setUrl(objectUrl);
            return;
          }
        }

        if (href) {
          setUrl(href);
          if ([".txt", ".md"].includes(ext)) {
            try {
              const res = await fetch(href);
              if (res.ok) setText(await res.text());
            } catch {
              /* preview falls back to the message below */
            }
          }
          return;
        }

        throw new Error("No file is attached to this document");
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not open this document");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileKey, href, ext]);

  const isPdf = ext === ".pdf" || mime === "application/pdf";
  const isImage = mime.startsWith("image/") || [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext);
  const isText = text !== null || mime.startsWith("text/") || [".txt", ".md"].includes(ext);

  function save() {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = name || "document";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="card flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold text-slate-900">{title}</h3>
            <p className="truncate text-xs text-slate-500">{name}</p>
          </div>
          <div className="flex flex-none items-center gap-2">
            <button type="button" className="btn-primary btn-xs" onClick={save} disabled={!url || loading}>
              Save / Download
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close viewer"
              className="grid h-8 w-8 place-items-center rounded-md text-lg leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              ×
            </button>
          </div>
        </div>

        <div className="min-h-[320px] flex-1 overflow-auto bg-slate-50 p-4">
          {loading && (
            <div className="flex h-[55vh] items-center justify-center gap-2 text-sm text-slate-500">
              <Spinner className="h-5 w-5" /> Opening document…
            </div>
          )}

          {!loading && error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {!loading && !error && url && isText && (
            <pre className="min-h-[55vh] whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-4 font-mono text-sm text-slate-700">
              {text ?? "Preview is not available. Use Save / Download."}
            </pre>
          )}

          {!loading && !error && url && !isText && isPdf && (
            <iframe
              src={url}
              title={title}
              className="h-[65vh] w-full rounded-lg border border-slate-200 bg-white"
            />
          )}

          {!loading && !error && url && !isText && !isPdf && isImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={title}
              className="mx-auto max-h-[65vh] rounded-lg border border-slate-200 bg-white object-contain"
            />
          )}

          {!loading && !error && url && !isText && !isPdf && !isImage && (
            <div className="flex h-[55vh] flex-col items-center justify-center gap-2 text-center text-sm text-slate-500">
              <p className="font-medium text-slate-700">Preview is not available for this file type.</p>
              <p>Use <strong>Save / Download</strong> to open it in the correct application.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
