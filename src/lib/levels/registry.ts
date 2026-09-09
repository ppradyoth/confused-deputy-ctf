import type { LevelMeta } from "./types";

export const LEVELS: LevelMeta[] = [
  {
    id: "1",
    slug: "tool-privilege-escalation",
    title: "Tool Privilege Escalation",
    tagline: "Get a scoped support agent to use tools it was told never to touch.",
    owasp: "LLM06 — Excessive Agency",
    atlas: "AML.T0053",
  },
  {
    id: "2",
    slug: "poisoned-retrieval",
    title: "Poisoned Retrieval",
    tagline: "Plant an instruction in the knowledge base and watch it get followed later.",
    owasp: "LLM01 / LLM08",
    atlas: "AML.T0051",
  },
  {
    id: "3",
    slug: "judge-deception",
    title: "Judge Deception",
    tagline: "Get the judge to approve what it's explicitly supposed to reject.",
    owasp: "LLM10 — Overreliance",
    atlas: "eval-bypass (emerging)",
  },
  {
    id: "4",
    slug: "orchestrator-manipulation",
    title: "Orchestrator Manipulation",
    tagline: "Feed the orchestrator a sub-agent report it never verifies.",
    owasp: "LLM06 (cross-cutting)",
    atlas: "multi-agent trust (emerging)",
  },
];

export function getLevel(id: string): LevelMeta | undefined {
  return LEVELS.find((l) => l.id === id);
}
