/**
 * Parses separate Answer Key sections and returns a Map<number, 'A' | 'B' | 'C' | 'D'>
 */

export function parseAnswerKeyText(answerKeyText: string): Map<number, 'A' | 'B' | 'C' | 'D'> {
  const answerMap = new Map<number, 'A' | 'B' | 'C' | 'D'>();
  if (!answerKeyText || !answerKeyText.trim()) return answerMap;

  // Clean answer key header
  let content = answerKeyText.replace(/^[\s\S]*?(?:ANSWER\s+KEY|Answer\s+Keys?|Correct\s+Answers?)[:\s\-]*/i, '');
  // Strip trailing exam notes/disclaimers
  content = content.replace(/(?:Exam\s+note|Note|Total\s+Marks)[\s\S]*$/i, '');

  // 1. Regex for matching patterns like: "1. C", "1) C", "1 - C", "1: C", "1. (C)", "1 C"
  const pairRegex = /(?:^|\s|,|;)(?:Q\.?\s*)?(\d{1,3})\s*[\.\)\:\-–—\s]\s*\(?([A-Da-d])\)?(?=\s|\d|,|;|$)/g;
  let match: RegExpExecArray | null;

  while ((match = pairRegex.exec(content)) !== null) {
    const qNum = parseInt(match[1], 10);
    const ans = match[2].toUpperCase() as 'A' | 'B' | 'C' | 'D';
    if (qNum > 0 && qNum <= 300 && ['A', 'B', 'C', 'D'].includes(ans)) {
      answerMap.set(qNum, ans);
    }
  }

  // 2. If standard regex found few answers, try row-based split (e.g. "1 C \n 2 C")
  if (answerMap.size === 0) {
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const lineMatch = line.trim().match(/^(?:Q\.?\s*)?(\d{1,3})\s*[\.\)\:\-–—\s]\s*\(?([A-Da-d])\)?/i);
      if (lineMatch) {
        const qNum = parseInt(lineMatch[1], 10);
        const ans = lineMatch[2].toUpperCase() as 'A' | 'B' | 'C' | 'D';
        if (qNum > 0 && qNum <= 300 && ['A', 'B', 'C', 'D'].includes(ans)) {
          answerMap.set(qNum, ans);
        }
      }
    }
  }

  return answerMap;
}
