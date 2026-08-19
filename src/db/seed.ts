import { db } from './index';
import { USER_PROFILES } from '../lib/supabase';
import type {
  Target,
  Subject,
  Topic,
  Question,
  DailyAllocation,
  StudySchedule,
} from '../types';
import { format } from 'date-fns';

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
      name: 'RBB IT (Level 5)',
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
      id: 'target-u2-sanstha',
      userId: user2Id,
      name: 'Sangathit Sanstha Common Exam',
      type: 'Competitive Exam',
      color: '#06b6d4',
      icon: 'Layers',
      deadlineDate: format(new Date(now + 86400000 * 45), 'yyyy-MM-dd'),
      dailyGoalMinutes: 75,
      weeklyGoalMinutes: 500,
      targetQuestionGoal: 25,
      isArchived: false,
      createdAt: now - 86400000 * 10,
      updatedAt: now - 86400000 * 10,
    },
    {
      id: 'target-u2-nrb',
      userId: user2Id,
      name: 'NRB Administration (Level 4)',
      type: 'Competitive Exam',
      color: '#10b981',
      icon: 'Building2',
      deadlineDate: format(new Date(now + 86400000 * 50), 'yyyy-MM-dd'),
      dailyGoalMinutes: 60,
      weeklyGoalMinutes: 450,
      targetQuestionGoal: 20,
      isArchived: false,
      createdAt: now - 86400000 * 10,
      updatedAt: now - 86400000 * 10,
    }
  ];

  await db.targets.bulkPut([...user1Targets, ...user2Targets]);

  // 3. SEED OFFICIAL SYLLABUS TOPICS FOR RBB IT (Paper II: 6 Parts)
  const rbbSubjects: Subject[] = [
    {
      id: 'sub-rbbit-paper2',
      userId: user1Id,
      targetId: 'target-u1-rbbit',
      name: 'Paper II: IT & Management',
      description: 'Official 6-Part Curriculum for RBB IT Assistant Level 5',
      createdAt: now,
      updatedAt: now,
    }
  ];

  const rbbTopics: Topic[] = [
    {
      id: 'top-rbb-1-intro',
      userId: user1Id,
      targetId: 'target-u1-rbbit',
      subjectId: 'sub-rbbit-paper2',
      name: '1. Introduction of Computer',
      description: 'Analog/Digital/Supercomputers, Internet/Email, Physical Security, AI/ML/Blockchain',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'top-rbb-2-arch',
      userId: user1Id,
      targetId: 'target-u1-rbbit',
      subjectId: 'sub-rbbit-paper2',
      name: '2. Computer Architecture',
      description: 'Registers, Memory Management, Hard Disk Organization, CPU Architecture, I/O Management',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'top-rbb-3-net',
      userId: user1Id,
      targetId: 'target-u1-rbbit',
      subjectId: 'sub-rbbit-paper2',
      name: '3. Communication and Computer Network Technologies',
      description: 'Networking Devices, Switching, Modems, IPv4/IPv6, Cryptography & Security',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'top-rbb-4-os',
      userId: user1Id,
      targetId: 'target-u1-rbbit',
      subjectId: 'sub-rbbit-paper2',
      name: '4. Operating System and Information Systems',
      description: 'Process Management, CPU Scheduling, DOS/UNIX/Windows, OS Security Threats',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'top-rbb-5-db',
      userId: user1Id,
      targetId: 'target-u1-rbbit',
      subjectId: 'sub-rbbit-paper2',
      name: '5. Database Management System & Web Technology',
      description: 'Tables, Normalization (1NF-BCNF), Indexing, Data Warehousing, HTML/CSS, Web Servers',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'top-rbb-6-sec',
      userId: user1Id,
      targetId: 'target-u1-rbbit',
      subjectId: 'sub-rbbit-paper2',
      name: '6. Cybersecurity and IT Policies',
      description: 'Access Control, Malware/DDoS/Phishing, ICT Policy 2072, NRB IT & Cyber Resilience Guidelines',
      createdAt: now,
      updatedAt: now,
    },
  ];

  // 4. SEED SANGATHIT SANSTHA TOPICS FOR SHILPA (9 Parts)
  const sansthaSubjects: Subject[] = [
    {
      id: 'sub-sanstha-core',
      userId: user2Id,
      targetId: 'target-u2-sanstha',
      name: 'Pre-Qualifying General Syllabus',
      description: 'Lok Sewa Aayog Unified Curriculum (50 MCQs = 100 Marks)',
      createdAt: now,
      updatedAt: now,
    }
  ];

  const sansthaTopics: Topic[] = [
    { id: 'top-san-1', userId: user2Id, targetId: 'target-u2-sanstha', subjectId: 'sub-sanstha-core', name: '1. Geography, Environment & Population', description: 'World & Nepal Geography, Climate Change', createdAt: now, updatedAt: now },
    { id: 'top-san-2', userId: user2Id, targetId: 'target-u2-sanstha', subjectId: 'sub-sanstha-core', name: '2. History and Culture', description: 'Kiranta, Lichchhavi, Medieval & Modern History, Cultural heritage', createdAt: now, updatedAt: now },
    { id: 'top-san-3', userId: user2Id, targetId: 'target-u2-sanstha', subjectId: 'sub-sanstha-core', name: '3. Economic Aspects and Development', description: 'GDP, Per capita income, Balance of Payments, Foreign aid', createdAt: now, updatedAt: now },
    { id: 'top-san-4', userId: user2Id, targetId: 'target-u2-sanstha', subjectId: 'sub-sanstha-core', name: '4. Governance and Constitution', description: 'Constitution of Nepal Parts 1-5, Federal/Provincial system, Human rights', createdAt: now, updatedAt: now },
    { id: 'top-san-5', userId: user2Id, targetId: 'target-u2-sanstha', subjectId: 'sub-sanstha-core', name: '5. International Affairs & Organizations', description: 'UN, SAARC, BIMSTEC, ASEAN, World Bank, IMF, ADB', createdAt: now, updatedAt: now },
    { id: 'top-san-6', userId: user2Id, targetId: 'target-u2-sanstha', subjectId: 'sub-sanstha-core', name: '6. Science, Public Health & Current Affairs', description: 'Scientific inventions, Computers, Health, National & International events', createdAt: now, updatedAt: now },
    { id: 'top-san-7', userId: user2Id, targetId: 'target-u2-sanstha', subjectId: 'sub-sanstha-core', name: '7. Office & Public Management', description: 'Registration & Dispatch, Filing, Tippani, Public charter, E-governance', createdAt: now, updatedAt: now },
    { id: 'top-san-8', userId: user2Id, targetId: 'target-u2-sanstha', subjectId: 'sub-sanstha-core', name: '8. Applied Mathematics', description: 'Unitary method, Percentage, Ratio, Profit & Loss, Simple/Compound interest', createdAt: now, updatedAt: now },
    { id: 'top-san-9', userId: user2Id, targetId: 'target-u2-sanstha', subjectId: 'sub-sanstha-core', name: '9. Knowledge about Public Enterprises', description: 'Classification, Corporate governance, Privatization, NRB & Regulatory bodies', createdAt: now, updatedAt: now },
  ];

  await db.subjects.bulkPut([...rbbSubjects, ...sansthaSubjects]);
  await db.topics.bulkPut([...rbbTopics, ...sansthaTopics]);

  // 5. SEED AUTHENTIC SAMPLE QUESTIONS (Balanced Answers: A, B, C, D)
  const questions: Question[] = [
    // --- TOPIC 1: Introduction of Computer ---
    {
      id: 'q-rbb-101',
      userId: user1Id,
      targetId: 'target-u1-rbbit',
      subjectId: 'sub-rbbit-paper2',
      topicId: 'top-rbb-1-intro',
      questionText: 'Which category of computers is specially engineered to perform massive floating-point calculations for weather forecasting and scientific modeling?',
      options: [
        { id: 'A', text: 'Mainframe Computer' },
        { id: 'B', text: 'Supercomputer' },
        { id: 'C', text: 'Workstation' },
        { id: 'D', text: 'Hybrid Computer' },
      ],
      correctOptionId: 'B',
      explanation: 'Supercomputers are designed for high computational speed, measuring performance in FLOPS, used in climate modeling and nuclear simulations.',
      source: 'RBB IT Level 5 Syllabus Practice',
      difficulty: 'easy',
      origin: 'IMPORTED_OLD_QUESTION',
      isShared: true,
      isBookmarked: false,
      isDifficult: false,
      tags: ['computer-types', 'hardware'],
      createdAt: now,
      updatedAt: now,
      stats: { totalAttempts: 0, correctAttempts: 0, wrongAttempts: 0, consecutiveCorrect: 0, easeFactor: 2.5, intervalDays: 1 },
    },
    {
      id: 'q-rbb-102',
      userId: user1Id,
      targetId: 'target-u1-rbbit',
      subjectId: 'sub-rbbit-paper2',
      topicId: 'top-rbb-1-intro',
      questionText: 'In blockchain architecture, what cryptographic mechanism ensures that previously committed transaction blocks cannot be altered undetected?',
      options: [
        { id: 'A', text: 'Symmetric Stream Ciphers' },
        { id: 'B', text: 'Dynamic Access Control Lists' },
        { id: 'C', text: 'Cryptographic Hash Pointers (e.g. SHA-256) linking blocks' },
        { id: 'D', text: 'Round-Robin Consensus Nodes' },
      ],
      correctOptionId: 'C',
      explanation: 'Each block contains the cryptographic hash of the previous block. Modifying any block invalidates all subsequent hashes in the chain.',
      source: 'RBB IT Level 5 Syllabus Practice',
      difficulty: 'medium',
      origin: 'IMPORTED_OLD_QUESTION',
      isShared: true,
      isBookmarked: false,
      isDifficult: false,
      tags: ['blockchain', 'emerging-tech'],
      createdAt: now,
      updatedAt: now,
      stats: { totalAttempts: 0, correctAttempts: 0, wrongAttempts: 0, consecutiveCorrect: 0, easeFactor: 2.5, intervalDays: 1 },
    },

    // --- TOPIC 2: Computer Architecture ---
    {
      id: 'q-rbb-201',
      userId: user1Id,
      targetId: 'target-u1-rbbit',
      subjectId: 'sub-rbbit-paper2',
      topicId: 'top-rbb-2-arch',
      questionText: 'Which CPU register holds the memory address of the next instruction to be fetched and executed?',
      options: [
        { id: 'A', text: 'Program Counter (PC)' },
        { id: 'B', text: 'Instruction Register (IR)' },
        { id: 'C', text: 'Memory Buffer Register (MBR)' },
        { id: 'D', text: 'Accumulator (AC)' },
      ],
      correctOptionId: 'A',
      explanation: 'The Program Counter (PC) stores the address of the next sequential instruction in main memory.',
      source: 'RBB IT Level 5 Syllabus Practice',
      difficulty: 'easy',
      origin: 'IMPORTED_OLD_QUESTION',
      isShared: true,
      isBookmarked: false,
      isDifficult: false,
      tags: ['cpu', 'registers'],
      createdAt: now,
      updatedAt: now,
      stats: { totalAttempts: 0, correctAttempts: 0, wrongAttempts: 0, consecutiveCorrect: 0, easeFactor: 2.5, intervalDays: 1 },
    },
    {
      id: 'q-rbb-202',
      userId: user1Id,
      targetId: 'target-u1-rbbit',
      subjectId: 'sub-rbbit-paper2',
      topicId: 'top-rbb-2-arch',
      questionText: 'In magnetic hard disk geometry, what term describes the time required for the read/write head to position itself over the designated track?',
      options: [
        { id: 'A', text: 'Rotational Latency' },
        { id: 'B', text: 'Transfer Rate' },
        { id: 'C', text: 'Seek Time' },
        { id: 'D', text: 'Access Burst Time' },
      ],
      correctOptionId: 'C',
      explanation: 'Seek time is the mechanical delay needed for disk arm actuators to align with the target radial cylinder/track.',
      source: 'RBB IT Level 5 Syllabus Practice',
      difficulty: 'medium',
      origin: 'IMPORTED_OLD_QUESTION',
      isShared: true,
      isBookmarked: false,
      isDifficult: false,
      tags: ['storage', 'hard-disk'],
      createdAt: now,
      updatedAt: now,
      stats: { totalAttempts: 0, correctAttempts: 0, wrongAttempts: 0, consecutiveCorrect: 0, easeFactor: 2.5, intervalDays: 1 },
    },

    // --- TOPIC 3: Communication & Networks ---
    {
      id: 'q-rbb-301',
      userId: user1Id,
      targetId: 'target-u1-rbbit',
      subjectId: 'sub-rbbit-paper2',
      topicId: 'top-rbb-3-net',
      questionText: 'Which layer of the OSI model is responsible for logical IP addressing and path determination across heterogeneous subnets?',
      options: [
        { id: 'A', text: 'Data Link Layer' },
        { id: 'B', text: 'Transport Layer' },
        { id: 'C', text: 'Network Layer' },
        { id: 'D', text: 'Session Layer' },
      ],
      correctOptionId: 'C',
      explanation: 'The Network Layer (Layer 3) provides logical addressing (IPv4/IPv6) and routing decisions.',
      source: 'RBB IT Level 5 Past Questions',
      difficulty: 'easy',
      origin: 'IMPORTED_OLD_QUESTION',
      isShared: true,
      isBookmarked: false,
      isDifficult: false,
      tags: ['networking', 'osi'],
      createdAt: now,
      updatedAt: now,
      stats: { totalAttempts: 0, correctAttempts: 0, wrongAttempts: 0, consecutiveCorrect: 0, easeFactor: 2.5, intervalDays: 1 },
    },
    {
      id: 'q-rbb-302',
      userId: user1Id,
      targetId: 'target-u1-rbbit',
      subjectId: 'sub-rbbit-paper2',
      topicId: 'top-rbb-3-net',
      questionText: 'How many usable host IP addresses are provided by an IPv4 subnet configured with prefix mask /27?',
      options: [
        { id: 'A', text: '32' },
        { id: 'B', text: '30' },
        { id: 'C', text: '62' },
        { id: 'D', text: '14' },
      ],
      correctOptionId: 'B',
      explanation: 'Host bits = 32 - 27 = 5 bits. Total IPs = 2^5 = 32. Usable host IPs = 32 - 2 (network & broadcast) = 30.',
      source: 'RBB IT Level 5 Past Questions',
      difficulty: 'medium',
      origin: 'IMPORTED_OLD_QUESTION',
      isShared: true,
      isBookmarked: false,
      isDifficult: false,
      tags: ['networking', 'subnetting'],
      createdAt: now,
      updatedAt: now,
      stats: { totalAttempts: 0, correctAttempts: 0, wrongAttempts: 0, consecutiveCorrect: 0, easeFactor: 2.5, intervalDays: 1 },
    },

    // --- TOPIC 4: Operating System ---
    {
      id: 'q-rbb-401',
      userId: user1Id,
      targetId: 'target-u1-rbbit',
      subjectId: 'sub-rbbit-paper2',
      topicId: 'top-rbb-4-os',
      questionText: 'Which process scheduling algorithm can cause indefinite starvation of lower-priority processes unless an aging technique is implemented?',
      options: [
        { id: 'A', text: 'Round Robin (RR)' },
        { id: 'B', text: 'First-Come, First-Served (FCFS)' },
        { id: 'C', text: 'Priority Scheduling' },
        { id: 'D', text: 'Shortest Remaining Time First with Time Slicing' },
      ],
      correctOptionId: 'C',
      explanation: 'Static Priority Scheduling allows high-priority tasks to indefinitely block lower-priority processes unless aging increases priority over time.',
      source: 'RBB IT Level 5 Past Questions',
      difficulty: 'medium',
      origin: 'IMPORTED_OLD_QUESTION',
      isShared: true,
      isBookmarked: false,
      isDifficult: false,
      tags: ['os', 'scheduling'],
      createdAt: now,
      updatedAt: now,
      stats: { totalAttempts: 0, correctAttempts: 0, wrongAttempts: 0, consecutiveCorrect: 0, easeFactor: 2.5, intervalDays: 1 },
    },
    {
      id: 'q-rbb-402',
      userId: user1Id,
      targetId: 'target-u1-rbbit',
      subjectId: 'sub-rbbit-paper2',
      topicId: 'top-rbb-4-os',
      questionText: 'Which of the following conditions is NOT a necessary requirement for a deadlock to occur in an operating system?',
      options: [
        { id: 'A', text: 'Mutual Exclusion' },
        { id: 'B', text: 'Hold and Wait' },
        { id: 'C', text: 'Preemptive Resource Allocation' },
        { id: 'D', text: 'Circular Wait' },
      ],
      correctOptionId: 'C',
      explanation: 'The Coffman condition is "No Preemption". If resources CAN be preempted, deadlocks cannot exist.',
      source: 'RBB IT Level 5 Past Questions',
      difficulty: 'medium',
      origin: 'IMPORTED_OLD_QUESTION',
      isShared: true,
      isBookmarked: false,
      isDifficult: false,
      tags: ['os', 'deadlocks'],
      createdAt: now,
      updatedAt: now,
      stats: { totalAttempts: 0, correctAttempts: 0, wrongAttempts: 0, consecutiveCorrect: 0, easeFactor: 2.5, intervalDays: 1 },
    },

    // --- TOPIC 5: Database & Web Technology ---
    {
      id: 'q-rbb-501',
      userId: user1Id,
      targetId: 'target-u1-rbbit',
      subjectId: 'sub-rbbit-paper2',
      topicId: 'top-rbb-5-db',
      questionText: 'In relational database normalization, transforming a relation from 2NF to 3NF specifically eliminates which type of dependency?',
      options: [
        { id: 'A', text: 'Partial Functional Dependency' },
        { id: 'B', text: 'Multivalued Dependency' },
        { id: 'C', text: 'Join Dependency' },
        { id: 'D', text: 'Transitive Dependency on candidate keys' },
      ],
      correctOptionId: 'D',
      explanation: '3NF requires that no non-prime attribute is transitively dependent on any candidate key (X -> Y and Y -> Z where Z is non-prime).',
      source: 'RBB IT Level 5 Past Questions',
      difficulty: 'medium',
      origin: 'IMPORTED_OLD_QUESTION',
      isShared: true,
      isBookmarked: false,
      isDifficult: false,
      tags: ['database', 'normalization'],
      createdAt: now,
      updatedAt: now,
      stats: { totalAttempts: 0, correctAttempts: 0, wrongAttempts: 0, consecutiveCorrect: 0, easeFactor: 2.5, intervalDays: 1 },
    },
    {
      id: 'q-rbb-502',
      userId: user1Id,
      targetId: 'target-u1-rbbit',
      subjectId: 'sub-rbbit-paper2',
      topicId: 'top-rbb-5-db',
      questionText: 'What type of database index structure maintains balance such that all leaf nodes reside at the exact same depth for predictable O(log N) lookups?',
      options: [
        { id: 'A', text: 'B+ Tree Index' },
        { id: 'B', text: 'Linear Hash Index' },
        { id: 'C', text: 'Inverted Bitmap Index' },
        { id: 'D', text: 'R-Tree Spatial Index' },
      ],
      correctOptionId: 'A',
      explanation: 'B+ Trees are self-balancing multi-way search trees where all records/keys in leaf nodes have equal depth and sequential pointers.',
      source: 'RBB IT Level 5 Past Questions',
      difficulty: 'hard',
      origin: 'IMPORTED_OLD_QUESTION',
      isShared: true,
      isBookmarked: false,
      isDifficult: false,
      tags: ['database', 'indexing'],
      createdAt: now,
      updatedAt: now,
      stats: { totalAttempts: 0, correctAttempts: 0, wrongAttempts: 0, consecutiveCorrect: 0, easeFactor: 2.5, intervalDays: 1 },
    },

    // --- TOPIC 6: Cybersecurity & IT Policies ---
    {
      id: 'q-rbb-601',
      userId: user1Id,
      targetId: 'target-u1-rbbit',
      subjectId: 'sub-rbbit-paper2',
      topicId: 'top-rbb-6-sec',
      questionText: 'Under the Electronic Transaction Act (ETA) 2063 of Nepal, unauthorized hacking or altering computer source code carries what maximum statutory penalty?',
      options: [
        { id: 'A', text: 'Fine up to Rs. 50,000 or 6 months imprisonment' },
        { id: 'B', text: 'Fine up to Rs. 100,000 or 1 year imprisonment' },
        { id: 'C', text: 'Fine up to Rs. 200,000 or imprisonment up to 3 years, or both' },
        { id: 'D', text: 'Fine up to Rs. 500,000 or imprisonment up to 5 years' },
      ],
      correctOptionId: 'C',
      explanation: 'Section 44 and 45 of ETA 2063 state that tampering with computer source code or unauthorized access is punishable with up to Rs 200,000 fine or 3 years imprisonment or both.',
      source: 'Nepal IT Laws & Guidelines',
      difficulty: 'medium',
      origin: 'IMPORTED_OLD_QUESTION',
      isShared: true,
      isBookmarked: false,
      isDifficult: false,
      tags: ['nepal-law', 'eta2063', 'cyber-security'],
      createdAt: now,
      updatedAt: now,
      stats: { totalAttempts: 0, correctAttempts: 0, wrongAttempts: 0, consecutiveCorrect: 0, easeFactor: 2.5, intervalDays: 1 },
    },
    {
      id: 'q-rbb-602',
      userId: user1Id,
      targetId: 'target-u1-rbbit',
      subjectId: 'sub-rbbit-paper2',
      topicId: 'top-rbb-6-sec',
      questionText: 'According to Nepal Rastra Bank Cyber Resilience Guidelines, what is the maximum recommended Recovery Time Objective (RTO) for critical banking payment settlement services?',
      options: [
        { id: 'A', text: 'Within 2 hours' },
        { id: 'B', text: 'Within 24 hours' },
        { id: 'C', text: 'Within 48 hours' },
        { id: 'D', text: 'Within 7 working days' },
      ],
      correctOptionId: 'A',
      explanation: 'NRB Cyber Resilience Guidelines mandate that critical electronic payment and core banking settlement systems must have an RTO not exceeding 2 hours.',
      source: 'NRB Cyber Resilience Guidelines 2023',
      difficulty: 'hard',
      origin: 'IMPORTED_OLD_QUESTION',
      isShared: true,
      isBookmarked: false,
      isDifficult: false,
      tags: ['nrb-guidelines', 'rto', 'cyber-security'],
      createdAt: now,
      updatedAt: now,
      stats: { totalAttempts: 0, correctAttempts: 0, wrongAttempts: 0, consecutiveCorrect: 0, easeFactor: 2.5, intervalDays: 1 },
    },

    // --- SHILPA: Sangathit Sanstha Questions ---
    {
      id: 'q-san-101',
      userId: user2Id,
      targetId: 'target-u2-sanstha',
      subjectId: 'sub-sanstha-core',
      topicId: 'top-san-4',
      questionText: 'According to the Constitution of Nepal, what is the minimum voting age for adult franchise in federal and provincial elections?',
      options: [
        { id: 'A', text: '16 Years' },
        { id: 'B', text: '18 Years' },
        { id: 'C', text: '21 Years' },
        { id: 'D', text: '25 Years' },
      ],
      correctOptionId: 'B',
      explanation: 'Article 84(5) of the Constitution of Nepal provides that every Nepali citizen who has attained 18 years of age has the right to vote.',
      source: 'Lok Sewa Aayog Past Questions',
      difficulty: 'easy',
      origin: 'IMPORTED_OLD_QUESTION',
      isShared: true,
      isBookmarked: false,
      isDifficult: false,
      tags: ['constitution', 'lok-sewa'],
      createdAt: now,
      updatedAt: now,
      stats: { totalAttempts: 0, correctAttempts: 0, wrongAttempts: 0, consecutiveCorrect: 0, easeFactor: 2.5, intervalDays: 1 },
    },
    {
      id: 'q-san-102',
      userId: user2Id,
      targetId: 'target-u2-sanstha',
      subjectId: 'sub-sanstha-core',
      topicId: 'top-san-9',
      questionText: 'Which regulatory authority in Nepal governs and supervises insurance companies under the Insurance Act 2079?',
      options: [
        { id: 'A', text: 'Nepal Rastra Bank (NRB)' },
        { id: 'B', text: 'Securities Board of Nepal (SEBON)' },
        { id: 'C', text: 'Nepal Insurance Authority (Bima Pradhikaran)' },
        { id: 'D', text: 'Department of Industry' },
      ],
      correctOptionId: 'C',
      explanation: 'Nepal Insurance Authority (formerly Beema Samiti) is the apex regulatory body for all life and non-life insurance entities in Nepal.',
      source: 'Sangathit Sanstha Public Enterprise MCQs',
      difficulty: 'easy',
      origin: 'IMPORTED_OLD_QUESTION',
      isShared: true,
      isBookmarked: false,
      isDifficult: false,
      tags: ['public-enterprises', 'regulations'],
      createdAt: now,
      updatedAt: now,
      stats: { totalAttempts: 0, correctAttempts: 0, wrongAttempts: 0, consecutiveCorrect: 0, easeFactor: 2.5, intervalDays: 1 },
    }
  ];

  await db.questions.bulkPut(questions);

  // 6. SEED TODAY'S DAILY TIME ALLOCATIONS
  const allocations: DailyAllocation[] = [
    { id: `alloc-u1-1`, userId: user1Id, targetId: 'target-u1-rbbit', date: todayStr, plannedMinutes: 90, createdAt: now },
    { id: `alloc-u1-2`, userId: user1Id, targetId: 'target-u1-nrb', date: todayStr, plannedMinutes: 60, createdAt: now },
    { id: `alloc-u1-3`, userId: user1Id, targetId: 'target-u1-college', date: todayStr, plannedMinutes: 45, createdAt: now },
    { id: `alloc-u2-1`, userId: user2Id, targetId: 'target-u2-sanstha', date: todayStr, plannedMinutes: 75, createdAt: now },
    { id: `alloc-u2-2`, userId: user2Id, targetId: 'target-u2-nrb', date: todayStr, plannedMinutes: 60, createdAt: now },
  ];

  await db.dailyAllocations.bulkPut(allocations);

  // 7. SEED TODAY'S STUDY SCHEDULES
  const schedules: StudySchedule[] = [
    {
      id: 'sched-u1-1',
      userId: user1Id,
      targetId: 'target-u1-rbbit',
      title: '3. Communication & Networks Practice',
      date: todayStr,
      startTime: '19:00',
      durationMinutes: 60,
      emailReminderSent: false,
      isCompleted: false,
      createdAt: now,
    },
    {
      id: 'sched-u2-1',
      userId: user2Id,
      targetId: 'target-u2-sanstha',
      title: 'Governance & Public Enterprises Drill',
      date: todayStr,
      startTime: '19:30',
      durationMinutes: 60,
      emailReminderSent: false,
      isCompleted: false,
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
