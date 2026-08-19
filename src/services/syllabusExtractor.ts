import type { ExtractedTopicSection, ExtractedLessonItem } from '../types';
import { extractLinesFromPDF } from './import/pdfExtractor';

/**
 * Extracts structured Topics and Lessons from raw syllabus text or PDF.
 * Identifies Top-Level Units (e.g., "1", "Unit 1", "Paper 1", "1. Database Systems")
 * and Child Lessons (e.g., "1.1", "1.2", "1.1.1", "a)", "i.").
 */
export function parseSyllabusTextToHierarchy(rawText: string): ExtractedTopicSection[] {
  const lines = rawText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const sections: ExtractedTopicSection[] = [];
  let currentSection: ExtractedTopicSection | null = null;

  // Regex patterns
  // Top level: "1. Topic Name", "1 Topic Name", "Unit 1: Name", "Chapter 1", "Section 1", "Part 1"
  const topLevelRegex = /^(?:(?:Unit|Chapter|Section|Part|Topic)\s*(\d+|[I|V|X]+)[:.\s-]*|(\d+)\.|\b(\d+)\s+([A-Z][A-Za-z0-9\s&,/-]{3,}))/i;
  
  // Lesson level: "1.1 Lesson Name", "1.1.1 Sub", "a) Name", "(a) Name", "• Name", "- Name"
  const lessonRegex = /^(?:(\d+\.\d+(?:\.\d+)?)\s*[:.-]?\s*|(?:\(?([a-z]|[ivx]+)\)|[-*•])\s+)(.+)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if it's a sub-lesson first (like 1.1 or 3.2)
    const lessonMatch = line.match(lessonRegex);
    if (lessonMatch && currentSection) {
      const code = lessonMatch[1] || lessonMatch[2] || `${currentSection.lessons.length + 1}`;
      const name = (lessonMatch[3] || line).replace(/^[0-9.]+\s*/, '').trim();
      if (name.length > 0) {
        currentSection.lessons.push({
          code,
          name,
          sortOrder: currentSection.lessons.length + 1,
        });
      }
      continue;
    }

    // Check if it's a top-level unit/topic (e.g., "1. General Banking", "3. Communication and Network")
    const topMatch = line.match(topLevelRegex);
    const startsWithSingleNumber = /^[1-9]\s*[.:-]?\s+([A-Z].*)/.test(line);

    if (topMatch || startsWithSingleNumber) {
      let topicName = line;
      let topicCode = '';

      const numMatch = line.match(/^(\d+|Unit\s*\d+|Chapter\s*\d+)[:.\s-]*/i);
      if (numMatch) {
        topicCode = numMatch[1].replace(/^(Unit|Chapter)\s*/i, '').trim();
        topicName = line.slice(numMatch[0].length).trim();
      }

      if (!topicName || topicName.length < 2) {
        topicName = line;
      }

      currentSection = {
        code: topicCode || `${sections.length + 1}`,
        name: topicName,
        sortOrder: sections.length + 1,
        lessons: [],
      };
      sections.push(currentSection);
      continue;
    }

    // If we have an active section and this line is indented or looks like content, append as lesson
    if (currentSection && line.length > 3 && !line.toLowerCase().includes('syllabus') && !line.toLowerCase().includes('curriculum')) {
      currentSection.lessons.push({
        code: `${currentSection.code || sections.length}.${currentSection.lessons.length + 1}`,
        name: line.replace(/^[-*•]\s*/, '').trim(),
        sortOrder: currentSection.lessons.length + 1,
      });
    } else if (!currentSection && line.length > 4) {
      // First top-level topic fallback if text starts without number
      currentSection = {
        code: `${sections.length + 1}`,
        name: line,
        sortOrder: sections.length + 1,
        lessons: [],
      };
      sections.push(currentSection);
    }
  }

  // If no numbered sections matched at all, divide into default logical topics
  if (sections.length === 0 && rawText.trim().length > 0) {
    const rawLines = rawText.split(/\n+/).filter(l => l.trim().length > 2);
    const defaultTopic: ExtractedTopicSection = {
      code: '1',
      name: 'General Curriculum',
      sortOrder: 1,
      lessons: rawLines.map((l, idx) => ({
        code: `1.${idx + 1}`,
        name: l.trim(),
        sortOrder: idx + 1,
      })),
    };
    sections.push(defaultTopic);
  }

  return sections;
}

/**
 * Extracts syllabus text and parsed hierarchy from a File (PDF or plain text).
 */
export async function extractSyllabusFromFile(file: File): Promise<{
  rawText: string;
  sections: ExtractedTopicSection[];
  totalTopics: number;
  totalLessons: number;
}> {
  let rawText = '';

  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    const pdfResult = await extractLinesFromPDF(file);
    rawText = pdfResult.rawText;
  } else {
    rawText = await file.text();
  }

  const sections = parseSyllabusTextToHierarchy(rawText);
  const totalTopics = sections.length;
  const totalLessons = sections.reduce((acc, s) => acc + s.lessons.length, 0);

  return {
    rawText,
    sections,
    totalTopics,
    totalLessons,
  };
}
