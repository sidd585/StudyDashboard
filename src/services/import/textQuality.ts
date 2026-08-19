/**
 * Analyzes extracted text quality and detects corrupted font encodings (e.g. repeating 'n n n n' or '□' or '').
 */

export interface TextQualityAnalysis {
  isCorrupted: boolean;
  corruptionType?: 'unmapped_glyphs' | 'repeating_placeholders' | 'low_alpha_ratio' | 'empty';
  qualityScore: number; // 0 (completely corrupted) to 1 (clean)
  issues: string[];
}

export function analyzeTextQuality(text: string): TextQualityAnalysis {
  if (!text || text.trim().length === 0) {
    return {
      isCorrupted: true,
      corruptionType: 'empty',
      qualityScore: 0,
      issues: ['Empty text content.'],
    };
  }

  const issues: string[] = [];
  const clean = text.trim();

  // 1. Check for standard unmapped replacement glyphs
  const replacementGlyphCount = (clean.match(/[□■\uFFFD]/g) || []).length;
  if (replacementGlyphCount > 2) {
    issues.push(`Detected ${replacementGlyphCount} unmapped glyph symbols (/□).`);
    return {
      isCorrupted: true,
      corruptionType: 'unmapped_glyphs',
      qualityScore: 0.2,
      issues,
    };
  }

  // 2. Check for repeating font placeholders (e.g. 'nnnnnn nnnnnn “ nnnn ” nn nnnnnnnnnn' common in missing Nepali PDF fonts)
  const repeatingNPattern = /\b(?:n{3,}|(?:n\s+){4,})\b/i;
  const nMatches = clean.match(/\bn+\b/gi) || [];
  const totalWords = clean.split(/\s+/).length;
  
  if (repeatingNPattern.test(clean) || (totalWords >= 5 && nMatches.length / totalWords > 0.4)) {
    issues.push('Detected repeating placeholder glyphs (corrupted font mapping).');
    return {
      isCorrupted: true,
      corruptionType: 'repeating_placeholders',
      qualityScore: 0.1,
      issues,
    };
  }

  // 3. Usable character ratio
  const usableChars = clean.replace(/[\s\d\p{P}]/gu, '');
  if (usableChars.length === 0 && clean.length > 10) {
    issues.push('Very low readable character ratio.');
    return {
      isCorrupted: true,
      corruptionType: 'low_alpha_ratio',
      qualityScore: 0.3,
      issues,
    };
  }

  return {
    isCorrupted: false,
    qualityScore: 1.0,
    issues: [],
  };
}
