import { storage } from "../storage";
import type { EvidenceItem } from "@shared/schema";

export interface InjectedContext {
  text: string;
  count: number;
}

export async function getRelevantContext(
  userId: string,
  userPrompt: string,
): Promise<InjectedContext> {
  const allInsights = await storage.getEvidenceByInsightType(userId);

  if (allInsights.length === 0) {
    return { text: "", count: 0 };
  }

  const promptLower = userPrompt.toLowerCase();
  const promptWords = promptLower.split(/\s+/).filter((w) => w.length > 3);

  const scored: Array<{ item: EvidenceItem; score: number }> = [];

  for (const item of allInsights) {
    let score = 0;
    const titleLower = item.title.toLowerCase();
    const contentLower = item.content.toLowerCase();

    for (const word of promptWords) {
      if (titleLower.includes(word)) score += 3;
      if (contentLower.includes(word)) score += 1;
    }

    if (score > 0) {
      scored.push({ item, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const topItems = scored.slice(0, 10);

  if (topItems.length === 0) {
    return { text: "", count: 0 };
  }

  return {
    text: formatContextBlock(topItems.map((s) => s.item)),
    count: topItems.length,
  };
}

function formatContextBlock(items: EvidenceItem[]): string {
  if (items.length === 0) return "";

  const grouped: Record<string, EvidenceItem[]> = {};
  for (const item of items) {
    const type = item.insightType || "insight";
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push(item);
  }

  const sections: string[] = [];
  const typeLabels: Record<string, string> = {
    problem: "Known Problems",
    feature: "Feature Ideas",
    decision: "Past Decisions",
    insight: "Product Insights",
    question: "Open Questions",
  };

  for (const [type, label] of Object.entries(typeLabels)) {
    const typeItems = grouped[type];
    if (!typeItems || typeItems.length === 0) continue;
    const entries = typeItems
      .map((i) => `  - ${i.title}: ${i.content.slice(0, 200)}`)
      .join("\n");
    sections.push(`${label}:\n${entries}`);
  }

  return `[Context Brain — Accumulated Product Intelligence]\n${sections.join("\n\n")}`;
}
