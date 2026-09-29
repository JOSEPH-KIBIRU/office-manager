interface Org {
  name: string;
  logoUrl: string | null;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
}

/** Server-rendered company header for requisition print forms. */
export function RequisitionBrand({ org }: { org: Org | null }) {
  const name = org?.name || "Office Manager";
  const addressLine = [org?.address, org?.city].filter(Boolean).join(", ");
  return (
    <div className="mb-6 flex items-center justify-between border-b-2 border-slate-800 pb-4">
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
          <p className="text-lg font-black tracking-tight text-slate-900">{name}</p>
          {addressLine && <p className="text-xs text-slate-600">{addressLine}</p>}
          <p className="text-xs text-slate-500">{[org?.phone, org?.email].filter(Boolean).join(" · ")}</p>
        </div>
      </div>
    </div>
  );
}