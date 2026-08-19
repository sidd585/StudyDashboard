import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useUser } from '../context/UserContext';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { ProgressBar } from '../components/common/ProgressBar';
import {
  CheckCircle2,
  XCircle,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  HelpCircle,
  Check,
  X,
  Clock,
  Bookmark,
  AlertOctagon,
  ArrowRight,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { Question, QuizSession, QuizConfig } from '../types';

interface PracticeSessionProps {
  sessionId: string;
  onFinish: (sessionId: string) => void;
  onExit: () => void;
}

export const PracticeSession: React.FC<PracticeSessionProps> = ({ sessionId, onFinish, onExit }) => {
  const { currentUser } = useUser();
  const session = useLiveQuery(() => db.quizSessions.get(sessionId), [sessionId]);

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  // Results State
  const [resultsData, setResultsData] = useState<{
    total: number;
    correct: number;
    wrong: number;
    unanswered: number;
    accuracy: number;
    score: number;
    timeSpentFormatted: string;
    topicBreakdown: Record<string, { total: number; correct: number; pct: number }>;
    wrongQuestionIds: string[];
  } | null>(null);

  const questionIds = session?.questionIds || [];
  const currentQuestionId = questionIds[currentIndex];

  const currentQuestion = useLiveQuery(
    () => (currentQuestionId ? db.questions.get(currentQuestionId) : undefined),
    [currentQuestionId]
  );

  const isExamMode = session?.config?.mode === 'exam';
  const durationMinutes = session?.config?.durationMinutes || 45;
  const totalExamSeconds = durationMinutes * 60;
  const remainingSeconds = Math.max(0, totalExamSeconds - elapsedSeconds);

  // Timer Tick
  useEffect(() => {
    if (isCompleted) return;

    const timer = setInterval(() => {
      setElapsedSeconds(prev => {
        const next = prev + 1;
        if (isExamMode && next >= totalExamSeconds) {
          clearInterval(timer);
          finishPractice();
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isCompleted, isExamMode, totalExamSeconds]);

  // Sync state on question change
  useEffect(() => {
    if (!session || !currentQuestionId) return;
    const existing = session.answers[currentQuestionId];
    if (existing && existing.selectedOptionId) {
      setSelectedOption(existing.selectedOptionId);
      setIsAnswered(true);
    } else {
      setSelectedOption(null);
      setIsAnswered(false);
    }
  }, [currentIndex, currentQuestionId, session]);

  // Toggle Bookmark
  const handleToggleBookmark = async () => {
    if (!currentQuestion) return;
    await db.questions.update(currentQuestion.id, {
      isBookmarked: !currentQuestion.isBookmarked,
    });
  };

  // Toggle Difficult
  const handleToggleDifficult = async () => {
    if (!currentQuestion) return;
    await db.questions.update(currentQuestion.id, {
      isDifficult: !currentQuestion.isDifficult,
    });
  };

  // Handle Option Select
  const handleSelectOption = async (optionId: string) => {
    if (!currentQuestion || !session) return;
    if (isExamMode && isAnswered) {
      // Allow changing answer in exam mode before final submit
    } else if (isAnswered) {
      return;
    }

    setSelectedOption(optionId);
    setIsAnswered(true);

    const isCorrect = optionId === currentQuestion.correctOptionId;

    if (isCorrect && !isExamMode) {
      confetti({ particleCount: 30, spread: 60, origin: { y: 0.8 } });
    }

    // Record attempt
    await db.attempts.put({
      id: `attempt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      userId: currentUser.id,
      questionId: currentQuestion.id,
      sessionId: session.id,
      targetId: currentQuestion.targetId,
      subjectId: currentQuestion.subjectId,
      topicId: currentQuestion.topicId,
      selectedOptionId: optionId,
      correctOptionId: currentQuestion.correctOptionId,
      isCorrect,
      isSkipped: false,
      responseTimeMs: 5000,
      mode: isExamMode ? 'exam' : 'practice',
      timestamp: Date.now(),
    });

    // Update question stats
    await db.questions.update(currentQuestion.id, {
      'stats.totalAttempts': (currentQuestion.stats?.totalAttempts || 0) + 1,
      'stats.correctAttempts': (currentQuestion.stats?.correctAttempts || 0) + (isCorrect ? 1 : 0),
      'stats.wrongAttempts': (currentQuestion.stats?.wrongAttempts || 0) + (isCorrect ? 0 : 1),
      'stats.lastResult': isCorrect ? 'correct' : 'wrong',
      'stats.lastAttemptedAt': Date.now(),
    });

    // Save answer to session
    const updatedAnswers = {
      ...session.answers,
      [currentQuestion.id]: {
        selectedOptionId: optionId,
        isMarkedForReview: false,
        responseTimeMs: 5000,
        answeredAt: Date.now(),
      },
    };

    await db.quizSessions.update(session.id, {
      answers: updatedAnswers,
      currentQuestionIndex: currentIndex,
    });
  };

  const handleNext = () => {
    if (currentIndex < questionIds.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      finishPractice();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  // Finalize practice & compute results
  const finishPractice = async () => {
    if (!session) return;

    const allQuestions = await db.questions.where('id').anyOf(questionIds).toArray();
    const topicsList = await db.topics.toArray();

    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;
    const wrongIds: string[] = [];
    const topicBreakdown: Record<string, { total: number; correct: number; pct: number }> = {};

    allQuestions.forEach(q => {
      const topicName = topicsList.find(t => t.id === q.topicId)?.name || 'General';
      if (!topicBreakdown[topicName]) {
        topicBreakdown[topicName] = { total: 0, correct: 0, pct: 0 };
      }
      topicBreakdown[topicName].total += 1;

      const ans = session.answers[q.id];
      if (!ans || !ans.selectedOptionId) {
        unansweredCount += 1;
      } else if (ans.selectedOptionId === q.correctOptionId) {
        correctCount += 1;
        topicBreakdown[topicName].correct += 1;
      } else {
        wrongCount += 1;
        wrongIds.push(q.id);
      }
    });

    Object.keys(topicBreakdown).forEach(k => {
      const t = topicBreakdown[k];
      t.pct = t.total > 0 ? Math.round((t.correct / t.total) * 100) : 0;
    });

    const total = questionIds.length;
    const accuracy = (correctCount + wrongCount) > 0 ? Math.round((correctCount / (correctCount + wrongCount)) * 100) : 0;
    const score = (correctCount * 2) - (wrongCount * 0.4);

    const m = Math.floor(elapsedSeconds / 60);
    const s = elapsedSeconds % 60;
    const timeFormatted = `${m}m ${s < 10 ? '0' : ''}${s}s`;

    await db.quizSessions.update(session.id, {
      status: 'completed',
      completedAt: Date.now(),
      totalTimeSpentMs: elapsedSeconds * 1000,
    });

    setResultsData({
      total,
      correct: correctCount,
      wrong: wrongCount,
      unanswered: unansweredCount,
      accuracy,
      score: Math.max(0, Number(score.toFixed(1))),
      timeSpentFormatted: timeFormatted,
      topicBreakdown,
      wrongQuestionIds: wrongIds,
    });

    setIsCompleted(true);
  };

  // Launch wrong questions practice session
  const handlePracticeWrongQuestions = async () => {
    if (!resultsData || resultsData.wrongQuestionIds.length === 0) return;

    const newSessionId = `session-wrong-${Date.now()}`;
    const newConfig: QuizConfig = {
      mode: 'practice',
      title: `Revision: Wrong Questions (${resultsData.wrongQuestionIds.length} Qs)`,
      subjectIds: [],
      topicIds: [],
      questionCount: resultsData.wrongQuestionIds.length,
      marksPerCorrect: 1,
      negativeMarks: 0,
      shuffleQuestions: true,
      shuffleOptions: false,
      immediateFeedback: true,
    };

    await db.quizSessions.put({
      id: newSessionId,
      userId: currentUser.id,
      title: newConfig.title,
      mode: 'practice',
      status: 'in_progress',
      config: newConfig,
      questionIds: resultsData.wrongQuestionIds,
      answers: {},
      currentQuestionIndex: 0,
      startedAt: Date.now(),
      completedAt: null,
      totalTimeSpentMs: 0,
    });

    window.location.reload();
  };

  // Format Timer Strings
  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // ================= RESULTS SCREEN =================
  if (isCompleted && resultsData) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 pb-16 animate-fade-in">
        <Card className="p-8 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-brand-50 dark:bg-brand-950 border border-brand-500/30 text-brand-600 dark:text-brand-400 flex items-center justify-center mx-auto text-2xl">
            {resultsData.accuracy >= 75 ? '🎉' : '📊'}
          </div>

          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {isExamMode ? 'Exam Completed' : 'Practice Finished'}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Time Used: <strong>{resultsData.timeSpentFormatted}</strong> • {session?.title}
            </p>
          </div>

          {/* 4 Main Score Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Score</span>
              <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">{resultsData.score}</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Correct</span>
              <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">{resultsData.correct}</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-500/30">
              <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Wrong</span>
              <p className="text-xl font-extrabold text-rose-600 dark:text-rose-400 mt-0.5">{resultsData.wrong}</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-brand-50 dark:bg-brand-950/40 border border-brand-500/30">
              <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider">Accuracy</span>
              <p className="text-xl font-extrabold text-brand-600 dark:text-brand-400 mt-0.5">{resultsData.accuracy}%</p>
            </div>
          </div>

          {/* Topic-wise Breakdown */}
          <div className="text-left space-y-3 pt-2">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Topic-Wise Accuracy Breakdown
            </h4>
            <div className="space-y-2">
              {Object.entries(resultsData.topicBreakdown).map(([topName, data]) => (
                <div
                  key={topName}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between text-xs"
                >
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-xs">{topName}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500">{data.correct} / {data.total}</span>
                    <Badge variant={data.pct >= 75 ? 'success' : data.pct >= 50 ? 'warning' : 'danger'} size="sm">
                      {data.pct}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-4 border-t border-slate-200 dark:border-slate-800">
            {resultsData.wrongQuestionIds.length > 0 && (
              <Button
                variant="primary"
                size="lg"
                className="w-full font-bold"
                leftIcon={<RotateCcw className="w-4 h-4" />}
                onClick={handlePracticeWrongQuestions}
              >
                Practice {resultsData.wrongQuestionIds.length} Wrong Questions Now
              </Button>
            )}

            <Button
              variant="outline"
              size="lg"
              className="w-full font-semibold"
              onClick={onExit}
            >
              Back to Question Bank / Dashboard
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // ================= ACTIVE PRACTICE RUNNER =================
  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-16 animate-fade-in">
      {/* Top Runner Header Bar */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <button
          type="button"
          onClick={onExit}
          className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white"
        >
          ✕ Exit
        </button>

        <div className="text-xs font-bold text-slate-900 dark:text-white">
          Question {currentIndex + 1} of {questionIds.length}
        </div>

        {/* Live Countdown Clock for Exam Mode, or Elapsed for Practice */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-300 text-xs font-bold font-mono">
          <Clock className="w-3.5 h-3.5" />
          <span>{isExamMode ? `${formatCountdown(remainingSeconds)} Left` : formatCountdown(elapsedSeconds)}</span>
        </div>

        <Button variant="outline" size="sm" onClick={finishPractice}>
          Submit Test
        </Button>
      </div>

      {/* Question Card */}
      {currentQuestion ? (
        <Card className="p-6 sm:p-8 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-6">
          {/* Question Tag Bar */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-brand-600 dark:text-brand-400">#{currentIndex + 1}</span>
              <Badge variant={currentQuestion.difficulty === 'hard' ? 'danger' : 'warning'} size="sm">
                {currentQuestion.difficulty}
              </Badge>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleToggleBookmark}
                className={`p-1.5 rounded-lg border text-xs ${
                  currentQuestion.isBookmarked
                    ? 'bg-amber-50 dark:bg-amber-950 border-amber-400 text-amber-600'
                    : 'border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-600'
                }`}
                title="Bookmark Question"
              >
                <Bookmark className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Statement */}
          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-relaxed">
            {currentQuestion.questionText}
          </h3>

          {/* Options */}
          <div className="space-y-3">
            {currentQuestion.options.map(opt => {
              const isSelected = selectedOption === opt.id;
              const isCorrectAnswer = opt.id === currentQuestion.correctOptionId;

              let style = 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200';

              if (isExamMode) {
                // Exam Mode: Only show selected option, no answers revealed
                if (isSelected) {
                  style = 'bg-brand-50 dark:bg-brand-950/40 border-brand-500 text-brand-900 dark:text-brand-100 ring-1 ring-brand-500 font-semibold';
                }
              } else if (isAnswered) {
                // Practice Mode: Instant color feedback
                if (isCorrectAnswer) {
                  style = 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-200 font-semibold ring-1 ring-emerald-500';
                } else if (isSelected && !isCorrectAnswer) {
                  style = 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-900 dark:text-rose-200 font-semibold ring-1 ring-rose-500';
                }
              } else if (isSelected) {
                style = 'bg-brand-50 dark:bg-brand-950/40 border-brand-500 text-brand-900 dark:text-brand-100 ring-1 ring-brand-500';
              }

              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectOption(opt.id)}
                  className={`w-full p-4 rounded-xl border text-left text-xs sm:text-sm flex items-center gap-3.5 transition-all ${style}`}
                >
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                    isSelected ? 'bg-brand-600 text-white' : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600'
                  }`}>
                    {opt.id}
                  </span>
                  <span className="flex-1 leading-snug">{opt.text}</span>

                  {!isExamMode && isAnswered && isCorrectAnswer && (
                    <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                  )}
                  {!isExamMode && isAnswered && isSelected && !isCorrectAnswer && (
                    <X className="w-5 h-5 text-rose-600 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Explanation in Practice Mode */}
          {!isExamMode && isAnswered && currentQuestion.explanation && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 space-y-1">
              <span className="font-bold text-slate-900 dark:text-white">Explanation:</span>
              <p>{currentQuestion.explanation}</p>
            </div>
          )}

          {/* Bottom Navigation */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800/80">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<ChevronLeft className="w-4 h-4" />}
              onClick={handlePrev}
              disabled={currentIndex === 0}
            >
              Previous
            </Button>

            <Button
              variant="primary"
              size="sm"
              rightIcon={<ChevronRight className="w-4 h-4" />}
              onClick={handleNext}
            >
              {currentIndex === questionIds.length - 1 ? 'Finish & Submit' : 'Next Question'}
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="p-8 text-center text-slate-400">Loading question...</Card>
      )}
    </div>
  );
};
