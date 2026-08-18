import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useUser } from '../context/UserContext';
import { NEPAL_EXAM_TEMPLATES } from '../lib/nepalSeeds';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { Input, Select } from '../components/common/Input';
import {
  Target as TargetIcon,
  Plus,
  Edit2,
  Trash2,
  Archive,
  ChevronRight,
  BookOpen,
  Tag,
  Sparkles,
  Calendar,
  Layers,
  FolderPlus,
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
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

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

  // Import Nepal Template
  const handleImportTemplate = async (templateKey: string) => {
    const tmpl = NEPAL_EXAM_TEMPLATES[templateKey];
    if (!tmpl) return;

    const targetId = `target-${templateKey}-${Date.now()}`;
    await db.targets.put({
      id: targetId,
      userId: currentUser.id,
      name: tmpl.name,
      type: tmpl.type,
      color: tmpl.color,
      icon: tmpl.icon,
      dailyGoalMinutes: tmpl.dailyGoalMinutes,
      weeklyGoalMinutes: tmpl.weeklyGoalMinutes,
      targetQuestionGoal: tmpl.targetQuestionGoal,
      isArchived: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    for (const sub of tmpl.subjects) {
      const subId = `sub-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      await db.subjects.put({
        id: subId,
        userId: currentUser.id,
        targetId,
        name: sub.name,
        description: sub.description,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      for (const top of sub.topics) {
        await db.topics.put({
          id: `top-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          userId: currentUser.id,
          targetId,
          subjectId: subId,
          name: top,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    }

    setIsTemplateModalOpen(false);
    setSelectedTargetId(targetId);
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">My Targets & Syllabi</h2>
          <p className="text-xs text-slate-400">Manage your study targets, subjects, and topics.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Sparkles className="w-4 h-4 text-amber-400" />}
            onClick={() => setIsTemplateModalOpen(true)}
          >
            Nepal Exam Templates
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
            Add Target
          </Button>
        </div>
      </div>

      {/* 3-Column Hierarchy Explorer (Target -> Subject -> Topic) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Targets Column */}
        <Card className="p-4 border-slate-800 flex flex-col h-[600px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <TargetIcon className="w-4 h-4 text-brand-400" />
              <span>Targets ({targets.length})</span>
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
              className="text-xs text-brand-400 hover:text-brand-300 font-semibold"
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
                      ? 'bg-brand-600/10 border-brand-500/50 text-white shadow-sm'
                      : 'bg-slate-900/40 border-slate-800/80 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5 truncate">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: target.color }} />
                      <div className="truncate">
                        <p className="font-bold text-sm truncate">{target.name}</p>
                        <p className="text-[11px] text-slate-400">{target.type} • {target.dailyGoalMinutes}m/day</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleEditTarget(target);
                        }}
                        className="p-1 text-slate-500 hover:text-slate-300 rounded"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleDeleteTarget(target.id);
                        }}
                        className="p-1 text-slate-500 hover:text-rose-400 rounded"
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

        {/* 2. Subjects Column */}
        <Card className="p-4 border-slate-800 flex flex-col h-[600px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-sky-400" />
              <span>Subjects ({subjects.length})</span>
            </span>
            {selectedTargetId && (
              <button
                onClick={() => setIsSubjectModalOpen(true)}
                className="text-xs text-brand-400 hover:text-brand-300 font-semibold"
              >
                + Add
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 py-3">
            {subjects.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                {selectedTargetId ? 'No subjects added yet. Click + Add to create one.' : 'Select a target first.'}
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
                        ? 'bg-blue-600/10 border-blue-500/50 text-white shadow-sm'
                        : 'bg-slate-900/40 border-slate-800/80 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <p className="font-semibold text-sm">{subject.name}</p>
                    {subject.description && (
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{subject.description}</p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* 3. Topics Column */}
        <Card className="p-4 border-slate-800 flex flex-col h-[600px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Tag className="w-4 h-4 text-sky-400" />
              <span>Topics ({topics.length})</span>
            </span>
            {selectedSubjectId && (
              <button
                onClick={() => setIsTopicModalOpen(true)}
                className="text-xs text-brand-400 hover:text-brand-300 font-semibold"
              >
                + Add
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 py-3">
            {topics.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                {selectedSubjectId ? 'No topics yet. Click + Add to add syllabus topics.' : 'Select a subject first.'}
              </div>
            ) : (
              topics.map(topic => (
                <div
                  key={topic.id}
                  className="p-3 rounded-xl border border-slate-800 bg-slate-900/40 text-slate-200"
                >
                  <p className="font-medium text-xs text-slate-100">{topic.name}</p>
                  {topic.description && (
                    <p className="text-[10px] text-slate-400 mt-0.5">{topic.description}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Target Modal */}
      <Modal
        isOpen={isTargetModalOpen}
        onClose={() => setIsTargetModalOpen(false)}
        title={targetForm.id ? 'Edit Study Target' : 'Create Study Target'}
      >
        <form onSubmit={handleSaveTarget} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Target Name</label>
            <input
              type="text"
              required
              value={targetForm.name}
              onChange={e => setTargetForm({ ...targetForm, name: e.target.value })}
              placeholder="e.g. RBB IT, NRB Assistant, AI Course, College"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Category</label>
              <select
                value={targetForm.type}
                onChange={e => setTargetForm({ ...targetForm, type: e.target.value as TargetType })}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none"
              >
                <option value="Competitive Exam">Competitive Exam</option>
                <option value="College">College</option>
                <option value="Course">Course</option>
                <option value="Certification">Certification</option>
                <option value="Custom">Custom</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Color Theme</label>
              <div className="flex items-center gap-2 pt-1">
                {['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#8b5cf6'].map(col => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setTargetForm({ ...targetForm, color: col })}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${
                      targetForm.color === col ? 'border-white scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: col }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Daily Goal (Minutes)</label>
              <input
                type="number"
                min="15"
                step="15"
                value={targetForm.dailyGoalMinutes}
                onChange={e => setTargetForm({ ...targetForm, dailyGoalMinutes: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Exam Date (Optional)</label>
              <input
                type="date"
                value={targetForm.deadlineDate}
                onChange={e => setTargetForm({ ...targetForm, deadlineDate: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" type="button" onClick={() => setIsTargetModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Save Target
            </Button>
          </div>
        </form>
      </Modal>

      {/* Nepal Template Quick Import Modal */}
      <Modal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        title="Import Nepal Exam Track"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-400">
            Select a standard Nepal examination template. It will create the target with all official subjects and syllabus topics.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(NEPAL_EXAM_TEMPLATES).map(([key, tmpl]) => (
              <div
                key={key}
                onClick={() => handleImportTemplate(key)}
                className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 hover:border-brand-500 hover:bg-brand-500/10 cursor-pointer transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: tmpl.color }} />
                    <h4 className="font-bold text-sm text-white">{tmpl.name}</h4>
                  </div>
                  <p className="text-xs text-slate-400 mb-3">{tmpl.subjects.length} Subjects • {tmpl.dailyGoalMinutes}m daily target</p>
                  <div className="flex flex-wrap gap-1">
                    {tmpl.subjects.slice(0, 3).map(s => (
                      <span key={s.name} className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {s.name}
                      </span>
                    ))}
                    {tmpl.subjects.length > 3 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                        +{tmpl.subjects.length - 3} more
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-800/80 flex justify-end">
                  <span className="text-xs font-semibold text-brand-400">+ Import Track</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* Subject Modal */}
      <Modal
        isOpen={isSubjectModalOpen}
        onClose={() => setIsSubjectModalOpen(false)}
        title={`Add Subject to ${activeTarget?.name || 'Target'}`}
      >
        <form onSubmit={handleSaveSubject} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Subject Name</label>
            <input
              type="text"
              required
              value={subjectName}
              onChange={e => setSubjectName(e.target.value)}
              placeholder="e.g. Computer Networks, Banking Laws"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Description (Optional)</label>
            <textarea
              value={subjectDescription}
              onChange={e => setSubjectDescription(e.target.value)}
              placeholder="Brief overview of topics covered..."
              rows={3}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setIsSubjectModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Save Subject
            </Button>
          </div>
        </form>
      </Modal>

      {/* Topic Modal */}
      <Modal
        isOpen={isTopicModalOpen}
        onClose={() => setIsTopicModalOpen(false)}
        title={`Add Topic to ${activeSubject?.name || 'Subject'}`}
      >
        <form onSubmit={handleSaveTopic} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Topic Name</label>
            <input
              type="text"
              required
              value={topicName}
              onChange={e => setTopicName(e.target.value)}
              placeholder="e.g. Switching Technology, BAFIA Section 15"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setIsTopicModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Save Topic
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
