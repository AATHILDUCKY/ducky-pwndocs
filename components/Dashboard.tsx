
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { readStore } from '../services/webStore';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  Cell,
  AreaChart,
  Area,
  Legend,
} from 'recharts';
import {
  ShieldAlert,
  Clock,
  Target,
  ShieldCheck,
  Plus,
  Shield,
  Activity,
  CheckCircle2,
  Timer,
  FileCheck2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Flame,
  BarChart3,
  ListChecks,
} from 'lucide-react';
import { Activity as ActivityType, Issue, Project, UserProfile } from '../types';
import { fetchIssues } from '../services/issueService';
import {
  getIsoEvidenceScore,
  getSlaStatus,
  isClosed,
  ISO_CONTROL_REFERENCE,
} from '../utils/vulnerabilityProcedure';

const SEVERITY_ORDER: Record<string, number> = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
  Info: 0,
};

const SEVERITY_CONFIG = {
  Critical: { color: '#ef4444', bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-100', dot: 'bg-red-500' },
  High:     { color: '#f97316', bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-100', dot: 'bg-orange-500' },
  Medium:   { color: '#eab308', bg: 'bg-yellow-50', text: 'text-yellow-600', border: 'border-yellow-100', dot: 'bg-yellow-500' },
  Low:      { color: '#3b82f6', bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100', dot: 'bg-blue-500' },
  Info:     { color: '#6366f1', bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-100', dot: 'bg-indigo-500' },
};

const formatRelativeTime = (input: string) => {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return 'Just now';
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
};

const getLastDays = (count: number) => {
  const today = new Date();
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (count - 1 - i));
    return {
      key: date.toISOString().slice(0, 10),
      day: date.toLocaleDateString(undefined, { weekday: 'short' }),
      date,
    };
  });
};

const getRangeDays = (range: 'week' | 'month' | 'quarter') => {
  if (range === 'month') return 30;
  if (range === 'quarter') return 90;
  return 7;
};

// SVG ring gauge
const RingGauge: React.FC<{ value: number; max?: number; color: string; size?: number; label?: string }> = ({
  value, max = 100, color, size = 72, label,
}) => {
  const pct = Math.min(1, Math.max(0, value / max));
  const r = (size - 14) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={7} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={7}
          strokeDasharray={`${pct * circ} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.7s ease' }}
        />
      </svg>
      {label && (
        <span className="absolute text-[10px] font-bold text-slate-600" style={{ fontSize: 11 }}>{label}</span>
      )}
    </div>
  );
};

// Inline mini bar sparkline
const MiniBar: React.FC<{ data: number[]; color: string }> = ({ data, color }) => {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-0.5 h-8">
      {data.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm transition-all"
          style={{ height: `${Math.max(4, (v / max) * 32)}px`, backgroundColor: color, opacity: 0.7 + (i / data.length) * 0.3 }}
        />
      ))}
    </div>
  );
};

// Severity pill badge
const SeverityBadge: React.FC<{ severity: string }> = ({ severity }) => {
  const cfg = SEVERITY_CONFIG[severity as keyof typeof SEVERITY_CONFIG] || SEVERITY_CONFIG.Info;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text} ${cfg.border} border`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {severity}
    </span>
  );
};

// KPI Card component
const KpiCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  iconColor?: string;
  iconBg?: string;
  trend?: number;
  trendLabel?: string;
  children?: React.ReactNode;
  accent?: string;
}> = ({ title, value, subtitle, icon: Icon, iconColor = 'text-indigo-600', iconBg = 'bg-indigo-50', trend, trendLabel, children, accent }) => (
  <div className={`bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all duration-200 group overflow-hidden relative ${accent ? `border-l-4 ${accent}` : ''}`}>
    <div className="flex items-start justify-between mb-4">
      <div className={`p-2.5 rounded-xl ${iconBg} transition-colors group-hover:scale-110 transition-transform duration-200`}>
        <Icon size={17} className={iconColor} />
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${trend > 0 ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600'}`}>
          {trend > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {Math.abs(trend)}% {trendLabel || ''}
        </div>
      )}
    </div>
    <div className="space-y-0.5">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
      <p className="text-2xl font-bold text-slate-800 tabular-nums leading-tight">{value}</p>
      {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
    </div>
    {children && <div className="mt-4">{children}</div>}
  </div>
);

// ISO metric pill
const IsoMetric: React.FC<{ label: string; value: string | number; caption: string; tone?: 'ok' | 'warn' | 'danger' | 'neutral' }> = ({
  label, value, caption, tone = 'neutral',
}) => {
  const colors = {
    ok:      { card: 'bg-emerald-50 border-emerald-100', val: 'text-emerald-700', cap: 'text-emerald-500' },
    warn:    { card: 'bg-amber-50 border-amber-100',    val: 'text-amber-700',   cap: 'text-amber-500' },
    danger:  { card: 'bg-red-50 border-red-100',        val: 'text-red-700',     cap: 'text-red-500' },
    neutral: { card: 'bg-slate-50 border-slate-100',    val: 'text-slate-800',   cap: 'text-slate-400' },
  }[tone];
  return (
    <div className={`rounded-xl border p-4 text-center ${colors.card}`}>
      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${colors.val}`}>{value}</p>
      <p className={`text-[11px] font-medium mt-1 ${colors.cap}`}>{caption}</p>
    </div>
  );
};

const Dashboard: React.FC<{
  activeProjectId: string;
  activeProject?: Project | null;
  profile?: UserProfile | null;
}> = ({ activeProjectId, activeProject, profile }) => {
  const navigate = useNavigate();
  const [issues, setIssues] = useState<Issue[]>(() =>
    activeProjectId ? (readStore().issues[activeProjectId] || []) : []
  );
  const [activityUser, setActivityUser] = useState<string>('Analyst');
  // true only when we have NO data at all (first load of a project)
  const [isLoading, setIsLoading] = useState(!activeProjectId ? false : !(readStore().issues[activeProjectId]?.length));
  const [dataError, setDataError] = useState<string | null>(null);
  const [pulseRange, setPulseRange] = useState<'week' | 'month' | 'quarter'>('week');
  const prevProjectId = useRef<string>('');

  useEffect(() => {
    if (!activeProjectId) { setIssues([]); return; }

    // On project switch: seed from local store immediately (zero-flash)
    if (prevProjectId.current !== activeProjectId) {
      prevProjectId.current = activeProjectId;
      const cached = readStore().issues[activeProjectId] || [];
      setIssues(cached);
      setDataError(null);
      // Only show spinner when there is truly nothing to show yet
      if (!cached.length) setIsLoading(true);
    }

    let isMounted = true;
    fetchIssues(activeProjectId)
      .then((data) => { if (isMounted) setIssues(data || []); })
      .catch((err: any) => {
        if (!isMounted) return;
        // Keep existing data on error; only surface error when we have nothing
        setIssues((prev) => prev.length ? prev : []);
        setDataError(err?.message || 'Unable to load overview data.');
      })
      .finally(() => { if (isMounted) setIsLoading(false); });

    return () => { isMounted = false; };
  }, [activeProjectId]);

  useEffect(() => {
    setActivityUser(profile?.username || 'Analyst');
  }, [profile]);

  const metrics = useMemo(() => {
    const total = issues.length;
    const severityCounts = { Critical: 0, High: 0, Medium: 0, Low: 0, Info: 0 };
    let weightedScore = 0;
    let fixedCount = 0;
    let openCount = 0;
    let inProgressCount = 0;

    issues.forEach((issue) => {
      const sev = issue.severity || 'Info';
      if (sev in severityCounts) severityCounts[sev as keyof typeof severityCounts] += 1;
      weightedScore += SEVERITY_ORDER[sev] || 0;
      if (issue.isFixed || issue.state === 'Fixed' || issue.state === 'Closed') {
        fixedCount += 1;
      } else if (issue.state === 'In Progress') {
        inProgressCount += 1;
      } else {
        openCount += 1;
      }
    });

    const riskIndex = total ? Math.round((weightedScore / (total * 4)) * 100) : 0;
    const remediationRate = total ? Math.round((fixedCount / total) * 1000) / 10 : 0;
    const recentWindow = getLastDays(7);
    const recentKeys = new Set(recentWindow.map((d) => d.key));
    const recentFindings = issues.filter((issue) => {
      const date = new Date(issue.updatedAt);
      if (Number.isNaN(date.getTime())) return false;
      return recentKeys.has(date.toISOString().slice(0, 10));
    }).length;
    const detectionVelocity = recentFindings ? Math.round((recentFindings / 7) * 10) / 10 : 0;
    const coverage = total
      ? Math.min(100, Math.round((issues.filter((i) => i.affected?.trim()).length / total) * 100))
      : 0;
    const criticalHighOpen = issues.filter(
      (i) => (i.severity === 'Critical' || i.severity === 'High') && !i.isFixed && i.state !== 'Fixed' && i.state !== 'Closed'
    ).length;

    return {
      total, severityCounts, riskIndex, remediationRate, detectionVelocity,
      coverage, fixedCount, openCount, inProgressCount, criticalHighOpen,
    };
  }, [issues]);

  // MTTR: mean days from dateIdentified → remediationCompletedDate for resolved issues
  const mttrDays = useMemo(() => {
    const resolved = issues.filter(
      (i) => (i.isFixed || i.state === 'Fixed' || i.state === 'Closed') && i.dateIdentified && i.remediationCompletedDate
    );
    if (!resolved.length) return null;
    const total = resolved.reduce((sum, i) => {
      const start = new Date(i.dateIdentified!).getTime();
      const end = new Date(i.remediationCompletedDate!).getTime();
      const days = Math.max(0, (end - start) / 86400000);
      return sum + days;
    }, 0);
    return Math.round(total / resolved.length);
  }, [issues]);

  const isoMetrics = useMemo(() => {
    const tracked = issues.filter((i) => i.severity === 'Critical' || i.severity === 'High');
    const overdue = issues.filter((i) => getSlaStatus(i).tone === 'danger').length;
    const dueSoon = issues.filter((i) => getSlaStatus(i).tone === 'warning').length;
    const exceptions = issues.filter((i) => i.exceptionRequired).length;
    const closedWithVerification = issues.filter(
      (i) => isClosed(i) && i.verificationDate && i.verificationResult && i.verificationResult !== 'Not Verified'
    ).length;
    const closed = issues.filter(isClosed).length;
    const evidenceAverage = issues.length
      ? Math.round(issues.reduce((sum, i) => sum + getIsoEvidenceScore(i), 0) / issues.length)
      : 100;
    const verifiedClosureRate = closed ? Math.round((closedWithVerification / closed) * 100) : 100;

    return { tracked: tracked.length, overdue, dueSoon, exceptions, evidenceAverage, verifiedClosureRate };
  }, [issues]);

  const remediationVelocity = useMemo(() => {
    const days = getLastDays(getRangeDays(pulseRange));
    const map = new Map(days.map((d) => [d.key, { day: d.day, findings: 0, fixed: 0 }]));
    issues.forEach((issue) => {
      const date = new Date(issue.updatedAt);
      if (Number.isNaN(date.getTime())) return;
      const key = date.toISOString().slice(0, 10);
      const entry = map.get(key);
      if (!entry) return;
      entry.findings += 1;
      if (issue.isFixed || issue.state === 'Fixed') entry.fixed += 1;
    });
    return Array.from(map.values());
  }, [issues, pulseRange]);

  const exposureMatrix = useMemo(() => {
    if (!issues.length) return { heatLevel: 0, criticalRatio: 0, highRatio: 0, avgCvss: 0 };
    const critical = metrics.severityCounts.Critical;
    const high = metrics.severityCounts.High;
    const avgCvss = issues.reduce((sum, i) => sum + (Number.parseFloat(i.cvssScore || '0') || 0), 0) / issues.length;
    const heatLevel = Math.min(100, Math.round((metrics.riskIndex * 0.7) + (avgCvss * 10 * 0.3)));
    return {
      heatLevel,
      criticalRatio: Math.round((critical / issues.length) * 100),
      highRatio: Math.round((high / issues.length) * 100),
      avgCvss: Math.round(avgCvss * 10) / 10,
    };
  }, [issues, metrics]);

  const severityData = useMemo(() => [
    { name: 'Critical', count: metrics.severityCounts.Critical, fill: '#ef4444' },
    { name: 'High',     count: metrics.severityCounts.High,     fill: '#f97316' },
    { name: 'Medium',   count: metrics.severityCounts.Medium,   fill: '#eab308' },
    { name: 'Low',      count: metrics.severityCounts.Low,      fill: '#3b82f6' },
    { name: 'Info',     count: metrics.severityCounts.Info,     fill: '#6366f1' },
  ], [metrics]);

  const categoryData = useMemo(() => {
    const counts = { Internal: 0, External: 0, Unknown: 0 };
    issues.forEach((i) => {
      if (i.type === 'Internal') counts.Internal += 1;
      else if (i.type === 'External') counts.External += 1;
      else counts.Unknown += 1;
    });
    return [
      { name: 'Internal', value: counts.Internal, fill: '#6366f1' },
      { name: 'External', value: counts.External, fill: '#3b82f6' },
      { name: 'Unknown',  value: counts.Unknown,  fill: '#94a3b8' },
    ];
  }, [issues]);

  const recentActivity: ActivityType[] = useMemo(() => {
    const sorted = [...issues].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return sorted.slice(0, 8).map((issue) => ({
      id: issue.id,
      user: activityUser,
      action: issue.isFixed || issue.state === 'Fixed' ? 'resolved' : issue.state === 'In Progress' ? 'investigating' : 'logged',
      target: issue.title || 'Untitled vulnerability',
      timestamp: formatRelativeTime(issue.updatedAt),
      severity: issue.severity,
    }));
  }, [issues, activityUser]);

  const topFindings = useMemo(() => {
    const open = issues.filter((i) => !i.isFixed && i.state !== 'Fixed' && i.state !== 'Closed');
    return [...open]
      .sort((a, b) => {
        const sd = (SEVERITY_ORDER[b.severity] || 0) - (SEVERITY_ORDER[a.severity] || 0);
        if (sd !== 0) return sd;
        return (Number.parseFloat(b.cvssScore || '0')) - (Number.parseFloat(a.cvssScore || '0'));
      })
      .slice(0, 4)
      .map((i) => ({
        id: i.id,
        title: i.title || 'Untitled vulnerability',
        severity: i.severity || 'Info',
        score: Number.parseFloat(i.cvssScore || '0') || 0,
        state: i.state,
        sla: getSlaStatus(i),
      }));
  }, [issues]);

  const weeklySparkline = useMemo(() => {
    const days = getLastDays(7);
    const map = new Map(days.map((d) => [d.key, 0]));
    issues.forEach((i) => {
      const key = new Date(i.updatedAt).toISOString().slice(0, 10);
      if (map.has(key)) map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.values());
  }, [issues]);

  const riskColor = metrics.riskIndex >= 70 ? '#ef4444' : metrics.riskIndex >= 40 ? '#f97316' : '#22c55e';
  const riskLabel = metrics.riskIndex >= 70 ? 'High Risk' : metrics.riskIndex >= 40 ? 'Medium Risk' : 'Low Risk';

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`w-2 h-2 rounded-full animate-pulse ${metrics.riskIndex >= 70 ? 'bg-red-500' : metrics.riskIndex >= 40 ? 'bg-amber-400' : 'bg-emerald-500'}`} />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {riskLabel} · {metrics.remediationRate.toFixed(1)}% resolved
            </span>
          </div>
          <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Vulnerability Dashboard</h2>
          <p className="text-sm text-slate-500 mt-1">Risk exposure, remediation progress, SLA health and ISO 27001 audit readiness.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm">
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Active Project</p>
              <p className="text-sm font-bold text-indigo-600">{activeProject?.name || 'None selected'}</p>
            </div>
            <div className="h-8 w-px bg-slate-100" />
            <button className="w-9 h-9 bg-indigo-600 text-white rounded-lg shadow-lg shadow-indigo-100 flex items-center justify-center hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all">
              <Plus size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Alerts */}
      {dataError && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-100 text-red-600 text-sm font-medium px-5 py-3 rounded-xl">
          <AlertCircle size={16} />
          {dataError}
        </div>
      )}
      {isLoading && !dataError && (
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 text-slate-500 text-sm font-medium px-5 py-3 rounded-xl">
          <div className="w-4 h-4 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin" />
          Loading vulnerability data...
        </div>
      )}

      {/* KPI Cards — Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Risk Score */}
        <KpiCard
          title="Risk Score"
          value={`${metrics.riskIndex}`}
          subtitle={riskLabel}
          icon={ShieldAlert}
          iconColor={metrics.riskIndex >= 70 ? 'text-red-500' : metrics.riskIndex >= 40 ? 'text-orange-500' : 'text-emerald-500'}
          iconBg={metrics.riskIndex >= 70 ? 'bg-red-50' : metrics.riskIndex >= 40 ? 'bg-orange-50' : 'bg-emerald-50'}
          accent={metrics.riskIndex >= 70 ? 'border-l-red-500' : metrics.riskIndex >= 40 ? 'border-l-orange-400' : 'border-l-emerald-500'}
        >
          <div className="flex items-center gap-3">
            <RingGauge value={metrics.riskIndex} color={riskColor} size={56} />
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${metrics.riskIndex}%`, backgroundColor: riskColor }}
              />
            </div>
          </div>
        </KpiCard>

        {/* Total Findings */}
        <KpiCard
          title="Total Findings"
          value={metrics.total}
          subtitle={`${metrics.openCount} open · ${metrics.inProgressCount} in progress`}
          icon={BarChart3}
          iconColor="text-slate-600"
          iconBg="bg-slate-100"
        >
          <MiniBar data={weeklySparkline} color="#6366f1" />
        </KpiCard>

        {/* Critical & High Open */}
        <KpiCard
          title="Critical & High"
          value={metrics.criticalHighOpen}
          subtitle="Open urgent items"
          icon={Flame}
          iconColor={metrics.criticalHighOpen > 0 ? 'text-red-500' : 'text-emerald-500'}
          iconBg={metrics.criticalHighOpen > 0 ? 'bg-red-50' : 'bg-emerald-50'}
          accent={metrics.criticalHighOpen > 0 ? 'border-l-red-500' : 'border-l-emerald-500'}
        >
          <div className="flex gap-2">
            <span className="flex-1 text-center bg-red-50 text-red-600 rounded-lg py-1.5 text-xs font-bold border border-red-100">
              {metrics.severityCounts.Critical} Crit
            </span>
            <span className="flex-1 text-center bg-orange-50 text-orange-600 rounded-lg py-1.5 text-xs font-bold border border-orange-100">
              {metrics.severityCounts.High} High
            </span>
          </div>
        </KpiCard>

        {/* Remediation Rate */}
        <KpiCard
          title="Resolved"
          value={`${metrics.remediationRate.toFixed(1)}%`}
          subtitle={`${metrics.fixedCount} of ${metrics.total} verified`}
          icon={CheckCircle2}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
        >
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Progress</span>
              <span>{metrics.fixedCount}/{metrics.total}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-700"
                style={{ width: `${metrics.remediationRate}%` }}
              />
            </div>
          </div>
        </KpiCard>

        {/* MTTR */}
        <KpiCard
          title="Avg MTTR"
          value={mttrDays !== null ? `${mttrDays}d` : '—'}
          subtitle={mttrDays !== null ? 'Mean time to remediate' : 'No resolved data'}
          icon={Timer}
          iconColor="text-indigo-600"
          iconBg="bg-indigo-50"
        >
          {mttrDays !== null && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <div className={`w-2 h-2 rounded-full ${mttrDays <= 7 ? 'bg-emerald-500' : mttrDays <= 30 ? 'bg-amber-400' : 'bg-red-500'}`} />
              {mttrDays <= 7 ? 'Excellent pace' : mttrDays <= 30 ? 'Within SLA' : 'Needs improvement'}
            </div>
          )}
        </KpiCard>

        {/* Evidence Score */}
        <KpiCard
          title="Evidence Score"
          value={`${isoMetrics.evidenceAverage}%`}
          subtitle="ISO register completeness"
          icon={FileCheck2}
          iconColor="text-indigo-600"
          iconBg="bg-indigo-50"
        >
          <div className="flex items-center gap-2">
            <RingGauge value={isoMetrics.evidenceAverage} color="#6366f1" size={40} />
            <p className="text-xs text-slate-500">
              {isoMetrics.evidenceAverage >= 80 ? 'Audit ready' : isoMetrics.evidenceAverage >= 50 ? 'Needs attention' : 'Below threshold'}
            </p>
          </div>
        </KpiCard>
      </div>

      {/* ISO 27001 Compliance Panel */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6 p-6">
          <div className="lg:w-56 shrink-0">
            <div className="flex items-center gap-2 text-indigo-600 mb-2">
              <ShieldCheck size={16} />
              <span className="text-xs font-semibold uppercase tracking-wider">{ISO_CONTROL_REFERENCE}</span>
            </div>
            <h3 className="text-lg font-bold text-slate-800">ISO Procedure Health</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">Register completeness, SLA tracking, verification evidence and exception status.</p>
          </div>
          <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-3">
            <IsoMetric
              label="Evidence"
              value={`${isoMetrics.evidenceAverage}%`}
              caption="Register fields"
              tone={isoMetrics.evidenceAverage >= 80 ? 'ok' : isoMetrics.evidenceAverage >= 50 ? 'warn' : 'danger'}
            />
            <IsoMetric
              label="Tracked"
              value={isoMetrics.tracked}
              caption="C/H SLA items"
              tone="neutral"
            />
            <IsoMetric
              label="Due Soon"
              value={isoMetrics.dueSoon}
              caption="Within 7 days"
              tone={isoMetrics.dueSoon > 0 ? 'warn' : 'ok'}
            />
            <IsoMetric
              label="Overdue"
              value={isoMetrics.overdue}
              caption="SLA breaches"
              tone={isoMetrics.overdue > 0 ? 'danger' : 'ok'}
            />
            <IsoMetric
              label="Verified"
              value={`${isoMetrics.verifiedClosureRate}%`}
              caption="Closed evidence"
              tone={isoMetrics.verifiedClosureRate >= 80 ? 'ok' : isoMetrics.verifiedClosureRate >= 50 ? 'warn' : 'danger'}
            />
          </div>
        </div>

        {/* Progress bar for overall compliance health */}
        <div className="px-6 pb-5 border-t border-slate-50 pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">Overall Compliance Health</span>
            <span className="text-xs font-bold text-indigo-600">
              {Math.round((isoMetrics.evidenceAverage * 0.4) + (isoMetrics.verifiedClosureRate * 0.3) + ((100 - Math.min(100, isoMetrics.overdue * 10)) * 0.3))}%
            </span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full transition-all duration-1000"
              style={{ width: `${Math.round((isoMetrics.evidenceAverage * 0.4) + (isoMetrics.verifiedClosureRate * 0.3) + ((100 - Math.min(100, isoMetrics.overdue * 10)) * 0.3))}%` }}
            />
          </div>
        </div>
      </section>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Remediation Pulse (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-800">Remediation Pulse</h3>
              <p className="text-xs text-slate-400 mt-0.5">New findings vs. verified patches over time</p>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
              {(['week', 'month', 'quarter'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setPulseRange(r)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                    pulseRange === r ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {r === 'week' ? '7d' : r === 'month' ? '30d' : '90d'}
                </button>
              ))}
            </div>
          </div>

          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={remediationVelocity} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradFindings" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradFixed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} dy={8} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontSize: 12 }}
                  labelStyle={{ fontWeight: 600, color: '#334155' }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                  formatter={(value) => <span style={{ color: '#64748b', fontWeight: 500 }}>{value}</span>}
                />
                <Area type="monotone" dataKey="findings" stroke="#ef4444" strokeWidth={2.5} fillOpacity={1} fill="url(#gradFindings)" name="New Findings" dot={false} />
                <Area type="monotone" dataKey="fixed" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#gradFixed)" name="Verified Patches" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Severity Breakdown Bar */}
          <div className="border-t border-slate-50 pt-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Severity Breakdown</p>
            <div className="grid grid-cols-5 gap-3">
              {severityData.map((s) => {
                const pct = metrics.total ? Math.round((s.count / metrics.total) * 100) : 0;
                return (
                  <div key={s.name} className="text-center">
                    <div className="text-lg font-bold text-slate-800 tabular-nums">{s.count}</div>
                    <div className="text-[11px] font-medium text-slate-400 mb-2">{s.name}</div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: s.fill }} />
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">{pct}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar (4 cols) */}
        <div className="lg:col-span-4 space-y-5">

          {/* Exposure Summary */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-slate-800 mb-1">Exposure Summary</h3>
            <p className="text-xs text-slate-400 mb-4">Asset risk concentration by severity</p>

            <div className="flex items-center gap-5 mb-4">
              <RingGauge value={exposureMatrix.heatLevel} color={exposureMatrix.heatLevel >= 70 ? '#ef4444' : exposureMatrix.heatLevel >= 40 ? '#f97316' : '#22c55e'} size={72} />
              <div className="space-y-2 flex-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">Critical ratio</span>
                  <span className="text-xs font-bold text-red-500">{exposureMatrix.criticalRatio}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-red-500 rounded-full" style={{ width: `${exposureMatrix.criticalRatio}%` }} />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">High ratio</span>
                  <span className="text-xs font-bold text-orange-500">{exposureMatrix.highRatio}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-400 rounded-full" style={{ width: `${exposureMatrix.highRatio}%` }} />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-2.5 border border-slate-100">
              <span className="text-xs text-slate-500 font-medium">Avg CVSS Score</span>
              <span className={`text-sm font-bold ${exposureMatrix.avgCvss >= 7 ? 'text-red-600' : exposureMatrix.avgCvss >= 4 ? 'text-orange-500' : 'text-emerald-600'}`}>
                {exposureMatrix.avgCvss || '—'}
              </span>
            </div>
          </div>

          {/* Activity Feed */}
          <div className="bg-slate-900 rounded-2xl shadow-lg overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div>
                <h3 className="text-sm font-bold text-white">Recent Activity</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Latest updates in this project</p>
              </div>
              <span className="flex items-center gap-1.5 bg-indigo-500/20 text-indigo-400 px-2.5 py-1 rounded-full text-[11px] font-semibold">
                <Activity size={10} />
                Live
              </span>
            </div>
            <div className="divide-y divide-white/5 max-h-72 overflow-y-auto custom-scrollbar">
              {recentActivity.length ? recentActivity.map((a: any) => (
                <div key={a.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-white/5 transition-colors cursor-pointer group">
                  <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 group-hover:bg-indigo-600 group-hover:text-white transition-all shrink-0 mt-0.5">
                    <Clock size={13} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[12px] text-slate-300 font-medium truncate">
                        <span className="text-white font-semibold">{a.user}</span>{' '}
                        <span className={
                          a.action === 'resolved' ? 'text-emerald-400' :
                          a.action === 'investigating' ? 'text-amber-400' : 'text-slate-300'
                        }>{a.action}</span>
                      </p>
                      <span className="text-[10px] text-slate-500 shrink-0">{a.timestamp}</span>
                    </div>
                    <p className="text-[11px] text-indigo-400 truncate mt-0.5">{a.target}</p>
                  </div>
                </div>
              )) : (
                <div className="py-10 text-center text-xs text-slate-500">No recent activity</div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Record Type Distribution */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-bold text-slate-800">Record Types</h3>
              <p className="text-xs text-slate-400 mt-0.5">Internal vs. external vulnerability sources</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="h-[180px] w-[180px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%" cy="50%"
                    innerRadius={55} outerRadius={80}
                    paddingAngle={4} dataKey="value" stroke="none"
                  >
                    {categoryData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: 'none', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-3">
              {categoryData.map((c) => (
                <div key={c.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: c.fill }} />
                    <span className="text-sm font-medium text-slate-700">{c.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${metrics.total ? Math.round((c.value / metrics.total) * 100) : 0}%`, backgroundColor: c.fill }} />
                    </div>
                    <span className="text-sm font-bold text-slate-800 w-10 text-right tabular-nums">{c.value}</span>
                  </div>
                </div>
              ))}

              <div className="border-t border-slate-100 pt-3 mt-3 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Open</span>
                  <span className="font-semibold text-slate-700">{metrics.openCount}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>In Progress</span>
                  <span className="font-semibold text-amber-600">{metrics.inProgressCount}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Resolved</span>
                  <span className="font-semibold text-emerald-600">{metrics.fixedCount}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Priority Action Panel */}
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl shadow-xl relative overflow-hidden p-6">
          <div className="absolute top-0 right-0 p-12 opacity-[0.07] pointer-events-none">
            <Shield size={220} strokeWidth={1} color="white" />
          </div>
          <div className="relative z-10 h-full flex flex-col">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-2 bg-white/20 rounded-xl">
                <Target className="text-white" size={16} />
              </div>
              <div>
                <span className="text-xs font-semibold text-indigo-200 uppercase tracking-wider">Recommended Actions</span>
              </div>
            </div>
            <h4 className="text-xl font-bold text-white mb-1">Priority Open Items</h4>
            <p className="text-sm text-indigo-200/80 mb-5 leading-relaxed">
              Prioritise critical and high severity findings first, then verify closure evidence to maintain audit readiness.
            </p>
            <div className="flex-1 space-y-2">
              {topFindings.length ? topFindings.map((f) => (
                <div key={f.id} className="flex items-center gap-3 p-3 bg-white/10 rounded-xl border border-white/10 hover:bg-white/15 transition-colors cursor-pointer group">
                  <SeverityBadge severity={f.severity} />
                  <span className="text-sm font-medium text-white flex-1 truncate">{f.title}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {f.score > 0 && <span className="text-[11px] text-indigo-300 font-semibold">{f.score}</span>}
                    {f.sla.tone === 'danger' && (
                      <span className="text-[10px] font-bold bg-red-500/30 text-red-200 px-2 py-0.5 rounded-full border border-red-400/30">Overdue</span>
                    )}
                  </div>
                </div>
              )) : (
                <div className="flex items-center justify-center gap-2 py-6 bg-white/10 rounded-xl border border-dashed border-white/20">
                  <CheckCircle2 size={16} className="text-emerald-400" />
                  <span className="text-sm font-medium text-indigo-200">All urgent items resolved</span>
                </div>
              )}
            </div>
            <button
              onClick={() => navigate(`/issues${activeProjectId ? `?project=${activeProjectId}` : ''}`)}
              className="mt-5 w-full bg-white text-indigo-700 py-3 rounded-xl font-semibold text-sm shadow-xl hover:bg-indigo-50 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <ListChecks size={15} />
              View All Findings
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
