import type {
  Question,
  QuizSession,
  Attempt,
  QuestionOption,
} from '../types';

export interface ScoreReport {
  totalQuestions: number;
  attemptedCount: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  markedForReviewCount: number;
  accuracy: number; // 0 - 100%
  grossScore: number;
  negativeMarks: number;
  netScore: number;
  maxPossibleScore: number;
  percentageScore: number;
  totalTimeSpentMs: number;
  avgTimePerQuestionMs: number;
  breakdowns: {
    byTarget: Record<string, BreakdownItem>;
    bySubject: Record<string, BreakdownItem>;
    byTopic: Record<string, BreakdownItem>;
  };
}

export interface BreakdownItem {
  id: string;
  name: string;
  total: number;
  correct: number;
  wrong: number;
  unanswered: number;
  accuracy: number;
  score: number;
  timeSpentMs: number;
}

/**
 * Calculates full scorecard and performance metrics for a completed quiz/exam session.
 */
export function calculateQuizResults(
  session: QuizSession,
  questionsMap: Map<string, Question>,
  targetsMap: Map<string, string>,
  subjectsMap: Map<string, string>,
  topicsMap: Map<string, string>
): ScoreReport {
  const marksPerCorrect = session.config.marksPerCorrect ?? 1;
  const negativeMarks = session.config.negativeMarks ?? 0.25;

  let correctCount = 0;
  let wrongCount = 0;
  let unansweredCount = 0;
  let markedForReviewCount = 0;
  let totalTimeMs = 0;

  const byTarget: Record<string, BreakdownItem> = {};
  const bySubject: Record<string, BreakdownItem> = {};
  const byTopic: Record<string, BreakdownItem> = {};

  const ensureBreakdown = (map: Record<string, BreakdownItem>, id: string, name: string) => {
    if (!map[id]) {
      map[id] = {
        id,
        name: name || 'Unknown',
        total: 0,
        correct: 0,
        wrong: 0,
        unanswered: 0,
        accuracy: 0,
        score: 0,
        timeSpentMs: 0,
      };
    }
    return map[id];
  };

  session.questionIds.forEach((qId: string) => {
    const question = questionsMap.get(qId);
    const answer = session.answers[qId];

    const targetId = question?.targetId || 'unknown';
    const subjectId = question?.subjectId || 'unknown';
    const topicId = question?.topicId || 'unknown';

    const targetName = targetsMap.get(targetId) || 'Unknown Target';
    const subjectName = subjectsMap.get(subjectId) || 'Unknown Subject';
    const topicName = topicsMap.get(topicId) || 'Unknown Topic';

    const targetItem = ensureBreakdown(byTarget, targetId, targetName);
    const subjectItem = ensureBreakdown(bySubject, subjectId, subjectName);
    const topicItem = ensureBreakdown(byTopic, topicId, topicName);

    [targetItem, subjectItem, topicItem].forEach(item => item.total++);

    const responseTime = answer?.responseTimeMs || 0;
    totalTimeMs += responseTime;
    [targetItem, subjectItem, topicItem].forEach(item => (item.timeSpentMs += responseTime));

    if (answer?.isMarkedForReview) {
      markedForReviewCount++;
    }

    if (!answer || !answer.selectedOptionId) {
      unansweredCount++;
      [targetItem, subjectItem, topicItem].forEach(item => item.unanswered++);
    } else {
      const isCorrect = question ? answer.selectedOptionId === question.correctOptionId : false;
      if (isCorrect) {
        correctCount++;
        [targetItem, subjectItem, topicItem].forEach(item => {
          item.correct++;
          item.score += marksPerCorrect;
        });
      } else {
        wrongCount++;
        [targetItem, subjectItem, topicItem].forEach(item => {
          item.wrong++;
          item.score -= negativeMarks;
        });
      }
    }
  });

  // Compute accuracies
  const finalizeBreakdowns = (map: Record<string, BreakdownItem>) => {
    Object.values(map).forEach(item => {
      const attempted = item.correct + item.wrong;
      item.accuracy = attempted > 0 ? Math.round((item.correct / attempted) * 100) : 0;
      item.score = Number(Math.max(0, item.score).toFixed(2));
    });
  };

  finalizeBreakdowns(byTarget);
  finalizeBreakdowns(bySubject);
  finalizeBreakdowns(byTopic);

  const totalQuestions = session.questionIds.length;
  const attemptedCount = correctCount + wrongCount;
  const accuracy = attemptedCount > 0 ? Math.round((correctCount / attemptedCount) * 100) : 0;
  const grossScore = correctCount * marksPerCorrect;
  const totalNegativeDeduction = Number((wrongCount * negativeMarks).toFixed(2));
  const netScore = Number(Math.max(0, grossScore - totalNegativeDeduction).toFixed(2));
  const maxPossibleScore = totalQuestions * marksPerCorrect;
  const percentageScore = maxPossibleScore > 0 ? Math.round((netScore / maxPossibleScore) * 100) : 0;
  const avgTimePerQuestionMs = totalQuestions > 0 ? Math.round(totalTimeMs / totalQuestions) : 0;

  return {
    totalQuestions,
    attemptedCount,
    correctCount,
    wrongCount,
    unansweredCount,
    markedForReviewCount,
    accuracy,
    grossScore,
    negativeMarks: totalNegativeDeduction,
    netScore,
    maxPossibleScore,
    percentageScore,
    totalTimeSpentMs: totalTimeMs,
    avgTimePerQuestionMs,
    breakdowns: {
      byTarget,
      bySubject,
      byTopic,
    },
  };
}

/**
 * Fisher-Yates shuffle for options while maintaining correctOptionId integrity
 */
export function shuffleQuestionOptions(question: Question): Question {
  if (!question.options || question.options.length <= 1) return question;

  const originalOptions = [...question.options];
  const originalCorrectOption = originalOptions.find(o => o.id === question.correctOptionId);

  // Shuffle text options
  const shuffledTexts = originalOptions.map(o => o.text);
  for (let i = shuffledTexts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledTexts[i], shuffledTexts[j]] = [shuffledTexts[j], shuffledTexts[i]];
  }

  const optionLabels = ['A', 'B', 'C', 'D', 'E', 'F'];
  const newOptions: QuestionOption[] = shuffledTexts.map((text, idx) => ({
    id: optionLabels[idx] || `${idx + 1}`,
    text,
  }));

  let newCorrectId = question.correctOptionId;
  if (originalCorrectOption) {
    const newCorrectIdx = newOptions.findIndex(o => o.text === originalCorrectOption.text);
    if (newCorrectIdx !== -1) {
      newCorrectId = newOptions[newCorrectIdx].id;
    }
  }

  return {
    ...question,
    options: newOptions,
    correctOptionId: newCorrectId,
  };
}
