import Link from "next/link";
import { LEVELS } from "@/lib/levels/registry";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-bold text-[var(--accent)]">Confused Deputy CTF</h1>
      <p className="mt-3 text-[var(--muted)]">
        Every level here is the same vulnerability wearing a different costume: an AI agent with
        legitimate authority, tricked into using it on the attacker&apos;s behalf. Four attack
        surfaces, one root cause.
      </p>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Runs entirely on rule-based mock agents by default — free, deterministic, no API keys
        required. Bring your own key later to try the same levels against a real model.
      </p>

      <ul className="mt-10 space-y-3">
        {LEVELS.map((level) => {
          const live = level.id === "1";
          const card = (
            <div
              className={`rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 transition ${
                live ? "hover:border-[var(--accent)]" : "opacity-50"
              }`}
            >
              <div className="flex items-baseline justify-between">
                <h2 className="font-semibold text-[var(--fg)]">
                  {level.id}. {level.title}
                </h2>
                {!live && <span className="text-xs text-[var(--muted)]">coming soon</span>}
              </div>
              <p className="mt-1 text-sm text-[var(--muted)]">{level.tagline}</p>
              <p className="mt-2 text-xs text-[var(--muted)]">
                {level.owasp} · {level.atlas}
              </p>
            </div>
          );
          return (
            <li key={level.id}>
              {live ? <Link href={`/levels/${level.id}`}>{card}</Link> : card}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
