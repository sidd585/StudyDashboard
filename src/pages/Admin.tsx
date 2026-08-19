import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import type { ApplicationRole } from '../lib/supabase';
import { adminService, type AdminUserListItem, type AdminOverviewStats } from '../services/adminService';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import {
  ShieldAlert,
  Users,
  UserCheck,
  Clock,
  Mail,
  UserPlus,
  Activity,
  CheckCircle2,
  XCircle,
  RotateCcw,
} from 'lucide-react';

export const Admin: React.FC = () => {
  const { user, role } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'invitations' | 'friends'>('overview');
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [stats, setStats] = useState<AdminOverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'USER' | 'SUB_ADMIN'>('USER');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);

  const isMainAdmin = role === 'MAIN_ADMIN';
  const isSubAdmin = role === 'SUB_ADMIN';

  const loadData = async () => {
    setLoading(true);
    try {
      const [userList, statData] = await Promise.all([
        adminService.getUsers(),
        adminService.getOverviewStats(),
      ]);

      // Sub-admins only see users assigned to them
      if (isSubAdmin && user) {
        setUsers(userList.filter(u => u.managedBy === user.id));
      } else {
        setUsers(userList);
      }
      setStats(statData);
    } catch (e) {
      console.error('Error loading admin data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [role, user]);

  const handleToggleStatus = async (userId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'DEACTIVATED' : 'ACTIVE';
    const success = await adminService.toggleUserStatus(userId, nextStatus);
    if (success) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: nextStatus } : u));
    }
  };

  const handleUpdateRole = async (userId: string, newRole: ApplicationRole) => {
    const success = await adminService.updateUserRole(userId, newRole);
    if (success) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;

    setInviteLoading(true);
    setInviteMessage(null);

    const managedBy = isSubAdmin ? user?.id : undefined;
    const res = await adminService.inviteUser(inviteEmail, isSubAdmin ? 'USER' : inviteRole, managedBy);

    if (res.success) {
      setInviteMessage(`Invitation successfully registered for ${inviteEmail}`);
      setInviteEmail('');
      setTimeout(() => setShowInviteModal(false), 2000);
      loadData();
    } else {
      setInviteMessage(res.error || 'Failed to send invitation.');
    }
    setInviteLoading(false);
  };

  if (!isMainAdmin && !isSubAdmin) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-3">
        <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-xl font-bold text-[#101828] dark:text-[#f8f9fc]">Access Restricted</h2>
        <p className="text-xs text-[#667085] dark:text-[#9496a8]">
          This console is reserved for Siddhartha (Main Admin) and authorized Sub-Admins.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-fade-in">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-[#101828] dark:text-[#f8f9fc]">
              {isMainAdmin ? 'Main Admin Console' : 'Sub-Admin Workspace'}
            </h1>
            <Badge variant={isMainAdmin ? 'brand' : 'neutral'} size="sm">
              {role}
            </Badge>
          </div>
          <p className="text-xs text-[#667085] dark:text-[#9496a8] mt-0.5">
            {isMainAdmin
              ? 'Manage study accounts, sub-admins, friend permissions, and invitations.'
              : 'Manage assigned study users and register invitations.'}
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          className="bg-[#7f56d9] hover:bg-[#6941c6] text-white font-bold self-start"
          leftIcon={<UserPlus className="w-4 h-4" />}
          onClick={() => setShowInviteModal(true)}
        >
          Invite User
        </Button>
      </div>

      {/* TABS */}
      <div className="flex items-center gap-2 border-b border-[#eaecf0] dark:border-[#23293d] pb-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            activeTab === 'overview'
              ? 'bg-[#f4ebff] text-[#6941c6] dark:bg-[#2c1c5f] dark:text-[#d6bbfb]'
              : 'text-[#667085] hover:text-[#101828]'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            activeTab === 'users'
              ? 'bg-[#f4ebff] text-[#6941c6] dark:bg-[#2c1c5f] dark:text-[#d6bbfb]'
              : 'text-[#667085] hover:text-[#101828]'
          }`}
        >
          Users ({users.length})
        </button>
      </div>

      {/* TAB CONTENT */}
      {activeTab === 'overview' && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 bg-white dark:bg-[#141824] border-[#eaecf0] dark:border-[#23293d]">
              <div className="flex items-center justify-between text-xs text-[#667085] font-semibold">
                <span>Total Users</span>
                <Users className="w-4 h-4 text-[#7f56d9]" />
              </div>
              <div className="text-2xl font-extrabold text-[#101828] dark:text-[#f8f9fc] mt-1.5">
                {stats.totalUsers}
              </div>
            </Card>

            <Card className="p-4 bg-white dark:bg-[#141824] border-[#eaecf0] dark:border-[#23293d]">
              <div className="flex items-center justify-between text-xs text-[#667085] font-semibold">
                <span>Active Accounts</span>
                <CheckCircle2 className="w-4 h-4 text-[#12b76a]" />
              </div>
              <div className="text-2xl font-extrabold text-[#101828] dark:text-[#f8f9fc] mt-1.5">
                {stats.activeUsers}
              </div>
            </Card>

            <Card className="p-4 bg-white dark:bg-[#141824] border-[#eaecf0] dark:border-[#23293d]">
              <div className="flex items-center justify-between text-xs text-[#667085] font-semibold">
                <span>Sub-Admins</span>
                <ShieldAlert className="w-4 h-4 text-[#0284c7]" />
              </div>
              <div className="text-2xl font-extrabold text-[#101828] dark:text-[#f8f9fc] mt-1.5">
                {stats.subAdmins}
              </div>
            </Card>

            <Card className="p-4 bg-white dark:bg-[#141824] border-[#eaecf0] dark:border-[#23293d]">
              <div className="flex items-center justify-between text-xs text-[#667085] font-semibold">
                <span>Today Active</span>
                <Clock className="w-4 h-4 text-[#f79009]" />
              </div>
              <div className="text-2xl font-extrabold text-[#101828] dark:text-[#f8f9fc] mt-1.5">
                {stats.todayActiveStudents}
              </div>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <Card className="p-0 bg-white dark:bg-[#141824] border-[#eaecf0] dark:border-[#23293d] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f8f9fc] dark:bg-[#181d2f] text-[#344054] dark:text-[#eceef2] font-bold border-b border-[#eaecf0] dark:border-[#23293d]">
                <tr>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Role & Access</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Joined</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eaecf0] dark:divide-[#23293d]">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-[#f9fafb] dark:hover:bg-[#181d2f]/50">
                    <td className="py-3 px-4 font-bold text-[#101828] dark:text-[#f8f9fc]">
                      {u.displayName}
                    </td>
                    <td className="py-3 px-4">{u.email}</td>
                    <td className="py-3 px-4">
                      {isMainAdmin && u.email !== 'sid.paudel585@gmail.com' ? (
                        <select
                          value={u.role}
                          onChange={(e) => handleUpdateRole(u.id, e.target.value as ApplicationRole)}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold border border-[#eaecf0] dark:border-[#23293d] bg-[#f8f9fc] dark:bg-[#181d2f] text-[#101828] dark:text-[#f8f9fc] outline-none cursor-pointer focus:border-[#7f56d9]"
                        >
                          <option value="USER">USER (Student)</option>
                          <option value="SUB_ADMIN">SUB_ADMIN (Manager)</option>
                          <option value="MAIN_ADMIN">MAIN_ADMIN (Superuser)</option>
                        </select>
                      ) : (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          u.role === 'MAIN_ADMIN'
                            ? 'bg-[#f4ebff] text-[#6941c6]'
                            : u.role === 'SUB_ADMIN'
                            ? 'bg-[#f0f9ff] text-[#0284c7]'
                            : 'bg-slate-100 dark:bg-slate-800 text-[#344054] dark:text-[#eceef2]'
                        }`}>
                          {u.role}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 font-semibold ${
                        u.status === 'ACTIVE' ? 'text-[#12b76a]' : 'text-rose-500'
                      }`}>
                        {u.status === 'ACTIVE' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        <span>{u.status}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      {u.email !== 'sid.paudel585@gmail.com' && (
                        <button
                          onClick={() => handleToggleStatus(u.id, u.status)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${
                            u.status === 'ACTIVE'
                              ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300'
                          }`}
                        >
                          {u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* INVITE MODAL */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-6 bg-white dark:bg-[#141824] border-[#eaecf0] dark:border-[#23293d] shadow-lg space-y-4">
            <h3 className="text-base font-bold text-[#101828] dark:text-[#f8f9fc]">
              Invite New User
            </h3>

            {inviteMessage && (
              <div className="p-3 rounded-xl bg-[#f4ebff] dark:bg-[#2c1c5f] text-[#6941c6] dark:text-[#d6bbfb] text-xs font-semibold">
                {inviteMessage}
              </div>
            )}

            <form onSubmit={handleSendInvite} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#344054] dark:text-[#eceef2]">
                  Recipient Email
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="student@example.com"
                  required
                  className="w-full px-3.5 py-2 rounded-xl text-sm border border-[#d0d5dd] dark:border-[#344054] bg-white dark:bg-[#1a1f30] text-[#101828] dark:text-[#f8f9fc] outline-none focus:border-[#7f56d9]"
                />
              </div>

              {isMainAdmin && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#344054] dark:text-[#eceef2]">
                    Role
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as any)}
                    className="w-full px-3.5 py-2 rounded-xl text-sm border border-[#d0d5dd] dark:border-[#344054] bg-white dark:bg-[#1a1f30] text-[#101828] dark:text-[#f8f9fc] outline-none"
                  >
                    <option value="USER">Normal Student (USER)</option>
                    <option value="SUB_ADMIN">Sub Admin (SUB_ADMIN)</option>
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowInviteModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={inviteLoading}
                >
                  {inviteLoading ? 'Sending...' : 'Send Invitation'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};
