export type StudioMode = "metadata" | "prompt";

type PromptOptions = {
  mode: StudioMode;
  platform: string;
  promptStyle?: string;
  titleMin?: number;
  titleMax?: number;
  keywordMin?: number;
  keywordMax?: number;
  descriptionMin?: number;
  descriptionMax?: number;
  singleWordKeywords?: boolean;
  silhouetteMode?: boolean;
  customPrompt?: string;
  prohibitedWords?: string;
  titlePrefix?: string;
  titleSuffix?: string;
};

export function buildStudioPrompt(options: PromptOptions) {
  if (options.mode === "prompt") {
    return [
      "Analyze the supplied image and return one detailed, practical AI image-generation prompt.",
      `Style direction: ${options.promptStyle || "Original"}.`,
      "Mention subject, composition, lighting, material, color, mood, and any relevant visual details.",
      "Return plain text only. Do not add a title, markdown, preamble, or commentary.",
    ].join("\n");
  }

  const prohibited = options.prohibitedWords?.trim()
    ? `Avoid these words: ${options.prohibitedWords.trim()}.`
    : "";
  const custom = options.customPrompt?.trim() ? `Additional creator instruction: ${options.customPrompt.trim()}.` : "";

  return [
    `You are a senior ${options.platform} stock-metadata specialist. Analyze the supplied image and return valid JSON only.`,
    "Use exactly this object schema: {\"title\": string, \"keywords\": string[], \"description\": string, \"category\": string}.",
    `Write a natural title between ${options.titleMin ?? 6} and ${options.titleMax ?? 12} words.`,
    `Return ${options.keywordMin ?? 35} to ${options.keywordMax ?? 40} focused, search-friendly keywords, ordered from most important to least important.`,
    `Write a clear description between ${options.descriptionMin ?? 12} and ${options.descriptionMax ?? 30} words.`,
    options.singleWordKeywords ? "Prefer single-word keywords unless a precise multi-word term is essential." : "Multi-word keywords are allowed when they improve search relevance.",
    options.silhouetteMode ? "Treat the subject as a silhouette and avoid unsupported detail claims." : "",
    options.titlePrefix ? `Begin the title with: ${options.titlePrefix}.` : "",
    options.titleSuffix ? `End the title with: ${options.titleSuffix}.` : "",
    prohibited,
    custom,
  ].filter(Boolean).join("\n");
}

export function parseMetadataResult(output: string) {
  const normalizedOutput = output.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const parsed = JSON.parse(normalizedOutput) as { title?: unknown; keywords?: unknown; description?: unknown; category?: unknown };
  const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
  const description = typeof parsed.description === "string" ? parsed.description.trim() : "";
  const category = typeof parsed.category === "string" ? parsed.category.trim() : "";
  const keywords = Array.isArray(parsed.keywords)
    ? parsed.keywords.filter((keyword): keyword is string => typeof keyword === "string").map((keyword) => keyword.trim()).filter(Boolean)
    : [];
  if (!title || !description || !keywords.length) throw new Error("The AI response did not contain complete metadata.");
  return { title, description, keywords, category };
}
