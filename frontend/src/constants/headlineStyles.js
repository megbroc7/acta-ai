/**
 * Headline Style constants shared across PromptForm, PromptsList, and anywhere
 * else that needs to display or resolve content_type values.
 */

export const HEADLINE_STYLES = [
  {
    value: 'ai_selected',
    label: 'AI-Selected',
    description: 'Mix of all 5 styles — weighted random pick for scheduled posts',
  },
  {
    value: 'how_to',
    label: 'How-To',
    description: 'Actionable, instructional headlines ("How to...")',
  },
  {
    value: 'listicle',
    label: 'Listicle',
    description: 'Numbered lists with scannable value ("7 Ways to...")',
  },
  {
    value: 'experience',
    label: 'Experience',
    description: 'First-person, story-driven headlines ("I Tried X — Here\'s What Happened")',
  },
  {
    value: 'direct_benefit',
    label: 'Direct Benefit',
    description: 'Leads with the reader\'s outcome ("Rank on Page 1 in 90 Days")',
  },
  {
    value: 'contrarian',
    label: 'Contrarian',
    description: 'Challenges conventional wisdom ("Why X Is Wrong")',
  },
];

/** Maps legacy content_type values to valid headline styles. */
export const LEGACY_STYLE_MAP = {
  blog_post: 'ai_selected',
  article: 'ai_selected',
  tutorial: 'how_to',
  listicle: 'listicle',
  how_to: 'how_to',
  review: 'experience',
};

/**
 * Resolve any raw content_type value (including legacy) to a valid headline style.
 * Returns 'ai_selected' as the default for null/empty/unknown values.
 */
export function resolveHeadlineStyle(raw) {
  if (!raw) return 'ai_selected';
  const valid = HEADLINE_STYLES.map((s) => s.value);
  if (valid.includes(raw)) return raw;
  return LEGACY_STYLE_MAP[raw] || 'ai_selected';
}

/**
 * Return the user-friendly display label for a headline style value.
 * Falls back to the raw value (title-cased) if unknown.
 */
export function getStyleLabel(value) {
  const resolved = resolveHeadlineStyle(value);
  const style = HEADLINE_STYLES.find((s) => s.value === resolved);
  return style ? style.label : value;
}
