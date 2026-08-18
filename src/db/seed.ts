import { db } from './index';
import { USER_PROFILES } from '../lib/supabase';
import type {
  Target,
  Subject,
  Topic,
  Question,
  DailyAllocation,
  StudySession,
  StudySchedule,
} from '../types';
import { format, subDays } from 'date-fns';

export async function seedNepalInitialData(force = false) {
  const existingTargets = await db.targets.count();
  if (existingTargets > 0 && !force) {
    return;
  }

  // Clear existing
  await Promise.all([
    db.targets.clear(),
    db.subjects.clear(),
    db.topics.clear(),
    db.questions.clear(),
    db.dailyAllocations.clear(),
    db.studySessions.clear(),
    db.studySchedules.clear(),
  ]);

  const now = Date.now();
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // 1. SEED SIDDHARTHA TARGETS
  const user1Id = USER_PROFILES.siddhartha.id;
  const user1Targets: Target[] = [
    {
      id: 'target-u1-rbbit',
      userId: user1Id,
      name: 'RBB IT (Level 5/6)',
      type: 'Competitive Exam',
      color: '#6366f1',
      icon: 'Cpu',
      deadlineDate: format(new Date(now + 86400000 * 45), 'yyyy-MM-dd'),
      dailyGoalMinutes: 90,
      weeklyGoalMinutes: 600,
      targetQuestionGoal: 30,
      isArchived: false,
      createdAt: now - 86400000 * 10,
      updatedAt: now - 86400000 * 10,
    },
    {
      id: 'target-u1-nrb',
      userId: user1Id,
      name: 'NRB Assistant',
      type: 'Competitive Exam',
      color: '#0ea5e9',
      icon: 'Building2',
      deadlineDate: format(new Date(now + 86400000 * 60), 'yyyy-MM-dd'),
      dailyGoalMinutes: 60,
      weeklyGoalMinutes: 450,
      targetQuestionGoal: 25,
      isArchived: false,
      createdAt: now - 86400000 * 10,
      updatedAt: now - 86400000 * 10,
    },
    {
      id: 'target-u1-ai',
      userId: user1Id,
      name: 'AI Course',
      type: 'Course',
      color: '#8b5cf6',
      icon: 'Sparkles',
      dailyGoalMinutes: 45,
      weeklyGoalMinutes: 300,
      targetQuestionGoal: 15,
      isArchived: false,
      createdAt: now - 86400000 * 10,
      updatedAt: now - 86400000 * 10,
    },
    {
      id: 'target-u1-college',
      userId: user1Id,
      name: 'College',
      type: 'College',
      color: '#3b82f6',
      icon: 'GraduationCap',
      dailyGoalMinutes: 45,
      weeklyGoalMinutes: 300,
      targetQuestionGoal: 10,
      isArchived: false,
      createdAt: now - 86400000 * 10,
      updatedAt: now - 86400000 * 10,
    }
  ];

  // 2. SEED SHILPA TARGETS
  const user2Id = USER_PROFILES.shilpa.id;
  const user2Targets: Target[] = [
    {
      id: 'target-u2-nrb',
      userId: user2Id,
      name: 'NRB Administration (Level 4)',
      type: 'Competitive Exam',
      color: '#10b981',
      icon: 'Building2',
      deadlineDate: format(new Date(now + 86400000 * 50), 'yyyy-MM-dd'),
      dailyGoalMinutes: 75,
      weeklyGoalMinutes: 500,
      targetQuestionGoal: 25,
      isArchived: false,
      createdAt: now - 86400000 * 10,
      updatedAt: now - 86400000 * 10,
    },
    {
      id: 'target-u2-rbb',
      userId: user2Id,
      name: 'RBB Administration',
      type: 'Competitive Exam',
      color: '#f59e0b',
      icon: 'Briefcase',
      deadlineDate: format(new Date(now + 86400000 * 45), 'yyyy-MM-dd'),
      dailyGoalMinutes: 60,
      weeklyGoalMinutes: 450,
      targetQuestionGoal: 25,
      isArchived: false,
      createdAt: now - 86400000 * 10,
      updatedAt: now - 86400000 * 10,
    },
    {
      id: 'target-u2-sanstha',
      userId: user2Id,
      name: 'Sangathit Sanstha Common Exam',
      type: 'Competitive Exam',
      color: '#06b6d4',
      icon: 'Layers',
      dailyGoalMinutes: 45,
      weeklyGoalMinutes: 300,
      targetQuestionGoal: 20,
      isArchived: false,
      createdAt: now - 86400000 * 10,
      updatedAt: now - 86400000 * 10,
    },
    {
      id: 'target-u2-college',
      userId: user2Id,
      name: 'College',
      type: 'College',
      color: '#ec4899',
      icon: 'GraduationCap',
      dailyGoalMinutes: 45,
      weeklyGoalMinutes: 300,
      targetQuestionGoal: 10,
      isArchived: false,
      createdAt: now - 86400000 * 10,
      updatedAt: now - 86400000 * 10,
    }
  ];

  await db.targets.bulkPut([...user1Targets, ...user2Targets]);

  // 3. SEED ALL SUBJECTS FOR EVERY TARGET
  const subjects: Subject[] = [
    // Siddhartha: RBB IT
    {
      id: 'sub-net-rbb',
      userId: user1Id,
      targetId: 'target-u1-rbbit',
      name: 'Computer Networks',
      description: 'OSI, TCP/IP, Routing, Subnetting, Switching',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'sub-os-rbb',
      userId: user1Id,
      targetId: 'target-u1-rbbit',
      name: 'Operating Systems',
      description: 'Process Management, Deadlocks, Memory & Paging, Linux Administration',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'sub-sec-rbb',
      userId: user1Id,
      targetId: 'target-u1-rbbit',
      name: 'Cybersecurity & IT Policies',
      description: 'Electronic Transaction Act 2063, NRB IT Guidelines 2024, Cryptography',
      createdAt: now,
      updatedAt: now,
    },
    // Siddhartha: NRB Assistant
    {
      id: 'sub-nrb-bank-u1',
      userId: user1Id,
      targetId: 'target-u1-nrb',
      name: 'Banking Structure & Acts',
      description: 'NRB Act 2058, BAFIA 2073, Monetary Policy of Nepal',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'sub-nrb-econ-u1',
      userId: user1Id,
      targetId: 'target-u1-nrb',
      name: 'Economics & General Awareness',
      description: 'Macroeconomics, Inflation, Remittance, Nepal Economy',
      createdAt: now,
      updatedAt: now,
    },
    // Siddhartha: AI Course
    {
      id: 'sub-ai-ml',
      userId: user1Id,
      targetId: 'target-u1-ai',
      name: 'Machine Learning',
      description: 'Supervised, Unsupervised, Neural Networks & PyTorch',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'sub-ai-py',
      userId: user1Id,
      targetId: 'target-u1-ai',
      name: 'Python for AI & Data',
      description: 'NumPy, Pandas, Vector Math, Scikit-Learn',
      createdAt: now,
      updatedAt: now,
    },
    // Siddhartha: College
    {
      id: 'sub-col-compiler',
      userId: user1Id,
      targetId: 'target-u1-college',
      name: 'Compiler Design',
      description: 'Lexical Analysis, Parsing, Syntax Directed Translation',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'sub-col-netprog',
      userId: user1Id,
      targetId: 'target-u1-college',
      name: 'Network Programming',
      description: 'Socket APIs, TCP/UDP Clients and Servers in C# / C++',
      createdAt: now,
      updatedAt: now,
    },

    // Shilpa: NRB Administration
    {
      id: 'sub-bank-laws',
      userId: user2Id,
      targetId: 'target-u2-nrb',
      name: 'Banking & Relevant Laws',
      description: 'NRB Act 2058, BAFIA 2073, Anti-Money Laundering Act 2064, Banking Offence Act',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'sub-mgmt-act',
      userId: user2Id,
      targetId: 'target-u2-nrb',
      name: 'Management & Accounting',
      description: 'Double Entry, Balance Sheet, Budgeting, HR Planning & Motivation',
      createdAt: now,
      updatedAt: now,
    },
    // Shilpa: RBB Administration
    {
      id: 'sub-rbb-admin',
      userId: user2Id,
      targetId: 'target-u2-rbb',
      name: 'Office Management & Communication',
      description: 'Record Keeping, Official Correspondence, Decision Making',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'sub-rbb-acct',
      userId: user2Id,
      targetId: 'target-u2-rbb',
      name: 'Financial Accounting & Auditing',
      description: 'Financial Statements, Trial Balance, Audit Procedures in Nepal',
      createdAt: now,
      updatedAt: now,
    },
    // Shilpa: Sangathit Sanstha
    {
      id: 'sub-sanstha-gk',
      userId: user2Id,
      targetId: 'target-u2-sanstha',
      name: 'General Knowledge & Governance',
      description: 'Constitution of Nepal, Public Governance, Geography & History',
      createdAt: now,
      updatedAt: now,
    },
    // Shilpa: College
    {
      id: 'sub-col-shilpa-fin',
      userId: user2Id,
      targetId: 'target-u2-college',
      name: 'Advanced Financial Management',
      description: 'Capital Structure, Working Capital, Ratio Analysis',
      createdAt: now,
      updatedAt: now,
    }
  ];

  const topics: Topic[] = [
    // Siddhartha topics
    {
      id: 'top-osi-rbb',
      userId: user1Id,
      targetId: 'target-u1-rbbit',
      subjectId: 'sub-net-rbb',
      name: 'OSI Reference Model',
      description: '7-Layer Architecture and Protocol mappings',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'top-subnet-rbb',
      userId: user1Id,
      targetId: 'target-u1-rbbit',
      subjectId: 'sub-net-rbb',
      name: 'Subnetting & CIDR Calculation',
      description: 'VLSM, Network Masks, Usable Host Calculations',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'top-tcp-rbb',
      userId: user1Id,
      targetId: 'target-u1-rbbit',
      subjectId: 'sub-net-rbb',
      name: 'TCP/IP & Transport Layer',
      description: '3-Way Handshake, Flow & Congestion Control',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'top-deadlocks-rbb',
      userId: user1Id,
      targetId: 'target-u1-rbbit',
      subjectId: 'sub-os-rbb',
      name: 'Deadlocks & Concurrency',
      description: 'Coffman Conditions, Banker Algorithm, Semaphores',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'top-ai-reg',
      userId: user1Id,
      targetId: 'target-u1-ai',
      subjectId: 'sub-ai-ml',
      name: 'Linear & Logistic Regression',
      description: 'Cost functions, Gradient Descent, Classification Metrics',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'top-ai-nn',
      userId: user1Id,
      targetId: 'target-u1-ai',
      subjectId: 'sub-ai-ml',
      name: 'Neural Networks Basics',
      description: 'Perceptron, Multi-Layer Perceptrons, Activation Functions',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'top-col-lex',
      userId: user1Id,
      targetId: 'target-u1-college',
      subjectId: 'sub-col-compiler',
      name: 'Lexical Analysis',
      description: 'DFA, NFA, Regular Expressions, Lex tool',
      createdAt: now,
      updatedAt: now,
    },

    // Shilpa topics
    {
      id: 'top-nrb-act',
      userId: user2Id,
      targetId: 'target-u2-nrb',
      subjectId: 'sub-bank-laws',
      name: 'Nepal Rastra Bank Act 2058',
      description: 'Objectives, Board of Directors, Monetary Management',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'top-bafia',
      userId: user2Id,
      targetId: 'target-u2-nrb',
      subjectId: 'sub-bank-laws',
      name: 'BAFIA 2073 Provisions',
      description: 'Bank classification (A, B, C, D), Capital adequacy, Governance',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'top-rbb-corr',
      userId: user2Id,
      targetId: 'target-u2-rbb',
      subjectId: 'sub-rbb-admin',
      name: 'Official Correspondence & Filing',
      description: 'Tippani writing, Official Letter Formats in Nepali & English',
      createdAt: now,
      updatedAt: now,
    }
  ];

  await db.subjects.bulkPut(subjects);
  await db.topics.bulkPut(topics);

  // 4. SEED HIGH-YIELD NEPAL MCQs
  const questions: Question[] = [
    // User 1 questions
    {
      id: 'q-u1-01',
      userId: user1Id,
      targetId: 'target-u1-rbbit',
      subjectId: 'sub-net-rbb',
      topicId: 'top-osi-rbb',
      questionText: 'Which layer of the OSI model is responsible for end-to-end communication and flow control?',
      options: [
        { id: 'A', text: 'Network Layer' },
        { id: 'B', text: 'Transport Layer' },
        { id: 'C', text: 'Data Link Layer' },
        { id: 'D', text: 'Session Layer' },
      ],
      correctOptionId: 'B',
      explanation: 'The Transport Layer (Layer 4) handles end-to-end communication, segmentation, flow control, and error recovery (e.g. TCP/UDP).',
      source: 'RBB IT Past Paper 2079',
      difficulty: 'medium',
      isShared: true,
      isBookmarked: true,
      isDifficult: false,
      tags: ['networking', 'osi', 'rbb-it'],
      createdAt: now - 86400000 * 5,
      updatedAt: now - 86400000 * 5,
      stats: {
        totalAttempts: 3,
        correctAttempts: 3,
        wrongAttempts: 0,
        consecutiveCorrect: 3,
        easeFactor: 2.6,
        intervalDays: 6,
      }
    },
    {
      id: 'q-u1-02',
      userId: user1Id,
      targetId: 'target-u1-rbbit',
      subjectId: 'sub-net-rbb',
      topicId: 'top-subnet-rbb',
      questionText: 'How many usable host IP addresses are available in a subnet with prefix /28?',
      options: [
        { id: 'A', text: '16' },
        { id: 'B', text: '14' },
        { id: 'C', text: '30' },
        { id: 'D', text: '6' },
      ],
      correctOptionId: 'B',
      explanation: 'For /28, host bits = 32 - 28 = 4 bits. Total IPs = 2^4 = 16. Usable hosts = 16 - 2 = 14 (subtracting Network and Broadcast addresses).',
      source: 'Nepal IT Exam Practice',
      difficulty: 'medium',
      isShared: true,
      isBookmarked: false,
      isDifficult: false,
      tags: ['subnetting', 'ip-addressing'],
      createdAt: now - 86400000 * 5,
      updatedAt: now - 86400000 * 5,
      stats: {
        totalAttempts: 2,
        correctAttempts: 2,
        wrongAttempts: 0,
        consecutiveCorrect: 2,
        easeFactor: 2.5,
        intervalDays: 3,
      }
    },
    {
      id: 'q-u1-03',
      userId: user1Id,
      targetId: 'target-u1-rbbit',
      subjectId: 'sub-os-rbb',
      topicId: 'top-deadlocks-rbb',
      questionText: 'Which of the following is NOT one of the four Coffman conditions necessary for a deadlock to occur?',
      options: [
        { id: 'A', text: 'Mutual Exclusion' },
        { id: 'B', text: 'Hold and Wait' },
        { id: 'C', text: 'Preemption' },
        { id: 'D', text: 'Circular Wait' },
      ],
      correctOptionId: 'C',
      explanation: 'The Coffman condition is "No Preemption". If resources can be preempted, deadlocks cannot occur.',
      source: 'Computer Engineering past MCQs',
      difficulty: 'hard',
      isShared: true,
      isBookmarked: false,
      isDifficult: true,
      tags: ['os', 'deadlock'],
      createdAt: now - 86400000 * 4,
      updatedAt: now - 86400000 * 4,
      stats: {
        totalAttempts: 2,
        correctAttempts: 1,
        wrongAttempts: 1,
        consecutiveCorrect: 1,
        easeFactor: 2.3,
        intervalDays: 1,
      }
    },
    {
      id: 'q-u1-04',
      userId: user1Id,
      targetId: 'target-u1-rbbit',
      subjectId: 'sub-sec-rbb',
      questionText: 'Under the Electronic Transaction Act 2063 (Nepal), what is the maximum punishment for unauthorized computer data alteration?',
      options: [
        { id: 'A', text: 'Fine up to Rs. 50,000 or imprisonment up to 1 year' },
        { id: 'B', text: 'Fine up to Rs. 200,000 or imprisonment up to 3 years, or both' },
        { id: 'C', text: 'Fine up to Rs. 100,000 or imprisonment up to 2 years' },
        { id: 'D', text: 'Fine up to Rs. 500,000' },
      ],
      correctOptionId: 'B',
      explanation: 'Under Section 44/45 of ETA 2063, unauthorized damage/alteration to computer source code is punishable with fine up to 2 Lakhs or up to 3 years imprisonment or both.',
      source: 'Nepal Cyber Law Bank',
      difficulty: 'medium',
      isShared: true,
      isBookmarked: true,
      isDifficult: false,
      tags: ['nepal-law', 'eta2063', 'cyber-security'],
      createdAt: now - 86400000 * 3,
      updatedAt: now - 86400000 * 3,
      stats: {
        totalAttempts: 1,
        correctAttempts: 1,
        wrongAttempts: 0,
        consecutiveCorrect: 1,
        easeFactor: 2.5,
        intervalDays: 1,
      }
    },
    // User 2 questions
    {
      id: 'q-u2-01',
      userId: user2Id,
      targetId: 'target-u2-nrb',
      subjectId: 'sub-bank-laws',
      topicId: 'top-nrb-act',
      questionText: 'According to Nepal Rastra Bank Act 2058, who serves as the Chairman of the Board of Directors of NRB?',
      options: [
        { id: 'A', text: 'Finance Minister' },
        { id: 'B', text: 'Governor of NRB' },
        { id: 'C', text: 'Finance Secretary' },
        { id: 'D', text: 'Senior Deputy Governor' },
      ],
      correctOptionId: 'B',
      explanation: 'Under NRB Act 2058, the Governor of Nepal Rastra Bank is the ex-officio Chairman of the 7-member Board of Directors.',
      source: 'NRB Assistant Level 4 Past Paper',
      difficulty: 'easy',
      isShared: true,
      isBookmarked: true,
      isDifficult: false,
      tags: ['nrb-act', 'banking-law', 'nrb4'],
      createdAt: now - 86400000 * 5,
      updatedAt: now - 86400000 * 5,
      stats: {
        totalAttempts: 4,
        correctAttempts: 4,
        wrongAttempts: 0,
        consecutiveCorrect: 4,
        easeFactor: 2.7,
        intervalDays: 7,
      }
    },
    {
      id: 'q-u2-02',
      userId: user2Id,
      targetId: 'target-u2-nrb',
      subjectId: 'sub-bank-laws',
      topicId: 'top-bafia',
      questionText: 'Under Bank and Financial Institutions Act (BAFIA) 2073, which category represents Development Banks?',
      options: [
        { id: 'A', text: 'Class "A"' },
        { id: 'B', text: 'Class "B"' },
        { id: 'C', text: 'Class "C"' },
        { id: 'D', text: 'Class "D"' },
      ],
      correctOptionId: 'B',
      explanation: 'In Nepal: Class A = Commercial Banks, Class B = Development Banks, Class C = Finance Companies, Class D = Microfinance Financial Institutions.',
      source: 'Nepal Banking Law MCQs',
      difficulty: 'easy',
      isShared: true,
      isBookmarked: false,
      isDifficult: false,
      tags: ['bafia', 'banking-classification'],
      createdAt: now - 86400000 * 4,
      updatedAt: now - 86400000 * 4,
      stats: {
        totalAttempts: 3,
        correctAttempts: 3,
        wrongAttempts: 0,
        consecutiveCorrect: 3,
        easeFactor: 2.6,
        intervalDays: 5,
      }
    }
  ];

  await db.questions.bulkPut(questions);

  // 5. SEED TODAY'S DAILY TIME ALLOCATIONS
  const allocations: DailyAllocation[] = [
    // User 1: 4 Hours Total
    { id: `alloc-u1-1`, userId: user1Id, targetId: 'target-u1-rbbit', date: todayStr, plannedMinutes: 90, createdAt: now },
    { id: `alloc-u1-2`, userId: user1Id, targetId: 'target-u1-nrb', date: todayStr, plannedMinutes: 60, createdAt: now },
    { id: `alloc-u1-3`, userId: user1Id, targetId: 'target-u1-ai', date: todayStr, plannedMinutes: 45, createdAt: now },
    { id: `alloc-u1-4`, userId: user1Id, targetId: 'target-u1-college', date: todayStr, plannedMinutes: 45, createdAt: now },

    // User 2: 3.5 Hours Total
    { id: `alloc-u2-1`, userId: user2Id, targetId: 'target-u2-nrb', date: todayStr, plannedMinutes: 75, createdAt: now },
    { id: `alloc-u2-2`, userId: user2Id, targetId: 'target-u2-rbb', date: todayStr, plannedMinutes: 60, createdAt: now },
    { id: `alloc-u2-3`, userId: user2Id, targetId: 'target-u2-sanstha', date: todayStr, plannedMinutes: 45, createdAt: now },
    { id: `alloc-u2-4`, userId: user2Id, targetId: 'target-u2-college', date: todayStr, plannedMinutes: 30, createdAt: now },
  ];

  await db.dailyAllocations.bulkPut(allocations);

  // 6. SEED REALISTIC HISTORICAL STUDY SESSIONS
  const studySessions: StudySession[] = [
    // User 1 recent sessions
    {
      id: 'sess-u1-01',
      userId: user1Id,
      targetId: 'target-u1-rbbit',
      subjectId: 'sub-net-rbb',
      startTime: now - 3600000 * 3,
      endTime: now - 3600000 * 2.2,
      focusedMinutes: 48,
      breakMinutes: 0,
      activityType: 'Reading',
      focusRating: 5,
      notes: 'Covered OSI 7 layers and TCP 3-way handshake in detail.',
      createdAt: now - 3600000 * 2.2,
    },
    {
      id: 'sess-u1-02',
      userId: user1Id,
      targetId: 'target-u1-rbbit',
      subjectId: 'sub-os-rbb',
      startTime: now - 3600000 * 1.8,
      endTime: now - 3600000 * 1.2,
      focusedMinutes: 36,
      breakMinutes: 0,
      activityType: 'MCQ Practice',
      focusRating: 4,
      notes: 'Practiced 15 Operating Systems questions.',
      createdAt: now - 3600000 * 1.2,
    },
    {
      id: 'sess-u1-03',
      userId: user1Id,
      targetId: 'target-u1-nrb',
      startTime: now - 3600000 * 0.9,
      endTime: now - 3600000 * 0.1,
      focusedMinutes: 48,
      breakMinutes: 0,
      activityType: 'Reading',
      focusRating: 5,
      notes: 'Reviewed Banking Acts & NRB directives.',
      createdAt: now - 3600000 * 0.1,
    },
    // Past days for User 1 7-day chart
    {
      id: 'sess-u1-past1',
      userId: user1Id,
      targetId: 'target-u1-rbbit',
      startTime: subDays(new Date(), 1).getTime(),
      endTime: subDays(new Date(), 1).getTime() + 7200000,
      focusedMinutes: 120,
      breakMinutes: 0,
      activityType: 'Reading',
      focusRating: 5,
      createdAt: subDays(new Date(), 1).getTime(),
    },
    {
      id: 'sess-u1-past2',
      userId: user1Id,
      targetId: 'target-u1-rbbit',
      startTime: subDays(new Date(), 2).getTime(),
      endTime: subDays(new Date(), 2).getTime() + 9000000,
      focusedMinutes: 150,
      breakMinutes: 0,
      activityType: 'Reading',
      focusRating: 4,
      createdAt: subDays(new Date(), 2).getTime(),
    },

    // User 2 recent sessions
    {
      id: 'sess-u2-01',
      userId: user2Id,
      targetId: 'target-u2-nrb',
      subjectId: 'sub-bank-laws',
      startTime: now - 3600000 * 2.5,
      endTime: now - 3600000 * 1.5,
      focusedMinutes: 60,
      breakMinutes: 0,
      activityType: 'Reading',
      focusRating: 5,
      notes: 'Studied NRB Act 2058 Chapter 1 to 5.',
      createdAt: now - 3600000 * 1.5,
    },
    {
      id: 'sess-u2-02',
      userId: user2Id,
      targetId: 'target-u2-rbb',
      startTime: now - 3600000 * 1.1,
      endTime: now - 3600000 * 0.3,
      focusedMinutes: 48,
      breakMinutes: 0,
      activityType: 'MCQ Practice',
      focusRating: 4,
      notes: 'Reviewed Accounting Ratios & BAFIA provisions.',
      createdAt: now - 3600000 * 0.3,
    },
    // Past days for User 2 7-day chart
    {
      id: 'sess-u2-past1',
      userId: user2Id,
      targetId: 'target-u2-nrb',
      startTime: subDays(new Date(), 1).getTime(),
      endTime: subDays(new Date(), 1).getTime() + 6600000,
      focusedMinutes: 110,
      breakMinutes: 0,
      activityType: 'Reading',
      focusRating: 5,
      createdAt: subDays(new Date(), 1).getTime(),
    },
    {
      id: 'sess-u2-past2',
      userId: user2Id,
      targetId: 'target-u2-rbb',
      startTime: subDays(new Date(), 2).getTime(),
      endTime: subDays(new Date(), 2).getTime() + 7800000,
      focusedMinutes: 130,
      breakMinutes: 0,
      activityType: 'Reading',
      focusRating: 5,
      createdAt: subDays(new Date(), 2).getTime(),
    },
  ];

  await db.studySessions.bulkPut(studySessions);

  // 7. SEED TODAY'S STUDY SCHEDULES
  const schedules: StudySchedule[] = [
    {
      id: 'sched-u1-1',
      userId: user1Id,
      targetId: 'target-u1-rbbit',
      title: 'Networking OSI & Subnetting Practice',
      date: todayStr,
      startTime: '19:00',
      durationMinutes: 60,
      emailReminderSent: false,
      isCompleted: true,
      createdAt: now,
    },
    {
      id: 'sched-u2-1',
      userId: user2Id,
      targetId: 'target-u2-nrb',
      title: 'BAFIA & Banking Laws Drill',
      date: todayStr,
      startTime: '19:30',
      durationMinutes: 60,
      emailReminderSent: false,
      isCompleted: true,
      createdAt: now,
    }
  ];

  await db.studySchedules.bulkPut(schedules);
}

/**
 * Resets all study sessions and attempts to 0 (Day 0 Start).
 */
export async function resetAllProgressToZero(mode: 'all' | 'user', userId?: string) {
  if (mode === 'all') {
    await Promise.all([
      db.studySessions.clear(),
      db.attempts.clear(),
      db.quizSessions.clear(),
    ]);
  } else if (userId) {
    await Promise.all([
      db.studySessions.where('userId').equals(userId).delete(),
      db.attempts.where('userId').equals(userId).delete(),
      db.quizSessions.where('userId').equals(userId).delete(),
    ]);
  }
}
