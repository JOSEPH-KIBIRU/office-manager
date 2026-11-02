import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { xlsxToRows } from "@/lib/bankXlsx";

async function workbookBuffer(build: (wb: ExcelJS.Workbook) => void): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  build(wb);
  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as unknown as ArrayBuffer);
}

describe("xlsx bank import", () => {
  it("reads rows into strings", async () => {
    const buf = await workbookBuffer((wb) => {
      const ws = wb.addWorksheet("Sheet1");
      ws.addRow(["Date", "Description", "Amount"]);
      ws.addRow(["2026-01-01", "Payment", 100]);
    });
    const rows = await xlsxToRows(buf);
    expect(rows).toEqual([
      ["Date", "Description", "Amount"],
      ["2026-01-01", "Payment", "100"],
    ]);
  });

  it("returns no rows for an empty workbook", async () => {
    const buf = await workbookBuffer((wb) => {
      wb.addWorksheet("Sheet1");
    });
    expect(await xlsxToRows(buf)).toEqual([]);
  });
});
