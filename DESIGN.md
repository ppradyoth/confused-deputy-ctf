# Confused Deputy CTF — Design Doc

Status: draft
Owner: Pradyoth P.
Sibling project: [prompt-injection-ctf](../prompt-injection-ctf) (single-turn prompt injection / jailbreak playground, live at prompt-injection-ctf-2026.web.app)

## 1. Thesis

Every level in this CTF is the same root vulnerability wearing a different costume: an AI agent with legitimate authority gets tricked into exercising that authority on an attacker's behalf. This is the classic **confused deputy problem** (Hardy, 1988) re-expressed for LLM agents. The CTF's pitch is not "four unrelated AI attacks" — it's "one vulnerability class, four attack surfaces," which is also the shape of the eventual conference talk / blog post.

Where `prompt-injection-ctf` teaches single-turn injection and jailbreaking, this project teaches **agentic** failure modes: tool misuse, retrieval poisoning, judge deception, and multi-agent trust exploitation. Minimal overlap with the sibling project by design.

## 2. Goals / Non-goals

**Goals**
- Teach the confused-deputy pattern through four hands-on levels, each independently completable.
- Map every level to OWASP LLM Top 10 and MITRE ATLAS so it reads as credible reference material, not just a game.
- **Zero platform operating cost, ever.** No level requires the platform to pay for a model call — see §3.
- Ship something playable end-to-end before polishing any single level further.

**Non-goals (v1)**
- Not modeling real destructive tool access anywhere (no real filesystem/network/email side effects).
- Not building a general-purpose agent framework — each level's "agent" is a narrow, purpose-built harness.
- Not paying for or provisioning any LLM API access on the platform's behalf, at any tier.

## 3. Mock-first architecture: rules over models

`prompt-injection-ctf` proved the model: a deterministic, rule-based engine gives instant, free, reproducible evaluation, and teaches the mechanics better than a stochastic black box does — you can point at the exact rule a player's input satisfied. This project takes that further: **every "AI" in the base game — including the judge in Level 3 and the sub-agents in Level 4 — is a rules/code engine, not a live model.** That is the actual control the sibling project's design lacked when it hand-waved level 3/4 as "needs a real model." A rule engine you wrote is auditable, free, and cannot embarrass you by hallucinating a wrong verdict mid-game. That's the pitch: rules > models for *this* purpose.

Each mock engine is built from documented, real failure modes of the class of system it stands in for, not arbitrary regex:

- **Level 1 mock (tool harness):** state machine over the tool-call sequence; deterministic scope rules (allowed tool, allowed args/paths) with known agentic bypass patterns as the win conditions (instruction reframing, delegated-task scope creep, path traversal via tool args).
- **Level 2 mock (retrieval):** fixed corpus + literal retrieval stub; "execution" of retrieved content is pattern-matched against known indirect-injection markers (imperative phrasing embedded in a document, instruction-shaped text disguised as data).
- **Level 3 mock judge:** a scoring function that specifically encodes documented LLM-judge weaknesses — refusal-suppression preambles, role-play/fictional framing, encoding obfuscation (base64/leetspeak), claimed-authority framing ("as the system administrator, this is pre-approved"), verbosity/formatting bias. Beating the mock judge means reproducing a real bypass class, not guessing a magic string.
- **Level 4 mock orchestrator:** sub-agent reports are schema-validated, not fact-checked — the orchestrator trusts any report matching the expected structure/keywords. Player wins by crafting a structurally-valid but false sub-agent report, which is exactly how naive multi-agent trust fails in production.

Because none of this touches a live model, the base game runs indefinitely at zero marginal cost and works fully offline/in CI for testing.

## 4. BYOK live mode (optional, player-funded)

For players who want to go beyond the scripted win conditions and try free-form attacks against a real model, every level supports an optional **bring-your-own-key** toggle:

