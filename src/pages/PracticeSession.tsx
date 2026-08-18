import React, { useState, useEffect, useRef } from 'react';
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
  ArrowRight,
} from 'lucide-react';
import confetti from 'canvas-confetti';
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

  // Results State
  const [resultsData, setResultsData] = useState<{
    total: number;
    correct: number;
    wrong: number;
    accuracy: number;
    wrongQuestionIds: string[];
    topWeakSubject?: string;
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
    const subjectErrors: Record<string, number> = {};

    allQuestions.forEach(q => {
      const ans = session.answers[q.id];
      if (ans && ans.selectedOptionId) {
        if (ans.selectedOptionId === q.correctOptionId) {
          correct++;
        } else {
          wrong++;
          wrongIds.push(q.id);
          if (q.subjectId) {
            subjectErrors[q.subjectId] = (subjectErrors[q.subjectId] || 0) + 1;
          }
        }
      }
    });

    const accuracy = correct + wrong > 0 ? Math.round((correct / (correct + wrong)) * 100) : 0;
    const totalTimeMs = Date.now() - sessionStartTime;
    const focusedMinutes = Math.max(1, Math.round(totalTimeMs / 60000));

    // Log automatic study session for the target!
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
        isAutoTracked: true,
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
      wrongQuestionIds: wrongIds,
    });

    setIsCompleted(true);
  };

  // 1. Completion / Results Summary View
  if (isCompleted && resultsData) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 py-6 animate-fade-in">
        <Card className="p-8 border-slate-800 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-brand-600/20 border border-brand-500/40 text-brand-400 mx-auto flex items-center justify-center">
            <Sparkles className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Practice Complete!</h2>
            <p className="text-xs text-slate-400 mt-1">Great job finishing your target practice session.</p>
          </div>

          <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase">Accuracy</p>
              <p className="text-2xl font-bold text-brand-400 mt-0.5">{resultsData.accuracy}%</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase">Correct</p>
              <p className="text-2xl font-bold text-emerald-400 mt-0.5">{resultsData.correct}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase">Wrong</p>
              <p className="text-2xl font-bold text-rose-400 mt-0.5">{resultsData.wrong}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            {resultsData.wrongQuestionIds.length > 0 && (
              <Button
                variant="warning"
                leftIcon={<RotateCcw className="w-4 h-4" />}
                onClick={() => {
                  setIsCompleted(false);
                  setCurrentIndex(0);
                }}
              >
                Practice Wrong Questions Again ({resultsData.wrongQuestionIds.length})
              </Button>
            )}
            <Button
              variant="primary"
              onClick={onExit}
            >
              Back to Dashboard
            </Button>
          </div>
        </Card>
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
        <span className="text-xs font-semibold text-slate-400">
          Question {currentIndex + 1} of {questionIds.length}
        </span>
        <Button variant="outline" size="xs" onClick={finishPractice}>
          Finish
        </Button>
      </div>

      <ProgressBar progress={progressPct} size="xs" />

      {/* Main Question Card */}
      <Card className="p-6 sm:p-8 border-slate-800 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-brand-400 uppercase tracking-wider">
              {currentQuestion.source || 'Nepal Exam Bank'}
            </span>
            <h3 className="text-lg sm:text-xl font-bold text-white leading-relaxed">
              {currentQuestion.questionText}
            </h3>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-3">
          {currentQuestion.options.map(option => {
            const isSelected = selectedOption === option.id;
            const isThisOptionCorrect = currentQuestion.correctOptionId === option.id;

            let optionStyle = 'border-slate-800 bg-slate-900/60 text-slate-200 hover:border-slate-700 hover:bg-slate-800/40';

            if (isAnswered) {
              if (isThisOptionCorrect) {
                optionStyle = 'border-emerald-500 bg-emerald-500/10 text-emerald-300 font-semibold';
              } else if (isSelected && !isThisOptionCorrect) {
                optionStyle = 'border-rose-500 bg-rose-500/10 text-rose-300 font-semibold';
              }
            } else if (isSelected) {
              optionStyle = 'border-brand-500 bg-brand-500/10 text-white';
            }

            return (
              <button
                key={option.id}
                onClick={() => handleSelectOption(option.id)}
                disabled={isAnswered}
                className={`w-full p-4 rounded-2xl border text-left flex items-center justify-between gap-4 transition-all ${optionStyle}`}
              >
                <div className="flex items-center gap-3.5">
                  <span className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold shrink-0">
                    {option.id}
                  </span>
                  <span className="text-sm">{option.text}</span>
                </div>

                {isAnswered && (
                  <div>
                    {isThisOptionCorrect ? (
                      <Check className="w-5 h-5 text-emerald-400" />
                    ) : isSelected ? (
                      <X className="w-5 h-5 text-rose-400" />
                    ) : null}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Solution Drawer (Revealed immediately upon answer) */}
        {isAnswered && (
          <div className={`p-4 rounded-2xl border animate-slide-up ${
            isCorrect ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-rose-500/5 border-rose-500/30'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {isCorrect ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-400" />
              )}
              <span className={`text-xs font-bold uppercase tracking-wider ${
                isCorrect ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {isCorrect ? 'Correct Answer!' : `Incorrect — Correct Answer is (${currentQuestion.correctOptionId})`}
              </span>
            </div>

            {currentQuestion.explanation && (
              <p className="text-xs text-slate-300 leading-relaxed pl-6">
                {currentQuestion.explanation}
              </p>
            )}
          </div>
        )}

        {/* Navigation Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
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
