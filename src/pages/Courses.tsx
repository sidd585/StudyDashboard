import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { courseService, type CourseInput, type SubjectInput } from '../services/courseService';
import { extractSyllabusFromFile } from '../services/syllabusExtractor';
import { type CloudCourse, type CloudSubject, type CloudTopic } from '../lib/supabase';
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
  Calendar,
  AlertCircle,
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
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [isSyllabusUploadModalOpen, setIsSyllabusUploadModalOpen] = useState(false);
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);

  // Course Form State
  const [courseName, setCourseName] = useState('');
  const [courseDescription, setCourseDescription] = useState('');
  const [courseYear, setCourseYear] = useState<number>(2027);
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState<number>(60);
  const [courseColor, setCourseColor] = useState('#5b5bd6');

  // Subject Form State
  const [subjectName, setSubjectName] = useState('');
  const [subjectDescription, setSubjectDescription] = useState('');
  const [subjectCode, setSubjectCode] = useState('');

  // Topic / Lesson Form State
  const [topicName, setTopicName] = useState('');
  const [topicCode, setTopicCode] = useState('');
  const [parentTopicId, setParentTopicId] = useState<string | null>(null);

  // Syllabus Extractor Upload & Confirmation State
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedSections, setExtractedSections] = useState<ExtractedTopicSection[]>([]);
  const [extractedStats, setExtractedStats] = useState<{ totalTopics: number; totalLessons: number } | null>(null);
  const [syllabusFileName, setSyllabusFileName] = useState('');
  const [uploadStatusMsg, setUploadStatusMsg] = useState<string | null>(null);

  // Expanded topic IDs for lesson tree
  const [expandedTopicIds, setExpandedTopicIds] = useState<Record<string, boolean>>({});

  // 1. Fetch Courses
  const loadCourses = async () => {
    setLoading(true);
    try {
      const data = await courseService.getCourses();
      setCourses(data);
      if (data.length > 0 && !selectedCourseId) {
        setSelectedCourseId(data[0].id);
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
        setSelectedSubjectId(data[0].id);
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

  // 3. Fetch Topics when course/subject changes
  const loadTopics = async () => {
    if (!selectedCourseId) {
      setTopics([]);
      return;
    }
    try {
      const data = await courseService.getTopics(selectedCourseId, selectedSubjectId || undefined);
      setTopics(data);
      // Auto-expand all top-level topics
      const expanded: Record<string, boolean> = {};
      data.filter(t => !t.parent_topic_id).forEach(t => { expanded[t.id] = true; });
      setExpandedTopicIds(expanded);
    } catch (err) {
      console.error('Error loading topics:', err);
    }
  };

  useEffect(() => {
    loadTopics();
  }, [selectedCourseId, selectedSubjectId]);

  const activeCourse = courses.find(c => c.id === selectedCourseId);
  const activeSubject = subjects.find(s => s.id === selectedSubjectId);

  const topLevelTopics = topics.filter(t => !t.parent_topic_id);
  const getChildLessons = (parentTopicId: string) => topics.filter(t => t.parent_topic_id === parentTopicId);

  // Handle Save Course
  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseName.trim()) return;

    const newCourse = await courseService.createCourse({
      name: courseName.trim(),
      description: courseDescription.trim(),
      year: courseYear,
      dailyGoalMinutes,
      color: courseColor,
    });

    if (newCourse) {
      setCourses(prev => [...prev, newCourse]);
      setSelectedCourseId(newCourse.id);
      setIsCourseModalOpen(false);
      setCourseName('');
      setCourseDescription('');
    }
  };

  // Handle Save Subject
  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId || !subjectName.trim()) return;

    const newSub = await courseService.createSubject({
      courseId: selectedCourseId,
      name: subjectName.trim(),
      description: subjectDescription.trim(),
      code: subjectCode.trim(),
      sortOrder: subjects.length + 1,
    });

    if (newSub) {
      setSubjects(prev => [...prev, newSub]);
      setSelectedSubjectId(newSub.id);
      setIsSubjectModalOpen(false);
      setSubjectName('');
      setSubjectDescription('');
      setSubjectCode('');
    }
  };

  // Handle Save Topic or Lesson
  const handleSaveTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId || !topicName.trim()) return;

    const newTopic = await courseService.createTopic(
      selectedCourseId,
      topicName.trim(),
      selectedSubjectId || null,
      parentTopicId || null,
      topicCode.trim() || undefined,
      topics.length + 1
    );

    if (newTopic) {
      setTopics(prev => [...prev, newTopic]);
      setIsTopicModalOpen(false);
      setTopicName('');
      setTopicCode('');
      setParentTopicId(null);
    }
  };

  // Handle Delete Course
  const handleDeleteCourse = async (courseId: string) => {
    if (!window.confirm('Are you sure you want to delete this course and all its topics/lessons?')) return;
    const success = await courseService.deleteCourse(courseId);
    if (success) {
      const remaining = courses.filter(c => c.id !== courseId);
      setCourses(remaining);
      setSelectedCourseId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  // Handle Delete Topic
  const handleDeleteTopic = async (topicId: string) => {
    const success = await courseService.deleteTopic(topicId);
    if (success) {
      setTopics(prev => prev.filter(t => t.id !== topicId && t.parent_topic_id !== topicId));
    }
  };

  // Handle File Upload for Syllabus Extractor
  const handleSyllabusFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    setUploadStatusMsg('Reading and extracting topics and lessons from syllabus...');

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
      alert('Failed to parse syllabus file. Please verify it is a valid text or PDF document.');
    } finally {
      setIsExtracting(false);
      setUploadStatusMsg(null);
    }
  };

  // Confirm Extracted Syllabus and Save to Supabase
  const handleConfirmSyllabusSave = async () => {
    if (!selectedCourseId || extractedSections.length === 0) return;

    setIsExtracting(true);
    try {
      await courseService.saveSyllabusHierarchy(
        selectedCourseId,
        selectedSubjectId || null,
        extractedSections,
        syllabusFileName
      );
      setIsConfirmationModalOpen(false);
      setExtractedSections([]);
      setExtractedStats(null);
      await loadTopics();
    } catch (err) {
      console.error('Failed to save extracted syllabus hierarchy:', err);
      alert('Error saving syllabus topics to cloud.');
    } finally {
      setIsExtracting(false);
    }
  };

  const toggleTopicExpand = (topicId: string) => {
    setExpandedTopicIds(prev => ({
      ...prev,
      [topicId]: !prev[topicId],
    }));
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-fade-in text-[#172033] dark:text-[#f8f9fc] transition-colors">
      {/* Header & Add Course Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#172033] dark:text-[#f8f9fc] tracking-tight flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#5b5bd6]" />
            <span>My Courses</span>
          </h1>
          <p className="text-xs text-[#64748b] dark:text-[#9496a8] mt-0.5">
            Manage your courses, academic years, papers, syllabus topics, and lesson hierarchy.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          className="bg-[#5b5bd6] hover:bg-[#4a4ac9] text-white font-bold self-start sm:self-auto shadow-xs"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => setIsCourseModalOpen(true)}
        >
          + Add Course
        </Button>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Course List (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <h2 className="text-xs font-bold text-[#64748b] dark:text-[#9496a8] uppercase tracking-wider">
            Your Courses ({courses.length})
          </h2>

          {courses.length > 0 ? (
            <div className="space-y-2.5">
              {courses.map(c => {
                const isSelected = c.id === selectedCourseId;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCourseId(c.id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${
                      isSelected
                        ? 'bg-[#eef2f6] dark:bg-[#1f2538] border-[#5b5bd6]/40 shadow-indigo-500/5'
                        : 'bg-[#fbfcfe] dark:bg-[#141824] border-[#e2e8f0] dark:border-[#23293d] hover:border-[#cbd5e1]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: c.color || '#5b5bd6' }}
                        />
                        <div>
                          <h3 className="font-bold text-sm text-[#172033] dark:text-[#f8f9fc] leading-tight">
                            {c.name}
                          </h3>
                          {c.year && (
                            <span className="inline-block text-[10px] font-bold text-[#5b5bd6] dark:text-[#8282ea] mt-0.5">
                              Exam Year: {c.year}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCourse(c.id);
                        }}
                        className="text-[#94a3b8] hover:text-rose-600 p-1 transition-colors"
                        title="Delete Course"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-3 mt-3 pt-2.5 border-t border-[#e2e8f0]/60 dark:border-[#23293d]/60 text-[11px] text-[#64748b]">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#5b5bd6]" />
                        <span>Goal: {c.daily_goal_minutes}m/day</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Card className="p-6 text-center text-xs text-[#64748b] border-[#e2e8f0] dark:border-[#23293d]">
              <p>No courses found.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 text-xs font-bold bg-white dark:bg-[#181d2f] text-[#5b5bd6]"
                onClick={() => setIsCourseModalOpen(true)}
              >
                + Create Course
              </Button>
            </Card>
          )}
        </div>

        {/* Right Column: Course Hierarchy, Subjects, Syllabus & Topics (8 cols) */}
        <div className="lg:col-span-8 space-y-5">
          {activeCourse ? (
            <div className="space-y-5">
              {/* Course Detail Card */}
              <Card className="p-5 border-[#e2e8f0] dark:border-[#23293d] bg-[#fbfcfe] dark:bg-[#141824] shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#e2e8f0] dark:border-[#23293d]">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-lg font-extrabold text-[#172033] dark:text-[#f8f9fc]">
                        {activeCourse.name}
                      </h2>
                      {activeCourse.year && (
                        <Badge variant="brand" size="sm">
                          Year {activeCourse.year}
                        </Badge>
                      )}
                    </div>
                    {activeCourse.description && (
                      <p className="text-xs text-[#64748b] dark:text-[#9496a8] mt-1">
                        {activeCourse.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-white dark:bg-[#181d2f] text-xs font-bold border-[#e2e8f0] dark:border-[#2b334d] text-[#0284c7]"
                      leftIcon={<Upload className="w-3.5 h-3.5" />}
                      onClick={() => setIsSyllabusUploadModalOpen(true)}
                    >
                      Upload Syllabus
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-white dark:bg-[#181d2f] text-xs font-bold border-[#e2e8f0] dark:border-[#2b334d] text-[#5b5bd6]"
                      leftIcon={<Plus className="w-3.5 h-3.5" />}
                      onClick={() => setIsSubjectModalOpen(true)}
                    >
                      + Add Subject / Paper
                    </Button>
                  </div>
                </div>

                {/* Subjects Tabs */}
                {subjects.length > 0 && (
                  <div className="pt-4 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-[#64748b] dark:text-[#9496a8] mr-1">
                      Papers:
                    </span>
                    <button
                      onClick={() => setSelectedSubjectId(null)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors ${
                        selectedSubjectId === null
                          ? 'bg-[#5b5bd6] text-white shadow-xs'
                          : 'bg-[#eef2f6] dark:bg-[#1f2538] text-[#64748b] hover:text-[#172033] dark:hover:text-white'
                      }`}
                    >
                      All Papers
                    </button>
                    {subjects.map(sub => (
                      <button
                        key={sub.id}
                        onClick={() => setSelectedSubjectId(sub.id)}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors ${
                          selectedSubjectId === sub.id
                            ? 'bg-[#5b5bd6] text-white shadow-xs'
                            : 'bg-[#eef2f6] dark:bg-[#1f2538] text-[#64748b] hover:text-[#172033] dark:hover:text-white'
                        }`}
                      >
                        {sub.name}
                      </button>
                    ))}
                  </div>
                )}
              </Card>

              {/* Topics & Lessons Tree */}
              <Card className="p-5 border-[#e2e8f0] dark:border-[#23293d] bg-[#fbfcfe] dark:bg-[#141824] shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-[#172033] dark:text-[#f8f9fc] flex items-center gap-2">
                      <Layers className="w-4 h-4 text-[#5b5bd6]" />
                      <span>Syllabus Topics & Lessons ({topLevelTopics.length} Topics)</span>
                    </h3>
                    <p className="text-[11px] text-[#64748b] dark:text-[#9496a8]">
                      Organized units and lessons for practice questions and planner sessions
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white dark:bg-[#181d2f] text-xs font-bold border-[#e2e8f0] dark:border-[#2b334d]"
                    leftIcon={<Plus className="w-3 h-3" />}
                    onClick={() => {
                      setParentTopicId(null);
                      setIsTopicModalOpen(true);
                    }}
                  >
                    + Add Topic
                  </Button>
                </div>

                {topLevelTopics.length > 0 ? (
                  <div className="space-y-3 pt-1">
                    {topLevelTopics.map((top, idx) => {
                      const childLessons = getChildLessons(top.id);
                      const isExpanded = expandedTopicIds[top.id] !== false;
                      return (
                        <div
                          key={top.id}
                          className="rounded-xl border border-[#e2e8f0] dark:border-[#23293d] bg-white dark:bg-[#181d2f] overflow-hidden shadow-xs"
                        >
                          {/* Top Level Topic Header */}
                          <div
                            onClick={() => toggleTopicExpand(top.id)}
                            className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-[#f8fafc] dark:hover:bg-[#141824]/60 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <span className="w-6 h-6 rounded-lg bg-[#5b5bd6]/10 text-[#5b5bd6] dark:text-[#8282ea] font-extrabold text-xs flex items-center justify-center">
                                {top.code || idx + 1}
                              </span>
                              <div>
                                <h4 className="font-bold text-xs sm:text-sm text-[#172033] dark:text-[#f8f9fc]">
                                  {top.name}
                                </h4>
                                <span className="text-[11px] text-[#64748b]">
                                  {childLessons.length} {childLessons.length === 1 ? 'Lesson' : 'Lessons'}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setParentTopicId(top.id);
                                  setIsTopicModalOpen(true);
                                }}
                                className="text-xs font-semibold text-[#5b5bd6] dark:text-[#8282ea] hover:underline p-1"
                                title="Add subtopic/lesson"
                              >
                                + Add Lesson
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteTopic(top.id);
                                }}
                                className="text-[#94a3b8] hover:text-rose-600 p-1"
                                title="Delete Topic"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-[#64748b]" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-[#64748b]" />
                              )}
                            </div>
                          </div>

                          {/* Nested Subtopic Lessons */}
                          {isExpanded && childLessons.length > 0 && (
                            <div className="border-t border-[#e2e8f0] dark:border-[#23293d] bg-[#f8fafc] dark:bg-[#141824]/40 px-4 py-2 space-y-1.5">
                              {childLessons.map((lesson) => (
                                <div
                                  key={lesson.id}
                                  className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white dark:hover:bg-[#181d2f] text-xs transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-mono font-bold text-[#5b5bd6]">
                                      {lesson.code || '•'}
                                    </span>
                                    <span className="text-[#334155] dark:text-[#cbd5e1] font-medium">
                                      {lesson.name}
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => handleDeleteTopic(lesson.id)}
                                    className="text-[#94a3b8] hover:text-rose-600 p-1"
                                    title="Delete Lesson"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-[#64748b] border border-dashed border-[#e2e8f0] dark:border-[#23293d] rounded-xl space-y-2">
                    <p>No syllabus topics extracted or added for this course yet.</p>
                    <div className="flex items-center justify-center gap-3 pt-1">
                      <Button
                        variant="primary"
                        size="sm"
                        className="bg-[#5b5bd6] text-white text-xs font-bold"
                        leftIcon={<Upload className="w-3.5 h-3.5" />}
                        onClick={() => setIsSyllabusUploadModalOpen(true)}
                      >
                        Upload Syllabus PDF
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          ) : (
            <Card className="p-8 text-center text-xs text-[#64748b]">
              <p>Select or create a course from the left menu to view subjects and syllabus.</p>
            </Card>
          )}
        </div>
      </div>

      {/* ================= MODAL 1: ADD COURSE ================= */}
      <Modal
        isOpen={isCourseModalOpen}
        onClose={() => setIsCourseModalOpen(false)}
        title="Add New Course"
        size="md"
      >
        <form onSubmit={handleSaveCourse} className="space-y-4 text-[#172033] dark:text-[#f8f9fc]">
          <div className="space-y-1">
            <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">
              Course Name *
            </label>
            <input
              type="text"
              value={courseName}
              onChange={e => setCourseName(e.target.value)}
              placeholder="e.g. RBB Level 5 IT, NRB Assistant, AI Course, College"
              required
              className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] text-[#172033] dark:text-[#f8f9fc] outline-none focus:border-[#5b5bd6]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">
                Academic / Exam Year
              </label>
              <input
                type="number"
                value={courseYear}
                onChange={e => setCourseYear(parseInt(e.target.value) || 2027)}
                className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] text-[#172033] dark:text-[#f8f9fc] outline-none focus:border-[#5b5bd6]"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">
                Daily Study Goal (Minutes)
              </label>
              <input
                type="number"
                value={dailyGoalMinutes}
                onChange={e => setDailyGoalMinutes(parseInt(e.target.value) || 60)}
                className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] text-[#172033] dark:text-[#f8f9fc] outline-none focus:border-[#5b5bd6]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">
              Description (Optional)
            </label>
            <textarea
              value={courseDescription}
              onChange={e => setCourseDescription(e.target.value)}
              placeholder="Syllabus coverage notes or target exam details"
              className="w-full h-16 px-3.5 py-2 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] text-[#172033] dark:text-[#f8f9fc] outline-none focus:border-[#5b5bd6] resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
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
              className="bg-[#5b5bd6] hover:bg-[#4a4ac9] text-white font-bold"
            >
              Create Course
            </Button>
          </div>
        </form>
      </Modal>

      {/* ================= MODAL 2: ADD SUBJECT / PAPER ================= */}
      <Modal
        isOpen={isSubjectModalOpen}
        onClose={() => setIsSubjectModalOpen(false)}
        title="Add Subject / Paper"
        size="md"
      >
        <form onSubmit={handleSaveSubject} className="space-y-4 text-[#172033] dark:text-[#f8f9fc]">
          <div className="space-y-1">
            <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">
              Subject / Paper Name *
            </label>
            <input
              type="text"
              value={subjectName}
              onChange={e => setSubjectName(e.target.value)}
              placeholder="e.g. Paper I — Banking & Management, Database Systems"
              required
              className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] text-[#172033] dark:text-[#f8f9fc] outline-none focus:border-[#5b5bd6]"
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
              placeholder="e.g. PAPER-1, CS-401"
              className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] text-[#172033] dark:text-[#f8f9fc] outline-none focus:border-[#5b5bd6]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
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
              className="bg-[#5b5bd6] text-white font-bold"
            >
              Save Subject
            </Button>
          </div>
        </form>
      </Modal>

      {/* ================= MODAL 3: ADD TOPIC / LESSON ================= */}
      <Modal
        isOpen={isTopicModalOpen}
        onClose={() => setIsTopicModalOpen(false)}
        title={parentTopicId ? 'Add Subtopic / Lesson' : 'Add Top-Level Topic'}
        size="md"
      >
        <form onSubmit={handleSaveTopic} className="space-y-4 text-[#172033] dark:text-[#f8f9fc]">
          <div className="space-y-1">
            <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">
              {parentTopicId ? 'Lesson Name *' : 'Topic Unit Name *'}
            </label>
            <input
              type="text"
              value={topicName}
              onChange={e => setTopicName(e.target.value)}
              placeholder={parentTopicId ? 'e.g. 3.1 Networking Devices' : 'e.g. 3. Computer Network Technologies'}
              required
              className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] text-[#172033] dark:text-[#f8f9fc] outline-none focus:border-[#5b5bd6]"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">
              Code / Unit Number (Optional)
            </label>
            <input
              type="text"
              value={topicCode}
              onChange={e => setTopicCode(e.target.value)}
              placeholder={parentTopicId ? 'e.g. 3.1' : 'e.g. 3'}
              className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] text-[#172033] dark:text-[#f8f9fc] outline-none focus:border-[#5b5bd6]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
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
              className="bg-[#5b5bd6] text-white font-bold"
            >
              Save Topic
            </Button>
          </div>
        </form>
      </Modal>

      {/* ================= MODAL 4: SYLLABUS FILE UPLOAD ================= */}
      <Modal
        isOpen={isSyllabusUploadModalOpen}
        onClose={() => setIsSyllabusUploadModalOpen(false)}
        title="Upload Syllabus Document"
        size="md"
      >
        <div className="space-y-4 text-[#172033] dark:text-[#f8f9fc]">
          <p className="text-xs text-[#64748b] dark:text-[#9496a8]">
            Upload a syllabus PDF or document. The system will automatically detect the main units (e.g. 6 Topics) and nested numbered sections (Lessons) for confirmation.
          </p>

          <div className="border-2 border-dashed border-[#cbd5e1] dark:border-[#2b334d] rounded-2xl p-8 text-center space-y-3 hover:border-[#5b5bd6] transition-colors">
            <Upload className="w-8 h-8 text-[#5b5bd6] mx-auto animate-bounce" />
            <div>
              <p className="text-xs font-bold text-[#172033] dark:text-white">
                Choose Syllabus PDF or Text File
              </p>
              <p className="text-[11px] text-[#64748b]">PDF, TXT up to 10MB</p>
            </div>
            <input
              type="file"
              accept=".pdf,.txt"
              onChange={handleSyllabusFileUpload}
              disabled={isExtracting}
              className="block w-full text-xs text-[#64748b] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#5b5bd6]/10 file:text-[#5b5bd6] hover:file:bg-[#5b5bd6]/20 cursor-pointer"
            />
          </div>

          {isExtracting && (
            <div className="p-3 bg-[#eef2f6] dark:bg-[#1f2538] rounded-xl text-center text-xs font-bold text-[#5b5bd6] animate-pulse">
              {uploadStatusMsg || 'Extracting syllabus hierarchy...'}
            </div>
          )}
        </div>
      </Modal>

      {/* ================= MODAL 5: SYLLABUS CONFIRMATION DIALOG ================= */}
      <Modal
        isOpen={isConfirmationModalOpen}
        onClose={() => setIsConfirmationModalOpen(false)}
        title="Syllabus Extracted Successfully"
        size="lg"
      >
        <div className="space-y-5 text-[#172033] dark:text-[#f8f9fc]">
          <div className="p-4 bg-[#f4fbf7] dark:bg-[#122820] rounded-2xl border border-emerald-500/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              <div>
                <h3 className="text-sm font-bold text-[#172033] dark:text-white">
                  {extractedStats?.totalTopics} Topics · {extractedStats?.totalLessons} Lessons Extracted
                </h3>
                <p className="text-xs text-[#64748b] dark:text-[#9496a8]">
                  Source file: {syllabusFileName}
                </p>
              </div>
            </div>
            <Badge variant="brand">Ready to Save</Badge>
          </div>

          {/* Extracted Hierarchy Preview */}
          <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1 border border-[#e2e8f0] dark:border-[#23293d] rounded-xl p-3 bg-[#f8fafc] dark:bg-[#141824]/40">
            {extractedSections.map((sec, i) => (
              <div key={i} className="p-3 rounded-lg bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#23293d] space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#5b5bd6]">{sec.code || `${i + 1}`}.</span>
                  <span className="text-xs font-bold text-[#172033] dark:text-[#f8f9fc]">{sec.name}</span>
                </div>
                {sec.lessons.length > 0 && (
                  <div className="pl-5 space-y-0.5 pt-1">
                    {sec.lessons.map((les, j) => (
                      <p key={j} className="text-[11px] text-[#64748b]">
                        <span className="font-mono font-bold text-[#5b5bd6] mr-1">{les.code}</span> {les.name}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsConfirmationModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="bg-[#5b5bd6] hover:bg-[#4a4ac9] text-white font-bold"
              onClick={handleConfirmSyllabusSave}
              disabled={isExtracting}
            >
              {isExtracting ? 'Saving to Cloud...' : 'Confirm & Save Hierarchy'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
