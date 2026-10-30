export type KeywordCity = { gorod: string; vGorode: string };

export function renderKeywords(templates: string[], city: KeywordCity): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const template of templates) {
    const keyword = template
      .replaceAll('%город%', city.gorod)
      .replaceAll('%в_городе%', city.vGorode)
      .trim();
    if (keyword === '' || seen.has(keyword)) continue;
    seen.add(keyword);
    out.push(keyword);
  }
  return out;
}

export function toKeywordsCsv(keywords: string[]): string {
  if (keywords.length === 0) return '';
  return keywords.join('\n') + '\n';
}
