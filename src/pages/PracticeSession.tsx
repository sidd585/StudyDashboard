import React, { useState, useEffect, useRef } from 'react';
import { useUser } from '../context/UserContext';
import { practiceService } from '../services/practiceService';
import type { CloudQuestion } from '../lib/supabase';
import type { QuizConfig } from '../types';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import {
  CheckCircle2,
  Clock,
  Bookmark,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface PracticeSessionProps {
  sessionPayload: {
    config: QuizConfig;
    questions: CloudQuestion[];
  };
  onFinish: () => void;
  onExit: () => void;
}

export const PracticeSession: React.FC<PracticeSessionProps> = ({
  sessionPayload,
  onFinish,
  onExit,
}) => {
  const { currentUser } = useUser();
  const { config, questions } = sessionPayload;

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [markedForReview, setMarkedForReview] = useState<Record<string, boolean>>({});
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Results State
  const [resultsData, setResultsData] = useState<{
    total: number;
    correct: number;
    wrong: number;
    unanswered: number;
    score: number;
    accuracy: number;
    timeSpentFormatted: string;
  } | null>(null);

  const isExamMode = config.mode === 'exam';
  const durationMinutes = config.durationMinutes || 30;
  const totalExamSeconds = durationMinutes * 60;

  // Persistent Timestamps
  const startTimeRef = useRef<number>(Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // Timer Tick
  useEffect(() => {
    if (isCompleted) return;

    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsedSeconds(elapsed);

      if (isExamMode && elapsed >= totalExamSeconds) {
        clearInterval(timer);
        handleFinishSession();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isCompleted, isExamMode, totalExamSeconds]);

  const currentQuestion = questions[currentIndex];
  const remainingSeconds = Math.max(0, totalExamSeconds - elapsedSeconds);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSelectOption = (optionKey: 'A' | 'B' | 'C' | 'D') => {
    if (!currentQuestion || isCompleted) return;
    setSelectedAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: optionKey,
    }));
  };

  const toggleMarkForReview = () => {
    if (!currentQuestion) return;
    setMarkedForReview(prev => ({
      ...prev,
      [currentQuestion.id]: !prev[currentQuestion.id],
    }));
  };

  // Submit and Calculate Score
  const handleFinishSession = async () => {
    if (isSubmitting || isCompleted) return;
    setIsSubmitting(true);

    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;

    const answerDetails = questions.map(q => {
      const chosen = selectedAnswers[q.id] || null;
      const correctAns = q.correct_answer?.trim().toUpperCase();
      const isCorrect = Boolean(chosen && correctAns && chosen === correctAns);

      if (!chosen) {
        unansweredCount++;
      } else if (isCorrect) {
        correctCount++;
      } else {
        wrongCount++;
      }

      return {
        questionId: q.id,
        selectedOption: chosen,
        isCorrect,
        markedForReview: Boolean(markedForReview[q.id]),
      };
    });

    const netScore = Math.max(
      0,
      Number((correctCount * (config.marksPerCorrect || 1) - wrongCount * (config.negativeMarks || 0.25)).toFixed(2))
    );
    const accuracy = correctCount + wrongCount > 0
      ? Math.round((correctCount / (correctCount + wrongCount)) * 100)
      : 0;

    // Record in Supabase
    try {
      if (config.courseId) {
        await practiceService.recordPracticeSession({
          courseId: config.courseId,
          mode: isExamMode ? 'TIMED' : 'PRACTICE',
          questionIds: questions.map(q => q.id),
          durationSeconds: elapsedSeconds,
          score: netScore,
          correctCount,
          wrongCount,
          unansweredCount,
          answers: answerDetails,
        });
      }
    } catch (err) {
      console.error('Error saving practice attempt:', err);
    }

    setResultsData({
      total: questions.length,
      correct: correctCount,
      wrong: wrongCount,
      unanswered: unansweredCount,
      score: netScore,
      accuracy,
      timeSpentFormatted: formatTimer(elapsedSeconds),
    });

    setIsCompleted(true);
    setIsSubmitting(false);

    if (accuracy >= 70) {
      confetti({ particleCount: 50, spread: 70, origin: { y: 0.6 } });
    }
  };

  // Option text resolution
  const getOptionText = (q: CloudQuestion, opt: 'A' | 'B' | 'C' | 'D') => {
    switch (opt) {
      case 'A': return q.option_a;
      case 'B': return q.option_b;
      case 'C': return q.option_c;
      case 'D': return q.option_d;
    }
  };

  // CASE 1: Results Scorecard Screen
  if (isCompleted && resultsData) {
    return (
      <div className="max-w-3xl mx-auto py-8 px-4 space-y-6 animate-fade-in text-[#101828] dark:text-[#f8f9fc]">
        <Card className="p-8 border-[#e2e8f0] dark:border-[#23293d] bg-white dark:bg-[#141824] shadow-xs text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 flex items-center justify-center mx-auto text-2xl font-bold">
            ✓
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-extrabold text-[#101828] dark:text-white">
              Practice Session Completed!
            </h2>
            <p className="text-xs text-[#64748b] dark:text-[#9496a8]">
              {config.title} · Time Spent: {resultsData.timeSpentFormatted}
            </p>
          </div>

          {/* 4 Stat Boxes */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-4 rounded-xl bg-[#f8fafc] dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d]">
              <span className="text-xs font-bold text-[#64748b] uppercase">Score</span>
              <div className="text-2xl font-extrabold text-[#5b5bd6] dark:text-[#8282ea] mt-1">{resultsData.score}</div>
            </div>
            <div className="p-4 rounded-xl bg-[#f8fafc] dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d]">
              <span className="text-xs font-bold text-[#64748b] uppercase">Accuracy</span>
              <div className="text-2xl font-extrabold text-[#12b76a] mt-1">{resultsData.accuracy}%</div>
            </div>
            <div className="p-4 rounded-xl bg-[#f8fafc] dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d]">
              <span className="text-xs font-bold text-[#64748b] uppercase">Correct</span>
              <div className="text-2xl font-extrabold text-emerald-600 mt-1">{resultsData.correct} / {resultsData.total}</div>
            </div>
            <div className="p-4 rounded-xl bg-[#f8fafc] dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d]">
              <span className="text-xs font-bold text-[#64748b] uppercase">Wrong</span>
              <div className="text-2xl font-extrabold text-rose-500 mt-1">{resultsData.wrong}</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-4 border-t border-[#e2e8f0] dark:border-[#23293d]">
            <Button
              variant="outline"
              size="md"
              className="bg-white dark:bg-[#181d2f] text-[#64748b] font-bold"
              onClick={onExit}
            >
              Back to Practice Setup
            </Button>
            <Button
              variant="primary"
              size="md"
              className="bg-[#5b5bd6] hover:bg-[#4a4ac9] text-white font-bold"
              onClick={onFinish}
            >
              Go to Dashboard
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // CASE 2: Active Question Practice Screen
  const currentSelected = selectedAnswers[currentQuestion.id];
  const isMarked = markedForReview[currentQuestion.id];

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-5 animate-fade-in text-[#101828] dark:text-[#f8f9fc]">
      {/* Session Top Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#141824] border border-[#e2e8f0] dark:border-[#23293d] flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <Badge variant="brand">
            Question {currentIndex + 1} of {questions.length}
          </Badge>
          <span className="text-xs font-bold text-[#64748b] hidden sm:inline truncate max-w-xs">
            {config.title}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Timer Display */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#f8fafc] dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] font-mono text-xs font-bold text-[#101828] dark:text-white">
            <Clock className="w-3.5 h-3.5 text-[#5b5bd6]" />
            <span>{isExamMode ? `${formatTimer(remainingSeconds)} Remaining` : formatTimer(elapsedSeconds)}</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="text-xs font-bold text-rose-600 border-rose-300 dark:border-rose-900/40 hover:bg-rose-50"
            onClick={onExit}
          >
            Exit
          </Button>
        </div>
      </div>

      {/* Main Question Card */}
      <Card className="p-6 sm:p-8 border-[#e2e8f0] dark:border-[#23293d] bg-white dark:bg-[#141824] shadow-xs space-y-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#64748b] uppercase tracking-wider">
              Question #{currentIndex + 1}
            </span>
            <button
              onClick={toggleMarkForReview}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-colors ${
                isMarked
                  ? 'bg-amber-500/10 text-amber-600 border border-amber-500/30'
                  : 'text-[#64748b] hover:bg-[#eef2f6] dark:hover:bg-[#181d2f]'
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isMarked ? 'fill-current' : ''}`} />
              <span>{isMarked ? 'Marked for Review' : 'Mark for Review'}</span>
            </button>
          </div>

          <h2 className="text-base sm:text-lg font-bold text-[#101828] dark:text-[#f8f9fc] leading-relaxed">
            {currentQuestion.question_text}
          </h2>
        </div>

        {/* Options A, B, C, D */}
        <div className="space-y-2.5">
          {(['A', 'B', 'C', 'D'] as const).map(optKey => {
            const optText = getOptionText(currentQuestion, optKey);
            const isSelected = currentSelected === optKey;
            const isPracticeRevealed = !isExamMode && currentSelected;
            const isCorrectAnswer = currentQuestion.correct_answer?.trim().toUpperCase() === optKey;

            let buttonStyle = 'bg-white dark:bg-[#181d2f] border-[#e2e8f0] dark:border-[#2b334d] text-[#334155] dark:text-[#cbd5e1] hover:border-[#5b5bd6]';

            if (isSelected) {
              buttonStyle = 'bg-[#eef2f6] dark:bg-[#1f2538] border-[#5b5bd6] text-[#5b5bd6] dark:text-[#8282ea] font-bold shadow-xs';
            }

            if (isPracticeRevealed) {
              if (isCorrectAnswer) {
                buttonStyle = 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500 text-emerald-700 dark:text-emerald-300 font-bold';
              } else if (isSelected && !isCorrectAnswer) {
                buttonStyle = 'bg-rose-50 dark:bg-rose-950/30 border-rose-500 text-rose-700 dark:text-rose-300 font-bold';
              }
            }

            return (
              <button
                key={optKey}
                onClick={() => handleSelectOption(optKey)}
                className={`w-full p-4 rounded-2xl border text-left flex items-start gap-3.5 transition-all ${buttonStyle}`}
              >
                <span className={`w-6 h-6 rounded-lg text-xs font-extrabold flex items-center justify-center shrink-0 ${
                  isSelected ? 'bg-[#5b5bd6] text-white' : 'bg-[#eef2f6] dark:bg-[#141824] text-[#64748b]'
                }`}>
                  {optKey}
                </span>
                <span className="text-xs sm:text-sm font-medium leading-normal pt-0.5">{optText}</span>
              </button>
            );
          })}
        </div>

        {/* Practice Mode Explanation Box */}
        {!isExamMode && currentSelected && currentQuestion.explanation && (
          <div className="p-4 rounded-xl bg-[#f8fafc] dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] space-y-1 animate-fade-in">
            <span className="text-xs font-bold text-[#5b5bd6] dark:text-[#8282ea]">Explanation:</span>
            <p className="text-xs text-[#64748b] dark:text-[#9496a8] leading-relaxed">
              {currentQuestion.explanation}
            </p>
          </div>
        )}

        {/* Bottom Navigation & Submit */}
        <div className="flex items-center justify-between pt-4 border-t border-[#e2e8f0] dark:border-[#23293d]">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
            disabled={currentIndex === 0}
            leftIcon={<ChevronLeft className="w-4 h-4" />}
          >
            Previous
          </Button>

          <div className="flex items-center gap-2">
            {currentIndex < questions.length - 1 ? (
              <Button
                variant="primary"
                size="sm"
                className="bg-[#5b5bd6] hover:bg-[#4a4ac9] text-white font-bold"
                onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
                rightIcon={<ChevronRight className="w-4 h-4" />}
              >
                Next
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-xs px-6"
                onClick={handleFinishSession}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Session'}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Question Palette / Number Jump Matrix */}
      <Card className="p-4 border-[#e2e8f0] dark:border-[#23293d] bg-white dark:bg-[#141824] shadow-xs space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-[#64748b]">
          <span>Question Palette</span>
          <span>{Object.keys(selectedAnswers).length} Answered</span>
        </div>

        <div className="flex flex-wrap gap-1.5 pt-1">
          {questions.map((q, idx) => {
            const isAnswered = Boolean(selectedAnswers[q.id]);
            const isMarked = Boolean(markedForReview[q.id]);
            const isCurrent = currentIndex === idx;

            let pillStyle = 'bg-white dark:bg-[#181d2f] border-[#e2e8f0] dark:border-[#23293d] text-[#64748b]';
            if (isCurrent) {
              pillStyle = 'bg-[#5b5bd6] text-white font-bold border-[#5b5bd6]';
            } else if (isMarked) {
              pillStyle = 'bg-amber-500/10 border-amber-500/40 text-amber-600 font-bold';
            } else if (isAnswered) {
              pillStyle = 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 font-bold';
            }

            return (
              <button
                key={q.id}
                onClick={() => setCurrentIndex(idx)}
                className={`w-8 h-8 rounded-lg border text-xs flex items-center justify-center transition-all ${pillStyle}`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
};
