/**
 * Constants for article generation defaults UI.
 * Used in project settings and app settings.
 */

export const ARTICLE_TYPES = [
  "listicle",
  "how-to",
  "guide",
  "tutorial",
  "news",
  "opinion",
  "editorial",
  "review",
  "comparison",
  "interview",
  "case-study",
  "explainer",
  "whitepaper",
  "report",
  "profile",
  "roundup",
  "story",
  "analysis",
  "research",
] as const;

export const ARTICLE_FORMATS = [
  "blog",
  "news",
  "magazine",
  "newsletter",
  "report",
  "whitepaper",
  "landing-page",
] as const;

export const CONTENT_LENGTHS = ["Short", "Medium", "Long", "Ultra-long"] as const;

export const TONES = [
  "Professional",
  "Conversational",
  "Authoritative",
  "Friendly",
  "Formal",
  "Casual",
  "Academic",
  "Journalistic",
  "Witty",
  "Empathetic",
  "Provocative",
] as const;

export const STYLES = [
  "Informative",
  "Persuasive",
  "Narrative",
  "Analytical",
  "Instructional",
  "Investigative",
  "Opinion-driven",
  "Data-driven",
  "Storytelling",
] as const;

export const READING_LEVELS = [
  "Elementary",
  "Intermediate",
  "Advanced",
  "Expert",
  "Technical",
] as const;

export const POINTS_OF_VIEW = [
  { value: "first-person", label: "First person" },
  { value: "second-person", label: "Second person" },
  { value: "third-person", label: "Third person" },
] as const;

export const CONTENT_INTENTS = [
  { value: "inform", label: "Inform" },
  { value: "persuade", label: "Persuade" },
  { value: "entertain", label: "Entertain" },
  { value: "sell", label: "Sell" },
  { value: "educate", label: "Educate" },
  { value: "inspire", label: "Inspire" },
  { value: "debate", label: "Debate" },
] as const;

export const CONTENT_FRESHNESS = [
  "Last week",
  "Last month",
  "Last quarter",
  "Evergreen",
] as const;

export const CITATION_STYLES = [
  "APA",
  "MLA",
  "Chicago",
  "Harvard",
  "IEEE",
  "footnote",
  "inline",
] as const;