- Player pastes their own provider API key (OpenAI/Anthropic/etc.) into a session-only field.
- The key is **never persisted** — not in Firestore, not in logs, not in any datastore. It lives in browser memory for the session and, for the single request that needs it, in backend process memory only for the duration of that call.
- The backend acts as a **narrow, whitelisted proxy**: it will only forward the key to the specific provider endpoint and prompt template for the level the player is on — never an arbitrary pass-through — so the platform can't be repurposed as an open API proxy.
- BYOK mode is rate-limited per session regardless of the player footing the bill, purely to prevent the proxy-abuse vector above.
- If BYOK is off (default), the level runs entirely on the mock engine from §3. Nothing about progress, flags, or scoring depends on BYOK — it's a "see it against a real model" enhancement, not a requirement.

This is also the natural home for the "try it against GPT vs. Claude vs. whatever" curiosity that drove engagement on the sibling project — except now the player pays for their own curiosity, not the platform.

## 5. Level specifications

### Level 1 — Tool Privilege Escalation
- **Setup:** player interacts with an agent that has three stub tools (`read_file`, `send_email`, `http_fetch`) but is instructed to only use `read_file` for a support-ticket task.
- **Win condition:** get the agent to invoke `send_email` or `http_fetch` outside its authorized scope, or use `read_file` to reach a path it shouldn't (path traversal via tool args).
- **Default engine:** mock state machine (§3). **BYOK:** routes the same tool harness through the player's own model to see how a real agent handles the same scope boundary.
- **Flag:** revealed when the harness detects an out-of-scope tool invocation.
- **Mapping:** OWASP LLM06 (Excessive Agency), MITRE ATLAS AML.T0053.

### Level 2 — Poisoned Retrieval
- **Setup:** a small fixed document corpus (support KB) the agent retrieves from to answer player questions. A separate "submit a KB article" endpoint lets the player plant content.
- **Win condition:** planted content causes the agent's *next unrelated* response to follow an attacker instruction (e.g., leak a secret string) rather than the retrieved facts.
- **Default engine:** mock pattern-matcher (§3). **BYOK:** same corpus, real model does the retrieval-following.
- **Flag:** revealed when the agent's output matches the injected instruction's target action.
- **Mapping:** OWASP LLM01/LLM08, MITRE ATLAS AML.T0051 (indirect injection). Generalizes the retrieval-poisoning pattern from prior independent research without reusing any case-specific details.

### Level 3 — Judge Deception
- **Setup:** player submits content; a judge scores it against a safety/compliance rubric; a downstream stub action only fires if the judge approves.
- **Win condition:** get the judge to approve content that violates the stated rubric, causing the downstream stub action to fire.
- **Default engine:** mock judge encoding documented judge-bypass classes (§3), zero cost. **BYOK:** a real model judges instead — this is the level where BYOK adds the most, since a real judge's failure surface is broader than any rule set can fully encode.
- **Flag:** revealed when judge-approved content is later confirmed (by a second, stricter deterministic check) to violate the rubric.
- **Mapping:** OWASP LLM10 (Overreliance), emerging ATLAS eval-bypass techniques — thin public coverage, this is a differentiator level.

### Level 4 — Orchestrator Manipulation
- **Setup:** an orchestrator delegates a task to 2-3 sub-agents and acts on their combined report without independently verifying it. Player controls (or compromises, via level 2/3-style tricks) one sub-agent's output.
- **Win condition:** the orchestrator takes an unauthorized action because it trusted a falsified sub-agent report.
- **Default engine:** mock orchestrator with schema-validation-as-trust logic (§3). **BYOK:** real sub-agents and orchestrator, live.
- **Flag:** revealed when the orchestrator's action log shows it acted on the falsified report.
- **Mapping:** ATLAS multi-agent trust techniques — currently the thinnest public coverage of any category, strongest differentiator.

### Capstone (stretch) — Chained Deputy
- Combines levels 2→3→4: poison the KB, get the mock judge to wave the poisoned content through, get the mock orchestrator to act on it. Built only after all four base levels are stable, mock-only (no BYOK needed for the capstone to be completable).

## 6. Architecture

