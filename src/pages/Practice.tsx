import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { courseService } from '../services/courseService';
import { questionService } from '../services/questionService';
import { type CloudCourse, type CloudSubject, type CloudTopic, type CloudQuestion } from '../lib/supabase';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import {
  Play,
  Clock,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Layers,
  Sliders,
} from 'lucide-react';
import type { QuizConfig } from '../types';

interface PracticeProps {
  onStartSession: (sessionPayload: { config: QuizConfig; questions: CloudQuestion[] }) => void;
  onNavigate: (page: any, params?: any) => void;
  initialCourseId?: string;
  initialTopicId?: string;
  initialQuestionCount?: number;
}

export const Practice: React.FC<PracticeProps> = ({
  onStartSession,
  onNavigate,
  initialCourseId,
  initialTopicId,
  initialQuestionCount,
}) => {
  const { currentUser } = useUser();

  const [courses, setCourses] = useState<CloudCourse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>(initialCourseId || '');
  const [subjects, setSubjects] = useState<CloudSubject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [topics, setTopics] = useState<CloudTopic[]>([]);

  // Topic Selection Mode
  const [topicSelectionMode, setTopicSelectionMode] = useState<'single' | 'multi' | 'all'>('all');
  const [selectedSingleTopicId, setSelectedSingleTopicId] = useState<string>(initialTopicId || '');
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);

  // Question Count & Custom
  const [questionCount, setQuestionCount] = useState<number>(initialQuestionCount || 15);
  const [isCustomCount, setIsCustomCount] = useState<boolean>(false);
  const [customCountInput, setCustomCountInput] = useState<string>('20');

  // Mode & Timer
  const [examMode, setExamMode] = useState<'practice' | 'timed'>('practice');
  const [timerMinutes, setTimerMinutes] = useState<number>(30);
  const [isCustomTimer, setIsCustomTimer] = useState<boolean>(false);
  const [customTimerMinutes, setCustomTimerMinutes] = useState<string>('45');

  // Available questions in pool
  const [availableQuestions, setAvailableQuestions] = useState<CloudQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState<boolean>(false);

  // Load courses
  useEffect(() => {
    async function loadCourses() {
      const data = await courseService.getCourses();
      setCourses(data);
      if (data.length > 0 && !selectedCourseId) {
        setSelectedCourseId(data[0].id);
      }
    }
    loadCourses();
  }, [currentUser.id]);

  // Load subjects
  useEffect(() => {
    async function loadSubjects() {
      if (!selectedCourseId) {
        setSubjects([]);
        setSelectedSubjectId('');
        return;
      }
      const data = await courseService.getSubjects(selectedCourseId);
      setSubjects(data);
      setSelectedSubjectId('');
    }
    loadSubjects();
  }, [selectedCourseId]);

  // Load topics
  useEffect(() => {
    async function loadTopics() {
      if (!selectedCourseId) {
        setTopics([]);
        return;
      }
      const data = await courseService.getTopics(selectedCourseId, selectedSubjectId || undefined);
      setTopics(data);
      if (data.length > 0) {
        setSelectedSingleTopicId(data[0].id);
        setSelectedTopicIds(data.map(t => t.id));
      } else {
        setSelectedSingleTopicId('');
        setSelectedTopicIds([]);
      }
    }
    loadTopics();
  }, [selectedCourseId, selectedSubjectId]);

  // Query eligible questions pool from Supabase
  useEffect(() => {
    async function loadEligibleQuestions() {
      if (!selectedCourseId) {
        setAvailableQuestions([]);
        return;
      }
      setLoadingQuestions(true);
      try {
        const { questions } = await questionService.getQuestions({
          courseId: selectedCourseId,
          subjectId: selectedSubjectId || undefined,
          pageSize: 500,
        });

        // Filter by topic mode
        let filtered = questions;
        if (topicSelectionMode === 'single' && selectedSingleTopicId) {
          filtered = questions.filter(q => q.topic_id === selectedSingleTopicId);
        } else if (topicSelectionMode === 'multi' && selectedTopicIds.length > 0) {
          filtered = questions.filter(q => q.topic_id && selectedTopicIds.includes(q.topic_id));
        }

        // Strictly deduplicate by ID (no repeated questions)
        const seen = new Set<string>();
        const unique = filtered.filter(q => {
          if (seen.has(q.id)) return false;
          seen.add(q.id);
          return true;
        });

        setAvailableQuestions(unique);
      } catch (err) {
        console.error('Error querying available questions:', err);
      } finally {
        setLoadingQuestions(false);
      }
    }
    loadEligibleQuestions();
  }, [selectedCourseId, selectedSubjectId, topicSelectionMode, selectedSingleTopicId, selectedTopicIds]);

  const handleToggleTopicCheckbox = (topicId: string) => {
    setSelectedTopicIds(prev =>
      prev.includes(topicId) ? prev.filter(id => id !== topicId) : [...prev, topicId]
    );
  };

  const finalQuestionCount = isCustomCount
    ? Math.max(1, parseInt(customCountInput) || 10)
    : questionCount;

  const finalDurationMinutes = isCustomTimer
    ? Math.max(1, parseInt(customTimerMinutes) || 30)
    : timerMinutes;

  const handleStartSession = () => {
    if (availableQuestions.length === 0) {
      alert('No MCQs found for the selected criteria. Please upload questions into Question Bank or choose other topics.');
      return;
    }

    // Step 1: Shuffle questions deterministically ONCE (strictly deduplicated)
    const shuffled = [...availableQuestions].sort(() => 0.5 - Math.random());

    // Step 2: Slice exact required count
    const selected = shuffled.slice(0, Math.min(finalQuestionCount, shuffled.length));

    const courseObj = courses.find(c => c.id === selectedCourseId);
    const isTest = examMode === 'timed';

    const config: QuizConfig = {
      mode: isTest ? 'exam' : 'practice',
      title: `${courseObj?.name || 'MCQ'} ${isTest ? 'Timed Test' : 'Practice'} (${selected.length} Questions)`,
      courseId: selectedCourseId,
      subjectId: selectedSubjectId || undefined,
      topicIds: topicSelectionMode === 'single' ? [selectedSingleTopicId] : selectedTopicIds,
      questionCount: selected.length,
      durationMinutes: isTest ? finalDurationMinutes : undefined,
      marksPerCorrect: 1,
      negativeMarks: 0.25,
      shuffleQuestions: false,
      shuffleOptions: false,
      immediateFeedback: !isTest,
    };

    onStartSession({ config, questions: selected });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16 animate-fade-in text-[#101828] dark:text-[#f8f9fc] transition-colors">
      {/* Header */}
      <div>
        <h1 className="text-xl font-extrabold text-[#101828] dark:text-[#f8f9fc] tracking-tight flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-[#5b5bd6]" />
          <span>MCQ Practice & Timed Test Setup</span>
        </h1>
        <p className="text-xs text-[#64748b] dark:text-[#9496a8] mt-0.5">
          Select your Course, Subject, and Topics to launch an interactive practice or timed exam session.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Setup Form (8 cols) */}
        <div className="lg:col-span-8 space-y-5">
          {/* STEP 1: COURSE & SUBJECT */}
          <Card className="p-6 border-[#e2e8f0] dark:border-[#23293d] bg-white dark:bg-[#141824] shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#5b5bd6]/10 text-[#5b5bd6] text-xs font-bold flex items-center justify-center">1</span>
              <h2 className="text-sm font-bold text-[#101828] dark:text-[#f8f9fc]">Select Course & Subject</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">Course *</label>
                <select
                  value={selectedCourseId}
                  onChange={e => setSelectedCourseId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] text-[#101828] dark:text-[#f8f9fc] font-semibold outline-none focus:border-[#5b5bd6]"
                >
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">Subject</label>
                <select
                  value={selectedSubjectId}
                  onChange={e => setSelectedSubjectId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] text-[#101828] dark:text-[#f8f9fc] font-semibold outline-none focus:border-[#5b5bd6]"
                >
                  <option value="">All Subjects</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.name} {s.code ? `(${s.code})` : ''}</option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          {/* STEP 2: TOPIC SELECTION */}
          <Card className="p-6 border-[#e2e8f0] dark:border-[#23293d] bg-white dark:bg-[#141824] shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#5b5bd6]/10 text-[#5b5bd6] text-xs font-bold flex items-center justify-center">2</span>
                <h2 className="text-sm font-bold text-[#101828] dark:text-[#f8f9fc]">Select Topics</h2>
              </div>

              <div className="flex items-center gap-1 p-1 rounded-xl bg-[#eef2f6] dark:bg-[#1f2538] border border-[#e2e8f0] dark:border-[#2b334d]">
                <button
                  type="button"
                  onClick={() => setTopicSelectionMode('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                    topicSelectionMode === 'all' ? 'bg-white dark:bg-[#141824] text-[#5b5bd6] shadow-xs' : 'text-[#64748b]'
                  }`}
                >
                  All Topics
                </button>
                <button
                  type="button"
                  onClick={() => setTopicSelectionMode('single')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                    topicSelectionMode === 'single' ? 'bg-white dark:bg-[#141824] text-[#5b5bd6] shadow-xs' : 'text-[#64748b]'
                  }`}
                >
                  Single Topic
                </button>
                <button
                  type="button"
                  onClick={() => setTopicSelectionMode('multi')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                    topicSelectionMode === 'multi' ? 'bg-white dark:bg-[#141824] text-[#5b5bd6] shadow-xs' : 'text-[#64748b]'
                  }`}
                >
                  Multiple
                </button>
              </div>
            </div>

            {topicSelectionMode === 'single' && (
              <div className="space-y-1">
                <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">Choose Topic</label>
                <select
                  value={selectedSingleTopicId}
                  onChange={e => setSelectedSingleTopicId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] text-[#101828] dark:text-[#f8f9fc] font-semibold outline-none focus:border-[#5b5bd6]"
                >
                  {topics.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}

            {topicSelectionMode === 'multi' && (
              <div className="space-y-2 max-h-48 overflow-y-auto p-2 border border-[#e2e8f0] dark:border-[#2b334d] rounded-xl bg-[#f8fafc] dark:bg-[#181d2f]">
                {topics.map(t => {
                  const isChecked = selectedTopicIds.includes(t.id);
                  return (
                    <label
                      key={t.id}
                      className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-[#141824] border border-[#e2e8f0] dark:border-[#23293d] cursor-pointer text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleTopicCheckbox(t.id)}
                        className="w-4 h-4 text-[#5b5bd6] rounded"
                      />
                      <span className="font-semibold text-[#101828] dark:text-[#f8f9fc]">{t.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </Card>

          {/* STEP 3: QUESTION QUANTITY & MODE */}
          <Card className="p-6 border-[#e2e8f0] dark:border-[#23293d] bg-white dark:bg-[#141824] shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#5b5bd6]/10 text-[#5b5bd6] text-xs font-bold flex items-center justify-center">3</span>
              <h2 className="text-sm font-bold text-[#101828] dark:text-[#f8f9fc]">Questions & Session Mode</h2>
            </div>

            {/* Quantity */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">Number of Questions</label>
              <div className="flex flex-wrap gap-2">
                {[10, 15, 25, 50].map(cnt => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => { setQuestionCount(cnt); setIsCustomCount(false); }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
                      !isCustomCount && questionCount === cnt
                        ? 'bg-[#5b5bd6] text-white border-[#5b5bd6]'
                        : 'bg-white dark:bg-[#181d2f] border-[#d0d5dd] dark:border-[#2b334d] text-[#64748b]'
                    }`}
                  >
                    {cnt} Questions
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setIsCustomCount(true)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
                    isCustomCount
                      ? 'bg-[#5b5bd6] text-white border-[#5b5bd6]'
                      : 'bg-white dark:bg-[#181d2f] border-[#d0d5dd] dark:border-[#2b334d] text-[#64748b]'
                  }`}
                >
                  Custom
                </button>
              </div>

              {isCustomCount && (
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={customCountInput}
                  onChange={e => setCustomCountInput(e.target.value)}
                  placeholder="Enter question count..."
                  className="w-48 px-3 py-2 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] outline-none"
                />
              )}
            </div>

            {/* Exam Mode Toggle */}
            <div className="space-y-2 pt-2 border-t border-[#e2e8f0] dark:border-[#23293d]">
              <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">Session Type</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setExamMode('practice')}
                  className={`p-4 rounded-xl border text-left space-y-1 transition-all ${
                    examMode === 'practice'
                      ? 'bg-[#5b5bd6]/10 border-[#5b5bd6] text-[#5b5bd6] font-bold'
                      : 'bg-white dark:bg-[#181d2f] border-[#d0d5dd] dark:border-[#2b334d] text-[#64748b]'
                  }`}
                >
                  <div className="text-xs font-bold">Self-Paced Practice</div>
                  <p className="text-[11px] opacity-80">Immediate feedback, explanations & no time pressure</p>
                </button>

                <button
                  type="button"
                  onClick={() => setExamMode('timed')}
                  className={`p-4 rounded-xl border text-left space-y-1 transition-all ${
                    examMode === 'timed'
                      ? 'bg-[#0284c7]/10 border-[#0284c7] text-[#0284c7] font-bold'
                      : 'bg-white dark:bg-[#181d2f] border-[#d0d5dd] dark:border-[#2b334d] text-[#64748b]'
                  }`}
                >
                  <div className="text-xs font-bold">Timed Exam Test</div>
                  <p className="text-[11px] opacity-80">Simulated test with timer and full score report at end</p>
                </button>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Side: Launch Summary Card (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="p-6 border-[#e2e8f0] dark:border-[#23293d] bg-white dark:bg-[#141824] shadow-xs space-y-5 sticky top-20">
            <h3 className="text-sm font-bold text-[#101828] dark:text-[#f8f9fc]">Session Summary</h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-[#e2e8f0] dark:border-[#23293d]">
                <span className="text-[#64748b]">Available Questions:</span>
                <strong className="text-[#5b5bd6] dark:text-[#8282ea]">{availableQuestions.length}</strong>
              </div>

              <div className="flex justify-between py-1.5 border-b border-[#e2e8f0] dark:border-[#23293d]">
                <span className="text-[#64748b]">Selected Question Count:</span>
                <strong>{Math.min(finalQuestionCount, availableQuestions.length)}</strong>
              </div>

              <div className="flex justify-between py-1.5 border-b border-[#e2e8f0] dark:border-[#23293d]">
                <span className="text-[#64748b]">Mode:</span>
                <strong className="capitalize">{examMode === 'timed' ? 'Timed Test' : 'Practice'}</strong>
              </div>
            </div>

            <Button
              variant="primary"
              size="lg"
              className="w-full font-bold bg-[#5b5bd6] hover:bg-[#4a4ac9] text-white shadow-xs"
              leftIcon={<Play className="w-4 h-4 fill-white" />}
              onClick={handleStartSession}
              disabled={loadingQuestions || availableQuestions.length === 0}
            >
              {availableQuestions.length === 0 ? 'No Questions in Pool' : 'Start Session'}
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
};
