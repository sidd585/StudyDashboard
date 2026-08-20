import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { courseService } from '../services/courseService';
import { extractSyllabusFromFile } from '../services/syllabusExtractor';
import { type CloudCourse, type CloudSubject, type CloudTopic } from '../lib/supabase';
import { getExamCountdown } from '../utils/dateCountdownUtils';
import type { ExtractedTopicSection } from '../types';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import {
  BookOpen,
  Plus,
  Edit2,
  Trash2,
  Upload,
  FileText,
  CheckCircle2,
  Layers,
  ChevronRight,
  ChevronDown,
  Clock,
  Sparkles,
  AlertCircle,
  Hourglass,
  Calendar,
  Settings2,
} from 'lucide-react';

export const Courses: React.FC = () => {
  const { currentUser } = useUser();

  const [courses, setCourses] = useState<CloudCourse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<CloudSubject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [topics, setTopics] = useState<CloudTopic[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modal States
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [isEditCourseModalOpen, setIsEditCourseModalOpen] = useState(false);
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [isEditSubjectModalOpen, setIsEditSubjectModalOpen] = useState(false);
  const [isEditTopicModalOpen, setIsEditTopicModalOpen] = useState(false);
  const [isSyllabusUploadModalOpen, setIsSyllabusUploadModalOpen] = useState(false);
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);

  // Create Course Form State
  const [courseName, setCourseName] = useState('');
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState<number>(60);
  const [examDate, setExamDate] = useState<string>('');
  const [isSubmittingCourse, setIsSubmittingCourse] = useState(false);
  const [courseError, setCourseError] = useState<string | null>(null);

  // Edit Course Form State
  const [editingCourse, setEditingCourse] = useState<CloudCourse | null>(null);
  const [editCourseName, setEditCourseName] = useState('');
  const [editDailyGoalMinutes, setEditDailyGoalMinutes] = useState<number>(60);
  const [editExamDate, setEditExamDate] = useState<string>('');
  const [editCourseError, setEditCourseError] = useState<string | null>(null);
  const [isUpdatingCourse, setIsUpdatingCourse] = useState(false);

  // Subject Form State
  const [subjectName, setSubjectName] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [subjectError, setSubjectError] = useState<string | null>(null);
  const [editingSubject, setEditingSubject] = useState<CloudSubject | null>(null);

  // Topic Form State
  const [topicName, setTopicName] = useState('');
  const [topicCode, setTopicCode] = useState('');
  const [topicError, setTopicError] = useState<string | null>(null);
  const [editingTopic, setEditingTopic] = useState<CloudTopic | null>(null);

  // Syllabus Extractor Upload & Confirmation State
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedSections, setExtractedSections] = useState<ExtractedTopicSection[]>([]);
  const [extractedStats, setExtractedStats] = useState<{ totalTopics: number; totalLessons: number } | null>(null);
  const [syllabusFileName, setSyllabusFileName] = useState('');
  const [uploadStatusMsg, setUploadStatusMsg] = useState<string | null>(null);

  // 1. Fetch Courses
  const loadCourses = async () => {
    setLoading(true);
    try {
      const data = await courseService.getCourses();
      setCourses(data);
      if (data.length > 0) {
        if (!selectedCourseId || !data.some(c => c.id === selectedCourseId)) {
          setSelectedCourseId(data[0].id);
        }
      } else {
        setSelectedCourseId(null);
      }
    } catch (err) {
      console.error('Error fetching courses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, [currentUser.id]);

  // 2. Fetch Subjects when selected course changes
  const loadSubjects = async () => {
    if (!selectedCourseId) {
      setSubjects([]);
      setSelectedSubjectId(null);
      return;
    }
    try {
      const data = await courseService.getSubjects(selectedCourseId);
      setSubjects(data);
      if (data.length > 0) {
        if (!selectedSubjectId || !data.some(s => s.id === selectedSubjectId)) {
          setSelectedSubjectId(data[0].id);
        }
      } else {
        setSelectedSubjectId(null);
      }
    } catch (err) {
      console.error('Error loading subjects:', err);
    }
  };

  useEffect(() => {
    loadSubjects();
  }, [selectedCourseId]);

  // 3. Fetch Topics when course or subject changes
  const loadTopics = async () => {
    if (!selectedCourseId) {
      setTopics([]);
      return;
    }
    try {
      const data = await courseService.getTopics(selectedCourseId, selectedSubjectId || undefined);
      setTopics(data);
    } catch (err) {
      console.error('Error loading topics:', err);
    }
  };

  useEffect(() => {
    loadTopics();
  }, [selectedCourseId, selectedSubjectId]);

  const activeCourse = courses.find(c => c.id === selectedCourseId);
  const activeSubject = subjects.find(s => s.id === selectedSubjectId);

  // Handle Save Course (Name, Daily Goal, Exam Date with Deduplication)
  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseName.trim()) return;

    setIsSubmittingCourse(true);
    setCourseError(null);

    try {
      const newCourse = await courseService.createCourse({
        name: courseName.trim(),
        dailyGoalMinutes: dailyGoalMinutes || 60,
        examDate: examDate || null,
      });

      if (newCourse) {
        setCourses(prev => [...prev, newCourse]);
        setSelectedCourseId(newCourse.id);
        setIsCourseModalOpen(false);
        setCourseName('');
        setExamDate('');
        setDailyGoalMinutes(60);
      } else {
        setCourseError('Could not save course. Please check your connection and try again.');
      }
    } catch (err: any) {
      console.error('Error in handleSaveCourse:', err);
      setCourseError(err.message || 'Failed to create course');
    } finally {
      setIsSubmittingCourse(false);
    }
  };

  // Open Edit Course Modal
  const handleOpenEditCourse = (course: CloudCourse) => {
    setEditingCourse(course);
    setEditCourseName(course.name);
    setEditDailyGoalMinutes(course.daily_goal_minutes || 60);
    setEditExamDate(course.exam_date ? course.exam_date.split('T')[0] : '');
    setEditCourseError(null);
    setIsEditCourseModalOpen(true);
  };

  // Handle Update Course
  const handleUpdateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourse || !editCourseName.trim()) return;

    setIsUpdatingCourse(true);
    setEditCourseError(null);

    try {
      const success = await courseService.updateCourse(editingCourse.id, {
        name: editCourseName.trim(),
        dailyGoalMinutes: editDailyGoalMinutes || 60,
        examDate: editExamDate || null,
      });

      if (success) {
        setCourses(prev => prev.map(c => c.id === editingCourse.id ? {
          ...c,
          name: editCourseName.trim(),
          daily_goal_minutes: editDailyGoalMinutes || 60,
          exam_date: editExamDate || null,
        } : c));
        setIsEditCourseModalOpen(false);
        setEditingCourse(null);
      } else {
        setEditCourseError('Failed to update course.');
      }
    } catch (err: any) {
      setEditCourseError(err?.message || 'Failed to update course.');
    } finally {
      setIsUpdatingCourse(false);
    }
  };

  // Handle Save Subject with Deduplication
  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId || !subjectName.trim()) return;
    setSubjectError(null);

    try {
      const newSub = await courseService.createSubject({
        courseId: selectedCourseId,
        name: subjectName.trim(),
        code: subjectCode.trim() || undefined,
        sortOrder: subjects.length + 1,
      });

      if (newSub) {
        setSubjects(prev => [...prev, newSub]);
        setSelectedSubjectId(newSub.id);
        setIsSubjectModalOpen(false);
        setSubjectName('');
        setSubjectCode('');
      }
    } catch (err: any) {
      console.error('Error saving subject:', err);
      setSubjectError(err?.message || 'Failed to save subject.');
    }
  };

  // Handle Update Subject
  const handleUpdateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubject || !subjectName.trim()) return;
    setSubjectError(null);

    try {
      const success = await courseService.updateSubject(editingSubject.id, {
        courseId: selectedCourseId || undefined,
        name: subjectName.trim(),
        code: subjectCode.trim() || undefined,
      });

      if (success) {
        setSubjects(prev => prev.map(s => s.id === editingSubject.id ? { ...s, name: subjectName.trim(), code: subjectCode.trim() || undefined } : s));
        setIsEditSubjectModalOpen(false);
        setEditingSubject(null);
        setSubjectName('');
        setSubjectCode('');
      }
    } catch (err: any) {
      setSubjectError(err?.message || 'Failed to update subject.');
    }
  };

  // Handle Save Topic with Deduplication
  const handleSaveTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId || !topicName.trim()) return;
    setTopicError(null);

    try {
      const newTopic = await courseService.createTopic(
        selectedCourseId,
        topicName.trim(),
        selectedSubjectId || null,
        null,
        topicCode.trim() || undefined,
        topics.length + 1
      );

      if (newTopic) {
        setTopics(prev => [...prev, newTopic]);
        setIsTopicModalOpen(false);
        setTopicName('');
        setTopicCode('');
      }
    } catch (err: any) {
      console.error('Error creating topic:', err);
      setTopicError(err?.message || 'Failed to create topic.');
    }
  };

  // Handle Update Topic
  const handleUpdateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTopic || !topicName.trim()) return;
    setTopicError(null);

    try {
      const success = await courseService.updateTopic(editingTopic.id, {
        name: topicName.trim(),
        code: topicCode.trim() || undefined,
      });

      if (success) {
        setTopics(prev => prev.map(t => t.id === editingTopic.id ? { ...t, name: topicName.trim(), code: topicCode.trim() || undefined } : t));
        setIsEditTopicModalOpen(false);
        setEditingTopic(null);
        setTopicName('');
        setTopicCode('');
      }
    } catch (err: any) {
      setTopicError(err?.message || 'Failed to update topic.');
    }
  };

  // Handle Delete Course
  const handleDeleteCourse = async (courseId: string) => {
    if (!window.confirm('Are you sure you want to delete this course and all its subjects and topics?')) return;
    const success = await courseService.deleteCourse(courseId);
    if (success) {
      const remaining = courses.filter(c => c.id !== courseId);
      setCourses(remaining);
      setSelectedCourseId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  // Handle Delete Subject
  const handleDeleteSubject = async (subjectId: string) => {
    if (!window.confirm('Are you sure you want to delete this subject and its topics?')) return;
    const success = await courseService.deleteSubject(subjectId);
    if (success) {
      const remaining = subjects.filter(s => s.id !== subjectId);
      setSubjects(remaining);
      setSelectedSubjectId(remaining.length > 0 ? remaining[0].id : null);
      loadTopics();
    }
  };

  // Handle Delete Topic
  const handleDeleteTopic = async (topicId: string) => {
    if (!window.confirm('Are you sure you want to delete this topic?')) return;
    const success = await courseService.deleteTopic(topicId);
    if (success) {
      setTopics(prev => prev.filter(t => t.id !== topicId));
    }
  };

  // Handle File Upload for Syllabus Extractor (Optional helper)
  const handleSyllabusFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    setUploadStatusMsg('Reading and extracting topics from syllabus...');

    try {
      const result = await extractSyllabusFromFile(file);
      setExtractedSections(result.sections);
      setExtractedStats({
        totalTopics: result.totalTopics,
        totalLessons: result.totalLessons,
      });
      setSyllabusFileName(file.name);
      setIsSyllabusUploadModalOpen(false);
      setIsConfirmationModalOpen(true);
    } catch (err) {
      console.error('Error extracting syllabus:', err);
      alert('Failed to extract syllabus. You can still add topics manually.');
    } finally {
      setIsExtracting(false);
      setUploadStatusMsg(null);
    }
  };

  // Confirm Extracted Hierarchy Save
  const handleConfirmSyllabusSave = async () => {
    if (!selectedCourseId || extractedSections.length === 0) return;

    try {
      await courseService.saveSyllabusHierarchy(
        selectedCourseId,
        selectedSubjectId || null,
        extractedSections,
        syllabusFileName
      );
      setIsConfirmationModalOpen(false);
      loadTopics();
    } catch (err) {
      console.error('Error saving extracted syllabus:', err);
      alert('Error saving syllabus topics.');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-fade-in text-[#101828] dark:text-[#f8f9fc] transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#101828] dark:text-[#f8f9fc] tracking-tight flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#5b5bd6]" />
            <span>My Courses & Study Structure</span>
          </h1>
          <p className="text-xs text-[#64748b] dark:text-[#9496a8] mt-0.5">
            Organize your learning path: Course → Subject → Topics.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          className="bg-[#5b5bd6] hover:bg-[#4a4ac9] text-white font-bold shadow-xs self-start sm:self-auto"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => {
            setCourseName('');
            setDailyGoalMinutes(60);
            setCourseError(null);
            setIsCourseModalOpen(true);
          }}
        >
          + Create Course
        </Button>
      </div>

      {/* Main Course Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Course Selection List (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-[#64748b] dark:text-[#9496a8] uppercase tracking-wider">
              Your Courses ({courses.length})
            </h2>
          </div>

          <div className="space-y-2">
            {courses.length > 0 ? (
              courses.map(course => {
                const isSelected = course.id === selectedCourseId;
                const countdown = getExamCountdown(course.exam_date);

                return (
                  <div
                    key={course.id}
                    onClick={() => setSelectedCourseId(course.id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-white dark:bg-[#181d2f] border-[#5b5bd6] shadow-sm'
                        : 'bg-white/80 dark:bg-[#141824] border-[#e2e8f0] dark:border-[#23293d] hover:border-[#94a3b8] dark:hover:border-[#334155]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: course.color || '#5b5bd6' }}
                      />
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-[#101828] dark:text-[#f8f9fc] truncate">
                          {course.name}
                        </h3>
                        <div className="flex items-center gap-2 flex-wrap mt-0.5">
                          <p className="text-[11px] text-[#64748b] dark:text-[#9496a8] flex items-center gap-1">
                            <Clock className="w-3 h-3 text-[#5b5bd6]" />
                            <span>{course.daily_goal_minutes || 60}m/d</span>
                          </p>

                          {countdown.hasExamDate && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-md border font-bold ${countdown.badgeColorClass}`}>
                              {countdown.formattedCountdown}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditCourse(course);
                        }}
                        className="p-1.5 text-[#94a3b8] hover:text-[#5b5bd6] rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        title="Edit Course & Exam Date"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCourse(course.id);
                        }}
                        className="p-1.5 text-[#94a3b8] hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                        title="Delete Course"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <ChevronRight
                        className={`w-4 h-4 transition-transform ${
                          isSelected ? 'text-[#5b5bd6] translate-x-0.5' : 'text-[#94a3b8]'
                        }`}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <Card className="p-6 text-center text-xs text-[#64748b] dark:text-[#9496a8] space-y-3">
                <p>No courses created yet.</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-white dark:bg-[#181d2f] text-[#5b5bd6] border-[#e2e8f0] dark:border-[#2b334d] font-bold"
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => {
                    setCourseName('');
                    setDailyGoalMinutes(60);
                    setExamDate('');
                    setCourseError(null);
                    setIsCourseModalOpen(true);
                  }}
                >
                  Create First Course
                </Button>
              </Card>
            )}
          </div>
        </div>

        {/* Right Side: Subjects & Topics Manager (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {activeCourse ? (
            <div className="space-y-6">
              {/* Course Detail Card Header */}
              <Card className="p-6 border-[#e2e8f0] dark:border-[#23293d] bg-white dark:bg-[#141824] shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: activeCourse.color || '#5b5bd6' }} />
                    <h2 className="text-lg font-bold text-[#101828] dark:text-[#f8f9fc]">
                      {activeCourse.name}
                    </h2>

                    {/* Active Course Exam Countdown Badge */}
                    {(() => {
                      const countdown = getExamCountdown(activeCourse.exam_date);
                      if (countdown.hasExamDate) {
                        return (
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs border font-bold ${countdown.badgeColorClass}`}>
                            <Hourglass className="w-3.5 h-3.5" />
                            <span>{countdown.formattedCountdown}</span>
                            <span className="opacity-70 font-normal">({countdown.formattedExamDate})</span>
                          </div>
                        );
                      }
                      return (
                        <button
                          onClick={() => handleOpenEditCourse(activeCourse)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-[#5b5bd6] border border-slate-200 dark:border-slate-700 transition-colors"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span>+ Set Exam Date</span>
                        </button>
                      );
                    })()}
                  </div>

                  <p className="text-xs text-[#64748b] dark:text-[#9496a8] flex items-center gap-2 flex-wrap">
                    <span>Daily Goal: <strong className="text-[#5b5bd6] dark:text-[#8282ea]">{activeCourse.daily_goal_minutes || 60} mins</strong></span>
                    <span>•</span>
                    <span>{subjects.length} {subjects.length === 1 ? 'Subject' : 'Subjects'}</span>
                    <span>•</span>
                    <span>{topics.length} {topics.length === 1 ? 'Topic' : 'Topics'}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs font-bold bg-white dark:bg-[#181d2f] text-slate-700 dark:text-slate-300 border-[#e2e8f0] dark:border-[#2b334d]"
                    leftIcon={<Settings2 className="w-3.5 h-3.5" />}
                    onClick={() => handleOpenEditCourse(activeCourse)}
                  >
                    Edit Course
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs font-bold bg-white dark:bg-[#181d2f] text-[#5b5bd6] border-[#e2e8f0] dark:border-[#2b334d]"
                    leftIcon={<Plus className="w-3.5 h-3.5" />}
                    onClick={() => {
                      setSubjectName('');
                      setSubjectCode('');
                      setSubjectError(null);
                      setIsSubjectModalOpen(true);
                    }}
                  >
                    + Add Subject
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs text-[#64748b] bg-white dark:bg-[#181d2f] border-[#e2e8f0] dark:border-[#2b334d]"
                    leftIcon={<Upload className="w-3.5 h-3.5" />}
                    onClick={() => setIsSyllabusUploadModalOpen(true)}
                    title="Upload syllabus PDF to extract topics automatically"
                  >
                    Upload Syllabus
                  </Button>
                </div>
              </Card>

              {/* 1. Subjects Tabs */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-[#64748b] dark:text-[#9496a8] uppercase tracking-wider">
                    Subjects / Papers ({subjects.length})
                  </h3>
                </div>

                {subjects.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {subjects.map(s => {
                      const isSelected = s.id === selectedSubjectId;
                      return (
                        <div
                          key={s.id}
                          onClick={() => setSelectedSubjectId(s.id)}
                          className={`group px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 border ${
                            isSelected
                              ? 'bg-[#5b5bd6] text-white border-[#5b5bd6] shadow-xs'
                              : 'bg-white dark:bg-[#181d2f] border-[#e2e8f0] dark:border-[#2b334d] text-[#334155] dark:text-[#cbd5e1] hover:border-[#5b5bd6]'
                          }`}
                        >
                          <span>{s.name} {s.code ? `(${s.code})` : ''}</span>

                          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingSubject(s);
                                setSubjectName(s.name);
                                setSubjectCode(s.code || '');
                                setSubjectError(null);
                                setIsEditSubjectModalOpen(true);
                              }}
                              className="p-0.5 hover:text-white"
                              title="Edit Subject"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSubject(s.id);
                              }}
                              className="p-0.5 hover:text-rose-300"
                              title="Delete Subject"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-dashed border-[#e2e8f0] dark:border-[#2b334d] text-center text-xs text-[#64748b]">
                    <p>No subjects added under this course yet.</p>
                    <button
                      onClick={() => {
                        setSubjectName('');
                        setSubjectCode('');
                        setSubjectError(null);
                        setIsSubjectModalOpen(true);
                      }}
                      className="mt-1 font-bold text-[#5b5bd6] dark:text-[#8282ea] hover:underline"
                    >
                      + Add Subject (e.g. Mathematics, Banking, IT)
                    </button>
                  </div>
                )}
              </div>

              {/* 2. Topics inside Subject */}
              <Card className="p-6 border-[#e2e8f0] dark:border-[#23293d] bg-white dark:bg-[#141824] shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-[#101828] dark:text-[#f8f9fc] flex items-center gap-2">
                      <Layers className="w-4 h-4 text-[#5b5bd6]" />
                      <span>
                        Topics {activeSubject ? `in ${activeSubject.name}` : ''} ({topics.length})
                      </span>
                    </h3>
                    <p className="text-xs text-[#64748b] dark:text-[#9496a8]">
                      Topics and chapters to study and practice questions for
                    </p>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    className="bg-[#5b5bd6] hover:bg-[#4a4ac9] text-white text-xs font-bold"
                    leftIcon={<Plus className="w-3.5 h-3.5" />}
                    onClick={() => {
                      setTopicName('');
                      setTopicCode('');
                      setTopicError(null);
                      setIsTopicModalOpen(true);
                    }}
                  >
                    + Add Topic
                  </Button>
                </div>

                {topics.length > 0 ? (
                  <div className="space-y-2 pt-2">
                    {topics.map((t, idx) => (
                      <div
                        key={t.id}
                        className="p-3.5 rounded-xl border border-[#e2e8f0] dark:border-[#23293d] bg-[#f8fafc] dark:bg-[#181d2f] flex items-center justify-between hover:border-[#5b5bd6]/40 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-lg bg-[#5b5bd6]/10 text-[#5b5bd6] dark:text-[#8282ea] font-extrabold text-xs flex items-center justify-center">
                            {t.code || idx + 1}
                          </span>
                          <div>
                            <h4 className="font-bold text-xs sm:text-sm text-[#101828] dark:text-[#f8f9fc]">
                              {t.name}
                            </h4>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setEditingTopic(t);
                              setTopicName(t.name);
                              setTopicCode(t.code || '');
                              setTopicError(null);
                              setIsEditTopicModalOpen(true);
                            }}
                            className="p-1 text-[#94a3b8] hover:text-[#5b5bd6] transition-colors"
                            title="Edit Topic"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTopic(t.id)}
                            className="p-1 text-[#94a3b8] hover:text-rose-600 transition-colors"
                            title="Delete Topic"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-[#64748b] border border-dashed border-[#e2e8f0] dark:border-[#23293d] rounded-xl space-y-2">
                    <p>No topics added for this subject yet.</p>
                    <p className="text-[11px] text-[#94a3b8]">
                      Add topics like <em>Simple Interest, Compound Interest, Percentage, Profit and Loss</em>.
                    </p>
                    <div className="pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-white dark:bg-[#181d2f] text-[#5b5bd6] font-bold text-xs"
                        leftIcon={<Plus className="w-3.5 h-3.5" />}
                        onClick={() => {
                          setTopicName('');
                          setTopicCode('');
                          setTopicError(null);
                          setIsTopicModalOpen(true);
                        }}
                      >
                        + Add First Topic
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          ) : (
            <Card className="p-12 text-center text-xs text-[#64748b] dark:text-[#9496a8] space-y-2">
              <BookOpen className="w-8 h-8 mx-auto text-[#94a3b8] opacity-50" />
              <p className="font-bold text-sm text-[#101828] dark:text-[#f8f9fc]">Select or create a course</p>
              <p>Choose a course on the left or click <strong>+ Create Course</strong> above.</p>
            </Card>
          )}
        </div>
      </div>

      {/* ================= MODAL 1: ADD COURSE WITH EXAM DATE & COUNTDOWN ================= */}
      <Modal
        isOpen={isCourseModalOpen}
        onClose={() => setIsCourseModalOpen(false)}
        title="Add New Course"
        size="sm"
      >
        <form onSubmit={handleSaveCourse} className="space-y-4 text-[#101828] dark:text-[#f8f9fc]">
          {courseError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{courseError}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">
              Course Name *
            </label>
            <input
              type="text"
              value={courseName}
              onChange={e => setCourseName(e.target.value)}
              placeholder="e.g. RBB Preparation, NRB Assistant, Banking Exam"
              required
              autoFocus
              className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] text-[#101828] dark:text-[#f8f9fc] outline-none focus:border-[#5b5bd6]"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">
              Target Exam Date (Optional)
            </label>
            <input
              type="date"
              value={examDate}
              onChange={e => setExamDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] text-[#101828] dark:text-[#f8f9fc] outline-none focus:border-[#5b5bd6]"
            />
            {examDate && (
              <div className="mt-1.5 p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/40 text-xs flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
                <Hourglass className="w-3.5 h-3.5 shrink-0" />
                <span>Countdown preview: <strong>{getExamCountdown(examDate).formattedCountdown}</strong></span>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">
              Minimum Daily Study Time (Minutes) *
            </label>
            <input
              type="number"
              min={10}
              max={720}
              value={dailyGoalMinutes}
              onChange={e => setDailyGoalMinutes(parseInt(e.target.value) || 60)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] text-[#101828] dark:text-[#f8f9fc] outline-none focus:border-[#5b5bd6]"
            />
            <p className="text-[11px] text-[#64748b] dark:text-[#9496a8]">
              e.g. 60 minutes target per day for this course
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCourseModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmittingCourse || !courseName.trim()}
              className="bg-[#5b5bd6] hover:bg-[#4a4ac9] text-white font-bold"
            >
              {isSubmittingCourse ? 'Creating...' : 'Create Course'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ================= MODAL: EDIT COURSE ================= */}
      <Modal
        isOpen={isEditCourseModalOpen}
        onClose={() => setIsEditCourseModalOpen(false)}
        title="Edit Course & Exam Date"
        size="sm"
      >
        <form onSubmit={handleUpdateCourse} className="space-y-4 text-[#101828] dark:text-[#f8f9fc]">
          {editCourseError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{editCourseError}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">
              Course Name *
            </label>
            <input
              type="text"
              value={editCourseName}
              onChange={e => setEditCourseName(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] text-[#101828] dark:text-[#f8f9fc] outline-none focus:border-[#5b5bd6]"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">
              Target Exam Date (Optional)
            </label>
            <input
              type="date"
              value={editExamDate}
              onChange={e => setEditExamDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] text-[#101828] dark:text-[#f8f9fc] outline-none focus:border-[#5b5bd6]"
            />
            {editExamDate && (
              <div className="mt-1.5 p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/40 text-xs flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
                <Hourglass className="w-3.5 h-3.5 shrink-0" />
                <span>Countdown preview: <strong>{getExamCountdown(editExamDate).formattedCountdown}</strong></span>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">
              Minimum Daily Study Time (Minutes) *
            </label>
            <input
              type="number"
              min={10}
              max={720}
              value={editDailyGoalMinutes}
              onChange={e => setEditDailyGoalMinutes(parseInt(e.target.value) || 60)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] text-[#101828] dark:text-[#f8f9fc] outline-none focus:border-[#5b5bd6]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditCourseModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isUpdatingCourse || !editCourseName.trim()}
              className="bg-[#5b5bd6] hover:bg-[#4a4ac9] text-white font-bold"
            >
              {isUpdatingCourse ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ================= MODAL 2: ADD SUBJECT ================= */}
      <Modal
        isOpen={isSubjectModalOpen}
        onClose={() => setIsSubjectModalOpen(false)}
        title={`Add Subject to ${activeCourse?.name || 'Course'}`}
        size="sm"
      >
        <form onSubmit={handleSaveSubject} className="space-y-4 text-[#101828] dark:text-[#f8f9fc]">
          {subjectError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{subjectError}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">
              Subject Name *
            </label>
            <input
              type="text"
              value={subjectName}
              onChange={e => setSubjectName(e.target.value)}
              placeholder="e.g. Mathematics, General Knowledge, Banking"
              required
              autoFocus
              className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] text-[#101828] dark:text-[#f8f9fc] outline-none focus:border-[#5b5bd6]"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">
              Code (Optional)
            </label>
            <input
              type="text"
              value={subjectCode}
              onChange={e => setSubjectCode(e.target.value)}
              placeholder="e.g. MATH-101, PAPER-1"
              className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] text-[#101828] dark:text-[#f8f9fc] outline-none focus:border-[#5b5bd6]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsSubjectModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={!subjectName.trim()}
              className="bg-[#5b5bd6] text-white font-bold"
            >
              Save Subject
            </Button>
          </div>
        </form>
      </Modal>

      {/* ================= MODAL: EDIT SUBJECT ================= */}
      <Modal
        isOpen={isEditSubjectModalOpen}
        onClose={() => setIsEditSubjectModalOpen(false)}
        title="Edit Subject"
        size="sm"
      >
        <form onSubmit={handleUpdateSubject} className="space-y-4 text-[#101828] dark:text-[#f8f9fc]">
          {subjectError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{subjectError}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">
              Subject Name *
            </label>
            <input
              type="text"
              value={subjectName}
              onChange={e => setSubjectName(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] text-[#101828] dark:text-[#f8f9fc] outline-none focus:border-[#5b5bd6]"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">
              Code (Optional)
            </label>
            <input
              type="text"
              value={subjectCode}
              onChange={e => setSubjectCode(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] text-[#101828] dark:text-[#f8f9fc] outline-none focus:border-[#5b5bd6]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditSubjectModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              className="bg-[#5b5bd6] text-white font-bold"
            >
              Update Subject
            </Button>
          </div>
        </form>
      </Modal>

      {/* ================= MODAL 3: ADD TOPIC ================= */}
      <Modal
        isOpen={isTopicModalOpen}
        onClose={() => setIsTopicModalOpen(false)}
        title={`Add Topic ${activeSubject ? `to ${activeSubject.name}` : ''}`}
        size="sm"
      >
        <form onSubmit={handleSaveTopic} className="space-y-4 text-[#101828] dark:text-[#f8f9fc]">
          {topicError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{topicError}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">
              Topic Name *
            </label>
            <input
              type="text"
              value={topicName}
              onChange={e => setTopicName(e.target.value)}
              placeholder="e.g. Simple Interest, Compound Interest, Percentage"
              required
              autoFocus
              className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] text-[#101828] dark:text-[#f8f9fc] outline-none focus:border-[#5b5bd6]"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">
              Topic Code / Number (Optional)
            </label>
            <input
              type="text"
              value={topicCode}
              onChange={e => setTopicCode(e.target.value)}
              placeholder="e.g. 1.1, Unit 1"
              className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] text-[#101828] dark:text-[#f8f9fc] outline-none focus:border-[#5b5bd6]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsTopicModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={!topicName.trim()}
              className="bg-[#5b5bd6] text-white font-bold"
            >
              Save Topic
            </Button>
          </div>
        </form>
      </Modal>

      {/* ================= MODAL: EDIT TOPIC ================= */}
      <Modal
        isOpen={isEditTopicModalOpen}
        onClose={() => setIsEditTopicModalOpen(false)}
        title="Edit Topic"
        size="sm"
      >
        <form onSubmit={handleUpdateTopic} className="space-y-4 text-[#101828] dark:text-[#f8f9fc]">
          {topicError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{topicError}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">
              Topic Name *
            </label>
            <input
              type="text"
              value={topicName}
              onChange={e => setTopicName(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] text-[#101828] dark:text-[#f8f9fc] outline-none focus:border-[#5b5bd6]"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">
              Topic Code (Optional)
            </label>
            <input
              type="text"
              value={topicCode}
              onChange={e => setTopicCode(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#d0d5dd] dark:border-[#2b334d] text-[#101828] dark:text-[#f8f9fc] outline-none focus:border-[#5b5bd6]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditTopicModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              className="bg-[#5b5bd6] text-white font-bold"
            >
              Update Topic
            </Button>
          </div>
        </form>
      </Modal>

      {/* ================= MODAL: OPTIONAL SYLLABUS UPLOAD ================= */}
      <Modal
        isOpen={isSyllabusUploadModalOpen}
        onClose={() => setIsSyllabusUploadModalOpen(false)}
        title="Upload Syllabus Document (Optional)"
        size="md"
      >
        <div className="space-y-4 text-[#101828] dark:text-[#f8f9fc]">
          <p className="text-xs text-[#64748b] dark:text-[#9496a8]">
            Upload an official syllabus PDF or document. The parser will automatically extract chapters and topics for you.
          </p>

          <div className="border-2 border-dashed border-[#cbd5e1] dark:border-[#2b334d] rounded-2xl p-6 text-center space-y-2">
            <Upload className="w-8 h-8 text-[#5b5bd6] mx-auto" />
            <p className="text-xs font-bold">Select Syllabus PDF</p>
            <input
              type="file"
              accept=".pdf,.txt,.md"
              onChange={handleSyllabusFileUpload}
              className="block w-full text-xs text-[#64748b] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#5b5bd6]/10 file:text-[#5b5bd6] cursor-pointer"
            />
          </div>

          {isExtracting && (
            <div className="p-3 bg-[#5b5bd6]/10 text-[#5b5bd6] rounded-xl text-xs font-bold animate-pulse text-center">
              {uploadStatusMsg || 'Analyzing syllabus structure...'}
            </div>
          )}
        </div>
      </Modal>

      {/* ================= MODAL: CONFIRM SYLLABUS EXTRACTION ================= */}
      <Modal
        isOpen={isConfirmationModalOpen}
        onClose={() => setIsConfirmationModalOpen(false)}
        title="Confirm Extracted Syllabus Topics"
        size="lg"
      >
        <div className="space-y-4 text-[#101828] dark:text-[#f8f9fc]">
          <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
            <span>✓ Extracted {extractedStats?.totalTopics || 0} topics from {syllabusFileName}</span>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-2 p-2 border border-[#e2e8f0] dark:border-[#23293d] rounded-xl bg-[#f8fafc] dark:bg-[#181d2f]">
            {extractedSections.map((sec, i) => (
              <div key={i} className="text-xs p-2 bg-white dark:bg-[#141824] rounded-lg border border-[#e2e8f0] dark:border-[#23293d]">
                <strong>{sec.code ? `${sec.code}. ` : ''}{sec.name}</strong>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsConfirmationModalOpen(false)}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleConfirmSyllabusSave} className="bg-[#5b5bd6] text-white font-bold">
              Save Topics to Course
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
