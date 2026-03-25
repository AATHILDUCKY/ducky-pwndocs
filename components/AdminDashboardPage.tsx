import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Briefcase,
  ChevronLeft,
  Clock,
  Filter,
  Mail,
  Save,
  Shield,
  ShieldAlert,
  UserCog,
  Users,
} from 'lucide-react';
import type { EmailHistoryEntry } from '../services/historyService';
import { fetchChangeHistory, fetchEmailHistory } from '../services/historyService';
import { fetchIssues } from '../services/issueService';
import { fetchProjects } from '../services/projectService';
import type { ChangeHistoryEntry, Issue, ManagedUser, Project, UserProfile, UserProfileInput } from '../types';
import AdminUsersPage from './AdminUsersPage';
import { notify } from '../utils/notify';

type AdminDashboardPageProps = {
  profile: UserProfile | null;
  users: ManagedUser[];
  onBack: () => void;
  onUsersChanged?: (users: ManagedUser[], activeUser: ManagedUser | null) => void;
  onSaveProfile: (next: UserProfile & UserProfileInput) => Promise<void>;
};

type UnifiedHistoryItem = {
  id: string;
  timestamp: string;
  kind: 'change' | 'mail';
  actor: string;
  summary: string;
  details?: string;
};

type ProgramIssue = {
  issue: Issue;
  project: Project;
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const isOpenFinding = (issue: Issue) => issue.state !== 'Fixed' && issue.state !== 'Closed' && !issue.isFixed;

const getSeverityWeight = (severity: Issue['severity']) => {
  if (severity === 'Critical') return 4;
  if (severity === 'High') return 3;
  if (severity === 'Medium') return 2;
  if (severity === 'Low') return 1;
  return 0;
};

const MetricCard: React.FC<{
  title: string;
  value: string | number;
  hint: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone?: 'indigo' | 'rose' | 'emerald' | 'amber';
}> = ({ title, value, hint, icon: Icon, tone = 'indigo' }) => {
  const tones = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
  };

  return (
    <div className="bg-white rounded-[1.75rem] border border-slate-200 p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">{title}</p>
          <p className="text-3xl font-black tracking-tight text-slate-800">{value}</p>
          <p className="text-xs font-semibold text-slate-500">{hint}</p>
        </div>
        <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center ${tones[tone]}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
};

const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({
  profile,
  users,
  onBack,
  onUsersChanged,
  onSaveProfile,
}) => {
  const [adminDraft, setAdminDraft] = useState<(UserProfile & UserProfileInput) | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [changeHistory, setChangeHistory] = useState<ChangeHistoryEntry[]>([]);
  const [mailHistory, setMailHistory] = useState<EmailHistoryEntry[]>([]);
  const [historyFilter, setHistoryFilter] = useState<string>('all');
  const [projects, setProjects] = useState<Project[]>([]);
  const [programIssues, setProgramIssues] = useState<ProgramIssue[]>([]);
  const [programLoading, setProgramLoading] = useState(false);

  useEffect(() => {
    if (profile) {
      setAdminDraft(profile as UserProfile & UserProfileInput);
    }
  }, [profile]);

  useEffect(() => {
    const loadAdminData = async () => {
      setHistoryLoading(true);
      setProgramLoading(true);

      try {
        const [changes, mails, projectList] = await Promise.all([
          fetchChangeHistory({ limit: 300, offset: 0 }),
          fetchEmailHistory({ limit: 300, offset: 0 }),
          fetchProjects(),
        ]);

        setChangeHistory(changes);
        setMailHistory(mails);
        setProjects(projectList);

        const issueLists = await Promise.all(
          projectList.map(async (project) => ({
            project,
            issues: await fetchIssues(project.id),
          }))
        );

        setProgramIssues(
          issueLists.flatMap(({ project, issues }) => issues.map((issue) => ({ issue, project })))
        );
      } catch (error) {
        console.error('Failed to load admin dashboard data', error);
        notify('Failed to load admin dashboard data.');
      } finally {
        setHistoryLoading(false);
        setProgramLoading(false);
      }
    };

    loadAdminData();
  }, []);

  const unifiedHistory = useMemo(() => {
    const changeItems: UnifiedHistoryItem[] = changeHistory.map((entry) => ({
      id: `c-${entry.id}`,
      timestamp: entry.createdAt,
      kind: 'change',
      actor: entry.actorName,
      summary: entry.action,
      details: entry.targetName || entry.details || entry.targetType,
    }));

    const mailItems: UnifiedHistoryItem[] = mailHistory.map((entry) => ({
      id: `m-${entry.id}`,
      timestamp: entry.sent_at,
      kind: 'mail',
      actor: entry.recipient,
      summary: entry.issue_title ? 'Issue report email sent' : 'Project report email sent',
      details: entry.subject || entry.project_name || entry.issue_title || 'Report email',
    }));

    const merged = [...changeItems, ...mailItems].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    if (historyFilter === 'all') return merged;

    return merged.filter((item) => {
      if (historyFilter === 'mail') return item.kind === 'mail';
      return item.kind === 'change' && item.actor.toLowerCase() === historyFilter.toLowerCase();
    });
  }, [changeHistory, historyFilter, mailHistory]);

  const historyFilterOptions = useMemo(() => {
    const names = Array.from(new Set(changeHistory.map((entry) => entry.actorName).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    );
    return ['all', 'mail', ...names];
  }, [changeHistory]);

  const programMetrics = useMemo(() => {
    const totalProjects = projects.length;
    const activeProjects = projects.filter((project) => project.status === 'active').length;
    const openFindings = programIssues.filter(({ issue }) => isOpenFinding(issue));
    const fixedFindings = programIssues.filter(({ issue }) => issue.isFixed || issue.state === 'Fixed');
    const criticalOpen = openFindings.filter(({ issue }) => issue.severity === 'Critical');
    const highOpen = openFindings.filter(({ issue }) => issue.severity === 'High');
    const draftQueue = programIssues.filter(({ issue }) => issue.state === 'Draft' || issue.state === 'QA');
    const staleProjects = projects.filter((project) => {
      const ageMs = Date.now() - new Date(project.lastUpdate).getTime();
      return project.status === 'active' && ageMs > 1000 * 60 * 60 * 24 * 14;
    });

    const usersMissingPassword = users.filter((user) => !user.passwordUpdatedAt);
    const usersMissingEmail = users.filter((user) => !user.email?.trim());
    const analystCount = users.filter((user) => user.role === 'Analyst').length;
    const editorCount = users.filter((user) => user.permissions.canEdit).length;

    const projectBacklog = projects
      .map((project) => {
        const findings = openFindings.filter((entry) => entry.project.id === project.id);
        const weightedRisk = findings.reduce((sum, entry) => sum + getSeverityWeight(entry.issue.severity), 0);
        return {
          project,
          count: findings.length,
          weightedRisk,
          critical: findings.filter((entry) => entry.issue.severity === 'Critical').length,
          high: findings.filter((entry) => entry.issue.severity === 'High').length,
        };
      })
      .filter((entry) => entry.count > 0)
      .sort((left, right) => right.weightedRisk - left.weightedRisk || right.count - left.count)
      .slice(0, 5);

    const urgentFindings = openFindings
      .filter(({ issue }) => issue.severity === 'Critical' || issue.severity === 'High')
      .sort((left, right) => {
        const severityGap = getSeverityWeight(right.issue.severity) - getSeverityWeight(left.issue.severity);
        if (severityGap !== 0) return severityGap;
        return new Date(right.issue.updatedAt).getTime() - new Date(left.issue.updatedAt).getTime();
      })
      .slice(0, 6);

    return {
      totalProjects,
      activeProjects,
      totalFindings: programIssues.length,
      openFindingCount: openFindings.length,
      fixedFindingCount: fixedFindings.length,
      criticalOpenCount: criticalOpen.length,
      highOpenCount: highOpen.length,
      staleProjects,
      draftQueueCount: draftQueue.length,
      usersMissingPassword,
      usersMissingEmail,
      analystCount,
      editorCount,
      projectBacklog,
      urgentFindings,
    };
  }, [programIssues, projects, users]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-4xl font-bold text-slate-800 tracking-tight">Admin Dashboard</h2>
          <p className="text-slate-500 font-medium text-sm">
            Admin-only command center for team vulnerability operations, governance, and access control.
          </p>
        </div>
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2"
        >
          <ChevronLeft size={14} />
          Back
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <MetricCard
          title="Program Exposure"
          value={programMetrics.openFindingCount}
          hint={`${programMetrics.criticalOpenCount} critical / ${programMetrics.highOpenCount} high still open`}
          icon={ShieldAlert}
          tone="rose"
        />
        <MetricCard
          title="Portfolio Coverage"
          value={programMetrics.totalProjects}
          hint={`${programMetrics.activeProjects} active projects under management`}
          icon={Briefcase}
          tone="indigo"
        />
        <MetricCard
          title="Team Readiness"
          value={users.length}
          hint={`${programMetrics.analystCount} analysts, ${programMetrics.editorCount} users with edit rights`}
          icon={Users}
          tone="emerald"
        />
        <MetricCard
          title="Workflow Queue"
          value={programMetrics.draftQueueCount}
          hint={`${programMetrics.fixedFindingCount} findings already remediated or closed`}
          icon={UserCog}
          tone="amber"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <section className="xl:col-span-7 bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-5">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-rose-600" />
            <h3 className="font-black text-xs uppercase tracking-widest text-slate-700">Critical Remediation Queue</h3>
          </div>

          {programLoading ? (
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading queue...</p>
          ) : programMetrics.urgentFindings.length === 0 ? (
            <p className="text-sm font-semibold text-slate-500">No critical or high findings are waiting right now.</p>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
              {programMetrics.urgentFindings.map(({ issue, project }) => (
                <div key={issue.id} className="p-4 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{project.name}</p>
                    <p className="text-sm font-black text-slate-800">{issue.title}</p>
                    <p className="text-[11px] font-semibold text-slate-500">
                      {issue.affected || 'General scope'} · {issue.state}
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <p
                      className={`text-[10px] font-black uppercase tracking-widest ${
                        issue.severity === 'Critical' ? 'text-rose-600' : 'text-amber-600'
                      }`}
                    >
                      {issue.severity}
                    </p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {formatDate(issue.updatedAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="xl:col-span-5 bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-5">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-indigo-600" />
            <h3 className="font-black text-xs uppercase tracking-widest text-slate-700">Governance Gaps</h3>
          </div>
          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Access Hygiene</p>
              <p className="text-2xl font-black text-slate-800 mt-2">{programMetrics.usersMissingPassword.length}</p>
              <p className="text-xs font-semibold text-slate-500 mt-1">Users missing password enrollment</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Communication Gaps</p>
              <p className="text-2xl font-black text-slate-800 mt-2">{programMetrics.usersMissingEmail.length}</p>
              <p className="text-xs font-semibold text-slate-500 mt-1">Users without an email address on file</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Stale Projects</p>
              <p className="text-2xl font-black text-slate-800 mt-2">{programMetrics.staleProjects.length}</p>
              <p className="text-xs font-semibold text-slate-500 mt-1">Active projects not updated in the last 14 days</p>
            </div>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <section className="xl:col-span-6 bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-5">
          <div className="flex items-center gap-2">
            <Briefcase size={16} className="text-indigo-600" />
            <h3 className="font-black text-xs uppercase tracking-widest text-slate-700">Projects Under Highest Risk</h3>
          </div>

          {programLoading ? (
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading projects...</p>
          ) : programMetrics.projectBacklog.length === 0 ? (
            <p className="text-sm font-semibold text-slate-500">No active backlog across projects.</p>
          ) : (
            <div className="space-y-3">
              {programMetrics.projectBacklog.map((entry) => (
                <div key={entry.project.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-black text-slate-800">{entry.project.name}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{entry.project.client}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-800">{entry.count} open</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {entry.critical} critical / {entry.high} high
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="xl:col-span-6 bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-5">
          <div className="flex items-center gap-2">
            <UserCog size={16} className="text-emerald-600" />
            <h3 className="font-black text-xs uppercase tracking-widest text-slate-700">Team Access Overview</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {users.map((user) => (
              <div key={user.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-800">{user.fullName || user.username}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{user.role}</p>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    {user.passwordUpdatedAt ? 'Credentialed' : 'No Password'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 mt-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <span>View: {user.permissions.canView ? 'Yes' : 'No'}</span>
                  <span>Create: {user.permissions.canCreate ? 'Yes' : 'No'}</span>
                  <span>Edit: {user.permissions.canEdit ? 'Yes' : 'No'}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-5">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-indigo-600" />
          <h3 className="font-black text-xs uppercase tracking-widest text-slate-700">Admin Profile</h3>
        </div>

        {adminDraft ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Username</label>
                <input
                  value={adminDraft.username || ''}
                  onChange={(event) => setAdminDraft((prev) => (prev ? { ...prev, username: event.target.value } : prev))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Full Name</label>
                <input
                  value={adminDraft.fullName || ''}
                  onChange={(event) => setAdminDraft((prev) => (prev ? { ...prev, fullName: event.target.value } : prev))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email</label>
                <input
                  type="email"
                  value={adminDraft.email || ''}
                  onChange={(event) => setAdminDraft((prev) => (prev ? { ...prev, email: event.target.value } : prev))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold outline-none"
                />
              </div>
            </div>

            <button
              onClick={async () => {
                if (!adminDraft) return;
                try {
                  setSavingProfile(true);
                  await onSaveProfile(adminDraft);
                  notify('Admin profile updated.', 'success');
                } catch (error) {
                  console.error('Failed to update admin profile', error);
                  notify('Failed to update profile.');
                } finally {
                  setSavingProfile(false);
                }
              }}
              disabled={savingProfile}
              className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-2"
            >
              <Save size={13} />
              {savingProfile ? 'Saving...' : 'Save Profile'}
            </button>
          </>
        ) : (
          <p className="text-sm font-semibold text-slate-500">Loading admin profile...</p>
        )}
      </section>

      <section className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Mail size={16} className="text-emerald-600" />
            <h3 className="font-black text-xs uppercase tracking-widest text-slate-700">All User Histories</h3>
          </div>
          <div className="flex items-center gap-2">
            <Filter size={13} className="text-slate-400" />
            <select
              value={historyFilter}
              onChange={(event) => setHistoryFilter(event.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600"
            >
              {historyFilterOptions.map((option) => (
                <option key={option} value={option}>
                  {option === 'all' ? 'All Activity' : option === 'mail' ? 'Mail Activity' : option}
                </option>
              ))}
            </select>
          </div>
        </div>

        {historyLoading ? (
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading history...</p>
        ) : unifiedHistory.length === 0 ? (
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No history records found.</p>
        ) : (
          <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-100 custom-scrollbar border border-slate-100 rounded-xl">
            {unifiedHistory.map((item) => (
              <div key={item.id} className="p-4 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    {item.kind === 'change' ? 'User Activity' : 'Mail Activity'}
                  </p>
                  <p className="text-sm font-bold text-slate-700">{item.summary}</p>
                  <p className="text-[11px] font-semibold text-slate-500">{item.details}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Actor: {item.actor}</p>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">
                  <Clock size={11} />
                  {formatDate(item.timestamp)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <AdminUsersPage
        embedded
        currentUserId={profile?.id || users[0]?.id || ''}
        onUsersChanged={onUsersChanged}
      />
    </div>
  );
};

export default AdminDashboardPage;
