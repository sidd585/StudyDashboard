import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useUser } from '../context/UserContext';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import {
  HelpCircle,
  Plus,
  Upload,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Trash2,
  Share2,
  Sparkles,
} from 'lucide-react';
import { parseMCQText, parseJSONQuestions, parseCSVQuestions } from '../services/mcqParser';
import { extractTextFromPDF, extractTextFromImageWithOCR } from '../services/ocrService';
import type { Question, ExtractedQuestion, Difficulty } from '../types';

export const Questions: React.FC = () => {
  const { currentUser } = useUser();

  const targets = useLiveQuery(
    () => db.targets.where('userId').equals(currentUser.id).toArray(),
    [currentUser.id]
  ) || [];

  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');

  // Modal States
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  // Manual Question Form
  const [questionText, setQuestionText] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [optionC, setOptionC] = useState('');
  const [optionD, setOptionD] = useState('');
  const [correctOption, setCorrectOption] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [explanation, setExplanation] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [isShared, setIsShared] = useState(true);

  // Ingestion / Review state
  const [extractedReviewList, setExtractedReviewList] = useState<ExtractedQuestion[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [rawPastedText, setRawPastedText] = useState('');

  const subjects = useLiveQuery(
    () => (selectedTargetId ? db.subjects.where('targetId').equals(selectedTargetId).toArray() : []),
    [selectedTargetId]
  ) || [];

  // Filtered Questions Query
  const questions = useLiveQuery(
    async () => {
      let q = db.questions.where('userId').equals(currentUser.id);
      if (selectedTargetId) {
        q = db.questions.where('targetId').equals(selectedTargetId);
      }
      let list = await q.toArray();
      if (selectedSubjectId) {
        list = list.filter(item => item.subjectId === selectedSubjectId);
      }
      if (difficultyFilter !== 'all') {
        list = list.filter(item => item.difficulty === difficultyFilter);
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        list = list.filter(item =>
          item.questionText.toLowerCase().includes(query) ||
          item.options.some(o => o.text.toLowerCase().includes(query))
        );
      }
      return list;
    },
    [currentUser.id, selectedTargetId, selectedSubjectId, difficultyFilter, searchQuery]
  ) || [];

  // Handle Save Manual Question
  const handleSaveManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim() || !selectedTargetId) return;

    const id = `q-${Date.now()}`;
    await db.questions.put({
      id,
      userId: currentUser.id,
      targetId: selectedTargetId,
      subjectId: selectedSubjectId || undefined,
      questionText: questionText.trim(),
      options: [
        { id: 'A', text: optionA.trim() },
        { id: 'B', text: optionB.trim() },
        { id: 'C', text: optionC.trim() },
        { id: 'D', text: optionD.trim() },
      ].filter(o => o.text),
      correctOptionId: correctOption,
      explanation: explanation.trim(),
      difficulty,
      isShared,
      isBookmarked: false,
      isDifficult: false,
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      stats: {
        totalAttempts: 0,
        correctAttempts: 0,
        wrongAttempts: 0,
        consecutiveCorrect: 0,
        easeFactor: 2.5,
        intervalDays: 1,
      }
    });

    setQuestionText('');
    setOptionA('');
    setOptionB('');
    setOptionC('');
    setOptionD('');
    setExplanation('');
    setIsManualModalOpen(false);
  };

  // Handle Text / PDF extraction
  const handleExtractText = () => {
    const targetId = selectedTargetId || (targets.length > 0 ? targets[0].id : '');
    if (!rawPastedText.trim() || !targetId) {
      alert('Please select a target and provide MCQ text.');
      return;
    }
    const parsed = parseMCQText(rawPastedText, {
      defaultTargetId: targetId,
      defaultSubjectId: selectedSubjectId || undefined,
    });
    if (parsed.length > 0) {
      setExtractedReviewList(parsed);
      setIsUploadModalOpen(false);
      setIsReviewModalOpen(true);
    } else {
      alert('No MCQs could be identified. Make sure each question has numbered statements (1., 2.) and options (A., B., C., D.).');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetId = selectedTargetId || (targets.length > 0 ? targets[0].id : '');
    if (!file) return;
    if (!targetId) {
      alert('Please create or select a study target first.');
      return;
    }

    setIsExtracting(true);
    try {
      let rawText = '';
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const pdfRes = await extractTextFromPDF(file);
        rawText = pdfRes.text;
      } else if (file.type.startsWith('image/')) {
        rawText = await extractTextFromImageWithOCR(file);
      } else {
        rawText = await file.text();
      }

      setRawPastedText(rawText);

      let parsed: ExtractedQuestion[] = [];
      if (file.name.endsWith('.json')) {
        parsed = parseJSONQuestions(rawText);
      } else if (file.name.endsWith('.csv')) {
        parsed = parseCSVQuestions(rawText);
      } else {
        parsed = parseMCQText(rawText, {
          defaultTargetId: targetId,
          defaultSubjectId: selectedSubjectId || undefined,
          sourceName: file.name,
        });
      }

      if (parsed.length > 0) {
        setExtractedReviewList(parsed);
        setIsUploadModalOpen(false);
        setIsReviewModalOpen(true);
      } else {
        alert('Text extracted from document, but questions need formatting. We loaded the text into the box below for you to review and extract.');
      }
    } catch (err: any) {
      console.error('File extraction error:', err);
      alert('Could not read PDF directly. Please open the PDF, select and copy the text (Ctrl+A, Ctrl+C), and paste it directly into the text box below.');
    } finally {
      setIsExtracting(false);
    }
  };

  // Commit Approved Questions to Bank
  const handleSaveApprovedToBank = async () => {
    const approved = extractedReviewList.filter(q => q.approved);
    for (const q of approved) {
      const id = `q-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      await db.questions.put({
        id,
        userId: currentUser.id,
        targetId: selectedTargetId,
        subjectId: selectedSubjectId || undefined,
        questionText: q.questionText,
        options: q.options,
        correctOptionId: q.detectedAnswer,
        explanation: q.explanation || '',
        difficulty: 'medium',
        isShared: true,
        isBookmarked: false,
        isDifficult: false,
        tags: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        stats: {
          totalAttempts: 0,
          correctAttempts: 0,
          wrongAttempts: 0,
          consecutiveCorrect: 0,
          easeFactor: 2.5,
          intervalDays: 1,
        }
      });
    }

    setIsReviewModalOpen(false);
    setExtractedReviewList([]);
  };

  const handleDeleteQuestion = async (id: string) => {
    if (window.confirm('Delete this question?')) {
      await db.questions.delete(id);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">MCQ Question Bank</h2>
          <p className="text-xs text-slate-400">Add, review, and organize questions by Target and Subject.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Upload className="w-4 h-4" />}
            onClick={() => setIsUploadModalOpen(true)}
          >
            Import PDF / Text
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setIsManualModalOpen(true)}
          >
            Add Question
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="p-4 border-slate-800">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Target */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Target</label>
            <select
              value={selectedTargetId}
              onChange={e => {
                setSelectedTargetId(e.target.value);
                setSelectedSubjectId('');
              }}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none"
            >
              <option value="">All Targets</option>
              {targets.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Subject</label>
            <select
              value={selectedSubjectId}
              onChange={e => setSelectedSubjectId(e.target.value)}
              disabled={!selectedTargetId}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none disabled:opacity-50"
            >
              <option value="">All Subjects</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Difficulty */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Difficulty</label>
            <select
              value={difficultyFilter}
              onChange={e => setDifficultyFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none"
            >
              <option value="all">All Difficulties</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          {/* Search */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Search Keyword</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search MCQs..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Questions List */}
      <div className="space-y-3">
        {questions.length === 0 ? (
          <Card className="p-12 text-center border-slate-800 space-y-3">
            <HelpCircle className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-sm font-bold text-slate-300">No questions found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Add your first MCQ or import from PDF / past questions to populate your study bank.
            </p>
          </Card>
        ) : (
          questions.map((q, idx) => (
            <Card key={q.id} className="p-5 border-slate-800 hover:border-slate-700 transition-all">
              <div className="flex items-start justify-between gap-3 mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-brand-400">#{idx + 1}</span>
                  <Badge variant={q.difficulty === 'easy' ? 'success' : q.difficulty === 'medium' ? 'warning' : 'danger'}>
                    {q.difficulty}
                  </Badge>
                  {q.isShared && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1">
                      <Share2 className="w-3 h-3" /> Shared
                    </span>
                  )}
                </div>

                <button
                  onClick={() => handleDeleteQuestion(q.id)}
                  className="p-1 text-slate-500 hover:text-rose-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <h4 className="text-sm font-semibold text-white mb-3 leading-relaxed">{q.questionText}</h4>

              {/* Options Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                {q.options.map(opt => {
                  const isCorrect = opt.id === q.correctOptionId;
                  return (
                    <div
                      key={opt.id}
                      className={`p-2.5 rounded-xl text-xs border flex items-center gap-2.5 ${
                        isCorrect
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 font-medium'
                          : 'border-slate-800 bg-slate-900/60 text-slate-300'
                      }`}
                    >
                      <span className="w-5 h-5 rounded bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                        {opt.id}
                      </span>
                      <span className="truncate">{opt.text}</span>
                    </div>
                  );
                })}
              </div>

              {q.explanation && (
                <p className="text-[11px] text-slate-400 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <strong className="text-slate-300">Explanation:</strong> {q.explanation}
                </p>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Manual Question Modal */}
      <Modal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        title="Add MCQ Question"
        size="lg"
      >
        <form onSubmit={handleSaveManual} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Target *</label>
              <select
                required
                value={selectedTargetId}
                onChange={e => setSelectedTargetId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
              >
                <option value="">Select Target</option>
                {targets.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Subject</label>
              <select
                value={selectedSubjectId}
                onChange={e => setSelectedSubjectId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
              >
                <option value="">Select Subject (Optional)</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Question Statement *</label>
            <textarea
              required
              rows={3}
              value={questionText}
              onChange={e => setQuestionText(e.target.value)}
              placeholder="e.g. Under BAFIA 2073, what is the minimum public share percentage?"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Option A</label>
              <input
                type="text"
                required
                value={optionA}
                onChange={e => setOptionA(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Option B</label>
              <input
                type="text"
                required
                value={optionB}
                onChange={e => setOptionB(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Option C</label>
              <input
                type="text"
                value={optionC}
                onChange={e => setOptionC(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Option D</label>
              <input
                type="text"
                value={optionD}
                onChange={e => setOptionD(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Correct Answer</label>
              <select
                value={correctOption}
                onChange={e => setCorrectOption(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white font-bold"
              >
                <option value="A">Option A</option>
                <option value="B">Option B</option>
                <option value="C">Option C</option>
                <option value="D">Option D</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Difficulty</label>
              <select
                value={difficulty}
                onChange={e => setDifficulty(e.target.value as Difficulty)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isShared}
                  onChange={e => setIsShared(e.target.checked)}
                  className="rounded text-brand-600 focus:ring-brand-500"
                />
                <span>Share with Study Partner</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Explanation (Optional)</label>
            <textarea
              rows={2}
              value={explanation}
              onChange={e => setExplanation(e.target.value)}
              placeholder="Rationale and legal/technical references..."
              className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setIsManualModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={!selectedTargetId}>
              Save to Bank
            </Button>
          </div>
        </form>
      </Modal>

      {/* Import / Upload Modal */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Import Questions (PDF / Past Papers)"
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Assign Target *</label>
              <select
                required
                value={selectedTargetId}
                onChange={e => setSelectedTargetId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
              >
                <option value="">Select Target</option>
                {targets.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Assign Subject</label>
              <select
                value={selectedSubjectId}
                onChange={e => setSelectedSubjectId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
              >
                <option value="">Select Subject (Optional)</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Upload File (PDF / JSON / CSV / Image)</label>
            <input
              type="file"
              accept=".pdf,.json,.csv,image/*"
              onChange={handleFileUpload}
              disabled={!selectedTargetId || isExtracting}
              className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-brand-600 file:text-white hover:file:bg-brand-500"
            />
            {isExtracting && <p className="text-xs text-amber-400 mt-1">Extracting text & parsing MCQs...</p>}
          </div>

          <div className="pt-2">
            <label className="block text-xs font-semibold text-slate-300 mb-1">Or Paste Text / Markdown</label>
            <textarea
              rows={6}
              value={rawPastedText}
              onChange={e => setRawPastedText(e.target.value)}
              placeholder="1. What is the time complexity of binary search?&#10;A. O(n)&#10;B. O(log n)&#10;C. O(n^2)&#10;D. O(1)&#10;Answer: B"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsUploadModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleExtractText}
              disabled={!selectedTargetId || !rawPastedText.trim()}
            >
              Extract & Review
            </Button>
          </div>
        </div>
      </Modal>

      {/* Mandatory Review Modal */}
      <Modal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        title={`Review Extracted Questions (${extractedReviewList.length})`}
        size="xl"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <p className="text-xs text-slate-400">
            Review questions before saving. Correct any statement, options, or answer keys.
          </p>

          <div className="space-y-3">
            {extractedReviewList.map((q, i) => (
              <Card key={q.tempId} className="p-4 border-slate-800 bg-slate-900/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-brand-400">Question #{i + 1}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={q.confidence === 'high' ? 'success' : q.confidence === 'medium' ? 'warning' : 'danger'}>
                      Confidence: {q.confidence}
                    </Badge>
                    <label className="flex items-center gap-1.5 text-xs text-slate-300 font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={q.approved}
                        onChange={e => {
                          const updated = [...extractedReviewList];
                          updated[i].approved = e.target.checked;
                          setExtractedReviewList(updated);
                        }}
                        className="rounded text-brand-600"
                      />
                      <span>Approve</span>
                    </label>
                  </div>
                </div>

                <textarea
                  value={q.questionText}
                  onChange={e => {
                    const updated = [...extractedReviewList];
                    updated[i].questionText = e.target.value;
                    setExtractedReviewList(updated);
                  }}
                  rows={2}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                />

                <div className="grid grid-cols-2 gap-2">
                  {q.options.map((opt, oIdx) => (
                    <div key={opt.id} className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400 w-4">{opt.id}.</span>
                      <input
                        type="text"
                        value={opt.text}
                        onChange={e => {
                          const updated = [...extractedReviewList];
                          updated[i].options[oIdx].text = e.target.value;
                          setExtractedReviewList(updated);
                        }}
                        className="w-full px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Detected Answer:</span>
                    <select
                      value={q.detectedAnswer || ''}
                      onChange={e => {
                        const updated = [...extractedReviewList];
                        updated[i].detectedAnswer = e.target.value || null;
                        setExtractedReviewList(updated);
                      }}
                      className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs font-bold text-brand-400"
                    >
                      <option value="">Unknown</option>
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                      <option value="D">D</option>
                    </select>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button variant="outline" onClick={() => setIsReviewModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveApprovedToBank}>
              Save Approved ({extractedReviewList.filter(q => q.approved).length}) to Bank
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
