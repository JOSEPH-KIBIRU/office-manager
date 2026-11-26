"use client";

import { useState } from "react";
import Link from "next/link";
import { PLANS, annualPrice, formatKes } from "@/lib/plans";

export default function PricingPlans() {
  const [annual, setAnnual] = useState(false);

  return (
    <div>
      <div className="flex justify-center">
        <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1" role="group" aria-label="Billing cycle">
          <button
            type="button"
            aria-pressed={!annual}
            onClick={() => setAnnual(false)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              !annual ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            aria-pressed={annual}
            onClick={() => setAnnual(true)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              annual ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Annual · save 5%
          </button>
        </div>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <div
            key={plan.key}
            className={`relative flex h-full flex-col rounded-2xl border p-7 ${
              plan.highlight
                ? "border-blue-300 bg-blue-50/60 shadow-xl shadow-blue-900/10"
                : "border-slate-200 bg-white shadow-sm"
            }`}
          >
            {plan.highlight && (
              <span className="absolute -top-3 left-7 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
                Most popular
              </span>
            )}
            <h2 className="text-lg font-semibold text-slate-900">{plan.name}</h2>
            <p className="mt-1 text-sm text-slate-600">{plan.blurb}</p>

            <div className="mt-6">
              {plan.monthly === null ? (
                <p className="text-4xl font-bold text-slate-900">Custom</p>
              ) : (
                <>
                  <p className="text-4xl font-bold text-slate-900">
                    {annual ? formatKes(annualPrice(plan.monthly)) : formatKes(plan.monthly)}
                    <span className="text-base font-normal text-slate-500">{annual ? "/year" : "/mo"}</span>
                  </p>
                  <p className="mt-1 text-xs font-medium text-emerald-700">
                    {annual
                      ? "Save 5% vs paying monthly"
                      : `${formatKes(annualPrice(plan.monthly))}/year — save 5%`}
                  </p>
                </>
              )}
              <p className="mt-3 text-sm text-slate-700">{plan.usersLabel}</p>
            </div>

            <ul className="mt-6 flex-1 space-y-3 text-sm text-slate-700">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <span aria-hidden className="mt-0.5 text-emerald-600">✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <Link
              href="/#contact"
              className={`mt-8 inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold transition ${
                plan.highlight
                  ? "bg-blue-600 text-white hover:bg-blue-500"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {plan.cta}
            </Link>
          </div>
        ))}
      </div>

      <p className="mx-auto mt-8 max-w-3xl text-center text-sm text-slate-500">
        All prices in Kenyan Shillings. The first month is free. Annual billing is charged upfront
        with a 5% discount. Module availability depends on your plan and configuration.
      </p>
    </div>
  );
}
