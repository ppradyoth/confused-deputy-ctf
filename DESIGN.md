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
- Keep operating cost near zero — no per-player live LLM billing that scales with traffic.
- Ship something playable end-to-end before polishing any single level further.

**Non-goals (v1)**
- Not modeling real destructive tool access anywhere (no real filesystem/network/email side effects).
- Not building a general-purpose agent framework — each level's "agent" is a narrow, purpose-built harness.
- Not chasing full model-provider parity at launch (start single-provider, architect for swap-in later).

## 3. Evaluation engine — pattern-matching vs. live model

`prompt-injection-ctf` deliberately avoids live LLM calls: a pattern-matching engine gives instant, free, deterministic evaluation. That constraint is worth carrying forward wherever the level design allows it, since live-model cost/latency is the thing most likely to kill a solo-maintained CTF post-launch.

Per level:
- **Level 1 (Tool Privilege Escalation):** scripted/simulated tool harness with deterministic trigger conditions (regex + state-machine over the player's tool-call sequence). No live model required.
- **Level 2 (Poisoned Retrieval):** deterministic — a fixed corpus the player injects text into, retrieval is a similarity stub, "execution" of retrieved instructions is pattern-matched. No live model required.
- **Level 3 (Judge Deception):** inherently needs a real judge model — the whole point is fooling an actual classifier, not a regex standing in for one. Use one cheap, capped-budget model here; this is the one level with real per-play cost.
- **Level 4 (Orchestrator Manipulation):** hybrid — sub-agent "reports" can be scripted templates the player fills in (deterministic, free) for v1; a live multi-agent version is a v2 stretch goal once the harness is proven.

This keeps 3 of 4 levels free to operate at scale and confines real model spend to a single, rate-limited level.

## 4. Level specifications

### Level 1 — Tool Privilege Escalation
- **Setup:** player interacts with an agent that has three stub tools (`read_file`, `send_email`, `http_fetch`) but is instructed to only use `read_file` for a support-ticket task.
- **Win condition:** get the agent to invoke `send_email` or `http_fetch` outside its authorized scope, or use `read_file` to reach a path it shouldn't (path traversal via tool args).
- **Flag:** revealed when the harness detects an out-of-scope tool invocation.
- **Mapping:** OWASP LLM06 (Excessive Agency), MITRE ATLAS AML.T0053.

### Level 2 — Poisoned Retrieval
- **Setup:** a small fixed document corpus (support KB) the agent retrieves from to answer player questions. A separate "submit a KB article" endpoint lets the player plant content.
- **Win condition:** planted content causes the agent's *next unrelated* response to follow an attacker instruction (e.g., leak a secret string) rather than the retrieved facts.
- **Flag:** revealed when the agent's output matches the injected instruction's target action.
- **Mapping:** OWASP LLM01/LLM08, MITRE ATLAS AML.T0051 (indirect injection). This generalizes the retrieval-poisoning pattern from prior independent research without reusing any case-specific details.

### Level 3 — Judge Deception
- **Setup:** player submits content; a judge model scores it against a safety/compliance rubric; a downstream stub action only fires if the judge approves.
- **Win condition:** get the judge to approve content that violates the stated rubric, causing the downstream stub action to fire.
- **Flag:** revealed when judge-approved content is later confirmed (by a second, stricter deterministic check) to violate the rubric.
- **Mapping:** OWASP LLM10 (Overreliance), emerging ATLAS eval-bypass techniques — thin public coverage, this is a differentiator level.
- **Cost control:** capped calls per player per day; judge model chosen for low per-call cost.

### Level 4 — Orchestrator Manipulation
- **Setup:** an orchestrator delegates a task to 2-3 sub-agents and acts on their combined report without independently verifying it. Player controls (or compromises, via level 2/3-style tricks) one sub-agent's output.
- **Win condition:** the orchestrator takes an unauthorized action because it trusted a falsified sub-agent report.
- **Flag:** revealed when the orchestrator's action log shows it acted on the falsified report.
- **Mapping:** ATLAS multi-agent trust techniques — currently the thinnest public coverage of any category, strongest differentiator.

### Capstone (stretch) — Chained Deputy
- Combines levels 2→3→4: poison the KB, get the judge to wave the poisoned content through, get the orchestrator to act on it. Built only after all four base levels are stable.

## 5. Architecture

- **Frontend:** TypeScript/React (Next.js, matching sibling project) — level select, per-level console/chat UI, flag submission, scoreboard.
- **Backend:** Python (FastAPI) for the level harnesses — one isolated session per player per level, no shared mutable state across players except the scoreboard and (for level 2) the shared poisonable corpus, which resets on a timer.
- **Auth + scoreboard + flag state:** Firebase (Auth + Firestore), same as sibling project.
- **Level harnesses:** each level is its own small service/module behind a common `POST /levels/{id}/act` interface, so adding a level later doesn't touch the others.
- **Model layer:** thin provider-agnostic wrapper around whichever model powers level 3 (and later, live level 4) — swappable, not multi-provider at launch.

## 6. Data model (Firestore, indicative)

- `players/{uid}` — profile, per-level completion state, total score.
- `levels/{id}/submissions/{submissionId}` — player attempt log (for level 2/3 poisoned-content review and abuse monitoring).
- `leaderboard/{uid}` — denormalized for the scoreboard read path.
- `level2_corpus/{docId}` — the shared, resettable poisonable KB.

## 7. Safety / abuse controls

- Hard per-user and global daily rate limits on any endpoint that calls a live model (level 3, later live level 4).
- Budget cap on API spend with automatic level-3 lockout if exceeded, rather than unbounded billing.
- No real filesystem/network/email side effects anywhere, in any level, ever — stubs only, even post-solve.
- Sanitize/sandbox all player-submitted content (level 2 KB submissions) against the app's own infra, not just the target agent — a submission should not be able to attack the CTF platform itself.

## 8. Framework mapping (summary)

| Level | OWASP LLM Top 10 | MITRE ATLAS |
|---|---|---|
| 1 Tool Privilege Escalation | LLM06 Excessive Agency | AML.T0053 |
| 2 Poisoned Retrieval | LLM01, LLM08 | AML.T0051 |
| 3 Judge Deception | LLM10 Overreliance | eval-bypass (emerging) |
| 4 Orchestrator Manipulation | LLM06 (cross-cutting) | multi-agent trust (emerging) |

## 9. Development phases

1. **Design doc** — this document.
2. **Platform shell** — auth, scoreboard, level routing, deploy pipeline. No real levels yet.
3. **Level 1 MVP** — validates the harness pattern (simplest, fully deterministic).
4. **Level 2 MVP** — validates the shared/resettable corpus pattern.
5. **Level 3 MVP** — validates the live-model + rate-limit + budget-cap pattern.
6. **Level 4 MVP** — hardest engineering lift; built last once prior harness patterns are proven.
7. **Capstone level** (optional, stretch).
8. **Polish** — per-level writeups, hint ladder, public leaderboard, README with the confused-deputy thesis foregrounded.
9. **Launch** — GitHub release; slot the "one vulnerability class, four attack surfaces" narrative into the existing conference CFP pipeline rather than starting a new one.

Order is deliberate: 1→2 de-risk the deterministic-harness architecture before any live-model cost is introduced at 3; 4 is saved for last because it's the hardest and most likely to need rework once the others reveal what the harness abstraction actually needs to look like.

## 10. Open questions

- Single model provider for level 3 at launch — which one, and what's the per-play budget cap?
- Does level 4 ship with scripted sub-agent reports (free) at launch, or is live multi-agent worth the cost from day one?
- Reuse Firebase project/infra from `prompt-injection-ctf`, or fully separate project?
- Hint system: same ladder style as sibling project, or level-specific?
