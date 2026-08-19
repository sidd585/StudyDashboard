import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Sparkles, Mail, Lock, AlertCircle, ArrowRight } from 'lucide-react';

interface LoginProps {
  onNavigateForgotPassword?: () => void;
  onNavigateSignUp?: () => void;
}

export const Login: React.FC<LoginProps> = ({
  onNavigateForgotPassword,
  onNavigateSignUp,
}) => {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setError(null);

    const { error: signInError } = await signIn(email, password, rememberMe);
    if (signInError) {
      setError(signInError);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f6fa] dark:bg-[#0d0f18] flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#7f56d9] to-[#6941c6] text-white shadow-md shadow-brand-500/20 mb-2">
            <Sparkles className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-extrabold text-[#101828] dark:text-[#f8f9fc] tracking-tight">
            StudyDashboard
          </h1>
          <p className="text-sm text-[#475467] dark:text-[#9496a8]">
            Welcome back. Sign in to your cloud study workspace.
          </p>
        </div>

        {/* Login Card */}
        <Card className="p-8 border-[#eaecf0] dark:border-[#23293d] bg-white dark:bg-[#141824] shadow-sm space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl bg-[#fef3f2] dark:bg-[#4a1c18] border border-[#fecdca] dark:border-[#7a271a] text-[#b42318] dark:text-[#fecdca] text-xs font-semibold flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#344054] dark:text-[#eceef2]">
                Email Address
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

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-[#344054] dark:text-[#eceef2]">
                  Password
                </label>
                {onNavigateForgotPassword && (
                  <button
                    type="button"
                    onClick={onNavigateForgotPassword}
                    className="text-xs font-semibold text-[#6941c6] dark:text-[#b692f6] hover:underline"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#98a2b3] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl text-sm border border-[#d0d5dd] dark:border-[#344054] bg-white dark:bg-[#1a1f30] text-[#101828] dark:text-[#f8f9fc] focus:border-[#7f56d9] focus:ring-2 focus:ring-[#7f56d9]/20 transition-all outline-none"
                />
              </div>
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center gap-2 pt-1">
              <input
                id="remember"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-[#d0d5dd] text-[#7f56d9] focus:ring-[#7f56d9] cursor-pointer"
              />
              <label htmlFor="remember" className="text-xs text-[#475467] dark:text-[#9496a8] font-medium cursor-pointer">
                Remember this device
              </label>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full font-bold shadow-sm"
              disabled={loading}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          {/* Quick Sign Up / Invite Link */}
          {onNavigateSignUp && (
            <div className="pt-4 border-t border-[#eaecf0] dark:border-[#23293d] text-center">
              <p className="text-xs text-[#475467] dark:text-[#9496a8]">
                Invited or new student?{' '}
                <button
                  type="button"
                  onClick={onNavigateSignUp}
                  className="font-bold text-[#6941c6] dark:text-[#b692f6] hover:underline"
                >
                  Create Account
                </button>
              </p>
            </div>
          )}
        </Card>

        {/* Footer info */}
        <p className="text-center text-xs text-[#98a2b3]">
          Cloud-backed • Asia/Kathmandu Time • End-to-End Private
        </p>
      </div>
    </div>
  );
};
