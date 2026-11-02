import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "@/lib/csv";

describe("csv sanitizer", () => {
  it("neutralises formula-injection prefixes", () => {
    expect(csvCell("=HYPERLINK(...)")).toBe("'=HYPERLINK(...)");
    expect(csvCell("+1+1")).toBe("'+1+1");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("-cmd|' /C calc'!A0")).toBe("'-cmd|' /C calc'!A0");
  });

  it("leaves numeric strings and numbers alone", () => {
    expect(csvCell("-1500.25")).toBe("-1500.25");
    expect(csvCell(42)).toBe("42");
    expect(csvCell(-7)).toBe("-7");
  });

  it("quotes commas, quotes and newlines", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('a"b')).toBe('"a""b"');
    expect(csvCell("a\nb")).toBe('"a\nb"');
  });

  it("builds a CSV with CRLF rows", () => {
    expect(toCsv([["=x", 1], ["a,b", "c"]])).toBe("'=x,1\r\n\"a,b\",c");
  });
});
