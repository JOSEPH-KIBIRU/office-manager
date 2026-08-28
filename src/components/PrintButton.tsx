"use client";

export default function PrintButton() {
  return (
    <div className="no-print mx-auto mt-8 mb-4 max-w-3xl px-6">
      <button onClick={() => window.print()} className="btn-primary">🖨 Print / Save as PDF</button>
    </div>
  );
}
