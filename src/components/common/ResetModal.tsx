import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { RotateCcw, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { adminService } from '../../services/adminService';

interface ResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (message: string) => void;
}

export const ResetModal: React.FC<ResetModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [resetType, setResetType] = useState<'PROGRESS_ONLY' | 'FULL_STUDY_DATA'>('PROGRESS_ONLY');
  const [confirmText, setConfirmText] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const handleClose = () => {
    setConfirmText('');
    setIsResetting(false);
    onClose();
  };

  const handleExecuteReset = async () => {
    if (!user || (resetType === 'FULL_STUDY_DATA' && confirmText !== 'RESET')) return;
    setIsResetting(true);
    try {
      const success = await adminService.resetUserData(user.id, resetType);
      if (success) {
        onSuccess?.('Reset complete! Refreshing workspace...');
        setTimeout(() => {
          window.location.reload();
        }, 500);
      } else {
        alert('Failed to reset data.');
        setIsResetting(false);
      }
    } catch (err) {
      console.error('Reset error:', err);
      setIsResetting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Reset Study Data"
      size="md"
    >
      <div className="space-y-4 text-[#172033] dark:text-[#f8f9fc]">
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-rose-700 dark:text-rose-300">
              Caution: Resetting Cloud Study Records
            </h4>
            <p className="text-[11px] text-[#64748b] dark:text-[#9496a8] mt-1 leading-relaxed">
              Choose whether to reset only your study sessions and attempts, or completely wipe all courses and questions.
            </p>
          </div>
        </div>

        <div className="space-y-2 text-xs">
          <label className="flex items-start gap-2.5 p-3 rounded-xl border border-[#e2e8f0] dark:border-[#23293d] cursor-pointer">
            <input
              type="radio"
              name="resetOption"
              checked={resetType === 'PROGRESS_ONLY'}
              onChange={() => setResetType('PROGRESS_ONLY')}
              className="mt-0.5 text-[#5b5bd6]"
            />
            <div>
              <p className="font-bold text-[#172033] dark:text-white">Reset Progress Only</p>
              <p className="text-[11px] text-[#64748b]">Resets focus time, streak, and quiz scores to 0. Keeps courses & questions.</p>
            </div>
          </label>

          <label className="flex items-start gap-2.5 p-3 rounded-xl border border-[#e2e8f0] dark:border-[#23293d] cursor-pointer">
            <input
              type="radio"
              name="resetOption"
              checked={resetType === 'FULL_STUDY_DATA'}
              onChange={() => setResetType('FULL_STUDY_DATA')}
              className="mt-0.5 text-rose-600"
            />
            <div>
              <p className="font-bold text-rose-600">Full Study Data Wipe</p>
              <p className="text-[11px] text-[#64748b]">Permanently deletes all courses, syllabus hierarchy, and question archives.</p>
            </div>
          </label>
        </div>

        {resetType === 'FULL_STUDY_DATA' && (
          <div className="space-y-1 pt-1">
            <label className="block text-xs font-bold">
              Type <code>RESET</code> to confirm:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder="RESET"
              className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-rose-400 font-bold outline-none"
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#e2e8f0] dark:border-[#23293d]">
          <Button variant="outline" size="sm" onClick={handleClose} disabled={isResetting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            disabled={isResetting || (resetType === 'FULL_STUDY_DATA' && confirmText !== 'RESET')}
            onClick={handleExecuteReset}
          >
            {isResetting ? 'Resetting...' : 'Execute Reset'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
