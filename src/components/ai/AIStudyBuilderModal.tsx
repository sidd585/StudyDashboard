import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { useUser } from '../../context/UserContext';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import {
  Sparkles,
  BookOpen,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  Sliders,
  Play,
  Trash2,
  Eye,
  Check,
} from 'lucide-react';
import {
  researchTargetSyllabus,
  createPracticeBlueprint,
  generateValidatedMCQs,
} from '../../services/ai/aiProvider';
import type {
  Target,
  AIResearchSummary,
  AIPracticeBlueprint,
  AIGeneratedQuestionCandidate,
  Question,
  Difficulty,
} from '../../types';

interface AIStudyBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onQuestionsSaved?: (savedCount: number) => void;
  onStartPractice?: (targetId: string) => void;
  initialTargetId?: string;
}

type WizardStep = 'CONFIG' | 'RESEARCH' | 'BLUEPRINT' | 'GENERATING' | 'REVIEW';

export const AIStudyBuilderModal: React.FC<AIStudyBuilderModalProps> = ({
  isOpen,
  onClose,
  onQuestionsSaved,
  onStartPractice,
  initialTargetId,
}) => {
  const { currentUser } = useUser();

  const targets = useLiveQuery(
    () => db.targets.where('userId').equals(currentUser.id).and(t => !t.isArchived).toArray(),
    [currentUser.id]
  ) || [];

  // Wizard state
  const [step, setStep] = useState<WizardStep>('CONFIG');
  const [selectedTargetId, setSelectedTargetId] = useState<string>(initialTargetId || '');
  const [syllabusMode, setSyllabusMode] = useState<'existing' | 'paste' | 'none'>('existing');
  const [pastedSyllabus, setPastedSyllabus] = useState<string>('');
  const [selectedTopic, setSelectedTopic] = useState<string>('All Topics');
  const [questionCount, setQuestionCount] = useState<number>(25);
  const [questionStyle, setQuestionStyle] = useState<
    'past_pattern' | 'syllabus_generated' | 'past_only' | 'mixed' | 'weak_area' | 'revision'
  >('past_pattern');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'mixed'>('medium');
  const [language, setLanguage] = useState<'en' | 'np' | 'en_np'>('en');
  const [researchTier, setResearchTier] = useState<'official_only' | 'official_and_trusted'>('official_and_trusted');

  // Async results
  const [researchSummary, setResearchSummary] = useState<AIResearchSummary | null>(null);
  const [blueprint, setBlueprint] = useState<AIPracticeBlueprint | null>(null);
  const [generatedList, setGeneratedList] = useState<AIGeneratedQuestionCandidate[]>([]);
  const [reviewFilter, setReviewFilter] = useState<'all' | 'needs_review' | 'valid'>('all');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  useEffect(() => {
    if (initialTargetId) {
      setSelectedTargetId(initialTargetId);
    } else if (!selectedTargetId && targets.length > 0) {
      setSelectedTargetId(targets[0].id);
    }
  }, [initialTargetId, targets]);

  const selectedTarget = targets.find(t => t.id === selectedTargetId) || targets[0];

  // 1. Analyze / Research
  const handleStartResearch = async () => {
    if (!selectedTarget) return;
    setIsLoading(true);
    setStatusMessage('Analyzing curriculum and verified exam archives...');
    try {
      const summary = await researchTargetSyllabus({
        targetName: selectedTarget.name,
        topic: selectedTopic,
        syllabusText: syllabusMode === 'paste' ? pastedSyllabus : undefined,
        researchTier,
      });
      setResearchSummary(summary);
      setStep('RESEARCH');
    } catch (err: any) {
      alert(`Research step failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Propose Blueprint
  const handleProposeBlueprint = async () => {
    if (!selectedTarget) return;
    setIsLoading(true);
    setStatusMessage('Constructing balanced practice blueprint...');
    try {
      const bp = await createPracticeBlueprint({
        targetId: selectedTarget.id,
        targetName: selectedTarget.name,
        topic: selectedTopic,
        questionCount,
        difficulty,
        style: questionStyle,
        language,
      });
      setBlueprint(bp);
      setStep('BLUEPRINT');
    } catch (err: any) {
      alert(`Blueprint creation failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Generate MCQs with Second-Pass Validation
  const handleGenerateQuestions = async () => {
    if (!selectedTarget) return;
    setStep('GENERATING');
    setIsLoading(true);
    setStatusMessage('Generating high-precision MCQs with second-pass structural validation...');
    try {
      const res = await generateValidatedMCQs({
        targetId: selectedTarget.id,
        targetName: selectedTarget.name,
        topic: selectedTopic,
        questionCount,
        difficulty,
        style: questionStyle,
        language,
        syllabusText: syllabusMode === 'paste' ? pastedSyllabus : undefined,
        blueprint: blueprint || undefined,
      });
      setGeneratedList(res.questions);
      setStep('REVIEW');
    } catch (err: any) {
      alert(`Question generation failed: ${err.message || 'Unknown error'}`);
      setStep('BLUEPRINT');
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Save Valid & Start Practice
  const handleSaveAndPractice = async (onlyValid: boolean = true) => {
    const toSave = generatedList.filter(q => (onlyValid ? q.status === 'VALIDATED' && q.approved : q.approved));
    if (toSave.length === 0) {
      alert('Please approve at least one question to save.');
      return;
    }

    const targetIdToUse = selectedTarget?.id || '';
    const now = Date.now();

    const questionsToInsert: Question[] = toSave.map((q, idx) => ({
      id: `q-ai-${now}-${idx}-${q.number}`,
      userId: currentUser.id,
      targetId: targetIdToUse,
      questionText: q.question.trim(),
      options: [
        { id: 'A', text: q.options.A.trim() },
        { id: 'B', text: q.options.B.trim() },
        { id: 'C', text: q.options.C.trim() },
        { id: 'D', text: q.options.D.trim() },
      ],
      correctOptionId: q.correctAnswer,
      explanation: q.explanation.trim(),
      source: `AI Practice: ${selectedTarget?.name || 'Curriculum'}`,
      difficulty: q.difficulty,
      origin: q.origin,
      isShared: true,
      isBookmarked: false,
      isDifficult: false,
      tags: [q.topic || 'General'],
      createdAt: now,
      updatedAt: now,
      stats: {
        totalAttempts: 0,
        correctAttempts: 0,
        wrongAttempts: 0,
        consecutiveCorrect: 0,
        easeFactor: 2.5,
        intervalDays: 1,
      },
    }));

    await db.questions.bulkPut(questionsToInsert);
    if (onQuestionsSaved) onQuestionsSaved(questionsToInsert.length);
    onClose();

    if (onStartPractice && targetIdToUse) {
      onStartPractice(targetIdToUse);
    }
  };

  const validatedCount = generatedList.filter(q => q.status === 'VALIDATED').length;
  const needsAttentionCount = generatedList.length - validatedCount;
  const approvedCount = generatedList.filter(q => q.approved).length;

  const filteredReviewList = generatedList.filter(q => {
    if (reviewFilter === 'needs_review') return q.status !== 'VALIDATED';
    if (reviewFilter === 'valid') return q.status === 'VALIDATED';
    return true;
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500" />
          <span>AI Study Builder</span>
        </div>
      }
      size="xl"
    >
      <div className="space-y-6">
        {/* ================= STEP 1: CONFIGURATION ================= */}
        {step === 'CONFIG' && (
          <div className="space-y-5 animate-fade-in">
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-brand-500/10 to-slate-900 border border-amber-500/20">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Build high-yield practice questions grounded in verified syllabus standards
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                AI analyzes your target exam pattern, proposes a structured blueprint, and generates strictly validated MCQs.
              </p>
            </div>

            {/* Target Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                1. What are you preparing for?
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {targets.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTargetId(t.id)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      selectedTargetId === t.id
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-white font-bold shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-xs truncate block">{t.name}</span>
                    <span className="text-[10px] text-slate-400 font-normal">{t.type}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Syllabus Source */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                2. Syllabus Reference
              </label>
              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setSyllabusMode('existing')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                    syllabusMode === 'existing'
                      ? 'bg-brand-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Standard Verified Syllabus
                </button>
                <button
                  type="button"
                  onClick={() => setSyllabusMode('paste')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                    syllabusMode === 'paste'
                      ? 'bg-brand-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Paste Custom Syllabus
                </button>
                <button
                  type="button"
                  onClick={() => setSyllabusMode('none')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                    syllabusMode === 'none'
                      ? 'bg-brand-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  General Topic Practice
                </button>
              </div>

              {syllabusMode === 'paste' && (
                <textarea
                  rows={3}
                  value={pastedSyllabus}
                  onChange={e => setPastedSyllabus(e.target.value)}
                  placeholder="Paste syllabus modules, chapters, or topics here..."
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
                />
              )}
            </div>

            {/* Question Configuration */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Question Count</label>
                <select
                  value={questionCount}
                  onChange={e => setQuestionCount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                >
                  <option value={5}>5 Questions (Quick Test)</option>
                  <option value={10}>10 Questions</option>
                  <option value={15}>15 Questions (Recommended)</option>
                  <option value={25}>25 Questions (Full Set)</option>
                  <option value={50}>50 Questions (Mock Exam)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Question Style</label>
                <select
                  value={questionStyle}
                  onChange={e => setQuestionStyle(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                >
                  <option value="past_pattern">Past-Question Pattern (High Yield)</option>
                  <option value="syllabus_generated">Syllabus-Generated Conceptual</option>
                  <option value="weak_area">Weak Area Drill</option>
                  <option value="mixed">Mixed Comprehensive</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Difficulty</label>
                <select
                  value={difficulty}
                  onChange={e => setDifficulty(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                >
                  <option value="easy">Easy (Fundamentals)</option>
                  <option value="medium">Exam Level (Standard)</option>
                  <option value="hard">Hard (Advanced / Scenario)</option>
                  <option value="mixed">Mixed Balanced</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                leftIcon={<Sparkles className="w-4 h-4" />}
                onClick={handleStartResearch}
                disabled={isLoading || !selectedTargetId}
              >
                {isLoading ? 'Analyzing...' : 'Analyze & Research'}
              </Button>
            </div>
          </div>
        )}

        {/* ================= STEP 2: RESEARCH SUMMARY ================= */}
        {step === 'RESEARCH' && researchSummary && (
          <div className="space-y-5 animate-fade-in">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Trust Hierarchy Analysis Complete</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Tier 1 Official Sources: <strong>{researchSummary.officialSourcesCount}</strong> • Tier 2/3 Sources: <strong>{researchSummary.secondarySourcesCount || 1}</strong>
                  </p>
                </div>
              </div>
              <Badge variant="success">Verified Syllabus</Badge>
            </div>

            {/* Fallback notice if historical past question evidence is absent */}
            {researchSummary.evidenceMessage && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Historical Question Evidence Notice</p>
                  <p className="mt-0.5">{researchSummary.evidenceMessage}</p>
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Observed Topic Weights (Based on Real Exam Distribution)
                </label>
                <button
                  type="button"
                  onClick={() => setReviewFilter(reviewFilter === 'needs_review' ? 'all' : 'needs_review')}
                  className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View Sources & Tiers</span>
                </button>
              </div>

              <div className="space-y-2">
                {researchSummary.observedTopics.map((item: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex items-center justify-between"
                  >
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white">{item.topic}</span>
                      <p className="text-[10px] text-slate-400">{item.observedFrequency}</p>
                    </div>
                    <Badge variant={item.weight === 'High' ? 'danger' : item.weight === 'Medium' ? 'warning' : 'outline'}>
                      {item.weight} Priority
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Structured Trust Hierarchy Sources Box */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 text-xs text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 space-y-2">
              <span className="font-bold text-slate-900 dark:text-white">Trusted Source Hierarchy:</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                <div className="p-2 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Tier 1 — Official</span>
                  <p className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold mt-0.5">psc.gov.np • nrb.org.np • rbb.com.np</p>
                </div>
                <div className="p-2 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">Tier 2 — User Verified</span>
                  <p className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold mt-0.5">Uploaded Syllabus & Model Papers</p>
                </div>
                <div className="p-2 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">Tier 3 — Secondary</span>
                  <p className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold mt-0.5">Standard Curriculum References</p>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-200 dark:border-slate-800">
              <Button variant="outline" onClick={() => setStep('CONFIG')}>
                ← Back
              </Button>
              <Button variant="primary" onClick={handleProposeBlueprint}>
                Propose Practice Blueprint →
              </Button>
            </div>
          </div>
        )}

        {/* ================= STEP 3: BLUEPRINT ================= */}
        {step === 'BLUEPRINT' && blueprint && (
          <div className="space-y-5 animate-fade-in">
            <div className="p-4 rounded-2xl bg-brand-500/10 border border-brand-500/30">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Proposed Practice Set ({blueprint.totalQuestions} Questions)
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Target: <strong>{blueprint.targetName}</strong> • Topic: <strong>{blueprint.topic}</strong>
              </p>
            </div>

            {/* Distribution Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="p-4 border-slate-200 dark:border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-500 uppercase">Difficulty Breakdown</span>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>Easy / Fundamental:</span>
                    <strong className="text-emerald-500">{blueprint.difficultyDistribution.easy} Qs</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Moderate / Standard:</span>
                    <strong className="text-amber-500">{blueprint.difficultyDistribution.moderate} Qs</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Hard / Scenario:</span>
                    <strong className="text-rose-500">{blueprint.difficultyDistribution.hard} Qs</strong>
                  </div>
                </div>
              </Card>

              <Card className="p-4 border-slate-200 dark:border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-500 uppercase">Question Styles</span>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>Direct Concept:</span>
                    <strong>{blueprint.styleDistribution.directConcept}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Comparison & Difference:</span>
                    <strong>{blueprint.styleDistribution.comparison}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Scenario & Case:</span>
                    <strong>{blueprint.styleDistribution.scenario}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Past Exam Pattern:</span>
                    <strong>{blueprint.styleDistribution.pastPattern}</strong>
                  </div>
                </div>
              </Card>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-200 dark:border-slate-800">
              <Button variant="outline" onClick={() => setStep('RESEARCH')}>
                ← Edit Plan
              </Button>
              <Button
                variant="primary"
                leftIcon={<Sparkles className="w-4 h-4" />}
                onClick={handleGenerateQuestions}
              >
                Generate Questions ({blueprint.totalQuestions})
              </Button>
            </div>
          </div>
        )}

        {/* ================= STEP 4: GENERATING SPINNER ================= */}
        {step === 'GENERATING' && (
          <div className="py-12 text-center space-y-3 animate-fade-in">
            <Sparkles className="w-10 h-10 text-amber-500 animate-spin mx-auto" />
            <h4 className="text-base font-bold text-slate-900 dark:text-white">
              Generating & Validating Questions
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Running second-pass validation to ensure accurate answers, valid distractors, and zero leaks.
            </p>
          </div>
        )}

        {/* ================= STEP 5: VALIDATED REVIEW & SAVE ================= */}
        {step === 'REVIEW' && (
          <div className="space-y-4 animate-fade-in">
            {/* Top Summary Banner */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    {generatedList.length} Questions Ready
                  </span>
                  <Badge variant="success">✓ {validatedCount} Validated</Badge>
                  {needsAttentionCount > 0 && <Badge variant="warning">! {needsAttentionCount} Needs Attention</Badge>}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Approved {approvedCount} of {generatedList.length} questions
                </p>
              </div>

              {/* Fast Batch Action Buttons */}
              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Play className="w-3.5 h-3.5 fill-current" />}
                  onClick={() => handleSaveAndPractice(true)}
                  disabled={approvedCount === 0}
                >
                  Save {approvedCount} & Practice Now
                </Button>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-semibold">Filter:</span>
              <button
                type="button"
                onClick={() => setReviewFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-semibold ${
                  reviewFilter === 'all' ? 'bg-brand-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                All ({generatedList.length})
              </button>
              <button
                type="button"
                onClick={() => setReviewFilter('valid')}
                className={`px-2.5 py-1 rounded-lg font-semibold ${
                  reviewFilter === 'valid' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                Validated ({validatedCount})
              </button>
              {needsAttentionCount > 0 && (
                <button
                  type="button"
                  onClick={() => setReviewFilter('needs_review')}
                  className={`px-2.5 py-1 rounded-lg font-semibold ${
                    reviewFilter === 'needs_review' ? 'bg-amber-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Needs Attention ({needsAttentionCount})
                </button>
              )}
            </div>

            {/* Question Cards List */}
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              {filteredReviewList.map((q, idx) => (
                <Card
                  key={q.tempId}
                  className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 space-y-3 shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-brand-600 dark:text-brand-400">
                        #{q.number}
                      </span>
                      <Badge variant={q.status === 'VALIDATED' ? 'success' : 'warning'}>
                        {q.status === 'VALIDATED' ? 'Validated' : 'Needs Review'}
                      </Badge>
                      <span className="text-[10px] text-slate-400 uppercase">{q.difficulty}</span>
                    </div>

                    <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={q.approved}
                        onChange={e => {
                          const updated = [...generatedList];
                          const realIdx = generatedList.findIndex(item => item.tempId === q.tempId);
                          if (realIdx >= 0) {
                            updated[realIdx].approved = e.target.checked;
                            setGeneratedList(updated);
                          }
                        }}
                        className="rounded text-brand-600 focus:ring-brand-500"
                      />
                      <span>Approve</span>
                    </label>
                  </div>

                  <p className="text-xs font-semibold text-slate-900 dark:text-white">
                    {q.question}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {(['A', 'B', 'C', 'D'] as const).map(optId => (
                      <div
                        key={optId}
                        className={`p-2 rounded-lg border flex items-center gap-2 ${
                          q.correctAnswer === optId
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-semibold'
                            : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span className="font-bold w-4">{optId}.</span>
                        <span>{q.options[optId]}</span>
                      </div>
                    ))}
                  </div>

                  {q.explanation && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-800/30 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                      💡 {q.explanation}
                    </p>
                  )}
                </Card>
              ))}
            </div>

            {/* Sticky Action Footer */}
            <div className="flex justify-between items-center pt-3 border-t border-slate-200 dark:border-slate-800">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleSaveAndPractice(false)}
                  disabled={approvedCount === 0}
                >
                  Save to Bank Only ({approvedCount})
                </Button>
                <Button
                  variant="primary"
                  leftIcon={<Play className="w-4 h-4 fill-current" />}
                  onClick={() => handleSaveAndPractice(true)}
                  disabled={approvedCount === 0}
                >
                  Save & Practice Now ({approvedCount})
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
