"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { Alert, api } from "@/components/ui";
import PrintButton from "@/components/PrintButton";
import { OrgHeader, OrgFooter, type ApiOrg } from "@/components/OrgBranding";
import { printDocument } from "@/lib/print";
import type { MinuteRow } from "@/lib/types";

function MinutesView({ id }: { id: string }) {
  const [m, setM] = useState<MinuteRow | null>(null);
  const [org, setOrg] = useState<ApiOrg | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const printed = useRef(false);

  useEffect(() => {
    api<{ minute: MinuteRow }>(`/api/minutes/${id}`)
      .then((d) => {
        setM(d.minute);
        // Print once the minutes have actually rendered (avoids a blank page).
        if (!printed.current) {
          printed.current = true;
          setTimeout(() => printDocument("/minutes"), 400);
        }
      })
      .catch((e) => setErr(e.message));
    api<ApiOrg>("/api/organization").then(setOrg).catch(() => setOrg(null));
  }, [id]);

  return (
    <div className="minutes-print mx-auto max-w-3xl p-6">
      <OrgHeader org={org} showTax />
      <div className="mb-4 text-center">
        <h1 className="text-xl font-bold text-slate-900">Minutes of Meeting</h1>
        {m && <p className="text-sm text-slate-600">{m.title}</p>}
      </div>

      {err && <Alert kind="error">{err}</Alert>}
      {!m && !err && <p className="text-sm text-slate-500">Loading minutes… (printing will open momentarily)</p>}

      {m && (
        <>
          <div className="mb-4 rounded-lg border border-slate-300 bg-slate-50 p-4 text-sm">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
              <p><span className="text-slate-500">Meeting: </span><span className="font-semibold">{m.title}</span></p>
              <p><span className="text-slate-500">Date: </span><span className="font-semibold">{m.meeting_date ?? "—"}</span></p>
              <p><span className="text-slate-500">Status: </span><span className="font-semibold capitalize">{m.status}</span></p>
              <p><span className="text-slate-500">Written by: </span><span className="font-semibold">{m.author_name ?? "—"}</span></p>
            </div>
            {m.attendees && (
              <div className="mt-2">
                <p className="text-slate-500">Attendees:</p>
                <p className="whitespace-pre-wrap font-semibold">{m.attendees}</p>
              </div>
            )}
          </div>

          <div className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-6 text-sm leading-relaxed text-slate-800">
            {m.content || "No formal minutes have been written yet."}
          </div>

          {m.file_name && (
            <p className="mt-3 text-xs text-slate-500">Attachment: {m.file_name}</p>
          )}

          <OrgFooter org={org} text="This is a computer-generated document." />
        </>
      )}
    </div>
  );
}

function Inner({ id }: { id: string }) {
  return (
    <>
      <MinutesView id={id} />
      <PrintButton path="/minutes" />
    </>
  );
}

export default function MinutesPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    Promise.resolve(params).then((p) => setId(p.id));
  }, [params]);
  if (!id) return null;
  return (
    <Suspense fallback={null}>
      <Inner id={id} />
    </Suspense>
  );
}