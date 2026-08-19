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
  Sparkles,
  HelpCircle,
  Check,
  X,
  Clock,
  Bookmark,
  AlertOctagon,
  ArrowRight,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { AIStudyBuilderModal } from '../components/ai/AIStudyBuilderModal';
import type { Question, QuizSession } from '../types';

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
  const [sessionStartTime] = useState<number>(Date.now());
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState<boolean>(false);

  // Results State
  const [resultsData, setResultsData] = useState<{
    total: number;
    correct: number;
    wrong: number;
    accuracy: number;
    timeSpentFormatted: string;
    avgTimePerQuestion: string;
    topicBreakdown: Record<string, { total: number; correct: number; pct: number }>;
    wrongQuestionIds: string[];
    topWeakTopic?: string;
  } | null>(null);

  const questionIds = session?.questionIds || [];
  const currentQuestionId = questionIds[currentIndex];

  const currentQuestion = useLiveQuery(
    () => (currentQuestionId ? db.questions.get(currentQuestionId) : undefined),
    [currentQuestionId]
  );

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
    if (isAnswered || !currentQuestion || !session) return;

    setSelectedOption(optionId);
    setIsAnswered(true);

    const isCorrect = optionId === currentQuestion.correctOptionId;

    if (isCorrect) {
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
      mode: 'practice',
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

  const finishPractice = async () => {
    if (!session) return;

    const allQuestions = await db.questions.where('id').anyOf(session.questionIds).toArray();
    let correct = 0;
    let wrong = 0;
    const wrongIds: string[] = [];
    const topicStats: Record<string, { total: number; correct: number; pct: number }> = {};

    allQuestions.forEach(q => {
      const topicKey = q.tags?.[0] || 'General Subject';
      if (!topicStats[topicKey]) {
        topicStats[topicKey] = { total: 0, correct: 0, pct: 0 };
      }
      topicStats[topicKey].total += 1;

      const ans = session.answers[q.id];
      if (ans && ans.selectedOptionId) {
        if (ans.selectedOptionId === q.correctOptionId) {
          correct++;
          topicStats[topicKey].correct += 1;
        } else {
          wrong++;
          wrongIds.push(q.id);
        }
      }
    });

    // Calculate percentage per topic
    Object.keys(topicStats).forEach(key => {
      const item = topicStats[key];
      item.pct = item.total > 0 ? Math.round((item.correct / item.total) * 100) : 0;
    });

    // Determine top weak topic
    let topWeakTopic: string | undefined = undefined;
    let lowestPct = 100;
    Object.entries(topicStats).forEach(([top, st]) => {
      if (st.total >= 1 && st.pct < lowestPct) {
        lowestPct = st.pct;
        topWeakTopic = top;
      }
    });

    const accuracy = correct + wrong > 0 ? Math.round((correct / (correct + wrong)) * 100) : 0;
    const totalTimeMs = Date.now() - sessionStartTime;
    const focusedMinutes = Math.max(1, Math.round(totalTimeMs / 60000));
    const avgSecsPerQ = questionIds.length > 0 ? Math.round(totalTimeMs / (questionIds.length * 1000)) : 0;

    // Log automatic study session for the target
    if (session.targetId) {
      await db.studySessions.put({
        id: `sess-mcq-${Date.now()}`,
        userId: currentUser.id,
        targetId: session.targetId,
        activityType: 'MCQ Practice',
        startTime: sessionStartTime,
        endTime: Date.now(),
        focusedMinutes,
        breakMinutes: 0,
        focusRating: accuracy >= 75 ? 5 : 4,
        notes: `Practiced ${questionIds.length} MCQs (${accuracy}% accuracy).`,
        createdAt: Date.now(),
      });
    }

    await db.quizSessions.update(session.id, {
      status: 'completed',
      completedAt: Date.now(),
      totalTimeSpentMs: totalTimeMs,
      score: correct,
      accuracy,
      netScore: correct,
    });

    setResultsData({
      total: questionIds.length,
      correct,
      wrong,
      accuracy,
      timeSpentFormatted: `${Math.floor(focusedMinutes)}m`,
      avgTimePerQuestion: `${avgSecsPerQ}s`,
      topicBreakdown: topicStats,
      wrongQuestionIds: wrongIds,
      topWeakTopic,
    });

    setIsCompleted(true);
  };

  // 1. Completion / Results View with Topic Accuracy Breakdown
  if (isCompleted && resultsData) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 py-6 animate-fade-in">
        <Card className="p-8 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Practice Complete!</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Your practice attempt has been recorded in your study analytics.
            </p>
          </div>

          {/* 4 Score Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-center">
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase">Accuracy</p>
              <p className="text-2xl font-bold text-brand-600 dark:text-brand-400 mt-0.5">{resultsData.accuracy}%</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase">Correct</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{resultsData.correct}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase">Wrong</p>
              <p className="text-2xl font-bold text-rose-500 mt-0.5">{resultsData.wrong}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase">Avg / Question</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">{resultsData.avgTimePerQuestion}</p>
            </div>
          </div>

          {/* Breakdown by Topic */}
          {Object.keys(resultsData.topicBreakdown).length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Topic Breakdown
              </h4>
              <div className="space-y-2">
                {Object.entries(resultsData.topicBreakdown).map(([top, st]) => (
                  <div
                    key={top}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white">{top}</span>
                      <p className="text-[10px] text-slate-400">{st.correct} / {st.total} correct</p>
                    </div>
                    <Badge variant={st.pct >= 75 ? 'success' : st.pct >= 50 ? 'warning' : 'danger'}>
                      {st.pct}%
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-2">
            <div className="flex flex-col sm:flex-row gap-2.5">
              {resultsData.wrongQuestionIds.length > 0 && (
                <Button
                  variant="warning"
                  className="flex-1"
                  leftIcon={<RotateCcw className="w-4 h-4" />}
                  onClick={() => {
                    setIsCompleted(false);
                    setCurrentIndex(0);
                  }}
                >
                  Practice Wrong Questions ({resultsData.wrongQuestionIds.length})
                </Button>
              )}

              <Button
                variant="outline"
                className="flex-1 border-amber-500/30 text-amber-600 dark:text-amber-300"
                leftIcon={<Sparkles className="w-4 h-4 text-amber-500" />}
                onClick={() => setIsAIModalOpen(true)}
              >
                Build AI Revision Set
              </Button>
            </div>

            <Button
              variant="primary"
              className="w-full"
              onClick={onExit}
            >
              Back to Dashboard
            </Button>
          </div>
        </Card>

        {/* AI Revision Builder Modal */}
        <AIStudyBuilderModal
          isOpen={isAIModalOpen}
          onClose={() => setIsAIModalOpen(false)}
          initialTargetId={session?.targetId}
        />
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="text-center py-12 text-slate-400">
        Loading question...
      </div>
    );
  }

  const isCorrect = selectedOption === currentQuestion.correctOptionId;
  const progressPct = Math.round(((currentIndex + 1) / questionIds.length) * 100);

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-12 animate-fade-in">
      {/* Top Header Progress */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="xs" onClick={onExit}>
          ✕ Exit Practice
        </Button>
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          Question {currentIndex + 1} of {questionIds.length}
        </span>
        <Button variant="outline" size="xs" onClick={finishPractice}>
          Finish Practice
        </Button>
      </div>

      <ProgressBar progress={progressPct} size="xs" />

      {/* Main Question Card */}
      <Card className="p-6 sm:p-8 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider">
                {currentQuestion.source || 'Exam Bank'}
              </span>
              {currentQuestion.difficulty && (
                <Badge variant={currentQuestion.difficulty === 'easy' ? 'success' : currentQuestion.difficulty === 'medium' ? 'warning' : 'danger'}>
                  {currentQuestion.difficulty}
                </Badge>
              )}
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-relaxed">
              {currentQuestion.questionText}
            </h3>
          </div>

          {/* Quick Question Tools (Bookmark, Flag Difficult) */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleToggleBookmark}
              className={`p-2 rounded-xl border transition-colors ${
                currentQuestion.isBookmarked
                  ? 'border-amber-500 bg-amber-500/10 text-amber-500'
                  : 'border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-600'
              }`}
              title="Bookmark Question"
            >
              <Bookmark className={`w-4 h-4 ${currentQuestion.isBookmarked ? 'fill-current' : ''}`} />
            </button>

            <button
              onClick={handleToggleDifficult}
              className={`p-2 rounded-xl border transition-colors ${
                currentQuestion.isDifficult
                  ? 'border-rose-500 bg-rose-500/10 text-rose-500'
                  : 'border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-600'
              }`}
              title="Mark as Difficult"
            >
              <AlertOctagon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-3">
          {currentQuestion.options.map(option => {
            const isSelected = selectedOption === option.id;
            const isThisOptionCorrect = currentQuestion.correctOptionId === option.id;

            let optionStyle = 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700';

            if (isAnswered) {
              if (isThisOptionCorrect) {
                optionStyle = 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold ring-1 ring-emerald-500';
              } else if (isSelected && !isThisOptionCorrect) {
                optionStyle = 'border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300 font-semibold ring-1 ring-rose-500';
              }
            } else if (isSelected) {
              optionStyle = 'border-brand-500 bg-brand-500/10 text-brand-700 dark:text-white ring-1 ring-brand-500';
            }

            return (
              <button
                key={option.id}
                onClick={() => handleSelectOption(option.id)}
                disabled={isAnswered}
                className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between gap-4 transition-all ${optionStyle}`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs font-bold shrink-0">
                    {option.id}
                  </span>
                  <span className="text-xs sm:text-sm font-medium">{option.text}</span>
                </div>

                {isAnswered && (
                  <div>
                    {isThisOptionCorrect ? (
                      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    ) : isSelected ? (
                      <X className="w-4 h-4 text-rose-500" />
                    ) : null}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Solution Drawer (Instant explanation) */}
        {isAnswered && (
          <div className={`p-4 rounded-2xl border animate-slide-up ${
            isCorrect ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-rose-500/5 border-rose-500/30'
          }`}>
            <div className="flex items-center gap-2 mb-1.5">
              {isCorrect ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-500" />
              )}
              <span className={`text-xs font-bold uppercase tracking-wider ${
                isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}>
                {isCorrect ? 'Correct Answer!' : `Incorrect — Correct Answer is Option ${currentQuestion.correctOptionId}`}
              </span>
            </div>

            {currentQuestion.explanation && (
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed pl-6">
                {currentQuestion.explanation}
              </p>
            )}
          </div>
        )}

        {/* Navigation Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
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
            {currentIndex === questionIds.length - 1 ? 'Finish Practice' : 'Next Question'}
          </Button>
        </div>
      </Card>
    </div>
  );
};
