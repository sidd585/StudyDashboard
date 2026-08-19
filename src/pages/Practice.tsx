import React, { useState, useEffect, useMemo } from 'react';
import { useUser } from '../context/UserContext';
import { courseService } from '../services/courseService';
import { questionService } from '../services/questionService';
import { practiceService } from '../services/practiceService';
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

  // Step 3: Topic Selection Mode
  const [topicSelectionMode, setTopicSelectionMode] = useState<'single' | 'multi' | 'all'>('all');
  const [selectedSingleTopicId, setSelectedSingleTopicId] = useState<string>(initialTopicId || '');
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);

  // Step 4: Question Count & Custom
  const [questionCount, setQuestionCount] = useState<number>(initialQuestionCount || 15);
  const [isCustomCount, setIsCustomCount] = useState<boolean>(false);
  const [customCountInput, setCustomCountInput] = useState<string>('20');

  // Step 5: Mode & Timer
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
      const topTopics = data.filter(t => !t.parent_topic_id);
      setTopics(topTopics);
      if (topTopics.length > 0) {
        setSelectedSingleTopicId(topTopics[0].id);
        setSelectedTopicIds(topTopics.map(t => t.id));
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

        // Strictly deduplicate by ID
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

  const handleSelectAllTopics = () => {
    setSelectedTopicIds(topics.map(t => t.id));
  };

  const handleClearAllTopics = () => {
    setSelectedTopicIds([]);
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

    // Step 1: Shuffle questions deterministically ONCE
    const shuffled = [...availableQuestions].sort(() => 0.5 - Math.random());

    // Step 2: Slice exact required count
    const selected = shuffled.slice(0, Math.min(finalQuestionCount, shuffled.length));

    const courseObj = courses.find(c => c.id === selectedCourseId);
    const isTest = examMode === 'timed';

    const config: QuizConfig = {
      mode: isTest ? 'exam' : 'practice',
      title: `${courseObj?.name || 'MCQ'} ${isTest ? 'Timed Exam' : 'Practice'} (${selected.length} Qs)`,
      courseId: selectedCourseId,
      subjectId: selectedSubjectId || undefined,
      topicIds: topicSelectionMode === 'single' ? [selectedSingleTopicId] : selectedTopicIds,
      questionCount: selected.length,
      durationMinutes: isTest ? finalDurationMinutes : undefined,
      marksPerCorrect: 1,
      negativeMarks: 0.2,
      shuffleQuestions: false, // already shuffled once
      shuffleOptions: false,
      immediateFeedback: !isTest,
    };

    onStartSession({ config, questions: selected });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16 animate-fade-in text-[#172033] dark:text-[#f8f9fc] transition-colors">
      {/* Header */}
      <div>
        <h1 className="text-xl font-extrabold text-[#172033] dark:text-[#f8f9fc] tracking-tight flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-[#5b5bd6]" />
          <span>MCQ Practice & Exam Setup</span>
        </h1>
        <p className="text-xs text-[#64748b] dark:text-[#9496a8] mt-0.5">
          Configure targeted practice sessions or timed simulated exams with instant scoring.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Setup Form (8 cols) */}
        <div className="lg:col-span-8 space-y-5">
          {/* STEP 1: Course & STEP 2: Subject */}
          <Card className="p-5 border-[#e2e8f0] dark:border-[#23293d] bg-[#fbfcfe] dark:bg-[#141824] shadow-xs space-y-4">
            <h2 className="text-xs font-bold text-[#64748b] dark:text-[#9496a8] uppercase tracking-wider">
              1. Target Course & Subject
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">
                  Select Course *
                </label>
                <select
                  value={selectedCourseId}
                  onChange={e => setSelectedCourseId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] text-[#172033] dark:text-[#f8f9fc] font-semibold outline-none focus:border-[#5b5bd6]"
                >
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.year ? `(${c.year})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">
                  Select Subject / Paper
                </label>
                <select
                  value={selectedSubjectId}
                  onChange={e => setSelectedSubjectId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] text-[#172033] dark:text-[#f8f9fc] font-semibold outline-none focus:border-[#5b5bd6]"
                >
                  <option value="">All Subjects</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          {/* STEP 3: Topic Selection Mode */}
          <Card className="p-5 border-[#e2e8f0] dark:border-[#23293d] bg-[#fbfcfe] dark:bg-[#141824] shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-[#64748b] dark:text-[#9496a8] uppercase tracking-wider">
                2. Topic Selection
              </h2>
              <div className="flex items-center gap-1 p-1 rounded-xl bg-[#eef2f6] dark:bg-[#1f2538] border border-[#e2e8f0] dark:border-[#2b334d]">
                <button
                  type="button"
                  onClick={() => setTopicSelectionMode('single')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                    topicSelectionMode === 'single' ? 'bg-white dark:bg-[#141824] text-[#5b5bd6] shadow-xs' : 'text-[#64748b]'
                  }`}
                >
                  One Topic
                </button>
                <button
                  type="button"
                  onClick={() => setTopicSelectionMode('multi')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                    topicSelectionMode === 'multi' ? 'bg-white dark:bg-[#141824] text-[#5b5bd6] shadow-xs' : 'text-[#64748b]'
                  }`}
                >
                  Multiple Topics
                </button>
                <button
                  type="button"
                  onClick={() => setTopicSelectionMode('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                    topicSelectionMode === 'all' ? 'bg-white dark:bg-[#141824] text-[#5b5bd6] shadow-xs' : 'text-[#64748b]'
                  }`}
                >
                  All Topics
                </button>
              </div>
            </div>

            {/* Single Topic Dropdown */}
            {topicSelectionMode === 'single' && (
              <div className="space-y-1">
                <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">
                  Choose Topic
                </label>
                <select
                  value={selectedSingleTopicId}
                  onChange={e => setSelectedSingleTopicId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] text-[#172033] dark:text-[#f8f9fc] font-semibold outline-none focus:border-[#5b5bd6]"
                >
                  {topics.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.code ? `${t.code}. ` : ''}{t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Multiple Topics Checkboxes */}
            {topicSelectionMode === 'multi' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#64748b]">Select topics to include:</span>
                  <div className="flex items-center gap-3 font-semibold">
                    <button type="button" onClick={handleSelectAllTopics} className="text-[#5b5bd6] hover:underline">
                      Select All
                    </button>
                    <button type="button" onClick={handleClearAllTopics} className="text-[#64748b] hover:underline">
                      Clear
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {topics.map((t, idx) => {
                    const isChecked = selectedTopicIds.includes(t.id);
                    return (
                      <label
                        key={t.id}
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-[#eef2f6] dark:bg-[#1f2538] border-[#5b5bd6]/40 text-[#172033] dark:text-white font-semibold'
                            : 'bg-white dark:bg-[#181d2f] border-[#e2e8f0] dark:border-[#23293d] text-[#64748b]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleTopicCheckbox(t.id)}
                          className="w-4 h-4 rounded border-[#cbd5e1] text-[#5b5bd6] focus:ring-[#5b5bd6]"
                        />
                        <span className="truncate">{t.code ? `${t.code}. ` : `${idx + 1}. `}{t.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {topicSelectionMode === 'all' && (
              <p className="text-xs text-[#64748b] dark:text-[#9496a8] italic">
                All {topics.length} topics from this course will be randomly sampled.
              </p>
            )}
          </Card>

          {/* STEP 4: Question Count */}
          <Card className="p-5 border-[#e2e8f0] dark:border-[#23293d] bg-[#fbfcfe] dark:bg-[#141824] shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-[#64748b] dark:text-[#9496a8] uppercase tracking-wider">
                3. Number of Questions
              </h2>
              <span className="text-xs font-bold text-[#5b5bd6] dark:text-[#8282ea]">
                {loadingQuestions ? 'Calculating...' : `${availableQuestions.length} Questions Available`}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {[5, 10, 15, 25, 50, 100].map(count => (
                <button
                  key={count}
                  type="button"
                  onClick={() => {
                    setQuestionCount(count);
                    setIsCustomCount(false);
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    !isCustomCount && questionCount === count
                      ? 'bg-[#5b5bd6] text-white shadow-xs'
                      : 'bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] text-[#64748b] hover:text-[#172033]'
                  }`}
                >
                  {count}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setIsCustomCount(true)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  isCustomCount
                    ? 'bg-[#5b5bd6] text-white shadow-xs'
                    : 'bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] text-[#64748b] hover:text-[#172033]'
                }`}
              >
                Custom
              </button>
            </div>

            {isCustomCount && (
              <div className="pt-1 flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max={availableQuestions.length || 500}
                  value={customCountInput}
                  onChange={e => setCustomCountInput(e.target.value)}
                  className="w-28 px-3 py-1.5 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] font-bold text-[#172033] dark:text-white outline-none focus:border-[#5b5bd6]"
                />
                <span className="text-xs text-[#64748b]">questions to practice</span>
              </div>
            )}
          </Card>

          {/* STEP 5: Mode & Timed Exam */}
          <Card className="p-5 border-[#e2e8f0] dark:border-[#23293d] bg-[#fbfcfe] dark:bg-[#141824] shadow-xs space-y-4">
            <h2 className="text-xs font-bold text-[#64748b] dark:text-[#9496a8] uppercase tracking-wider">
              4. Practice Mode & Timer
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setExamMode('practice')}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  examMode === 'practice'
                    ? 'bg-[#eef2f6] dark:bg-[#1f2538] border-[#5b5bd6]/40 text-[#5b5bd6] font-bold shadow-xs'
                    : 'bg-white dark:bg-[#181d2f] border-[#e2e8f0] dark:border-[#23293d] text-[#64748b]'
                }`}
              >
                <div className="text-sm font-bold">Standard Practice</div>
                <div className="text-[11px] font-normal text-[#64748b] mt-0.5">
                  No strict timer, instant explanation review enabled
                </div>
              </button>

              <button
                type="button"
                onClick={() => setExamMode('timed')}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  examMode === 'timed'
                    ? 'bg-[#eef2f6] dark:bg-[#1f2538] border-[#5b5bd6]/40 text-[#5b5bd6] font-bold shadow-xs'
                    : 'bg-white dark:bg-[#181d2f] border-[#e2e8f0] dark:border-[#23293d] text-[#64748b]'
                }`}
              >
                <div className="text-sm font-bold">Timed Exam Simulation</div>
                <div className="text-[11px] font-normal text-[#64748b] mt-0.5">
                  Countdown timer, auto-submit at zero, realistic scoring
                </div>
              </button>
            </div>

            {examMode === 'timed' && (
              <div className="pt-2 space-y-2">
                <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">
                  Timer Duration
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {[15, 30, 45, 60].map(mins => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => {
                        setTimerMinutes(mins);
                        setIsCustomTimer(false);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        !isCustomTimer && timerMinutes === mins
                          ? 'bg-[#5b5bd6] text-white shadow-xs'
                          : 'bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] text-[#64748b]'
                      }`}
                    >
                      {mins} mins
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setIsCustomTimer(true)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      isCustomTimer
                        ? 'bg-[#5b5bd6] text-white shadow-xs'
                        : 'bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] text-[#64748b]'
                    }`}
                  >
                    Custom
                  </button>
                </div>

                {isCustomTimer && (
                  <div className="pt-1 flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      value={customTimerMinutes}
                      onChange={e => setCustomTimerMinutes(e.target.value)}
                      className="w-24 px-3 py-1.5 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] font-bold text-[#172033] dark:text-white outline-none focus:border-[#5b5bd6]"
                    />
                    <span className="text-xs text-[#64748b]">minutes</span>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Right Summary & Launch (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="p-5 border-[#e2e8f0] dark:border-[#23293d] bg-[#fbfcfe] dark:bg-[#141824] shadow-xs space-y-4">
            <h2 className="text-xs font-bold text-[#64748b] dark:text-[#9496a8] uppercase tracking-wider">
              Session Summary
            </h2>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-[#e2e8f0] dark:border-[#23293d]">
                <span className="text-[#64748b]">Course</span>
                <span className="font-bold text-[#172033] dark:text-white">
                  {courses.find(c => c.id === selectedCourseId)?.name || '—'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#e2e8f0] dark:border-[#23293d]">
                <span className="text-[#64748b]">Topic Mode</span>
                <span className="font-bold capitalize text-[#5b5bd6]">
                  {topicSelectionMode === 'single' ? 'One Topic' : topicSelectionMode === 'multi' ? `${selectedTopicIds.length} Topics` : 'All Topics'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#e2e8f0] dark:border-[#23293d]">
                <span className="text-[#64748b]">Total Questions</span>
                <span className="font-extrabold text-[#172033] dark:text-white">
                  {Math.min(finalQuestionCount, availableQuestions.length)}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-[#64748b]">Mode</span>
                <span className="font-bold text-[#12b76a]">
                  {examMode === 'timed' ? `Timed (${finalDurationMinutes}m)` : 'Untimed Practice'}
                </span>
              </div>
            </div>

            <Button
              variant="primary"
              size="lg"
              className="w-full font-bold bg-[#5b5bd6] hover:bg-[#4a4ac9] text-white shadow-sm"
              leftIcon={<Play className="w-4 h-4 fill-white" />}
              onClick={handleStartSession}
              disabled={availableQuestions.length === 0}
            >
              Start Practice Session
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
};
