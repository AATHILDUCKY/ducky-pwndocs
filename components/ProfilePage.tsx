import React from 'react';
import { ChevronLeft, Mail, UserCog, History, Upload, Users, ShieldCheck } from 'lucide-react';
import type { SmtpSettings, UserProfile, UserProfileInput } from '../types';
import { selectMediaFile } from '../services/mediaService';
import { notify } from '../utils/notify';

type ProfilePageProps = {
  profile: UserProfile | null;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  smtpForm: SmtpSettings;
  setSmtpForm: React.Dispatch<React.SetStateAction<SmtpSettings>>;
  smtpSaving: boolean;
  smtpError: string | null;
  setSmtpError: React.Dispatch<React.SetStateAction<string | null>>;
  onSaveProfile: () => Promise<void>;
  onSaveSmtp: () => Promise<void>;
  onBack: () => void;
  onOpenHistory: () => void;
  isAdmin?: boolean;
  adminIdentity?: { username: string; email?: string };
  onOpenAdminUsers?: () => void;
};

const ProfilePage: React.FC<ProfilePageProps> = ({
  profile,
  setProfile,
  smtpForm,
  setSmtpForm,
  smtpSaving,
  smtpError,
  setSmtpError,
  onSaveProfile,
  onSaveSmtp,
  onBack,
  onOpenHistory,
  isAdmin = false,
  adminIdentity,
  onOpenAdminUsers,
}) => {
  if (!profile) {
    return (
      <div className="min-h-[400px] flex items-center justify-center text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
        Loading profile...
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-4xl font-black text-slate-800 tracking-tight">Profile Settings</h2>
          <p className="text-slate-500 font-medium text-sm">Manage your identity and secure mail configuration.</p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <button
              onClick={() => onOpenAdminUsers?.()}
              className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2"
            >
              <Users size={14} />
              Admin Users
            </button>
          )}
          <button
            onClick={onOpenHistory}
            className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2"
          >
            <History size={14} />
            History
          </button>
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2"
          >
            <ChevronLeft size={14} />
            Back
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
          {isAdmin && (
            <div className="mb-8 p-4 rounded-2xl border border-emerald-200 bg-emerald-50/60">
              <div className="flex items-center gap-2 text-emerald-700 mb-2">
                <ShieldCheck size={16} />
                <p className="text-[10px] font-black uppercase tracking-widest">Administrator Account</p>
              </div>
              <p className="text-sm font-bold text-slate-700">{adminIdentity?.username || profile.username}</p>
              <p className="text-[11px] font-semibold text-slate-500">
                {adminIdentity?.email || profile.email || 'admin@localhost'}
              </p>
            </div>
          )}
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600">
              <UserCog size={20} />
            </div>
            <h3 className="font-black text-sm text-slate-800 uppercase tracking-widest">User Profile</h3>
          </div>

          <div className="flex items-center gap-6 mb-8">
            <div className="w-20 h-20 rounded-full overflow-hidden border border-slate-200 shadow-sm bg-slate-50">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-white text-lg font-black"
                  style={{ backgroundColor: profile.avatarColor || '#4f46e5' }}
                >
                  {(profile.username || 'U').slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Profile Avatar</p>
              <button
                onClick={async () => {
                  try {
                    const result = await selectMediaFile('image');
                    if (!result?.url) return;
                    setProfile((prev) => (prev ? { ...prev, avatarUrl: result.url } : prev));
                    notify('Avatar updated.', 'success');
                  } catch (error) {
                    console.error('Failed to select avatar', error);
                    notify('Failed to select avatar.');
                  }
                }}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2"
              >
                <Upload size={14} />
                Upload
              </button>
            </div>
          </div>

          <div className="space-y-6">
            {[
              { label: 'Username', key: 'username', type: 'text' },
              { label: 'Full Name', key: 'fullName', type: 'text' },
              { label: 'Role', key: 'role', type: 'text' },
              { label: 'Email', key: 'email', type: 'email' },
            ].map((field) => (
              <div key={field.key} className="space-y-2">
                <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest px-1">{field.label}</label>
                <input
                  type={field.type}
                  value={(profile as UserProfile & UserProfileInput)[field.key] || ''}
                  onChange={(e) => setProfile((prev) => (prev ? { ...prev, [field.key]: e.target.value } : prev))}
                  readOnly={field.key === 'role'}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all shadow-sm"
                />
              </div>
            ))}
          </div>

          <div className="flex gap-4 pt-6">
            <button
              onClick={onSaveProfile}
              className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 transition-all active:scale-95"
            >
              Save Profile
            </button>
          </div>
        </section>

        <section className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2.5 bg-slate-50 rounded-xl text-slate-600">
              <Mail size={20} />
            </div>
            <h3 className="font-black text-sm text-slate-800 uppercase tracking-widest">Mail Settings</h3>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest px-1">SMTP Host</label>
                <input
                  type="text"
                  value={smtpForm.host}
                  onChange={(e) => setSmtpForm((prev) => ({ ...prev, host: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all shadow-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest px-1">SMTP Port</label>
                <input
                  type="number"
                  value={smtpForm.port || ''}
                  onChange={(e) => setSmtpForm((prev) => ({ ...prev, port: Number(e.target.value) || 0 }))}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all shadow-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest px-1">SMTP User</label>
                <input
                  type="text"
                  value={smtpForm.user}
                  onChange={(e) => setSmtpForm((prev) => ({ ...prev, user: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all shadow-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest px-1">SMTP Password</label>
                <input
                  type="password"
                  value={smtpForm.pass}
                  onChange={(e) => setSmtpForm((prev) => ({ ...prev, pass: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all shadow-sm"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest px-1">From Address</label>
                <input
                  type="email"
                  value={smtpForm.from}
                  onChange={(e) => setSmtpForm((prev) => ({ ...prev, from: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all shadow-sm"
                />
                {smtpForm.user && smtpForm.from && smtpForm.user !== smtpForm.from && (
                  <p className="text-[9px] font-black uppercase tracking-widest text-amber-500 px-1">
                    SMTP servers often require “From” to match SMTP User. We will send from SMTP User and use this as Reply-To.
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-4 pt-2">
              <button
                onClick={async () => {
                  setSmtpError(null);
                  await onSaveSmtp();
                }}
                className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 disabled:opacity-60"
                disabled={smtpSaving}
              >
                {smtpSaving ? 'Saving...' : 'Save Mail Settings'}
              </button>
            </div>
            {smtpError && (
              <p className="text-[10px] font-black uppercase tracking-widest text-rose-500">
                {smtpError}
              </p>
            )}
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Credentials stored locally in SQLite. Use app-level disk encryption for stronger protection.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ProfilePage;
