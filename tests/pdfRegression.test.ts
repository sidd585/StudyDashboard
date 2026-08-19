import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { extractLinesFromPDF } from '../src/services/import/pdfExtractor';
import { parseMCQLines } from '../src/services/import/mcqStateMachineParser';
import { validateImportCandidates } from '../src/services/import/questionValidator';

describe('PDF Regression Test: NRB_PSC_Pre_Qualification_MCQs_Set_1.pdf', () => {
  const pdfPath = 'C:/Users/3395/.gemini/antigravity-ide/brain/eb8e0416-a338-4a5b-95c1-cc41b480043f/.user_uploaded/media_1787071301405.pdf';

  it('must extract exactly 50 separate MCQs with no merged questions, section headings as options, or leaked page markers', async () => {
    expect(fs.existsSync(pdfPath)).toBe(true);
    const pdfBytes = fs.readFileSync(pdfPath);

    const { lines, numPages, rawText } = await extractLinesFromPDF(pdfBytes);
    expect(numPages).toBe(8);

    const { questions, answerKeyMap } = parseMCQLines(lines, {
      sourceFileName: 'NRB_PSC_Pre_Qualification_MCQs_Set_1.pdf',
    });

    const result = validateImportCandidates(questions, numPages, rawText);

    console.log('Extracted numbers:', questions.map(q => q.originalQuestionNumber));
    console.log('Missing numbers:', result.diagnostics.missingNumbers);
    expect(result.diagnostics.totalDetected).toBe(50);
    expect(result.diagnostics.hasSequentialNumbers).toBe(true);
    expect(result.diagnostics.missingNumbers).toEqual([]);
    expect(result.diagnostics.duplicateNumbers).toEqual([]);

    // 2. Q1 STRUCTURAL INTEGRITY
    const q1 = questions.find(q => q.originalQuestionNumber === 1);
    expect(q1).toBeDefined();
    expect(q1?.questionText).toBe('Which of the following is a component of physical geography?');
    expect(q1?.options.length).toBe(4);
    expect(q1?.options[0].text).toBe('Population density');
    expect(q1?.options[1].text).toBe('Political boundaries');
    expect(q1?.options[2].text).toBe('Landforms');
    expect(q1?.options[3].text).toBe('Trade routes');
    expect(q1?.detectedAnswer).toBe('C');
    expect(q1?.status).toBe('valid');
    expect(q1?.confidence).toBe('high');

    // 3. Q2 STRUCTURAL INTEGRITY
    const q2 = questions.find(q => q.originalQuestionNumber === 2);
    expect(q2).toBeDefined();
    expect(q2?.questionText).toBe('Which physiographic region of Nepal generally has the highest altitude?');
    expect(q2?.options.length).toBe(4);
    expect(q2?.options[0].text).toBe('Terai');
    expect(q2?.options[1].text).toBe('Hill');
    expect(q2?.options[2].text).toBe('Mountain');
    expect(q2?.options[3].text).toBe('Inner Terai');
    expect(q2?.detectedAnswer).toBe('C');

    // 4. CROSS-PAGE CONTINUATION TESTS
    // Q16 starts on Page 2 and options B, C, D continue on Page 3
    const q16 = questions.find(q => q.originalQuestionNumber === 16);
    expect(q16).toBeDefined();
    expect(q16?.questionText).toBe('The supreme law of Nepal is the:');
    expect(q16?.options.length).toBe(4);
    expect(q16?.options[0].text).toBe('Civil Code');
    expect(q16?.options[1].text).toBe('Constitution');
    expect(q16?.options[2].text).toBe('Parliament Act');
    expect(q16?.options[3].text).toBe('Local Government Act');
    expect(q16?.detectedAnswer).toBe('B');

    // Q33 starts on Page 4 and options continue on Page 5
    const q33 = questions.find(q => q.originalQuestionNumber === 33);
    expect(q33).toBeDefined();
    expect(q33?.options.length).toBe(4);
    expect(q33?.options[0].text).toContain('Electronic/digital technologies in government services');
    expect(q33?.detectedAnswer).toBe('A');

    // Q41 starts on Page 5 and options continue on Page 6
    const q41 = questions.find(q => q.originalQuestionNumber === 41);
    expect(q41).toBeDefined();
    expect(q41?.options.length).toBe(4);
    expect(q41?.options[0].text).toBe('25');
    expect(q41?.options[1].text).toBe('40');
    expect(q41?.options[2].text).toBe('50');
    expect(q41?.options[3].text).toBe('75');
    expect(q41?.detectedAnswer).toBe('C');

    // 5. REGRESSION ANSWER-KEY VERIFICATION
    const answerChecklist: Record<number, 'A' | 'B' | 'C' | 'D'> = {
      1: 'C',
      2: 'C',
      3: 'B',
      10: 'D',
      25: 'A',
      41: 'C',
      48: 'C',
      49: 'B',
      50: 'A',
    };

    for (const [qNumStr, expectedAns] of Object.entries(answerChecklist)) {
      const qNum = parseInt(qNumStr, 10);
      const q = questions.find(item => item.originalQuestionNumber === qNum);
      expect(q?.detectedAnswer).toBe(expectedAns);
    }

    // 6. SANITY CHECKS: No merged questions or page markers leaked into statements
    for (const q of questions) {
      expect(q.questionText).not.toContain('--- Page');
      expect(q.questionText).not.toContain('ANSWER KEY');
      // Verify question text does not contain following question numbers like "\n17. "
      expect(q.questionText).not.toMatch(/\b(?:1[0-9]|2[0-9]|3[0-9]|4[0-9]|50)\.\s+[A-Z]/);
      for (const opt of q.options) {
        expect(opt.text).not.toContain('--- Page');
        expect(opt.text).not.toContain('ANSWER KEY');
      }
    }

    // 7. Q49 and Q50 font corruption detection
    const q49 = questions.find(q => q.originalQuestionNumber === 49);
    const q50 = questions.find(q => q.originalQuestionNumber === 50);
    expect(q49?.status).toBe('needs_review');
    expect(q49?.confidence).toBe('low');
    expect(q50?.status).toBe('needs_review');
    expect(q50?.confidence).toBe('low');
  });
});
