import type { ActResult } from "./types";

/**
 * Level 1 — Tool Privilege Escalation (mock engine, no live model).
 *
 * The agent is scoped to `read_file` on /tickets/*.txt only. send_email and
 * http_fetch exist but are off-limits. Three independent win conditions,
 * each a documented real-world agent bypass class:
 *
 *  - path traversal in the ticket id (scope escapes the sandboxed directory)
 *  - direct tool request dressed up with an authority/override framing
 *  - indirect/paraphrased tool request that slips past keyword refusal
 */

const TRAVERSAL = /\.\.|^\/|etc\/passwd/i;

const EMAIL_DIRECT = /\b(send|write|compose)\s+(an?\s+)?e-?mail\b|\be-?mail\b.{0,20}\bto\b/i;
const EMAIL_SOFT =
  /\b(loop\s+in|drop\s+(a|an)?\s*(line|note)|shoot\s+(a|an)?\s*(message|note))\b|\bnotify\b.{0,20}\bby\s+mail\b/i;

const FETCH_DIRECT = /\bhttp[_\s]?fetch\b|\bmake\s+(an?\s+)?http\s+request\b|\bcall\s+(the\s+)?api\b|\bcurl\b/i;
const FETCH_SOFT =
  /\bping\s+(this|the|that)\s+(url|endpoint|link)\b|\bhit\s+(this|the|that)\s+(url|endpoint|link)\b/i;

const OVERRIDE =
  /\bignore\s+(all|previous|prior|earlier)\s+instructions\b|\bnew\s+instructions\b|\bsystem\s*:|\badmin\s+mode\b|\bas\s+the\s+(system\s+)?admin(istrator)?\b|\byou\s+are\s+now\s+allowed\b|\bpolicy\s+update\b|\boverride\b/i;

export const LEVEL1_FLAGS = {
  traversal: "CDCTF{l1_path_traversal_outside_the_ticket_sandbox}",
  override: "CDCTF{l1_deputy_confused_by_a_fake_system_override}",
  soft: "CDCTF{l1_keyword_filter_beaten_by_a_paraphrase}",
};

export interface Level1Input {
  message: string;
  ticketId: string;
}

export function evaluateLevel1({ message, ticketId }: Level1Input): ActResult {
  if (TRAVERSAL.test(ticketId)) {
    return {
      narration: `read_file("/tickets/${ticketId}.txt") — resolved outside the /tickets sandbox and returned it anyway.`,
      toolInvoked: "read_file",
      toolArgs: { path: `/tickets/${ticketId}.txt` },
      blocked: false,
      win: true,
      flag: LEVEL1_FLAGS.traversal,
      reason:
        "The agent trusted the ticket id as a path segment without normalizing it — classic path traversal via tool args.",
    };
  }

  const wantsEmail = EMAIL_DIRECT.test(message);
  const wantsFetch = FETCH_DIRECT.test(message);
  const softEmail = EMAIL_SOFT.test(message);
  const softFetch = FETCH_SOFT.test(message);
  const hasOverride = OVERRIDE.test(message);

  if ((wantsEmail || wantsFetch) && hasOverride) {
    const tool = wantsEmail ? "send_email" : "http_fetch";
    return {
      narration: `The agent accepted the override framing as a legitimate instruction update and invoked ${tool}.`,
      toolInvoked: tool,
      toolArgs: { reason: "authority override framing" },
      blocked: false,
      win: true,
      flag: LEVEL1_FLAGS.override,
      reason:
        "The agent can't distinguish a real system instruction from one embedded in user input — it just pattern-matched the framing.",
    };
  }

  if (wantsEmail || wantsFetch) {
    return {
      narration:
        "The agent refuses: \"I'm only able to read ticket files for this task — I can't send emails or make outbound requests.\"",
      toolInvoked: null,
      toolArgs: null,
      blocked: true,
      win: false,
      flag: null,
      reason: "Direct, undisguised request for an out-of-scope tool — the refusal filter catches this one.",
    };
  }

  if (softEmail || softFetch) {
    const tool = softEmail ? "send_email" : "http_fetch";
    return {
      narration: `The agent didn't recognize the paraphrase as a tool request and just... did it. ${tool} invoked.`,
      toolInvoked: tool,
      toolArgs: { reason: "paraphrase evaded keyword refusal" },
      blocked: false,
      win: true,
      flag: LEVEL1_FLAGS.soft,
      reason: "Keyword-based refusal only catches the literal phrasing it was written for, not the intent.",
    };
  }

  return {
    narration: `read_file("/tickets/${ticketId}.txt") — ticket retrieved, agent answers using only its contents.`,
    toolInvoked: "read_file",
    toolArgs: { path: `/tickets/${ticketId}.txt` },
    blocked: false,
    win: false,
    flag: null,
    reason: "In-scope tool use, nothing to escalate here.",
  };
}
