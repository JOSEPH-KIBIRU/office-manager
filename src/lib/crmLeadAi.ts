import "server-only";
import { cx, secret, api } from "./convex";
import { classifyInboundEmail, scoreLead } from "./crmAi";

function nextActionForScore(score: number): string {
  if (score >= 70) return "Contact today; confirm budget, decision-maker and timeline.";
  if (score >= 45) return "Qualify by asking about requirements, budget and timeline.";
  return "Review the details and decide whether to contact or disqualify.";
}

export async function scoreLeadById(orgId: string, id: string) {
  const lead = (await cx().query(api.crmLeads.getLead, {
    secret: secret(),
    orgId: orgId as never,
    id: id as never,
  })) as Record<string, unknown> | null;
  if (!lead) throw new Error("Lead not found");

  const result = await scoreLead({
    companyName: (lead.companyName as string) ?? undefined,
    contactName: (lead.contactName as string) ?? undefined,
    email: (lead.email as string) ?? undefined,
    phone: (lead.phone as string) ?? undefined,
    source: (lead.source as string) ?? undefined,
    value: (lead.value as number) ?? undefined,
    notes: (lead.notes as string) ?? undefined,
    status: (lead.status as string) ?? undefined,
  });

  await cx().mutation(api.crmLeads.updateLeadAI, {
    secret: secret(),
    orgId: orgId as never,
    id: id as never,
    score: result.score,
    confidence: result.confidence,
    summary: result.summary,
    intent: result.intent,
    nextAction: result.nextAction,
    model: result.model,
  });
  return { id, ...result };
}

export async function scoreUnscoredLeads(orgId: string, limit = 10) {
  const rows = (await cx().query(api.crmLeads.listLeadsToScore, {
    secret: secret(),
    orgId: orgId as never,
    limit,
  })) as Array<{ _id: string }>;
  const scored = [];
  for (const row of rows) {
    try {
      scored.push(await scoreLeadById(orgId, row._id as string));
    } catch {
      /* skip a lead if scoring fails */
    }
  }
  return { requested: rows.length, scored: scored.length, leads: scored };
}

export interface ReviewResult {
  reviewed: number;
  created: number;
  linked: number;
  skipped: number;
  leads: Array<{ leadId: string; email: string; score: number }>;
}

/**
 * AI-review unlinked inbound messages. Creates a lead only when the message
 * looks like a sales enquiry, deduplicating by sender email via convertToLead.
 */
export async function reviewInboundLeads(opts: {
  orgId: string;
  actorId: string;
  limit?: number;
}): Promise<ReviewResult> {
  const rows = (await cx().query(api.crmEmail.listUnreviewedInbound, {
    secret: secret(),
    orgId: opts.orgId as never,
    limit: opts.limit ?? 10,
  })) as Array<{
    id: string;
    from: string;
    subject: string | null;
    snippet: string | null;
    userId: string | null;
  }>;

  const result: ReviewResult = { reviewed: 0, created: 0, linked: 0, skipped: 0, leads: [] };

  for (const message of rows) {
    const actorId = message.userId ?? opts.actorId;
    if (!actorId) {
      result.skipped += 1;
      continue;
    }
    try {
      const decision = await classifyInboundEmail({
        from: message.from,
        subject: message.subject,
        snippet: message.snippet,
      });

      if (decision.isLead && decision.confidence >= 0.5) {
        const converted = (await cx().mutation(api.crmEmail.convertToLead, {
          secret: secret(),
          orgId: opts.orgId as never,
          actorId: actorId as never,
          id: message.id as never,
        })) as { leadId: string; created: boolean };

        await cx().mutation(api.crmLeads.updateLeadAI, {
          secret: secret(),
          orgId: opts.orgId as never,
          id: converted.leadId as never,
          score: decision.score,
          confidence: decision.confidence,
          summary: decision.summary,
          intent: decision.intent,
          nextAction: nextActionForScore(decision.score),
          model: decision.model,
        });

        await cx().mutation(api.crmEmail.markAiReviewed, {
          secret: secret(),
          orgId: opts.orgId as never,
          id: message.id as never,
          decision: "lead",
          reason: decision.reason,
        });

        if (converted.created) result.created += 1;
        else result.linked += 1;
        result.leads.push({
          leadId: converted.leadId as string,
          email: message.from,
          score: decision.score,
        });
      } else {
        await cx().mutation(api.crmEmail.markAiReviewed, {
          secret: secret(),
          orgId: opts.orgId as never,
          id: message.id as never,
          decision: decision.isLead ? "uncertain" : "not_lead",
          reason: decision.reason,
        });
        result.skipped += 1;
      }
      result.reviewed += 1;
    } catch (e) {
      try {
        await cx().mutation(api.crmEmail.markAiReviewed, {
          secret: secret(),
          orgId: opts.orgId as never,
          id: message.id as never,
          decision: "error",
          reason: e instanceof Error ? e.message : "AI review failed",
        });
      } catch {
        /* best effort */
      }
      result.skipped += 1;
    }
  }

  return result;
}
