import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useUser } from '../context/UserContext';
import { NEPAL_EXAM_TEMPLATES } from '../lib/nepalSeeds';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import {
  Target as TargetIcon,
  Plus,
  Edit2,
  Trash2,
  BookOpen,
  Tag,
  Upload,
  FileText,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import type { Target, Subject, Topic, TargetType } from '../types';

export const Targets: React.FC = () => {
  const { currentUser } = useUser();

  const targets = useLiveQuery(
    () => db.targets.where('userId').equals(currentUser.id).toArray(),
    [currentUser.id]
  ) || [];

  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  // Modal States
  const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [isSyllabusUploadModalOpen, setIsSyllabusUploadModalOpen] = useState(false);
  const [syllabusUploadSuccess, setSyllabusUploadSuccess] = useState<string | null>(null);

  // Target Form
  const [targetForm, setTargetForm] = useState<{
    id?: string;
    name: string;
    type: TargetType;
    color: string;
    icon: string;
    deadlineDate: string;
    dailyGoalMinutes: number;
    weeklyGoalMinutes: number;
    targetQuestionGoal: number;
  }>({
    name: '',
    type: 'Competitive Exam',
    color: '#6366f1',
    icon: 'Target',
    deadlineDate: '',
    dailyGoalMinutes: 60,
    weeklyGoalMinutes: 400,
    targetQuestionGoal: 25,
  });

  // Subject & Topic Form
  const [subjectName, setSubjectName] = useState('');
  const [subjectDescription, setSubjectDescription] = useState('');
  const [topicName, setTopicName] = useState('');
  const [topicDescription, setTopicDescription] = useState('');

  // Syllabus Import Form State
  const [syllabusText, setSyllabusText] = useState('');
  const [syllabusImportTargetId, setSyllabusImportTargetId] = useState('');

  // Default target selection
  React.useEffect(() => {
    if (!selectedTargetId && targets.length > 0) {
      setSelectedTargetId(targets[0].id);
    }
  }, [targets, selectedTargetId]);

  const activeTarget = targets.find(t => t.id === selectedTargetId);

  const subjects = useLiveQuery(
    () => (selectedTargetId ? db.subjects.where('targetId').equals(selectedTargetId).toArray() : []),
    [selectedTargetId]
  ) || [];

  React.useEffect(() => {
    if (subjects.length > 0 && !selectedSubjectId) {
      setSelectedSubjectId(subjects[0].id);
    } else if (subjects.length === 0) {
      setSelectedSubjectId(null);
    }
  }, [subjects, selectedSubjectId]);

  const activeSubject = subjects.find(s => s.id === selectedSubjectId);

  const topics = useLiveQuery(
    () => (selectedSubjectId ? db.topics.where('subjectId').equals(selectedSubjectId).toArray() : []),
    [selectedSubjectId]
  ) || [];

  // Target CRUD
  const handleSaveTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetForm.name.trim()) return;

    const now = Date.now();
    const id = targetForm.id || `target-${now}`;

    await db.targets.put({
      id,
      userId: currentUser.id,
      name: targetForm.name.trim(),
      type: targetForm.type,
      color: targetForm.color,
      icon: targetForm.icon,
      deadlineDate: targetForm.deadlineDate || undefined,
      dailyGoalMinutes: targetForm.dailyGoalMinutes,
      weeklyGoalMinutes: targetForm.weeklyGoalMinutes,
      targetQuestionGoal: targetForm.targetQuestionGoal,
      isArchived: false,
      createdAt: targetForm.id ? (activeTarget?.createdAt || now) : now,
      updatedAt: now,
    });

    setIsTargetModalOpen(false);
    setSelectedTargetId(id);
  };

  const handleEditTarget = (target: Target) => {
    setTargetForm({
      id: target.id,
      name: target.name,
      type: target.type,
      color: target.color,
      icon: target.icon,
      deadlineDate: target.deadlineDate || '',
      dailyGoalMinutes: target.dailyGoalMinutes,
      weeklyGoalMinutes: target.weeklyGoalMinutes,
      targetQuestionGoal: target.targetQuestionGoal,
    });
    setIsTargetModalOpen(true);
  };

  const handleDeleteTarget = async (targetId: string) => {
    if (window.confirm('Are you sure you want to delete this target and all its subjects, topics, and questions?')) {
      await db.targets.delete(targetId);
      await db.subjects.where('targetId').equals(targetId).delete();
      await db.topics.where('targetId').equals(targetId).delete();
      await db.questions.where('targetId').equals(targetId).delete();
      setSelectedTargetId(null);
    }
  };

  // Subject CRUD
  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectName.trim() || !selectedTargetId) return;

    const id = `sub-${Date.now()}`;
    await db.subjects.put({
      id,
      userId: currentUser.id,
      targetId: selectedTargetId,
      name: subjectName.trim(),
      description: subjectDescription.trim() || undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    setSubjectName('');
    setSubjectDescription('');
    setIsSubjectModalOpen(false);
    setSelectedSubjectId(id);
  };

  // Topic CRUD
  const handleSaveTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicName.trim() || !selectedTargetId || !selectedSubjectId) return;

    const id = `top-${Date.now()}`;
    await db.topics.put({
      id,
      userId: currentUser.id,
      targetId: selectedTargetId,
      subjectId: selectedSubjectId,
      name: topicName.trim(),
      description: topicDescription.trim() || undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    setTopicName('');
    setTopicDescription('');
    setIsTopicModalOpen(false);
  };

  // Parse and Save Syllabus
  const handleProcessSyllabusImport = async () => {
    const targetIdToUse = syllabusImportTargetId || selectedTargetId;
    if (!targetIdToUse || !syllabusText.trim()) {
      alert('Please select a course and provide syllabus text.');
      return;
    }

    const lines = syllabusText.split('\n').map(l => l.trim()).filter(Boolean);
    const mainSectionRegex = /^(?:(?:Section|Part|Paper|Unit|Chapter|\d+)[\s\.\:\-\)]+|[0-9]+\.\s+)/i;

    const now = Date.now();
    const subId = `sub-syllabus-${now}`;
    
    // Create main Subject wrapper
    await db.subjects.put({
      id: subId,
      userId: currentUser.id,
      targetId: targetIdToUse,
      name: 'Imported Syllabus Curriculum',
      description: 'Extracted from uploaded syllabus document',
      createdAt: now,
      updatedAt: now,
    });

    // Detect and insert topics
    let count = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.length < 4) continue;

      if (mainSectionRegex.test(line) || /^[0-9]+[\.\)]\s+/.test(line)) {
        await db.topics.put({
          id: `top-syl-${now}-${count}`,
          userId: currentUser.id,
          targetId: targetIdToUse,
          subjectId: subId,
          name: line.replace(/^[0-9]+[\.\)]\s+/, '').trim(),
          description: lines[i + 1] && !mainSectionRegex.test(lines[i + 1]) ? lines[i + 1] : undefined,
          createdAt: now,
          updatedAt: now,
        });
        count++;
      }
    }

    // If no numbered lines, split into chunk topics
    if (count === 0) {
      const chunks = lines.slice(0, 10);
      for (let i = 0; i < chunks.length; i++) {
        await db.topics.put({
          id: `top-syl-${now}-${i}`,
          userId: currentUser.id,
          targetId: targetIdToUse,
          subjectId: subId,
          name: chunks[i],
          createdAt: now,
          updatedAt: now,
        });
        count++;
      }
    }

    setSelectedTargetId(targetIdToUse);
    setSelectedSubjectId(subId);
    setSyllabusUploadSuccess(`Successfully extracted and saved ${count} topics to syllabus!`);
    setTimeout(() => {
      setSyllabusUploadSuccess(null);
      setIsSyllabusUploadModalOpen(false);
      setSyllabusText('');
    }, 2000);
  };

  // 1-Click Load Official Templates
  const handleLoadOfficialSyllabus = async (templateType: 'rbbit' | 'sanstha' | 'nrb') => {
    const targetIdToUse = syllabusImportTargetId || selectedTargetId;
    if (!targetIdToUse) {
      alert('Please select a course target first.');
      return;
    }

    const now = Date.now();
    const subId = `sub-official-${now}`;

    if (templateType === 'rbbit') {
      await db.subjects.put({
        id: subId,
        userId: currentUser.id,
        targetId: targetIdToUse,
        name: 'Paper II: IT & Management (Official)',
        description: 'RBB IT Assistant Level 5 Official 6-Part Curriculum',
        createdAt: now,
        updatedAt: now,
      });

      const rbb6Parts = [
        '1. Introduction of Computer (Types, Internet/Email, Physical Security, AI/ML)',
        '2. Computer Architecture (Registers, Hard Disk, CPU, I/O Management)',
        '3. Communication and Computer Network Technologies (Networking Devices, Switching, IPv4/IPv6, Security)',
        '4. Operating System and Information Systems (Process Scheduling, DOS/UNIX/Windows, OS Security)',
        '5. Database Management System & Web Technology (Normalization, Indexing, Data Warehouse, HTML/CSS)',
        '6. Cybersecurity and IT Policies (Access Control, Malware, ICT Policy 2072, NRB Guidelines)',
      ];

      for (let i = 0; i < rbb6Parts.length; i++) {
        await db.topics.put({
          id: `top-rbb-${now}-${i}`,
          userId: currentUser.id,
          targetId: targetIdToUse,
          subjectId: subId,
          name: rbb6Parts[i],
          createdAt: now,
          updatedAt: now,
        });
      }
    } else if (templateType === 'sanstha') {
      await db.subjects.put({
        id: subId,
        userId: currentUser.id,
        targetId: targetIdToUse,
        name: 'Pre-Qualifying Curriculum (Official)',
        description: 'Lok Sewa Aayog Unified 9-Part Curriculum',
        createdAt: now,
        updatedAt: now,
      });

      const sanstha9Parts = [
        '1. Geography, Environment & Population',
        '2. History and Culture of Nepal',
        '3. Economic Aspects and Development',
        '4. Governance and Constitution of Nepal',
        '5. International Affairs & Organizations (UN, SAARC, BIMSTEC)',
        '6. Science, Public Health & Current Affairs',
        '7. Office & Public Management (Tippani, Filing, Public Charter)',
        '8. Applied Mathematics (Percentages, Ratios, Profit & Loss, Interest)',
        '9. Knowledge about Public Enterprises & Financial Regulatory Authorities',
      ];

      for (let i = 0; i < sanstha9Parts.length; i++) {
        await db.topics.put({
          id: `top-san-${now}-${i}`,
          userId: currentUser.id,
          targetId: targetIdToUse,
          subjectId: subId,
          name: sanstha9Parts[i],
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    setSelectedTargetId(targetIdToUse);
    setSelectedSubjectId(subId);
    setSyllabusUploadSuccess('Official syllabus loaded successfully!');
    setTimeout(() => {
      setSyllabusUploadSuccess(null);
      setIsSyllabusUploadModalOpen(false);
    }, 1500);
  };

  return (
    <div className="space-y-6 pb-16 animate-fade-in max-w-6xl mx-auto">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Courses & Syllabus</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage your courses, official syllabi, and multi-part topic structures.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Upload className="w-4 h-4 text-blue-500" />}
            onClick={() => setIsSyllabusUploadModalOpen(true)}
          >
            Upload Syllabus
          </Button>

          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => {
              setTargetForm({
                name: '',
                type: 'Competitive Exam',
                color: '#6366f1',
                icon: 'Target',
                deadlineDate: '',
                dailyGoalMinutes: 60,
                weeklyGoalMinutes: 400,
                targetQuestionGoal: 25,
              });
              setIsTargetModalOpen(true);
            }}
          >
            Add Course
          </Button>
        </div>
      </div>

      {/* 3-Column Hierarchy Explorer (Target -> Subject -> Topic) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Targets / Courses Column */}
        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col h-[560px] shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <TargetIcon className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              <span>Courses ({targets.length})</span>
            </span>
            <button
              onClick={() => {
                setTargetForm({
                  name: '',
                  type: 'Competitive Exam',
                  color: '#6366f1',
                  icon: 'Target',
                  deadlineDate: '',
                  dailyGoalMinutes: 60,
                  weeklyGoalMinutes: 400,
                  targetQuestionGoal: 25,
                });
                setIsTargetModalOpen(true);
              }}
              className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-bold"
            >
              + Add
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 py-3">
            {targets.map(target => {
              const isSelected = target.id === selectedTargetId;
              return (
                <div
                  key={target.id}
                  onClick={() => setSelectedTargetId(target.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-brand-50 dark:bg-brand-950/40 border-brand-500 text-brand-900 dark:text-brand-100 ring-1 ring-brand-500 shadow-xs'
                      : 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5 truncate">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: target.color }} />
                      <div className="truncate">
                        <p className="font-bold text-xs sm:text-sm truncate">{target.name}</p>
                        <p className="text-[11px] text-slate-400">{target.type} • {target.dailyGoalMinutes}m/day</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleEditTarget(target);
                        }}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleDeleteTarget(target.id);
                        }}
                        className="p-1 text-slate-400 hover:text-rose-500 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* 2. Subjects / Papers Column */}
        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col h-[560px] shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-sky-500" />
              <span>Subjects / Papers ({subjects.length})</span>
            </span>
            {selectedTargetId && (
              <button
                onClick={() => setIsSubjectModalOpen(true)}
                className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-bold"
              >
                + Add
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 py-3">
            {subjects.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                {selectedTargetId ? 'No subjects added. Click "+ Add" or "Upload Syllabus".' : 'Select a course first.'}
              </div>
            ) : (
              subjects.map(subject => {
                const isSelected = subject.id === selectedSubjectId;
                return (
                  <div
                    key={subject.id}
                    onClick={() => setSelectedSubjectId(subject.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-500 text-sky-900 dark:text-sky-100 ring-1 ring-sky-500 shadow-xs'
                        : 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    <p className="font-bold text-xs sm:text-sm">{subject.name}</p>
                    {subject.description && (
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{subject.description}</p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* 3. Topics / Parts Column */}
        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col h-[560px] shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Tag className="w-4 h-4 text-indigo-500" />
              <span>Syllabus Topics ({topics.length})</span>
            </span>
            {selectedSubjectId && (
              <button
                onClick={() => setIsTopicModalOpen(true)}
                className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-bold"
              >
                + Add
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 py-3">
            {topics.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                {selectedSubjectId ? 'No syllabus topics added yet.' : 'Select a subject to view topics.'}
              </div>
            ) : (
              topics.map(topic => (
                <div
                  key={topic.id}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-800 dark:text-slate-200 space-y-0.5"
                >
                  <p className="font-semibold text-xs text-slate-900 dark:text-white">{topic.name}</p>
                  {topic.description && (
                    <p className="text-[10px] text-slate-400">{topic.description}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* ================= MODAL: UPLOAD SYLLABUS ================= */}
      <Modal
        isOpen={isSyllabusUploadModalOpen}
        onClose={() => setIsSyllabusUploadModalOpen(false)}
        title="Upload & Import Syllabus"
      >
        <div className="space-y-4">
          {syllabusUploadSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{syllabusUploadSuccess}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Select Course Target *
            </label>
            <select
              value={syllabusImportTargetId || selectedTargetId || ''}
              onChange={e => setSyllabusImportTargetId(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            >
              {targets.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Quick Pre-Built Official Syllabi */}
          <div className="p-3.5 rounded-2xl bg-brand-50/60 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800 space-y-2">
            <span className="text-xs font-bold text-brand-900 dark:text-brand-200 uppercase tracking-wider block">
              Quick 1-Click Official Curriculum:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs font-bold justify-start"
                leftIcon={<Layers className="w-3.5 h-3.5 text-brand-600" />}
                onClick={() => handleLoadOfficialSyllabus('rbbit')}
              >
                RBB IT (Official 6 Parts)
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="text-xs font-bold justify-start"
                leftIcon={<Layers className="w-3.5 h-3.5 text-brand-600" />}
                onClick={() => handleLoadOfficialSyllabus('sanstha')}
              >
                Sangathit Sanstha (9 Parts)
              </Button>
            </div>
          </div>

          {/* Manual / PDF Paste Syllabus */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Or Paste Custom Syllabus Text
            </label>
            <textarea
              rows={6}
              value={syllabusText}
              onChange={e => setSyllabusText(e.target.value)}
              placeholder="Paste syllabus modules, chapters, or sections (e.g., 1. Computer Architecture, 2. Database Systems...)"
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <Button variant="outline" size="sm" onClick={() => setIsSyllabusUploadModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleProcessSyllabusImport}
              disabled={!syllabusText.trim()}
            >
              Save Syllabus Topics
            </Button>
          </div>
        </div>
      </Modal>

      {/* ================= MODAL: ADD / EDIT COURSE ================= */}
      <Modal
        isOpen={isTargetModalOpen}
        onClose={() => setIsTargetModalOpen(false)}
        title={targetForm.id ? 'Edit Course Target' : 'Add New Course Target'}
      >
        <form onSubmit={handleSaveTarget} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Course / Exam Name *
            </label>
            <input
              type="text"
              required
              value={targetForm.name}
              onChange={e => setTargetForm({ ...targetForm, name: e.target.value })}
              placeholder="e.g. RBB IT Level 5, NRB, College..."
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Category
              </label>
              <select
                value={targetForm.type}
                onChange={e => setTargetForm({ ...targetForm, type: e.target.value as any })}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              >
                <option value="Competitive Exam">Competitive Exam</option>
                <option value="College">College</option>
                <option value="Course">Course</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Daily Goal (Minutes)
              </label>
              <input
                type="number"
                min={15}
                max={480}
                value={targetForm.dailyGoalMinutes}
                onChange={e => setTargetForm({ ...targetForm, dailyGoalMinutes: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsTargetModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Save Course
            </Button>
          </div>
        </form>
      </Modal>

      {/* ================= MODAL: ADD SUBJECT ================= */}
      <Modal
        isOpen={isSubjectModalOpen}
        onClose={() => setIsSubjectModalOpen(false)}
        title="Add Subject / Paper"
      >
        <form onSubmit={handleSaveSubject} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Subject / Paper Name *
            </label>
            <input
              type="text"
              required
              value={subjectName}
              onChange={e => setSubjectName(e.target.value)}
              placeholder="e.g. Paper II: Information Technology"
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description (Optional)
            </label>
            <input
              type="text"
              value={subjectDescription}
              onChange={e => setSubjectDescription(e.target.value)}
              placeholder="Brief summary of modules covered..."
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsSubjectModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Save Subject
            </Button>
          </div>
        </form>
      </Modal>

      {/* ================= MODAL: ADD TOPIC ================= */}
      <Modal
        isOpen={isTopicModalOpen}
        onClose={() => setIsTopicModalOpen(false)}
        title="Add Syllabus Topic"
      >
        <form onSubmit={handleSaveTopic} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Topic Name *
            </label>
            <input
              type="text"
              required
              value={topicName}
              onChange={e => setTopicName(e.target.value)}
              placeholder="e.g. 3. Communication & Network Technologies"
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Subtopics / Key Concepts (Optional)
            </label>
            <textarea
              rows={2}
              value={topicDescription}
              onChange={e => setTopicDescription(e.target.value)}
              placeholder="e.g. OSI Model, Subnetting, Routing Protocols..."
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsTopicModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Save Topic
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
