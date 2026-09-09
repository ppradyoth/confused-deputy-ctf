export type LevelId = "1" | "2" | "3" | "4";

export interface LevelMeta {
  id: LevelId;
  slug: string;
  title: string;
  tagline: string;
  owasp: string;
  atlas: string;
}

export interface ActResult {
  narration: string;
  toolInvoked: string | null;
  toolArgs: Record<string, string> | null;
  blocked: boolean;
  win: boolean;
  flag: string | null;
  reason: string;
}
