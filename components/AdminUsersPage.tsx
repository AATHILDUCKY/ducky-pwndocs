import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Pencil, Trash2, Plus, Users } from 'lucide-react';
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
      setEditingId(null);
      setDraft(null);
      setEditPassword('');
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

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-4xl font-black text-slate-800 tracking-tight">Admin Users</h2>
          <p className="text-slate-500 font-medium text-sm">Create users and control report permissions.</p>
        </div>
        {!embedded && onBack && (
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2"
          >
            <ChevronLeft size={14} />
            Back
          </button>
        )}
      </div>

      <section className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
            <Plus size={18} />
          </div>
          <h3 className="font-black text-sm text-slate-800 uppercase tracking-widest">Add User</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <input
            placeholder="Username"
            value={form.username}
            onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
            className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-semibold outline-none"
          />
          <input
            placeholder="Full name"
            value={form.fullName}
            onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
            className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-semibold outline-none"
          />
          <input
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-semibold outline-none"
          />
          <input
            placeholder="Password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
            className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-semibold outline-none"
          />
          <select
            value={form.role}
            onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value as UserRole }))}
            className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-semibold outline-none"
          >
            {roleOptions.map((role) => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { key: 'canView', label: 'Can View Reports' },
            { key: 'canCreate', label: 'Can Create Reports' },
            { key: 'canEdit', label: 'Can Edit Reports' },
          ].map((item) => (
            <label key={item.key} className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500">
              <input
                type="checkbox"
                checked={form[item.key as 'canView' | 'canCreate' | 'canEdit']}
                onChange={(event) => setForm((prev) => ({ ...prev, [item.key]: event.target.checked }))}
              />
              {item.label}
            </label>
          ))}
        </div>

        <div>
          <button
            onClick={submitCreate}
            disabled={saving}
            className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black uppercase tracking-widest"
          >
            {saving ? 'Saving...' : 'Add User'}
          </button>
        </div>
      </section>

      <section className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-2">
          <Users size={16} className="text-indigo-600" />
          <h3 className="font-black text-xs uppercase tracking-widest text-slate-700">User Directory</h3>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Loading users...</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {sortedUsers.map((user) => {
              const isCurrent = user.id === currentUserId;
              const isEditing = editingId === user.id && draft;

              return (
                <div key={user.id} className="p-6 flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-black text-slate-800">{user.fullName || user.username}</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        @{user.username} {isCurrent ? '· Active' : ''}
                      </p>
                      <p className="text-xs font-semibold text-slate-500 mt-1">{user.email || 'No email set'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-600">
                        {user.role}
                      </span>
                      {!isEditing && (
                        <>
                          <button
                            onClick={() => beginEdit(user)}
                            className="w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 flex items-center justify-center"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => removeUser(user)}
                            className="w-8 h-8 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-500 hover:bg-rose-50 flex items-center justify-center"
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="space-y-3 bg-slate-50 rounded-xl p-4">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <input
                          value={draft.fullName || ''}
                          onChange={(event) => setDraft({ ...draft, fullName: event.target.value })}
                          className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold"
                          placeholder="Full name"
                        />
                        <input
                          value={draft.email || ''}
                          onChange={(event) => setDraft({ ...draft, email: event.target.value })}
                          className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold"
                          placeholder="Email"
                        />
                        <select
                          value={draft.role}
                          onChange={(event) => {
                            const role = event.target.value as UserRole;
                            setDraft({
                              ...draft,
                              role,
                              permissions: role === 'Viewer'
                                ? { canView: true, canCreate: false, canEdit: false }
                                : role === 'Admin'
                                  ? { canView: true, canCreate: true, canEdit: true }
                                  : draft.permissions,
                            });
                          }}
                          className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold"
                        >
                          {roleOptions.map((role) => (
                            <option key={role} value={role}>{role}</option>
                          ))}
                        </select>
                        <button
                          onClick={async () => {
                            await setActiveUser(user.id);
                            await loadUsers();
                            notify('Active user switched.', 'success');
                          }}
                          className="rounded-lg border border-slate-200 bg-white text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100"
                        >
                          Switch User
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                        <input
                          value={editPassword}
                          onChange={(event) => setEditPassword(event.target.value)}
                          className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold"
                          placeholder="New password (leave blank to keep current)"
                          type="password"
                          autoComplete="new-password"
                        />
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
                          className="px-4 py-2 rounded-lg bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest"
                        >
                          Set Password
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { key: 'canView', label: 'Can View Reports' },
                          { key: 'canCreate', label: 'Can Create Reports' },
                          { key: 'canEdit', label: 'Can Edit Reports' },
                        ].map((item) => (
                          <label key={item.key} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                            <input
                              type="checkbox"
                              checked={draft.permissions[item.key as 'canView' | 'canCreate' | 'canEdit']}
                              onChange={(event) => setDraft({
                                ...draft,
                                permissions: {
                                  ...draft.permissions,
                                  [item.key]: event.target.checked,
                                },
                              })}
                            />
                            {item.label}
                          </label>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={saveEdit}
                          disabled={saving}
                          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => { setEditingId(null); setDraft(null); }}
                          className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <span>View: {user.permissions.canView ? 'Yes' : 'No'}</span>
                      <span>Create: {user.permissions.canCreate ? 'Yes' : 'No'}</span>
                      <span>Edit: {user.permissions.canEdit ? 'Yes' : 'No'}</span>
                      <button
                        onClick={async () => {
                          await setActiveUser(user.id);
                          await loadUsers();
                          notify('Active user switched.', 'success');
                        }}
                        className="text-indigo-600 hover:underline"
                      >
                        Switch To This User
                      </button>
                      <span>Password: {user.passwordUpdatedAt ? 'Set' : 'Not set'}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default AdminUsersPage;
