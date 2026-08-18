import { describe, it, expect } from 'vitest';
import { NEPAL_EXAM_TEMPLATES, INITIAL_USER_CONFIGS } from '../src/lib/nepalSeeds';

describe('Nepal Exam Templates & User Tracks', () => {
  it('should contain complete syllabi for NRB Assistant, RBB IT, RBB Admin, and Sangathit Sanstha', () => {
    expect(NEPAL_EXAM_TEMPLATES.rbb_it).toBeDefined();
    expect(NEPAL_EXAM_TEMPLATES.nrb_assistant).toBeDefined();
    expect(NEPAL_EXAM_TEMPLATES.rbb_admin).toBeDefined();
    expect(NEPAL_EXAM_TEMPLATES.sangathit_sanstha).toBeDefined();

    // RBB IT Subjects check
    const rbbSubjects = NEPAL_EXAM_TEMPLATES.rbb_it.subjects.map(s => s.name);
    expect(rbbSubjects).toContain('Networking');
    expect(rbbSubjects).toContain('Operating Systems');
    expect(rbbSubjects).toContain('Cybersecurity & IT Policies');

    // NRB Assistant Subjects check
    const nrbSubjects = NEPAL_EXAM_TEMPLATES.nrb_assistant.subjects.map(s => s.name);
    expect(nrbSubjects).toContain('Banking');
    expect(nrbSubjects).toContain('Banking / Relevant Laws');
    expect(nrbSubjects).toContain('Economics');
  });

  it('should define separate initial configurations for User 1 and User 2', () => {
    expect(INITIAL_USER_CONFIGS.user1.name).toBe('Primary Account');
    expect(INITIAL_USER_CONFIGS.user2.name).toBe('Study Partner');

    expect(INITIAL_USER_CONFIGS.user1.targets.length).toBeGreaterThanOrEqual(4);
    expect(INITIAL_USER_CONFIGS.user2.targets.length).toBeGreaterThanOrEqual(4);
  });
});
