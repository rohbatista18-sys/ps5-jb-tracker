// Shared by server and client. Only these keys are accepted by the API, so only positive emojis exist.
// `only` restricts a reaction to one dev's card; `shout` is shown above the visitor's sprite on click.
interface ReactionDef {
  key: string;
  emoji: string;
  only?: "zig" | "pasta" | "kuzi";
  shout?: string;
}

export const REACTIONS = [
  { key: "heart", emoji: "❤️" },
  { key: "clap", emoji: "👏" },
  { key: "rocket", emoji: "🚀" },
  { key: "fire", emoji: "🔥" },
  { key: "muscle", emoji: "💪" },
  { key: "pray", emoji: "🙏" },
  { key: "party", emoji: "🎉" },
  { key: "trophy", emoji: "🏆" },
  { key: "brazil", emoji: "🇧🇷", only: "pasta", shout: "Garotas Brazileiras <3" },
] as const satisfies readonly ReactionDef[];

export type Reaction = (typeof REACTIONS)[number];
export type ReactionKey = Reaction["key"];
export type ReactionCounts = Record<ReactionKey, number>;

/** Each person (IP) can send this many salves per clock hour, across all devs. */
export const REACTION_QUOTA = 3;

/**
 * Estimated totals from before the counters moved to Supabase (the real ones are locked in the
 * over-quota Upstash database). Added on top of the stored counts for display only; replace with
 * the real totals once Upstash can be read again.
 */
export const reactionBaseline = (key: ReactionKey) => (key === "brazil" ? 1000 : 500);

/** Window event fired on a reaction click; PixelCrowd shows the emoji (and shout) above the visitor's own sprite. */
export const EMOTE_EVENT = "ps5jb:emote";
export interface EmoteDetail {
  key: ReactionKey;
}

export const isReactionKey = (v: unknown): v is ReactionKey => REACTIONS.some((r) => r.key === v);

export const reactionsFor = (repo: string): Reaction[] =>
  REACTIONS.filter((r) => !("only" in r) || r.only === repo);

export const isReactionAllowed = (repo: string, key: ReactionKey) => reactionsFor(repo).some((r) => r.key === key);

export const emptyCounts = () => Object.fromEntries(REACTIONS.map((r) => [r.key, 0])) as ReactionCounts;
