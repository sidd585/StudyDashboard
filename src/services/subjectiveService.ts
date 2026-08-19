import { supabase, type CloudSubjectivePaper } from '../lib/supabase';

export interface SubjectivePaperInput {
  courseId: string;
  subjectId?: string | null;
  topicId?: string | null;
  paperTitle: string;
  year?: number;
  file: File;
  solutionFile?: File | null;
  isSharedFriend?: boolean;
}

export const subjectiveService = {
  // Get all subjective papers with optional filters
  async getSubjectivePapers(filters?: {
    courseId?: string;
    subjectId?: string;
    topicId?: string;
    year?: number;
  }): Promise<CloudSubjectivePaper[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    let query = supabase
      .from('subjective_papers')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.courseId) query = query.eq('course_id', filters.courseId);
    if (filters?.subjectId) query = query.eq('subject_id', filters.subjectId);
    if (filters?.topicId) query = query.eq('topic_id', filters.topicId);
    if (filters?.year) query = query.eq('year', filters.year);

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching subjective papers:', error);
      return [];
    }
    return data || [];
  },

  // Upload subjective paper & optional solution
  async uploadSubjectivePaper(input: SubjectivePaperInput): Promise<CloudSubjectivePaper | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    try {
      // 1. Upload main paper to private Supabase storage
      const fileExt = input.file.name.split('.').pop();
      const sanitizedName = input.file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `${user.id}/subjective/${Date.now()}_${sanitizedName}`;

      const { error: uploadError } = await supabase.storage
        .from('study-files')
        .upload(storagePath, input.file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        console.error('Error uploading subjective file to storage:', uploadError);
        return null;
      }

      // 2. Upload optional solution
      let solutionPath: string | null = null;
      if (input.solutionFile) {
        const solSanitized = input.solutionFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        solutionPath = `${user.id}/subjective_solutions/${Date.now()}_${solSanitized}`;
        await supabase.storage
          .from('study-files')
          .upload(solutionPath, input.solutionFile, {
            cacheControl: '3600',
            upsert: true,
          });
      }

      // 3. Insert record into subjective_papers table
      const { data, error } = await supabase
        .from('subjective_papers')
        .insert({
          user_id: user.id,
          course_id: input.courseId,
          subject_id: input.subjectId || null,
          topic_id: input.topicId || null,
          paper_title: input.paperTitle.trim(),
          year: input.year || 2027,
          file_path: storagePath,
          file_name: input.file.name,
          file_size: input.file.size,
          solution_path: solutionPath,
          is_shared_friend: input.isSharedFriend || false,
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving subjective paper metadata:', error);
        return null;
      }
      return data;
    } catch (err) {
      console.error('Failed to upload subjective paper:', err);
      return null;
    }
  },

  // Get signed URL for secure viewing
  async getSecureViewUrl(filePath: string): Promise<string | null> {
    try {
      const { data, error } = await supabase.storage
        .from('study-files')
        .createSignedUrl(filePath, 3600); // 1 hour access

      if (error || !data) {
        console.error('Error creating signed URL:', error);
        return null;
      }
      return data.signedUrl;
    } catch (err) {
      console.error('Error getting signed view URL:', err);
      return null;
    }
  },

  // Delete subjective paper
  async deleteSubjectivePaper(id: string, filePath: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    try {
      await supabase.storage.from('study-files').remove([filePath]);
      const { error } = await supabase
        .from('subjective_papers')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      return !error;
    } catch (err) {
      console.error('Error deleting subjective paper:', err);
      return false;
    }
  }
};
