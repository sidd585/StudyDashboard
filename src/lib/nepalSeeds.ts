export interface TargetTemplate {
  name: string;
  type: 'Competitive Exam' | 'College' | 'Course' | 'Certification' | 'Custom';
  color: string;
  icon: string;
  dailyGoalMinutes: number;
  weeklyGoalMinutes: number;
  targetQuestionGoal: number;
  subjects: {
    name: string;
    description?: string;
    topics: string[];
  }[];
}

export const NEPAL_EXAM_TEMPLATES: Record<string, TargetTemplate> = {
  rbb_it: {
    name: 'RBB IT (Level 5/6)',
    type: 'Competitive Exam',
    color: '#6366f1', // Indigo
    icon: 'Cpu',
    dailyGoalMinutes: 90,
    weeklyGoalMinutes: 600,
    targetQuestionGoal: 30,
    subjects: [
      {
        name: 'Networking',
        description: 'OSI Model, TCP/IP, Routing, Switching, Subnetting, Network Security',
        topics: ['Switching Technology', 'TCP/IP & Transport Layer', 'Routing Protocols (OSPF/BGP)', 'VLAN & STP', 'Network Security & Firewalls'],
      },
      {
        name: 'Operating Systems',
        description: 'Processes, Threads, Concurrency, Deadlocks, Memory Management, Linux',
        topics: ['Process Scheduling', 'Deadlocks & Banker Algorithm', 'Virtual Memory & Paging', 'Linux Shell & Administration'],
      },
      {
        name: 'Database & Web Technology',
        description: 'RDBMS, SQL, Normalization, ACID Properties, Web Protocols',
        topics: ['Relational Algebra & SQL Queries', 'Normalization (1NF-BCNF)', 'Indexing & Transactions', 'REST APIs & Security'],
      },
      {
        name: 'Cybersecurity & IT Policies',
        description: 'Electronic Transaction Act, Nepal IT Policy, Encryption, Vulnerabilities',
        topics: ['Nepal Electronic Transaction Act 2063', 'IT Policy of Nepal', 'Cryptography (AES/RSA)', 'OWASP Top 10'],
      },
      {
        name: 'Computer Architecture & Fundamentals',
        description: 'CPU Organization, Cache Memory, Logic Gates, Number Systems',
        topics: ['Instruction Pipelining', 'Cache Mapping & Cache Coherence', 'Digital Logic & Boolean Algebra'],
      },
      {
        name: 'Banking & Organizational Management',
        description: 'Core Banking Software, NRB Directives on IT, Disaster Recovery in Banks',
        topics: ['NRB IT Guidelines for Banks', 'Disaster Recovery (DR) & BCP', 'Core Banking Systems (CBS)'],
      }
    ]
  },

  nrb_assistant: {
    name: 'NRB Assistant (Level 4)',
    type: 'Competitive Exam',
    color: '#10b981', // Emerald
    icon: 'Building2',
    dailyGoalMinutes: 60,
    weeklyGoalMinutes: 450,
    targetQuestionGoal: 25,
    subjects: [
      {
        name: 'Banking',
        description: 'Central Banking Functions, Monetary Policy, Liquidity Management',
        topics: ['NRB Functions & Objectives', 'Monetary Policy Tools (CRR, SLR, Repo)', 'Commercial Banking Operations', 'Financial Inclusion in Nepal'],
      },
      {
        name: 'Accounting',
        description: 'Financial Statements, Trial Balance, Reconciliation, NFRS',
        topics: ['Double Entry Bookkeeping', 'Bank Reconciliation Statement (BRS)', 'Trial Balance & Final Accounts', 'Depreciation Methods'],
      },
      {
        name: 'Economics',
        description: 'Microeconomics, Macroeconomics, Inflation, GDP, Fiscal Policy',
        topics: ['Demand and Supply Elasticity', 'National Income Accounting (GDP/GNP)', 'Inflation & Deflation in Nepal', 'Fiscal & Foreign Exchange Policy'],
      },
      {
        name: 'Management',
        description: 'Principles of Management, Motivation, Leadership, Communication',
        topics: ['Functions of Management (POSDCORB)', 'Motivation Theories (Maslow, Herzberg)', 'Leadership Styles', 'Organizational Communication'],
      },
      {
        name: 'Banking / Relevant Laws',
        description: 'NRB Act 2058, BAFIA 2073, Anti-Money Laundering Act',
        topics: ['Nepal Rastra Bank Act 2058', 'BAFIA 2073 Key Provisions', 'Anti-Money Laundering (AML/CFT) Act 2064', 'Banking Offence and Punishment Act 2064'],
      },
      {
        name: 'Mathematics',
        description: 'Percentages, Ratios, Profit & Loss, Simple/Compound Interest',
        topics: ['Percentages & Profit Loss', 'Simple & Compound Interest', 'Ratio & Proportion', 'Time and Work'],
      },
      {
        name: 'Information Technology',
        description: 'Office Automation, Computer Basics, Cyber Safety',
        topics: ['MS Office Tools (Word/Excel/PowerPoint)', 'Internet & Email Etiquette', 'Cybersecurity Awareness'],
      }
    ]
  },

  rbb_admin: {
    name: 'RBB Administration (Level 4/5)',
    type: 'Competitive Exam',
    color: '#f59e0b', // Amber
    icon: 'Briefcase',
    dailyGoalMinutes: 75,
    weeklyGoalMinutes: 500,
    targetQuestionGoal: 25,
    subjects: [
      {
        name: 'Banking',
        description: 'Deposit Mobilization, Credit Operations, Remittance, KYC',
        topics: ['Types of Accounts & Operations', 'Credit Appraisal & Loan Types', 'Remittance & Trade Finance (LC/Bank Guarantee)', 'KYC and Customer Protection'],
      },
      {
        name: 'Banking Laws',
        description: 'RBB Acts, NRB Unified Directives, BAFIA',
        topics: ['BAFIA 2073', 'NRB Unified Directives (Directives 1-21)', 'Banking Offence Act', 'Foreign Exchange Regulation Act'],
      },
      {
        name: 'Management & Organizational Behavior',
        description: 'Human Resource Management, Decision Making, Ethics',
        topics: ['Principles of Administration', 'HR Planning & Performance Appraisal', 'Organizational Conflict & Resolution', 'Work Ethics in Banking'],
      },
      {
        name: 'Accounting',
        description: 'Financial Statements, Auditing, Cash Flow',
        topics: ['Journal, Ledger & Trial Balance', 'Financial Ratio Analysis', 'Bank Audit Procedures', 'Cash Flow Statement'],
      },
      {
        name: 'Mathematics',
        description: 'Arithmetic Calculations, Unitary Method, Averages',
        topics: ['Averages & Mixtures', 'Simple & Compound Interest Calculations', 'Partnership & Profit Sharing'],
      },
      {
        name: 'Digital Payment Systems & IT',
        description: 'ConnectIPS, RTGS, QR Payments, Mobile Banking',
        topics: ['National Payment Switch & ConnectIPS', 'Real Time Gross Settlement (RTGS)', 'Card Operations (ATM/POS)', 'Digital Payment Security'],
      },
      {
        name: 'General Banking & Institution Related',
        description: 'History of RBB, RBB Bye-laws, Nepali Economy',
        topics: ['History & Financial Position of Rastriya Banijya Bank', 'RBB Employee Service Bye-laws', 'Recent Economic Indicators of Nepal'],
      }
    ]
  },

  sangathit_sanstha: {
    name: 'Sangathit Sanstha Common Exam',
    type: 'Competitive Exam',
    color: '#ec4899', // Pink
    icon: 'Scale',
    dailyGoalMinutes: 60,
    weeklyGoalMinutes: 400,
    targetQuestionGoal: 20,
    subjects: [
      {
        name: 'General Awareness (GK)',
        description: 'Geography, History of Nepal, Constitution, Current Affairs',
        topics: ['Geography & Natural Resources of Nepal', 'History & Culture of Nepal', 'Constitution of Nepal 2072', 'National & International Current Affairs'],
      },
      {
        name: 'Management & Governance',
        description: 'Office Management, Public Administration, Good Governance',
        topics: ['Office Procedures & Records Management (Darta/Chalani)', 'Right to Information Act 2064', 'Good Governance Act 2064', 'Public Procurement Basics'],
      },
      {
        name: 'Mathematics & Reasoning',
        description: 'Verbal & Non-Verbal Logic, Basic Arithmetic',
        topics: ['Number Series & Coding-Decoding', 'Logical Deductions', 'Arithmetic Aptitude', 'Data Interpretation'],
      },
      {
        name: 'Service Related Knowledge',
        description: 'Public Enterprises in Nepal, Fiscal Discipline',
        topics: ['Role of Public Enterprises in Nepal Economy', 'Financial Discipline & Accountability', 'Customer Care in Public Sector'],
      }
    ]
  }
};

