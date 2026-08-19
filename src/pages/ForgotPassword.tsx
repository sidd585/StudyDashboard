import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Sparkles, Mail, AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';

interface ForgotPasswordProps {
  onNavigateLogin: () => void;
}

export const ForgotPassword: React.FC<ForgotPasswordProps> = ({ onNavigateLogin }) => {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);
    setError(null);

    const { error: resetError } = await sendPasswordReset(email);
    if (resetError) {
      setError(resetError);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f6fa] dark:bg-[#0d0f18] flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#7f56d9] to-[#6941c6] text-white shadow-md shadow-brand-500/20 mb-2">
            <Sparkles className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-extrabold text-[#101828] dark:text-[#f8f9fc] tracking-tight">
            Reset Password
          </h1>
          <p className="text-sm text-[#475467] dark:text-[#9496a8]">
            Enter your email to receive a secure recovery link.
          </p>
        </div>

        <Card className="p-8 border-[#eaecf0] dark:border-[#23293d] bg-white dark:bg-[#141824] shadow-sm space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl bg-[#fef3f2] dark:bg-[#4a1c18] border border-[#fecdca] dark:border-[#7a271a] text-[#b42318] dark:text-[#fecdca] text-xs font-semibold flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-12 h-12 rounded-full bg-[#ecfdf3] text-[#027a48] border border-[#a6f4c5] flex items-center justify-center mx-auto text-xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-[#101828] dark:text-[#f8f9fc]">
                Reset Email Sent
              </h3>
              <p className="text-xs text-[#475467] dark:text-[#9496a8]">
                We've sent a password reset link to <strong>{email}</strong>. Please check your inbox.
              </p>
              <Button
                variant="primary"
                size="md"
                className="w-full font-bold"
                onClick={onNavigateLogin}
              >
                Return to Sign In
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#344054] dark:text-[#eceef2]">
                  Registered Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#98a2b3] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="siddhartha@example.com"
                    required
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl text-sm border border-[#d0d5dd] dark:border-[#344054] bg-white dark:bg-[#1a1f30] text-[#101828] dark:text-[#f8f9fc] focus:border-[#7f56d9] focus:ring-2 focus:ring-[#7f56d9]/20 transition-all outline-none"
                  />
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full font-bold shadow-sm"
                disabled={loading}
              >
                {loading ? 'Sending Link...' : 'Send Reset Link'}
              </Button>
            </form>
          )}

          <div className="pt-3 text-center">
            <button
              type="button"
              onClick={onNavigateLogin}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6941c6] dark:text-[#b692f6] hover:underline"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Sign In</span>
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
};
