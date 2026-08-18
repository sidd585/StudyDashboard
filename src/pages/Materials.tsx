import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useUser } from '../context/UserContext';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import {
  FolderArchive,
  Upload,
  FileText,
  Trash2,
  Share2,
  Eye,
  Plus,
  BookOpen,
} from 'lucide-react';
import type { Material, MaterialType } from '../types';

export const Materials: React.FC = () => {
  const { currentUser } = useUser();

  const targets = useLiveQuery(
    () => db.targets.where('userId').equals(currentUser.id).toArray(),
    [currentUser.id]
  ) || [];

  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isViewerModalOpen, setIsViewerModalOpen] = useState(false);
  const [viewingMaterial, setViewingMaterial] = useState<Material | null>(null);

  // Upload Form
  const [title, setTitle] = useState('');
  const [materialType, setMaterialType] = useState<MaterialType>('pdf');
  const [noteContent, setNoteContent] = useState('');
  const [isShared, setIsShared] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const subjects = useLiveQuery(
    () => (selectedTargetId ? db.subjects.where('targetId').equals(selectedTargetId).toArray() : []),
    [selectedTargetId]
  ) || [];

  const materials = useLiveQuery(
    async () => {
      let q = db.materials.where('userId').equals(currentUser.id);
      if (selectedTargetId) {
        q = db.materials.where('targetId').equals(selectedTargetId);
      }
      let list = await q.toArray();
      if (selectedSubjectId) {
        list = list.filter(m => m.subjectId === selectedSubjectId);
      }
      return list;
    },
    [currentUser.id, selectedTargetId, selectedSubjectId]
  ) || [];

  const handleSaveMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTargetId || !title.trim()) return;

    const id = `mat-${Date.now()}`;
    await db.materials.put({
      id,
      userId: currentUser.id,
      targetId: selectedTargetId,
      subjectId: selectedSubjectId || undefined,
      title: title.trim(),
      type: materialType,
      content: materialType === 'note' ? noteContent : undefined,
      fileBlob: selectedFile ? selectedFile : undefined,
      fileName: selectedFile?.name,
      fileSize: selectedFile?.size,
      mimeType: selectedFile?.type,
      isShared,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    setTitle('');
    setNoteContent('');
    setSelectedFile(null);
    setIsUploadModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Delete this material?')) {
      await db.materials.delete(id);
    }
  };

  const handleView = (mat: Material) => {
    setViewingMaterial(mat);
    setIsViewerModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Syllabus & Materials Library</h2>
          <p className="text-xs text-slate-400">Store and read syllabus PDFs, study notes, and references.</p>
        </div>

        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => {
            if (targets.length > 0 && !selectedTargetId) setSelectedTargetId(targets[0].id);
            setIsUploadModalOpen(true);
          }}
        >
          Add Material
        </Button>
      </div>

      {/* Filter Bar */}
      <Card className="p-4 border-slate-800">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Filter by Target</label>
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

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Filter by Subject</label>
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
        </div>
      </Card>

      {/* Materials Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {materials.length === 0 ? (
          <Card className="p-12 text-center border-slate-800 space-y-3 col-span-3">
            <FolderArchive className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-sm font-bold text-slate-300">No materials saved yet</h3>
            <p className="text-xs text-slate-500">Upload syllabus PDFs or study notes organized by Target and Subject.</p>
          </Card>
        ) : (
          materials.map(mat => {
            const targetObj = targets.find(t => t.id === mat.targetId);

            return (
              <Card key={mat.id} className="p-5 border-slate-800 hover:border-slate-700 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/30 text-brand-400">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="flex items-center gap-1">
                      {mat.isShared && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          Shared
                        </span>
                      )}
                      <button
                        onClick={() => handleDelete(mat.id)}
                        className="p-1 text-slate-500 hover:text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h4 className="text-sm font-bold text-white mb-1 leading-tight">{mat.title}</h4>
                  <p className="text-xs text-slate-400 mb-3">{targetObj?.name || 'Target Material'}</p>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] uppercase font-bold text-slate-500">{mat.type}</span>
                  <Button
                    variant="outline"
                    size="xs"
                    leftIcon={<Eye className="w-3.5 h-3.5" />}
                    onClick={() => handleView(mat)}
                  >
                    View Document
                  </Button>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Upload Modal */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Add Syllabus or Study Material"
      >
        <form onSubmit={handleSaveMaterial} className="space-y-4">
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
            <label className="block text-xs font-semibold text-slate-300 mb-1">Document Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. RBB IT Complete Syllabus PDF"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Type</label>
            <select
              value={materialType}
              onChange={e => setMaterialType(e.target.value as MaterialType)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
            >
              <option value="pdf">PDF Document</option>
              <option value="note">Markdown / Study Note</option>
              <option value="image">Image / Diagram</option>
            </select>
          </div>

          {materialType === 'note' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Note Content</label>
              <textarea
                rows={5}
                value={noteContent}
                onChange={e => setNoteContent(e.target.value)}
                placeholder="Write your study notes here..."
                className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Select File</label>
              <input
                type="file"
                accept={materialType === 'pdf' ? '.pdf' : 'image/*'}
                onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-brand-600 file:text-white"
              />
            </div>
          )}

          <div className="flex items-center pt-2">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isShared}
                onChange={e => setIsShared(e.target.checked)}
                className="rounded text-brand-600 focus:ring-brand-500"
              />
              <span>Share with Study Together partner</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setIsUploadModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={!selectedTargetId}>
              Save Material
            </Button>
          </div>
        </form>
      </Modal>

      {/* Document Reader Modal */}
      <Modal
        isOpen={isViewerModalOpen}
        onClose={() => setIsViewerModalOpen(false)}
        title={viewingMaterial?.title || 'Document Viewer'}
        size="lg"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          {viewingMaterial?.type === 'note' ? (
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-200 whitespace-pre-wrap">
              {viewingMaterial.content}
            </div>
          ) : viewingMaterial?.fileBlob ? (
            <div className="text-center py-6 space-y-3">
              <p className="text-xs text-slate-400">File: {viewingMaterial.fileName || 'Attached Document'}</p>
              <a
                href={URL.createObjectURL(viewingMaterial.fileBlob)}
                download={viewingMaterial.fileName || 'document.pdf'}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-semibold"
              >
                Download / Open File
              </a>
            </div>
          ) : (
            <p className="text-xs text-slate-400 text-center py-6">Document preview ready.</p>
          )}
        </div>
      </Modal>
    </div>
  );
};