export const INITIAL_USER_CONFIGS = {
  siddhartha: {
    name: 'Siddhartha',
    email: 'siddhartha@studydashboard.local',
    targets: [
      { templateKey: 'rbb_it', dailyMinutes: 90, weeklyMinutes: 600, questionGoal: 30 },
      { templateKey: 'nrb_assistant', customName: 'NRB IT Track', dailyMinutes: 60, weeklyMinutes: 450, questionGoal: 25 },
      {
        customTarget: {
          name: 'AI Course',
          type: 'Course' as const,
          color: '#8b5cf6',
          icon: 'Sparkles',
          dailyGoalMinutes: 45,
          weeklyGoalMinutes: 300,
          targetQuestionGoal: 15,
          subjects: [
            {
              name: 'Machine Learning',
              topics: ['Linear & Logistic Regression', 'Decision Trees & Ensembles', 'Neural Networks Basics']
            },
            {
              name: 'Python for AI',
              topics: ['NumPy & Pandas', 'PyTorch Basics']
            }
          ]
        },
        dailyMinutes: 45,
        weeklyMinutes: 300,
        questionGoal: 15
      },
      {
        customTarget: {
          name: 'College',
          type: 'College' as const,
          color: '#3b82f6',
          icon: 'GraduationCap',
          dailyGoalMinutes: 45,
          weeklyGoalMinutes: 300,
          targetQuestionGoal: 10,
          subjects: [
            {
              name: 'Compiler Design',
              topics: ['Lexical & Syntax Analysis', 'Code Generation & Optimization']
            },
            {
              name: 'Network Programming',
              topics: ['Socket Programming in C#', 'Multi-threaded Server Architecture']
            }
          ]
        },
        dailyMinutes: 45,
        weeklyMinutes: 300,
        questionGoal: 10
      }
    ]
  },

  shilpa: {
    name: 'Shilpa',
    email: 'shilpa@studydashboard.local',
    targets: [
      { templateKey: 'nrb_assistant', dailyMinutes: 75, weeklyMinutes: 500, questionGoal: 25 },
      { templateKey: 'rbb_admin', dailyMinutes: 60, weeklyMinutes: 450, questionGoal: 25 },
      { templateKey: 'sangathit_sanstha', dailyMinutes: 45, weeklyMinutes: 300, questionGoal: 20 },
      {
        customTarget: {
          name: 'College',
          type: 'College' as const,
          color: '#ec4899',
          icon: 'GraduationCap',
          dailyGoalMinutes: 45,
          weeklyGoalMinutes: 300,
          targetQuestionGoal: 10,
          subjects: [
            {
              name: 'Advanced Financial Accounting',
              topics: ['Corporate Restructuring Accounts', 'Consolidated Balance Sheet', 'IFRS / NFRS Reporting']
            },
            {
              name: 'Business Research Methods',
              topics: ['Research Design & Sampling', 'Hypothesis Testing in SPSS', 'Report Writing']
            }
          ]
        },
        dailyMinutes: 45,
        weeklyMinutes: 300,
        questionGoal: 10
      }
    ]
  }
};
