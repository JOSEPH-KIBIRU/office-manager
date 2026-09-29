"use client";

export interface OrgBrandingData {
  id?: string;
  name: string;
  logoUrl?: string | null;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  taxNumber?: string | null;
  website?: string | null;
  paymentDetails?: string | null;
  invoiceNotes?: string | null;
  invoiceTerms?: string | null;
}

/** Shape returned by GET /api/organization (incl. the persisted storage id). */
export interface ApiOrg extends OrgBrandingData {
  id: string;
  slug: string;
  active: boolean;
  logoFileId: string | null;
  workingDays?: number[];
  workStartTime?: string;
  workEndTime?: string;
  graceMinutes?: number;
  etimsEnabled?: boolean;
  etimsEnv?: string;
  etimsBaseUrl?: string;
  etimsTin?: string;
  etimsBhfId?: string;
  etimsDeviceSerial?: string;
  etimsApiKey?: string;
  etimsHasSecret?: boolean;
  remindersEnabled?: boolean;
  reminderIntervalDays?: number;
  reminderMax?: number;
  leaveEntitlement?: number;
  leaveCarryOverMax?: number;
  leaveEncashment?: boolean;
}

interface Props {
  org: OrgBrandingData | null;
  /** Show the KRA PIN / tax number. Internal documents only — never on customer-facing exports. */
  showTax?: boolean;
  /** Compact single-line contact string for footers. */
  footer?: boolean;
  periodLabel?: string;
  rightLabel?: string;
  rightSub?: string;
}

/** Company header used on printable internal documents (payslips, invoices, P9, reports). */
export function OrgHeader({ org, showTax, periodLabel, rightLabel, rightSub }: Props) {
  const name = org?.name || "Office Manager";
  const addressLine = [org?.address, org?.city].filter(Boolean).join(", ");
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b-2 border-slate-900 pb-4">
      <div className="flex items-center gap-3">
        {org?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={org.logoUrl} alt={`${name} logo`} className="h-12 w-12 object-contain" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-950 text-xl font-black text-white">
            {name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-xl font-black tracking-tight text-slate-900">{name}</h1>
          {addressLine && <p className="text-xs text-slate-600">{addressLine}</p>}
          <p className="text-xs text-slate-500">
            {[org?.phone, org?.email].filter(Boolean).join(" · ")}
          </p>
          {showTax && org?.taxNumber && (
            <p className="text-xs font-semibold text-slate-700">KRA PIN: {org.taxNumber}</p>
          )}
        </div>
      </div>
      <div className="text-right">
        {rightLabel && <p className="font-mono text-lg font-bold">{rightLabel}</p>}
        {rightSub && <p className="font-mono text-sm text-indigo-700">{rightSub}</p>}
        {periodLabel && <p className="text-sm text-slate-600">{periodLabel}</p>}
      </div>
    </div>
  );
}

/** Minimal footer for printable documents: computer-generated note + product attribution. */
export function OrgFooter({ org, text }: { org: OrgBrandingData | null; text: string }) {
  void org;
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://officemanager.pigiecore.co.ke";
  return (
    <footer className="mt-8 border-t border-slate-200 pt-3 text-center text-[11px] leading-relaxed text-slate-500">
      <p>{text || "This is a computer-generated document."}</p>
      <p>
        Powered by{" "}
        <a href={SITE_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-700 hover:underline">
          Office Manager
        </a>
      </p>
    </footer>
  );
}