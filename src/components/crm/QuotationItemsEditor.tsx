"use client";

export interface DraftItem {
  description: string;
  qty: string;
  unitPrice: string;
  taxRate: string;
}

export function draftFromItems(
  items: Array<{ description: string; qty: number; unitPrice: number; taxRate: number }>
): DraftItem[] {
  return items.map((it) => ({
    description: it.description,
    qty: String(it.qty),
    unitPrice: String(it.unitPrice),
    taxRate: String(it.taxRate),
  }));
}

export function itemsPayload(items: DraftItem[]) {
  return items.map((it) => ({
    description: it.description.trim(),
    qty: Number(it.qty || 0),
    unitPrice: Number(it.unitPrice || 0),
    taxRate: Number(it.taxRate || 0),
  }));
}

export function quotationTotals(items: DraftItem[]) {
  let subtotal = 0;
  let taxTotal = 0;
  for (const it of items) {
    const line = Number(it.qty || 0) * Number(it.unitPrice || 0);
    subtotal += line;
    taxTotal += line * (Number(it.taxRate || 0) / 100);
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return { subtotal: round(subtotal), taxTotal: round(taxTotal), total: round(subtotal + taxTotal) };
}

export default function QuotationItemsEditor({
  items,
  onChange,
}: {
  items: DraftItem[];
  onChange: (items: DraftItem[]) => void;
}) {
  const update = (i: number, key: keyof DraftItem, value: string) =>
    onChange(items.map((it, idx) => (idx === i ? { ...it, [key]: value } : it)));
  const add = () => onChange([...items, { description: "", qty: "1", unitPrice: "", taxRate: "0" }]);
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const totals = quotationTotals(items);

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="table-base">
          <thead>
            <tr>
              <th>Description</th>
              <th className="w-20">Qty</th>
              <th className="w-28">Unit price</th>
              <th className="w-20">Tax %</th>
              <th className="text-right">Line</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={6} className="py-4 text-center text-sm text-slate-500">No items yet.</td></tr>
            )}
            {items.map((it, i) => {
              const line = Number(it.qty || 0) * Number(it.unitPrice || 0);
              return (
                <tr key={i}>
                  <td><input className="input py-1 text-sm" value={it.description} onChange={(e) => update(i, "description", e.target.value)} placeholder="Item / service" /></td>
                  <td><input className="input py-1 text-sm" type="number" min={0} step="0.01" value={it.qty} onChange={(e) => update(i, "qty", e.target.value)} /></td>
                  <td><input className="input py-1 text-sm" type="number" min={0} step="0.01" value={it.unitPrice} onChange={(e) => update(i, "unitPrice", e.target.value)} /></td>
                  <td><input className="input py-1 text-sm" type="number" min={0} step="0.01" value={it.taxRate} onChange={(e) => update(i, "taxRate", e.target.value)} /></td>
                  <td className="whitespace-nowrap text-right text-sm text-slate-600">{line.toLocaleString()}</td>
                  <td className="text-right"><button type="button" className="text-slate-400 hover:text-red-600" onClick={() => remove(i)} aria-label="Remove item">×</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <button type="button" className="btn-secondary px-3 py-1.5 text-sm" onClick={add}>+ Add line</button>
        <div className="text-sm text-slate-600">
          Subtotal <strong>{totals.subtotal.toLocaleString()}</strong> · Tax <strong>{totals.taxTotal.toLocaleString()}</strong> · Total{" "}
          <strong>{totals.total.toLocaleString()}</strong>
        </div>
      </div>
    </div>
  );
}
