import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { RotateCcw, CheckCircle2, ShieldAlert } from 'lucide-react';
import { resetAllProgressToZero } from '../../db/seed';
import { USER_PROFILES } from '../../lib/supabase';

export type ResetTargetOption = 'both' | 'siddhartha' | 'shilpa';

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
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedOption, setSelectedOption] = useState<ResetTargetOption>('both');
  const [isConfirmedCheckbox, setIsConfirmedCheckbox] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const resetModalState = () => {
    setStep(1);
    setSelectedOption('both');
    setIsConfirmedCheckbox(false);
    setIsResetting(false);
  };

  const handleClose = () => {
    resetModalState();
    onClose();
  };

  const handleExecuteReset = async () => {
    setIsResetting(true);
    try {
      if (selectedOption === 'both') {
        await resetAllProgressToZero('all');
        localStorage.setItem('studydashboard_is_reset_v5', 'true');
        onSuccess?.('Reset complete! Refreshing page...');
      } else if (selectedOption === 'siddhartha') {
        await resetAllProgressToZero('user', USER_PROFILES.siddhartha.id);
        onSuccess?.('Reset complete for Siddhartha! Refreshing page...');
      } else {
        await resetAllProgressToZero('user', USER_PROFILES.shilpa.id);
        onSuccess?.('Reset complete for Shilpa! Refreshing page...');
      }
      
      // Auto-reload to immediately flush all UI states, charts, and queries to 0!
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (err) {
      console.error('Reset error:', err);
      setIsResetting(false);
    }
  };

  const targetLabel =
    selectedOption === 'both'
      ? 'Both Profiles (Siddhartha & Shilpa)'
      : selectedOption === 'siddhartha'
      ? 'Siddhartha Only'
      : 'Shilpa Only';

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={step === 1 ? 'Step 1 of 2: Select What to Reset' : 'Step 2 of 2: Confirm Reset'}
      size="md"
    >
      <div className="space-y-5 pt-2">
        {step === 1 ? (
          /* STEP 1: TARGET SELECTION */
          <div className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Please choose which study dashboard or profile you want to reset back to Day 0 (0 study hours, 0 streak, 0 attempts):
            </p>

            <div className="space-y-2.5">
              {/* Option 1: Both */}
              <label
                onClick={() => setSelectedOption('both')}
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                  selectedOption === 'both'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-900 dark:text-white shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="resetOption"
                  checked={selectedOption === 'both'}
                  onChange={() => setSelectedOption('both')}
                  className="mt-1 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">Reset Both Profiles (Siddhartha & Shilpa)</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Resets all study records, focus timers, MCQ attempts, charts, and streaks for both dashboards to 0.
                  </p>
                </div>
              </label>

              {/* Option 2: Siddhartha */}
              <label
                onClick={() => setSelectedOption('siddhartha')}
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                  selectedOption === 'siddhartha'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-900 dark:text-white shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="resetOption"
                  checked={selectedOption === 'siddhartha'}
                  onChange={() => setSelectedOption('siddhartha')}
                  className="mt-1 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">Reset Siddhartha's Dashboard Only</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Resets only Siddhartha's study time, streak, and question attempts. Shilpa's data remains untouched.
                  </p>
                </div>
              </label>

              {/* Option 3: Shilpa */}
              <label
                onClick={() => setSelectedOption('shilpa')}
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                  selectedOption === 'shilpa'
                    ? 'border-pink-500 bg-pink-50 dark:bg-pink-950/30 text-pink-900 dark:text-white shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="resetOption"
                  checked={selectedOption === 'shilpa'}
                  onChange={() => setSelectedOption('shilpa')}
                  className="mt-1 text-pink-600 focus:ring-pink-500"
                />
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">Reset Shilpa's Dashboard Only</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Resets only Shilpa's study time, streak, and question attempts. Siddhartha's data remains untouched.
                  </p>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <Button variant="outline" size="sm" onClick={handleClose}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={() => setStep(2)}>
                Next: Verify & Confirm ➔
              </Button>
            </div>
          </div>
        ) : (
          /* STEP 2: VERIFICATION & CONFIRMATION */
          <div className="space-y-4 animate-fade-in">
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-rose-700 dark:text-rose-300">
                  Reset all study progress?
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                  This will permanently remove your study sessions, MCQ attempts, progress statistics and streak history. Your Targets, Subjects, Questions, Materials and Settings will remain.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-2">
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-200">Summary of Reset Action:</p>
              <ul className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1 list-disc list-inside">
                <li>Today's study time and focus counters reset to 0.</li>
                <li>Study streak set to 0.</li>
                <li>MCQ attempt history and accuracy reset to —.</li>
                <li>Targets, Subjects, Questions, Materials and Settings are preserved.</li>
              </ul>
            </div>

            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isConfirmedCheckbox}
                onChange={e => setIsConfirmedCheckbox(e.target.checked)}
                className="mt-0.5 rounded text-rose-600 focus:ring-rose-500"
              />
              <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                I understand and confirm I want to reset <strong>{targetLabel}</strong> to 0.
              </span>
            </label>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <Button variant="outline" size="sm" onClick={() => setStep(1)} disabled={isResetting}>
                ← Back
              </Button>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleClose} disabled={isResetting}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                  disabled={!isConfirmedCheckbox || isResetting}
                  onClick={handleExecuteReset}
                >
                  {isResetting ? 'Resetting...' : 'Yes, Execute Reset to 0'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
