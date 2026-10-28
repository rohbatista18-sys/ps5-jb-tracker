// Shared by server and client. Only these keys are accepted by the API, so only positive emojis exist.
export const REACTIONS = [
  { key: "heart", emoji: "❤️" },
  { key: "clap", emoji: "👏" },
  { key: "rocket", emoji: "🚀" },
  { key: "fire", emoji: "🔥" },
  { key: "muscle", emoji: "💪" },
  { key: "pray", emoji: "🙏" },
  { key: "party", emoji: "🎉" },
  { key: "trophy", emoji: "🏆" },
] as const;

export type ReactionKey = (typeof REACTIONS)[number]["key"];
export type ReactionCounts = Record<ReactionKey, number>;

export const isReactionKey = (v: unknown): v is ReactionKey => REACTIONS.some((r) => r.key === v);

export const emptyCounts = () => Object.fromEntries(REACTIONS.map((r) => [r.key, 0])) as ReactionCounts;
