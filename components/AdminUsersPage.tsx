import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Pencil, Trash2, UserPlus, Users, Check, X, KeyRound, ShieldCheck } from 'lucide-react';
import type { ManagedUser, UserRole } from '../types';
import {
  createManagedUser,
  deleteManagedUser,
  fetchUsers,
  setActiveUser,
  setManagedUserPassword,
  updateManagedUser,
} from '../services/userService';
import { notify } from '../utils/notify';

type AdminUsersPageProps = {
  currentUserId: string;
  onBack?: () => void;
  onUsersChanged?: (users: ManagedUser[], activeUser: ManagedUser | null) => void;
  embedded?: boolean;
};

const roleOptions: UserRole[] = ['Admin', 'Analyst', 'Viewer'];

const roleBadgeClasses: Record<string, string> = {
  Admin: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  Analyst: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  Viewer: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  User: 'bg-slate-100 text-slate-600 ring-slate-500/20',
};

const permissionFields = [
  { key: 'canView', label: 'View' },
  { key: 'canCreate', label: 'Create' },
  { key: 'canEdit', label: 'Edit' },
] as const;

const inputClass =
  'w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition';

const labelClass = 'block text-xs font-semibold text-slate-600 mb-1.5';

const AdminUsersPage: React.FC<AdminUsersPageProps> = ({
  currentUserId,
  onBack,
  onUsersChanged,
  embedded = false,
}) => {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ManagedUser | null>(null);
  const [editPassword, setEditPassword] = useState('');
  const [form, setForm] = useState({
    username: '',
    fullName: '',
    email: '',
    password: '',
    role: 'Analyst' as UserRole,
    canView: true,
    canCreate: true,
    canEdit: true,
  });

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const data = await fetchUsers();
      setUsers(data);
      const active = data.find((user) => user.id === currentUserId) || null;
      onUsersChanged?.(data, active);
    } catch (error) {
      console.error('Failed to load users', error);
      notify('Failed to load users.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      if (a.id === currentUserId) return -1;
      if (b.id === currentUserId) return 1;
      if (a.role === 'Admin' && b.role !== 'Admin') return -1;
      if (b.role === 'Admin' && a.role !== 'Admin') return 1;
      return a.username.localeCompare(b.username);
    });
  }, [currentUserId, users]);

  const resetForm = () => {
    setForm({
      username: '',
      fullName: '',
      email: '',
      password: '',
      role: 'Analyst',
      canView: true,
      canCreate: true,
      canEdit: true,
    });
  };

  const submitCreate = async () => {
    if (!form.username.trim() || !form.password.trim()) {
      notify('Username and password are required.');
      return;
    }

    setSaving(true);
    try {
      const created = await createManagedUser({
        username: form.username.trim(),
        fullName: form.fullName.trim() || form.username.trim(),
        email: form.email.trim(),
        password: form.password.trim(),
        role: form.role,
        permissions: {
          canView: form.canView,
          canCreate: form.canCreate,
          canEdit: form.canEdit,
        },
      });

      if (!created) {
        notify('User already exists or invalid input.');
        return;
      }

      notify('User created.', 'success');
      resetForm();
      await loadUsers();
    } catch (error) {
      console.error('Failed to create user', error);
      notify('Failed to create user.');
    } finally {
      setSaving(false);
    }
  };

  const beginEdit = (user: ManagedUser) => {
    setEditingId(user.id);
    setDraft({ ...user });
    setEditPassword('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
    setEditPassword('');
  };

  const saveEdit = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const updated = await updateManagedUser(draft);
      if (!updated) {
        notify('Unable to update user.');
        return;
      }
      if (editPassword.trim()) {
        await setManagedUserPassword(draft.id, editPassword.trim());
      }
      notify('User updated.', 'success');
      cancelEdit();
      await loadUsers();
    } catch (error) {
      console.error('Failed to update user', error);
      notify('Failed to update user.');
    } finally {
      setSaving(false);
    }
  };

  const removeUser = async (user: ManagedUser) => {
    if (user.role === 'Admin') {
      notify('Admin account cannot be deleted.');
      return;
    }

    const confirmed = window.confirm(`Delete user "${user.username}"?`);
    if (!confirmed) return;

    setSaving(true);
    try {
      const deleted = await deleteManagedUser(user.id);
      if (!deleted) {
        notify('Unable to delete user.');
        return;
      }
      notify('User deleted.', 'success');
      await loadUsers();
    } catch (error) {
      console.error('Failed to delete user', error);
      notify('Failed to delete user.');
    } finally {
      setSaving(false);
    }
  };

  const switchTo = async (user: ManagedUser) => {
    await setActiveUser(user.id);
    await loadUsers();
    notify('Active user switched.', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-900 text-white">
            <ShieldCheck size={18} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">User Management</h2>
            <p className="text-sm text-slate-500">Create accounts and control report permissions.</p>
          </div>
        </div>
        {!embedded && onBack && (
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
          >
            <ChevronLeft size={15} />
            Back
          </button>
        )}
      </div>

      {/* Add user */}
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <header className="flex items-center gap-2 border-b border-slate-200 px-5 py-3.5">
          <UserPlus size={16} className="text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-800">Add New User</h3>
        </header>

        <div className="space-y-5 p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className={labelClass}>Username</label>
              <input
                placeholder="jdoe"
                value={form.username}
                onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Full name</label>
              <input
                placeholder="John Doe"
                value={form.fullName}
                onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input
                placeholder="jdoe@example.com"
                type="email"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Password</label>
              <input
                placeholder="••••••••"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Role</label>
              <select
                value={form.role}
                onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value as UserRole }))}
                className={inputClass}
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Report permissions</label>
              <div className="flex h-[38px] items-center gap-4">
                {permissionFields.map((item) => (
                  <label key={item.key} className="flex items-center gap-1.5 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30"
                      checked={form[item.key]}
                      onChange={(event) => setForm((prev) => ({ ...prev, [item.key]: event.target.checked }))}
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end border-t border-slate-100 pt-4">
            <button
              onClick={submitCreate}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 transition"
            >
              <UserPlus size={15} />
              {saving ? 'Saving…' : 'Add User'}
            </button>
          </div>
        </div>
      </section>

      {/* Directory */}
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-800">User Directory</h3>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
            {users.length} {users.length === 1 ? 'user' : 'users'}
          </span>
        </header>

        {isLoading ? (
          <div className="p-10 text-center text-sm text-slate-400">Loading users…</div>
        ) : sortedUsers.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">No users yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3">User</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Permissions</th>
                  <th className="px-5 py-3">Password</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedUsers.map((user) => {
                  const isCurrent = user.id === currentUserId;
                  const isEditing = editingId === user.id && draft;

                  return (
                    <React.Fragment key={user.id}>
                      <tr className={isCurrent ? 'bg-blue-50/40' : 'hover:bg-slate-50/60 transition'}>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold uppercase text-slate-600">
                              {(user.fullName || user.username).slice(0, 2)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-slate-800">{user.fullName || user.username}</span>
                                {isCurrent && (
                                  <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                                    You
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-400">@{user.username}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600">{user.email || <span className="text-slate-300">—</span>}</td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                              roleBadgeClasses[user.role] || roleBadgeClasses.User
                            }`}
                          >
                            {user.role}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex gap-1.5">
                            {permissionFields.map((item) => {
                              const on = user.permissions[item.key];
                              return (
                                <span
                                  key={item.key}
                                  title={`${item.label}: ${on ? 'Allowed' : 'Denied'}`}
                                  className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-medium ${
                                    on ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'
                                  }`}
                                >
                                  {on ? <Check size={11} /> : <X size={11} />}
                                  {item.label}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          {user.passwordUpdatedAt ? (
                            <span className="text-xs font-medium text-emerald-600">Set</span>
                          ) : (
                            <span className="text-xs font-medium text-amber-600">Not set</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-1">
                            {!isCurrent && (
                              <button
                                onClick={() => switchTo(user)}
                                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 transition"
                              >
                                Switch
                              </button>
                            )}
                            <button
                              onClick={() => (isEditing ? cancelEdit() : beginEdit(user))}
                              title="Edit"
                              className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => removeUser(user)}
                              disabled={user.role === 'Admin'}
                              title={user.role === 'Admin' ? 'Admin cannot be deleted' : 'Delete'}
                              className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40 transition"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {isEditing && draft && (
                        <tr className="bg-slate-50/80">
                          <td colSpan={6} className="px-5 py-5">
                            <div className="space-y-4 rounded-md border border-slate-200 bg-white p-4">
                              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Editing @{user.username}
                              </div>

                              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                <div>
                                  <label className={labelClass}>Full name</label>
                                  <input
                                    value={draft.fullName || ''}
                                    onChange={(event) => setDraft({ ...draft, fullName: event.target.value })}
                                    className={inputClass}
                                    placeholder="Full name"
                                  />
                                </div>
                                <div>
                                  <label className={labelClass}>Email</label>
                                  <input
                                    value={draft.email || ''}
                                    onChange={(event) => setDraft({ ...draft, email: event.target.value })}
                                    className={inputClass}
                                    placeholder="Email"
                                  />
                                </div>
                                <div>
                                  <label className={labelClass}>Role</label>
                                  <select
                                    value={draft.role}
                                    onChange={(event) => {
                                      const role = event.target.value as UserRole;
                                      setDraft({
                                        ...draft,
                                        role,
                                        permissions:
                                          role === 'Viewer'
                                            ? { canView: true, canCreate: false, canEdit: false }
                                            : role === 'Admin'
                                              ? { canView: true, canCreate: true, canEdit: true }
                                              : draft.permissions,
                                      });
                                    }}
                                    className={inputClass}
                                  >
                                    {roleOptions.map((role) => (
                                      <option key={role} value={role}>{role}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              <div>
                                <label className={labelClass}>Report permissions</label>
                                <div className="flex flex-wrap gap-5">
                                  {permissionFields.map((item) => (
                                    <label key={item.key} className="flex items-center gap-1.5 text-sm text-slate-600">
                                      <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30"
                                        checked={draft.permissions[item.key]}
                                        onChange={(event) =>
                                          setDraft({
                                            ...draft,
                                            permissions: {
                                              ...draft.permissions,
                                              [item.key]: event.target.checked,
                                            },
                                          })
                                        }
                                      />
                                      {item.label}
                                    </label>
                                  ))}
                                </div>
                              </div>

                              <div>
                                <label className={labelClass}>Reset password</label>
                                <div className="flex flex-col gap-2 sm:flex-row">
                                  <div className="relative flex-1">
                                    <KeyRound size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                      value={editPassword}
                                      onChange={(event) => setEditPassword(event.target.value)}
                                      className={`${inputClass} pl-9`}
                                      placeholder="New password (leave blank to keep current)"
                                      type="password"
                                      autoComplete="new-password"
                                    />
                                  </div>
                                  <button
                                    onClick={async () => {
                                      if (!editPassword.trim()) {
                                        notify('Enter a new password first.');
                                        return;
                                      }
                                      try {
                                        await setManagedUserPassword(user.id, editPassword.trim());
                                        setEditPassword('');
                                        notify('Password updated.', 'success');
                                        await loadUsers();
                                      } catch (error) {
                                        console.error('Failed to set password', error);
                                        notify(error instanceof Error ? error.message : 'Failed to set password.');
                                      }
                                    }}
                                    className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                                  >
                                    Set Password
                                  </button>
                                </div>
                              </div>

                              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                                <button
                                  onClick={cancelEdit}
                                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={saveEdit}
                                  disabled={saving}
                                  className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition"
                                >
                                  <Check size={15} />
                                  {saving ? 'Saving…' : 'Save Changes'}
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default AdminUsersPage;
