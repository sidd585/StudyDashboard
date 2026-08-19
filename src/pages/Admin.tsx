import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUser } from '../context/UserContext';
import type { ApplicationRole, AccountStatus } from '../lib/supabase';
import { adminService, type AdminUserListItem, type AdminOverviewStats } from '../services/adminService';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
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
  EyeOff,
  Eye,
  HeartHandshake,
  Trash2,
} from 'lucide-react';

export const Admin: React.FC = () => {
  const { user } = useAuth();
  const { isMainAdmin, isSubAdmin, refreshFriendStatus } = useUser();

  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'pending' | 'subadmins' | 'friend'>('overview');
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [stats, setStats] = useState<AdminOverviewStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Admin Friend Selection State (Requirement 61)
  const [selectedFriendUserId, setSelectedFriendUserId] = useState<string>('');
  const [activeFriendName, setActiveFriendName] = useState<string | null>(null);
  const [friendSaveStatus, setFriendSaveStatus] = useState<string | null>(null);

  // Reset User Modal State
  const [resetModalUser, setResetModalUser] = useState<AdminUserListItem | null>(null);
  const [resetType, setResetType] = useState<'PROGRESS_ONLY' | 'FULL_STUDY_DATA'>('PROGRESS_ONLY');
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [userList, statData, currentFriend] = await Promise.all([
        adminService.getUsers(),
        adminService.getOverviewStats(),
        adminService.getActiveAdminFriend(),
      ]);

      // Scoped view for Sub-Admin
      if (isSubAdmin && user) {
        setUsers(userList.filter(u => u.managedBy === user.id && u.visibleToSubAdmin));
      } else {
        setUsers(userList);
      }

      setStats(statData);
      if (currentFriend) {
        setSelectedFriendUserId(currentFriend.userId);
        setActiveFriendName(currentFriend.displayName);
      }
    } catch (e) {
      console.error('Error loading admin data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isMainAdmin, isSubAdmin, user?.id]);

  // Actions
  const handleApproveUser = async (userId: string, role: ApplicationRole = 'USER') => {
    const success = await adminService.approveUser(userId, role, isSubAdmin ? user?.id : undefined);
    if (success) {
      loadData();
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus: AccountStatus) => {
    const nextStatus: AccountStatus = currentStatus === 'ACTIVE' ? 'DEACTIVATED' : 'ACTIVE';
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

  const handleToggleMainAdminOnly = async (userId: string, currentVisibleToSub: boolean) => {
    const nextPrivate = currentVisibleToSub;
    const success = await adminService.toggleMainAdminOnly(userId, nextPrivate);
    if (success) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, visibleToSubAdmin: !nextPrivate } : u));
    }
  };

  // Save Admin Friend Selection
  const handleSaveAdminFriend = async () => {
    if (!selectedFriendUserId) return;
    const success = await adminService.setAdminFriend(selectedFriendUserId);
    if (success) {
      await refreshFriendStatus();
      setFriendSaveStatus('Admin Friend active! Study Together room is now enabled for both of you.');
      setTimeout(() => setFriendSaveStatus(null), 4000);
      loadData();
    } else {
      alert('Failed to set Admin Friend.');
    }
  };

  // Execute User Reset
  const handleExecuteReset = async () => {
    if (!resetModalUser || resetConfirmText !== 'RESET') return;
    setIsResetting(true);
    try {
      const success = await adminService.resetUserData(resetModalUser.id, resetType);
      if (success) {
        alert(`Successfully reset ${resetType === 'PROGRESS_ONLY' ? 'progress' : 'all study data'} for ${resetModalUser.displayName}.`);
        setResetModalUser(null);
        setResetConfirmText('');
      } else {
        alert('Failed to reset user data.');
      }
    } finally {
      setIsResetting(false);
    }
  };

  const pendingUsers = users.filter(u => u.status === 'PENDING_APPROVAL' || u.status === 'PENDING');
  const subAdminList = users.filter(u => u.role === 'SUB_ADMIN');

  if (!isMainAdmin && !isSubAdmin) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-3">
        <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-xl font-bold text-[#172033] dark:text-[#f8f9fc]">Access Restricted</h2>
        <p className="text-xs text-[#64748b] dark:text-[#9496a8]">
          This console is reserved for the Super Admin and authorized Sub-Admins.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-fade-in text-[#172033] dark:text-[#f8f9fc] transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-extrabold text-[#172033] dark:text-[#f8f9fc] tracking-tight">
              {isMainAdmin ? 'Super Admin Console' : 'Sub-Admin Workspace'}
            </h1>
            <Badge variant={isMainAdmin ? 'brand' : 'neutral'} size="sm">
              {isMainAdmin ? 'MAIN ADMIN' : 'SUB ADMIN'}
            </Badge>
          </div>
          <p className="text-xs text-[#64748b] dark:text-[#9496a8] mt-0.5">
            {isMainAdmin
              ? 'User approvals, role assignments, Sub-Admin delegation, and Admin Friend management.'
              : 'Manage assigned study users and approve pending registrations.'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#e2e8f0] dark:border-[#23293d] pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
            activeTab === 'overview'
              ? 'bg-[#5b5bd6] text-white shadow-xs'
              : 'text-[#64748b] hover:text-[#172033] dark:hover:text-white'
          }`}
        >
          Overview
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
            activeTab === 'users'
              ? 'bg-[#5b5bd6] text-white shadow-xs'
              : 'text-[#64748b] hover:text-[#172033] dark:hover:text-white'
          }`}
        >
          All Users ({users.length})
        </button>

        <button
          onClick={() => setActiveTab('pending')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'pending'
              ? 'bg-[#5b5bd6] text-white shadow-xs'
              : 'text-[#64748b] hover:text-[#172033] dark:hover:text-white'
          }`}
        >
          <span>Pending Approvals</span>
          {pendingUsers.length > 0 && (
            <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center font-black">
              {pendingUsers.length}
            </span>
          )}
        </button>

        {isMainAdmin && (
          <>
            <button
              onClick={() => setActiveTab('subadmins')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                activeTab === 'subadmins'
                  ? 'bg-[#5b5bd6] text-white shadow-xs'
                  : 'text-[#64748b] hover:text-[#172033] dark:hover:text-white'
              }`}
            >
              Sub-Admins ({subAdminList.length})
            </button>

            <button
              onClick={() => setActiveTab('friend')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'friend'
                  ? 'bg-[#12b76a] text-white shadow-xs'
                  : 'text-[#64748b] hover:text-[#172033] dark:hover:text-white'
              }`}
            >
              <HeartHandshake className="w-3.5 h-3.5" />
              <span>Admin Friend</span>
            </button>
          </>
        )}
      </div>

      {/* TAB 1: OVERVIEW (Requirement 58) */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-5 border-[#e2e8f0] dark:border-[#23293d] bg-[#fbfcfe] dark:bg-[#141824] shadow-xs">
              <span className="text-xs font-bold text-[#64748b] uppercase">Total Registered Users</span>
              <p className="text-2xl font-extrabold text-[#172033] dark:text-white mt-1">{stats?.totalUsers || 0}</p>
            </Card>

            <Card className="p-5 border-[#e2e8f0] dark:border-[#23293d] bg-[#fbfcfe] dark:bg-[#141824] shadow-xs">
              <span className="text-xs font-bold text-[#64748b] uppercase">Active Users</span>
              <p className="text-2xl font-extrabold text-[#12b76a] mt-1">{stats?.activeUsers || 0}</p>
            </Card>

            <Card className="p-5 border-[#e2e8f0] dark:border-[#23293d] bg-[#fbfcfe] dark:bg-[#141824] shadow-xs">
              <span className="text-xs font-bold text-[#64748b] uppercase">Pending Approval</span>
              <p className="text-2xl font-extrabold text-amber-500 mt-1">{stats?.pendingApprovals || 0}</p>
            </Card>

            <Card className="p-5 border-[#e2e8f0] dark:border-[#23293d] bg-[#fbfcfe] dark:bg-[#141824] shadow-xs">
              <span className="text-xs font-bold text-[#64748b] uppercase">Admin Friend Status</span>
              <p className="text-sm font-extrabold text-[#5b5bd6] mt-2 truncate">
                {stats?.activeAdminFriend ? `Connected (${stats.activeAdminFriend})` : 'Not Selected'}
              </p>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: USERS TABLE (Requirement 59, 60) */}
      {activeTab === 'users' && (
        <Card className="p-5 border-[#e2e8f0] dark:border-[#23293d] bg-[#fbfcfe] dark:bg-[#141824] shadow-xs space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-[#e2e8f0] dark:border-[#23293d] text-[#64748b] uppercase">
                  <th className="pb-3 font-bold">User</th>
                  <th className="pb-3 font-bold">Role</th>
                  <th className="pb-3 font-bold">Status</th>
                  {isMainAdmin && <th className="pb-3 font-bold">Sub-Admin Visibility</th>}
                  <th className="pb-3 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0] dark:divide-[#23293d]">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-[#f8fafc] dark:hover:bg-[#181d2f]/60 transition-colors">
                    <td className="py-3">
                      <p className="font-bold text-[#172033] dark:text-[#f8f9fc]">{u.displayName}</p>
                      <p className="text-[11px] text-[#64748b]">{u.email}</p>
                    </td>
                    <td className="py-3">
                      {isMainAdmin && u.role !== 'MAIN_ADMIN' ? (
                        <select
                          value={u.role}
                          onChange={e => handleUpdateRole(u.id, e.target.value as ApplicationRole)}
                          className="px-2 py-1 rounded-lg text-xs bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] font-semibold outline-none"
                        >
                          <option value="USER">USER</option>
                          <option value="FRIEND">FRIEND</option>
                          <option value="SUB_ADMIN">SUB_ADMIN</option>
                        </select>
                      ) : (
                        <Badge variant="neutral" size="sm">{u.role}</Badge>
                      )}
                    </td>
                    <td className="py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        u.status === 'ACTIVE'
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : u.status === 'PENDING_APPROVAL'
                          ? 'bg-amber-500/10 text-amber-600'
                          : 'bg-rose-500/10 text-rose-600'
                      }`}>
                        {u.status}
                      </span>
                    </td>
                    {isMainAdmin && (
                      <td className="py-3">
                        <button
                          onClick={() => handleToggleMainAdminOnly(u.id, u.visibleToSubAdmin)}
                          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg border ${
                            u.visibleToSubAdmin
                              ? 'text-[#64748b] border-[#e2e8f0] dark:border-[#2b334d]'
                              : 'text-amber-600 bg-amber-500/10 border-amber-500/30'
                          }`}
                        >
                          {u.visibleToSubAdmin ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                          <span>{u.visibleToSubAdmin ? 'Visible to Sub-Admins' : 'Main Admin Only'}</span>
                        </button>
                      </td>
                    )}
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {u.status === 'PENDING_APPROVAL' && (
                          <Button
                            variant="primary"
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold px-2.5 py-1"
                            onClick={() => handleApproveUser(u.id, 'USER')}
                          >
                            Approve
                          </Button>
                        )}
                        {u.role !== 'MAIN_ADMIN' && (
                          <>
                            <button
                              onClick={() => handleToggleStatus(u.id, u.status)}
                              className="text-xs font-semibold text-[#64748b] hover:text-[#172033] p-1"
                            >
                              {u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              onClick={() => {
                                setResetModalUser(u);
                                setResetConfirmText('');
                              }}
                              className="text-xs font-semibold text-rose-600 hover:underline p-1"
                            >
                              Reset Data
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 3: PENDING APPROVALS */}
      {activeTab === 'pending' && (
        <Card className="p-5 border-[#e2e8f0] dark:border-[#23293d] bg-[#fbfcfe] dark:bg-[#141824] shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-[#172033] dark:text-[#f8f9fc]">Pending User Registrations</h2>
          {pendingUsers.length > 0 ? (
            <div className="space-y-3">
              {pendingUsers.map(u => (
                <div
                  key={u.id}
                  className="p-4 rounded-xl border border-[#e2e8f0] dark:border-[#23293d] bg-white dark:bg-[#181d2f] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <h4 className="font-bold text-sm text-[#172033] dark:text-[#f8f9fc]">{u.displayName}</h4>
                    <p className="text-xs text-[#64748b]">{u.email}</p>
                    <span className="text-[10px] text-amber-600 font-semibold">Registered & waiting for approval</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      className="bg-emerald-600 text-white font-bold"
                      onClick={() => handleApproveUser(u.id, 'USER')}
                    >
                      Approve as USER
                    </Button>
                    {isMainAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-white dark:bg-[#181d2f] text-[#5b5bd6] font-bold"
                        onClick={() => handleApproveUser(u.id, 'SUB_ADMIN')}
                      >
                        Approve as SUB ADMIN
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-[#64748b]">
              No registrations waiting for approval.
            </div>
          )}
        </Card>
      )}

      {/* TAB 4: SUB ADMINS (Requirement 62) */}
      {activeTab === 'subadmins' && isMainAdmin && (
        <Card className="p-5 border-[#e2e8f0] dark:border-[#23293d] bg-[#fbfcfe] dark:bg-[#141824] shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-[#172033] dark:text-[#f8f9fc]">Sub-Admin Workspaces</h2>
          <p className="text-xs text-[#64748b]">
            Sub-Admins can manage subordinate users assigned under them, but cannot see Super Admin, Admin Friend, or Main-Admin-Only users.
          </p>

          <div className="space-y-3 pt-2">
            {subAdminList.map(sa => {
              const subordinates = users.filter(u => u.managedBy === sa.id);
              return (
                <div key={sa.id} className="p-4 rounded-xl border border-[#e2e8f0] dark:border-[#23293d] bg-white dark:bg-[#181d2f] space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-[#172033] dark:text-[#f8f9fc]">{sa.displayName}</h4>
                    <Badge variant="brand">Sub-Admin</Badge>
                  </div>
                  <p className="text-xs text-[#64748b]">{sa.email}</p>
                  <div className="pt-2 text-xs font-semibold text-[#5b5bd6]">
                    Manages {subordinates.length} assigned users
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* TAB 5: ADMIN FRIEND SELECTION (Requirement 61) */}
      {activeTab === 'friend' && isMainAdmin && (
        <Card className="p-6 border-[#e2e8f0] dark:border-[#23293d] bg-[#fbfcfe] dark:bg-[#141824] shadow-xs space-y-5 max-w-2xl">
          <div>
            <h2 className="text-base font-extrabold text-[#172033] dark:text-[#f8f9fc] flex items-center gap-2">
              <HeartHandshake className="w-5 h-5 text-emerald-600" />
              <span>Admin Friend Selection</span>
            </h2>
            <p className="text-xs text-[#64748b] dark:text-[#9496a8] mt-1">
              Select one active friend. When saved, the Super Admin and Admin Friend will share the private <strong>Study Together</strong> comparison room.
            </p>
          </div>

          {friendSaveStatus && (
            <div className="p-3.5 bg-emerald-500/10 rounded-xl border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
              ✓ {friendSaveStatus}
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-xs font-bold text-[#334155] dark:text-[#cbd5e1]">
              Select Admin Friend:
            </label>
            <select
              value={selectedFriendUserId}
              onChange={e => setSelectedFriendUserId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-[#e2e8f0] dark:border-[#2b334d] font-bold text-[#172033] dark:text-[#f8f9fc] outline-none"
            >
              <option value="">-- Choose User as Admin Friend --</option>
              {users.filter(u => u.role !== 'MAIN_ADMIN').map(u => (
                <option key={u.id} value={u.id}>
                  {u.displayName} ({u.email})
                </option>
              ))}
            </select>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <span className="text-xs text-[#64748b]">
              Current Friend: <strong className="text-[#172033] dark:text-white">{activeFriendName || 'None'}</strong>
            </span>
            <Button
              variant="primary"
              size="md"
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
              onClick={handleSaveAdminFriend}
              disabled={!selectedFriendUserId}
            >
              Save Admin Friend
            </Button>
          </div>
        </Card>
      )}

      {/* ================= MODAL: ADMIN RESET USER DATA (Requirement 56) ================= */}
      {resetModalUser && (
        <Modal
          isOpen={true}
          onClose={() => setResetModalUser(null)}
          title={`Reset Data: ${resetModalUser.displayName}`}
          size="md"
        >
          <div className="space-y-4 text-[#172033] dark:text-[#f8f9fc]">
            <div className="p-3.5 bg-rose-500/10 rounded-xl border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs space-y-1">
              <p className="font-bold">Caution: This action cannot be undone.</p>
              <p>Choose whether to reset only study progress/attempts or wipe all study data (courses, questions, planner).</p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold">Reset Type:</label>
              <div className="space-y-2 text-xs">
                <label className="flex items-center gap-2 p-2.5 rounded-xl border border-[#e2e8f0] dark:border-[#2b334d] cursor-pointer">
                  <input
                    type="radio"
                    name="resetType"
                    checked={resetType === 'PROGRESS_ONLY'}
                    onChange={() => setResetType('PROGRESS_ONLY')}
                  />
                  <span><strong>Reset Progress Only</strong> (clears study time, attempts, scores; keeps courses & questions)</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-xl border border-[#e2e8f0] dark:border-[#2b334d] cursor-pointer">
                  <input
                    type="radio"
                    name="resetType"
                    checked={resetType === 'FULL_STUDY_DATA'}
                    onChange={() => setResetType('FULL_STUDY_DATA')}
                  />
                  <span><strong>Full Study Data Wipe</strong> (deletes user's courses, syllabus, questions, planner, sessions)</span>
                </label>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold">
                Type <code>RESET</code> to confirm:
              </label>
              <input
                type="text"
                value={resetConfirmText}
                onChange={e => setResetConfirmText(e.target.value)}
                placeholder="RESET"
                className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-[#181d2f] border border-rose-400 font-bold outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setResetModalUser(null)}>Cancel</Button>
              <Button
                variant="primary"
                size="sm"
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold"
                onClick={handleExecuteReset}
                disabled={resetConfirmText !== 'RESET' || isResetting}
              >
                {isResetting ? 'Resetting...' : 'Confirm Reset'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
