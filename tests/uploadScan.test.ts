import { beforeEach, describe, expect, it } from "vitest";
import { scanUploadBytes } from "@/lib/uploadScan";

beforeEach(() => {
  delete process.env.UPLOAD_SCAN_URL;
  delete process.env.UPLOAD_SCAN_TOKEN;
  delete process.env.UPLOAD_SCAN_FAIL_OPEN;
});

describe("upload scanning", () => {
  it("accepts a clean PNG", async () => {
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from("image-data"),
    ]);
    await expect(scanUploadBytes(png, "logo.png")).resolves.toEqual({ clean: true });
  });

  it("accepts a clean PDF", async () => {
    const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF");
    await expect(scanUploadBytes(pdf, "document.pdf")).resolves.toEqual({ clean: true });
  });

  it("rejects PDFs with active content", async () => {
    const pdf = Buffer.from("%PDF-1.4\n/JavaScript (alert(1))\n%%EOF");
    const result = await scanUploadBytes(pdf, "document.pdf");
    expect(result.clean).toBe(false);
    expect(result.reason).toMatch(/active content/i);
  });

  it("rejects executables regardless of extension", async () => {
    const exe = Buffer.from([0x4d, 0x5a, 0x90, 0x00]);
    const result = await scanUploadBytes(exe, "invoice.pdf");
    expect(result.clean).toBe(false);
    expect(result.reason).toMatch(/Windows executable/i);
  });

  it("rejects SVGs with scripts", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    const result = await scanUploadBytes(svg, "logo.svg");
    expect(result.clean).toBe(false);
    expect(result.reason).toMatch(/script/i);
  });

  it("rejects binary data disguised as text", async () => {
    const text = Buffer.from([0x68, 0x65, 0x00, 0x6c, 0x6f]);
    const result = await scanUploadBytes(text, "notes.txt");
    expect(result.clean).toBe(false);
  });

  it("rejects a mismatched image signature", async () => {
    const fake = Buffer.from("not a png");
    const result = await scanUploadBytes(fake, "photo.png");
    expect(result.clean).toBe(false);
  });
});
