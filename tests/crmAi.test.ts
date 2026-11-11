import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { classifyInboundEmail, scoreLead } from "@/lib/crmAi";

const originalAi = process.env.CRM_AI_API_KEY;
const originalDeepSeek = process.env.DEEPSEEK_API_KEY;

beforeEach(() => {
  delete process.env.CRM_AI_API_KEY;
  delete process.env.DEEPSEEK_API_KEY;
});

afterEach(() => {
  if (originalAi === undefined) delete process.env.CRM_AI_API_KEY;
  else process.env.CRM_AI_API_KEY = originalAi;
  if (originalDeepSeek === undefined) delete process.env.DEEPSEEK_API_KEY;
  else process.env.DEEPSEEK_API_KEY = originalDeepSeek;
});

describe("CRM AI fallback", () => {
  it("detects a buying enquiry from email metadata", async () => {
    const result = await classifyInboundEmail({
      from: "Jane Mwangi <jane@acme.co.ke>",
      subject: "Request for quotation - 20 laptops",
      snippet: "We need pricing and delivery timelines for 20 laptops.",
    });
    expect(result.isLead).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(result.model).toBe("heuristic");
  });

  it("does not turn newsletters or receipts into leads", async () => {
    const newsletter = await classifyInboundEmail({
      from: "newsletter@vendor.com",
      subject: "February newsletter",
      snippet: "Unsubscribe from our monthly newsletter.",
    });
    expect(newsletter.isLead).toBe(false);
    expect(newsletter.reason).toMatch(/notification|newsletter|transactional/i);

    const receipt = await classifyInboundEmail({
      from: "no-reply@payments.co.ke",
      subject: "Payment received",
      snippet: "Your receipt is attached.",
    });
    expect(receipt.isLead).toBe(false);
  });

  it("scores a complete, high-intent lead higher than an empty lead", async () => {
    const strong = await scoreLead({
      companyName: "Acme Ltd",
      contactName: "Jane",
      email: "jane@acme.co.ke",
      phone: "+254712345678",
      source: "website",
      value: 500000,
      notes: "Needs a quote urgently, budget approved, wants a demo.",
      status: "qualified",
    });
    const weak = await scoreLead({ email: "someone@gmail.com" });
    expect(strong.score).toBeGreaterThan(weak.score);
    expect(strong.model).toBe("heuristic");
    expect(strong.nextAction.length).toBeGreaterThan(10);
  });
});
