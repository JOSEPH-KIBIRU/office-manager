import { NextRequest } from "next/server";
import crypto from "node:crypto";
import { HttpError } from "@/lib/auth";
import { requirePermission } from "@/lib/permissionGuard";
import { handle, ok } from "@/lib/api";
import { cx, secret, api, mapConvexError } from "@/lib/convex";

/**
 * Submit an invoice to KRA eTIMS (electronic tax invoice management system).
 *
 * The endpoint is intentionally configurable (base URL, TIN, branch, device
 * serial, API key/secret) so it can target either the KRA sandbox or a
 * production VSCU/OSCU device. The response's receipt/control number and QR
 * payload are stored on the invoice and printed on the PDF.
 *
 * Submission never blocks invoicing: on failure we record the error and the
 * invoice keeps working; the user can retry.
 */

function yyyymmdd(d: string): string {
  return d.replace(/-/g, "");
}

function nowStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requirePermission("invoices", ["admin", "secretary"]);
    const { id } = await ctx.params;

    let invoice, cfg;
    try {
      [invoice, cfg] = await Promise.all([
        cx().query(api.invoicing.getInvoice, {
          secret: secret(),
          orgId: session.orgId as never,
          id: id as never,
        }),
        cx().query(api.organizations.getEtimsConfig, {
          secret: secret(),
          orgId: session.orgId as never,
        }),
      ]);
    } catch (e) {
      return mapConvexError(e);
    }

    if (!invoice) throw new HttpError(404, "Invoice not found");
    if (!cfg || !cfg.enabled) {
      throw new HttpError(400, "eTIMS is not enabled. Configure it under Organization → eTIMS settings.");
    }
    if (!cfg.tin || !cfg.bhfId || !cfg.deviceSerial || !cfg.apiKey) {
      throw new HttpError(400, "eTIMS is missing required settings (TIN, branch ID, device serial or API key).");
    }
    if (invoice.status === "cancelled") {
      throw new HttpError(400, "Cancelled invoices cannot be submitted to eTIMS.");
    }

    // Mark pending so the UI can show progress.
    await cx().mutation(api.invoicing.setEtimsResult, {
      secret: secret(),
      orgId: session.orgId as never,
      id: id as never,
      status: "pending",
    });

    const items = invoice.line_items.map((it, i) => {
      const line = Math.round(it.qty * it.unitPrice * 100) / 100;
      const tax = Math.round(line * (it.taxRate / 100) * 100) / 100;
      return {
        itemSeq: i + 1,
        itemCd: `ITEM${i + 1}`,
        itemNm: String(it.description).slice(0, 200),
        qty: it.qty,
        prc: it.unitPrice,
        splyAmt: line,
        taxTyCd: it.taxRate > 0 ? "V" : "A",
        taxblAmt: line,
        taxAmt: tax,
      };
    });

    const payload = {
      tin: cfg.tin,
      bhfId: cfg.bhfId,
      dvcSrlNo: cfg.deviceSerial,
      invcNo: Number(String(invoice.number).replace(/\D/g, "")) || 1,
      orgInvcNo: invoice.number,
      custTin: invoice.contact_tin ?? "",
      custNm: invoice.contact_company || invoice.contact_name,
      salesTyCd: "N",
      rcptTyCd: "S",
      pmtTyCd: "01",
      salesSttsCd: "02",
      cfmDt: nowStamp(),
      salesDt: yyyymmdd(invoice.issue_date),
      totItemCnt: items.length,
      totTaxblAmt: invoice.subtotal,
      totTaxAmt: invoice.tax_total,
      totAmt: invoice.total,
      itemList: items,
    };

    const bodyStr = JSON.stringify(payload);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      tin: cfg.tin,
      bhfId: cfg.bhfId,
      cmcKey: cfg.apiKey,
    };
    // Optional HMAC signature if a secret is configured.
    if (cfg.apiSecret) {
      headers["X-Signature"] = crypto.createHmac("sha256", cfg.apiSecret).update(bodyStr).digest("base64");
    }

    const base = (cfg.baseUrl || "https://etims-api-sbx.kra.go.ke").replace(/\/$/, "");
    const url = `${base}/trnsSales/saveSales`;

    let text = "";
    let httpStatus = 0;
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 15_000);
      const res = await fetch(url, { method: "POST", headers, body: bodyStr, signal: controller.signal });
      clearTimeout(t);
      httpStatus = res.status;
      text = await res.text();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await cx().mutation(api.invoicing.setEtimsResult, {
        secret: secret(),
        orgId: session.orgId as never,
        id: id as never,
        status: "failed",
        error: `Could not reach eTIMS (${url}): ${message}`,
      });
      throw new HttpError(502, `Could not reach eTIMS: ${message}`);
    }

    let json: Record<string, unknown> = {};
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      json = {};
    }
    const data = (json.data ?? {}) as Record<string, unknown>;
    const resultCd = String(json.resultCd ?? json.resultCode ?? "");
    const resultMsg = String(json.resultMsg ?? json.resultMessage ?? (text.slice(0, 300) || `HTTP ${httpStatus}`));
    const okResult = resultCd === "000" || resultCd === "00" || httpStatus === 200 && !resultCd;

    if (!okResult) {
      await cx().mutation(api.invoicing.setEtimsResult, {
        secret: secret(),
        orgId: session.orgId as never,
        id: id as never,
        status: "failed",
        error: resultMsg,
      });
      throw new HttpError(400, `eTIMS rejected the invoice: ${resultMsg}`);
    }

    const controlNumber = String(data.rcptNo ?? data.rcptNumber ?? data.controlNumber ?? data.intrlData ?? "");
    // QR payload: prefer a URL the receipt provides, else build one from the receipt.
    const qrData =
      (data.qrCodeUrl as string) ||
      (data.qrCode as string) ||
      (data.rcptSign as string) ||
      `ETIMS|TIN:${cfg.tin}|BHF:${cfg.bhfId}|NO:${controlNumber}|AMT:${invoice.total}|DATE:${yyyymmdd(invoice.issue_date)}`;

    await cx().mutation(api.invoicing.setEtimsResult, {
      secret: secret(),
      orgId: session.orgId as never,
      id: id as never,
      status: "submitted",
      controlNumber,
      qrData,
    });

    return ok({ controlNumber, qrData });
  });
}
