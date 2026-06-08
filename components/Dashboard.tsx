import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle2, FileText, ListChecks, ShieldCheck } from 'lucide-react';
import type { Issue, Project, UserProfile } from '../types';
import { fetchIssues } from '../services/issueService';
import { getIsoEvidenceScore, getSlaStatus, isClosed } from '../utils/vulnerabilityProcedure';

const severityOrder = ['Critical', 'High', 'Medium', 'Low', 'Info'] as const;
const severityClass: Record<string, string> = {
  Critical: 'bg-red-500',
  High: 'bg-orange-500',
  Medium: 'bg-yellow-500',
  Low: 'bg-blue-500',
  Info: 'bg-slate-400',
};

const StatCard: React.FC<{ label: string; value: string | number; icon: React.ElementType; tone?: string }> = ({
  label,
  value,
  icon: Icon,
  tone = 'text-slate-600 bg-slate-50',
}) => (
  <div className="rounded-lg border border-slate-200 bg-white p-4">
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}>
        <Icon size={17} />
      </span>
    </div>
    <p className="mt-3 text-2xl font-bold text-slate-900">{value}</p>
  </div>
);

const Dashboard: React.FC<{
  activeProjectId: string;
  activeProject: Project;
  profile: UserProfile | null;
}> = ({ activeProjectId, activeProject, profile }) => {
  const navigate = useNavigate();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!activeProjectId) {
        setIssues([]);
        return;
      }
      setLoading(true);
      try {
        const data = await fetchIssues(activeProjectId);
        if (alive) setIssues(data);
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [activeProjectId]);

  const metrics = useMemo(() => {
    const total = issues.length;
    const closed = issues.filter(isClosed).length;
    const overdue = issues.filter((issue) => getSlaStatus(issue).tone === 'danger').length;
    const evidence = total
      ? Math.round(issues.reduce((sum, issue) => sum + getIsoEvidenceScore(issue), 0) / total)
      : 100;
    const bySeverity = severityOrder.map((severity) => ({
      severity,
      count: issues.filter((issue) => issue.severity === severity).length,
    }));
    return { total, closed, open: total - closed, overdue, evidence, bySeverity };
  }, [issues]);

  const maxSeverity = Math.max(...metrics.bySeverity.map((item) => item.count), 1);
  const recentIssues = issues.slice(0, 6);

  if (!activeProjectId) {
    return (
      <section className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
        <ShieldCheck className="mx-auto text-slate-400" size={32} />
        <h2 className="mt-4 text-xl font-bold text-slate-900">Create your first project</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
          Projects keep findings, evidence, notes, and reports together.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col justify-between gap-4 rounded-lg border border-slate-200 bg-white p-5 md:flex-row md:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
            {profile?.fullName || profile?.username || 'Workspace'}
          </p>
          <h2 className="mt-1 text-2xl font-bold text-slate-950">{activeProject.name}</h2>
          <p className="mt-1 text-sm text-slate-500">{activeProject.client || 'No client set'}</p>
        </div>
        <button
          type="button"
          onClick={() => navigate(`/issues?project=${activeProjectId}`)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Open Findings
          <ArrowRight size={16} />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open Findings" value={metrics.open} icon={AlertTriangle} tone="bg-red-50 text-red-600" />
        <StatCard label="Closed" value={metrics.closed} icon={CheckCircle2} tone="bg-emerald-50 text-emerald-600" />
        <StatCard label="Overdue" value={metrics.overdue} icon={ListChecks} tone="bg-orange-50 text-orange-600" />
        <StatCard label="Audit Info" value={`${metrics.evidence}%`} icon={FileText} tone="bg-indigo-50 text-indigo-600" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-bold text-slate-900">Severity</h3>
          <div className="mt-4 space-y-3">
            {metrics.bySeverity.map((item) => (
              <div key={item.severity} className="grid grid-cols-[5rem_1fr_2rem] items-center gap-3 text-sm">
                <span className="font-semibold text-slate-600">{item.severity}</span>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${severityClass[item.severity]}`}
                    style={{ width: `${Math.max(4, (item.count / maxSeverity) * 100)}%` }}
                  />
                </div>
                <span className="text-right font-bold text-slate-700">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-slate-900">Recent Findings</h3>
            {loading && <span className="text-xs font-semibold text-slate-400">Loading...</span>}
          </div>
          <div className="mt-4 divide-y divide-slate-100">
            {recentIssues.length ? recentIssues.map((issue) => (
              <button
                key={issue.id}
                type="button"
                onClick={() => navigate(`/issues?project=${activeProjectId}`)}
                className="flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{issue.title || 'Untitled finding'}</p>
                  <p className="mt-1 text-xs text-slate-500">{issue.state} · {issue.affected || 'No asset set'}</p>
                </div>
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${severityClass[issue.severity] || 'bg-slate-400'}`} />
              </button>
            )) : (
              <p className="py-8 text-center text-sm text-slate-500">No findings yet.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Dashboard;