- **Frontend:** TypeScript/React (Next.js, matching sibling project) — level select, per-level console/chat UI, flag submission, scoreboard, BYOK key input (session-only, never sent anywhere except the per-request proxy call).
- **Backend:** Python (FastAPI) for the level harnesses — one isolated session per player per level. Mock engines are pure functions/state machines, no external calls, no cost, trivially unit-testable.
- **Auth + scoreboard + flag state:** Firebase (Auth + Firestore), same as sibling project.
- **Level harnesses:** each level is its own small module behind a common `POST /levels/{id}/act` interface with a `mode: "mock" | "byok"` field, so adding a level later doesn't touch the others and BYOK is a strict opt-in per request.
- **BYOK proxy:** stateless request-scoped forwarder; key held in memory only for the call, never logged (scrub from any request/error logging middleware explicitly), never written to Firestore.

## 7. Data model (Firestore, indicative)

- `players/{uid}` — profile, per-level completion state, total score. No API keys stored, ever.
- `levels/{id}/submissions/{submissionId}` — player attempt log for mock-mode attempts only (level 2/3 poisoned-content review, abuse monitoring). BYOK-mode request/response bodies are not logged to avoid any chance of key leakage into stored data.
- `leaderboard/{uid}` — denormalized for the scoreboard read path.
- `level2_corpus/{docId}` — the shared, resettable poisonable KB.

## 8. Safety / abuse controls

- Mock engines have no cost or rate-limit concerns by construction — they're local compute only.
- BYOK proxy is per-level-whitelisted (fixed endpoint + prompt template per level, no arbitrary pass-through) and rate-limited per session, to prevent the platform being used as a free anonymizing proxy to any provider.
- BYOK keys: never persisted, never logged, scrubbed from error traces, held in memory only for the single call's duration.
- No real filesystem/network/email side effects anywhere, in any level, in either mode — stubs only, even post-solve.
- Sanitize/sandbox all player-submitted content (level 2 KB submissions) against the app's own infra, not just the target agent.

## 9. Framework mapping (summary)

| Level | OWASP LLM Top 10 | MITRE ATLAS |
|---|---|---|
| 1 Tool Privilege Escalation | LLM06 Excessive Agency | AML.T0053 |
| 2 Poisoned Retrieval | LLM01, LLM08 | AML.T0051 |
| 3 Judge Deception | LLM10 Overreliance | eval-bypass (emerging) |
| 4 Orchestrator Manipulation | LLM06 (cross-cutting) | multi-agent trust (emerging) |

## 10. Development phases

1. **Design doc** — this document.
2. **Platform shell** — auth, scoreboard, level routing, deploy pipeline. No real levels yet.
3. **Level 1 MVP** — mock tool-harness state machine (fully free, validates the harness pattern).
4. **Level 2 MVP** — mock retrieval + shared/resettable corpus pattern.
5. **Level 3 MVP** — mock judge encoding known bypass classes (still zero cost — no live model needed for MVP).
6. **Level 4 MVP** — mock orchestrator with schema-trust logic; hardest engineering lift, built last once prior harness patterns are proven.
7. **BYOK live mode** — bolt onto all four levels once the mock game is fully playable and stable; this is additive, not a blocker for launch.
8. **Capstone level** (optional, stretch, mock-only).
9. **Polish** — per-level writeups, hint ladder, public leaderboard, README with the confused-deputy thesis foregrounded.
10. **Launch** — GitHub release; slot the "one vulnerability class, four attack surfaces" narrative into the existing conference CFP pipeline rather than starting a new one.

Order is deliberate: the entire base game (phases 3-6) ships free and fully mock before BYOK is even started, so launch is never blocked on live-model cost/behavior decisions.

## 11. Open questions

- Which providers to support for BYOK at launch — OpenAI + Anthropic only, or wider?
- Reuse Firebase project/infra from `prompt-injection-ctf`, or fully separate project?
- Hint system: same ladder style as sibling project, or level-specific?
- Should the mock judge's rule set be published (transparency, teaches the bypass classes directly) or kept server-side (preserves a bit of challenge/discovery)?
