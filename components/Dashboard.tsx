
import React, { useEffect, useMemo, useState } from 'react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  AreaChart,
  Area,
  BarChart,
  Bar
} from 'recharts';
import { 
  ShieldAlert, 
  Clock,
  Zap,
  Target,
  ShieldCheck,
  Fingerprint,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Shield,
  Activity,
} from 'lucide-react';
import { Activity as ActivityType, Issue, Project, UserProfile } from '../types';
import { fetchIssues } from '../services/issueService';
import { notify } from '../utils/notify';

const SEVERITY_ORDER: Record<string, number> = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
  Info: 0,
};

const formatRelativeTime = (input: string) => {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return 'Just now';
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} mins ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hours ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay} days ago`;
};

const getLastDays = (count: number) => {
  const today = new Date();
  const days = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const key = date.toISOString().slice(0, 10);
    days.push({
      key,
      day: date.toLocaleDateString(undefined, { weekday: 'short' }),
      date,
    });
  }
  return days;
};

const getRangeDays = (range: 'week' | 'month' | 'quarter') => {
  if (range === 'month') return 30;
  if (range === 'quarter') return 90;
  return 7;
};

const AnalyticsCard = ({ title, value, icon: Icon, trend, colorClass = "text-indigo-600", children }: any) => (
  <div className="bg-white/70 backdrop-blur-lg p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-2xl hover:shadow-indigo-100/30 transition-all group overflow-hidden relative">
    <div className="flex items-center justify-between mb-6">
      <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-indigo-50 transition-colors">
        <Icon size={18} className={colorClass} />
      </div>
      {trend && (
        <div className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-widest ${trend > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
          {trend > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {Math.abs(trend)}% Velocity
        </div>
      )}
    </div>
    <div className="space-y-1">
      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{title}</h3>
      <p className="text-4xl font-black text-slate-800 tracking-tighter tabular-nums">{value}</p>
    </div>
    <div className="mt-6">
      {children}
    </div>
  </div>
);

const RiskHeatmap: React.FC<{ heatLevel: number }> = ({ heatLevel }) => {
  const hotCells = Math.min(9, Math.round((heatLevel / 100) * 9));
  const cells = [...Array(9)].map((_, i) => {
    const position = i + 1;
    if (position > 9 - hotCells) {
      return 'bg-rose-500 shadow-lg shadow-rose-100';
    }
    if (position > 6 - Math.floor(hotCells / 2)) {
      return 'bg-rose-100';
    }
    if (position > 4 - Math.floor(hotCells / 3)) {
      return 'bg-amber-100';
    }
    return 'bg-slate-50';
  });

  return (
    <div className="grid grid-cols-3 gap-2 h-full">
      {cells.map((style, i) => (
        <div key={i} className={`${style} rounded-lg border border-white/50 transition-transform hover:scale-105 cursor-pointer`} />
      ))}
    </div>
  );
};

const Dashboard: React.FC<{ activeProjectId: string; activeProject?: Project | null; profile?: UserProfile | null }> = ({ activeProjectId, activeProject, profile }) => {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [activityUser, setActivityUser] = useState<string>('Analyst');
  const [isLoading, setIsLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [pulseRange, setPulseRange] = useState<'week' | 'month' | 'quarter'>('week');

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      if (!activeProjectId) return;
      setIsLoading(true);
      setDataError(null);
      try {
        const issuesData = await fetchIssues(activeProjectId);
        if (!isMounted) return;
        setIssues(issuesData || []);
      } catch (error: any) {
        if (!isMounted) return;
        setIssues([]);
        setDataError(error?.message || 'Unable to load overview data.');
        notify(error?.message || 'Unable to load overview data.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [activeProjectId]);

  useEffect(() => {
    setActivityUser(profile?.username || 'Analyst');
  }, [profile]);

  const metrics = useMemo(() => {
    const total = issues.length;
    const severityCounts = {
      Critical: 0,
      High: 0,
      Medium: 0,
      Low: 0,
      Info: 0,
    };
    let weightedScore = 0;
    let fixedCount = 0;

    issues.forEach((issue) => {
      const severity = issue.severity || 'Info';
      if (severityCounts[severity as keyof typeof severityCounts] !== undefined) {
        severityCounts[severity as keyof typeof severityCounts] += 1;
      }
      weightedScore += SEVERITY_ORDER[severity] || 0;
      if (issue.isFixed || issue.state === 'Fixed') fixedCount += 1;
    });

    const riskIndex = total ? Math.round((weightedScore / (total * 4)) * 100) : 0;
    const slaCompliance = total ? Math.round((fixedCount / total) * 1000) / 10 : 0;
    const recentWindow = getLastDays(7);
    const recentKeys = new Set(recentWindow.map((d) => d.key));
    const recentFindings = issues.filter((issue) => {
      const date = new Date(issue.updatedAt);
      if (Number.isNaN(date.getTime())) return false;
      return recentKeys.has(date.toISOString().slice(0, 10));
    }).length;
    const detectionVelocity = recentFindings ? Math.round((recentFindings / 7) * 10) / 10 : 0;
    const coverage = total
      ? Math.min(100, Math.round((issues.filter((issue) => issue.affected?.trim()).length / total) * 100))
      : 0;

    return {
      total,
      severityCounts,
      riskIndex,
      slaCompliance,
      detectionVelocity,
      coverage,
      fixedCount,
    };
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
      if (issue.isFixed || issue.state === 'Fixed') {
        entry.fixed += 1;
      }
    });
    return Array.from(map.values());
  }, [issues, pulseRange]);

  const exposureMatrix = useMemo(() => {
    if (!issues.length) {
      return { heatLevel: 0, criticalRatio: 0, highRatio: 0, avgCvss: 0 };
    }
    const critical = metrics.severityCounts.Critical;
    const high = metrics.severityCounts.High;
    const avgCvss =
      issues.reduce((sum, issue) => sum + (Number.parseFloat(issue.cvssScore || '0') || 0), 0) / issues.length;
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
    { name: 'High', count: metrics.severityCounts.High, fill: '#f97316' },
    { name: 'Medium', count: metrics.severityCounts.Medium, fill: '#eab308' },
    { name: 'Low', count: metrics.severityCounts.Low, fill: '#3b82f6' },
    { name: 'Info', count: metrics.severityCounts.Info, fill: '#6366f1' },
  ], [metrics]);

  const categoryData = useMemo(() => {
    const counts = { Internal: 0, External: 0, Unknown: 0 };
    issues.forEach((issue) => {
      if (issue.type === 'Internal') counts.Internal += 1;
      else if (issue.type === 'External') counts.External += 1;
      else counts.Unknown += 1;
    });
    return [
      { name: 'Internal', value: counts.Internal, fill: '#6366f1' },
      { name: 'External', value: counts.External, fill: '#3b82f6' },
      { name: 'Unknown', value: counts.Unknown, fill: '#94a3b8' },
    ];
  }, [issues]);

  const recentActivity: ActivityType[] = useMemo(() => {
    const sorted = [...issues].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return sorted.slice(0, 6).map((issue) => ({
      id: issue.id,
      user: activityUser,
      action: issue.isFixed || issue.state === 'Fixed' ? 'verified fix' : 'updated finding',
      target: issue.title || 'Untitled finding',
      timestamp: formatRelativeTime(issue.updatedAt),
    }));
  }, [issues, activityUser]);

  const topFindings = useMemo(() => {
    const sorted = [...issues].sort((a, b) => {
      const severityDiff = (SEVERITY_ORDER[b.severity] || 0) - (SEVERITY_ORDER[a.severity] || 0);
      if (severityDiff !== 0) return severityDiff;
      const aScore = Number.parseFloat(a.cvssScore || '0');
      const bScore = Number.parseFloat(b.cvssScore || '0');
      return bScore - aScore;
    });
    return sorted.slice(0, 3).map((issue) => ({
      id: issue.id,
      title: issue.title || 'Untitled finding',
      impact: issue.severity || 'Info',
      score: Number.parseFloat(issue.cvssScore || '0') || 0,
    }));
  }, [issues]);
  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
           <div className="flex items-center gap-2 mb-2">
              <span className={`flex h-2 w-2 rounded-full ${metrics.slaCompliance >= 80 ? 'bg-emerald-500' : 'bg-amber-400'} animate-pulse`}></span>
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.3em]">
                Operational Readiness {metrics.slaCompliance.toFixed(1)}%
              </span>
           </div>
          <h2 className="text-5xl font-bold text-slate-800 tracking-tighter leading-none">Command Center</h2>
          <p className="text-slate-500 text-sm font-medium">Strategic intelligence and risk distribution for the active project vault.</p>
        </div>
        <div className="flex items-center gap-4">
           <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-4 shadow-sm">
              <div className="text-right">
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active Scope</p>
                 <p className="text-lg font-black text-indigo-600 tracking-tight">{activeProject?.name || 'No Active Project'}</p>
              </div>
              <div className="h-10 w-[1px] bg-slate-100"></div>
              <button className="w-10 h-10 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100 flex items-center justify-center hover:scale-110 active:scale-95 transition-all">
                 <Plus size={20} />
              </button>
           </div>
        </div>
      </header>
      {dataError && (
        <div className="bg-rose-50/80 border border-rose-100 text-rose-500 text-[10px] font-black uppercase tracking-[0.3em] px-6 py-3 rounded-2xl">
          {dataError}
        </div>
      )}
      {isLoading && !dataError && (
        <div className="bg-slate-50/80 border border-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] px-6 py-3 rounded-2xl">
          Syncing overview data...
        </div>
      )}

      {/* Primary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <AnalyticsCard title="Risk Posture Index" value={metrics.riskIndex} icon={ShieldAlert} trend={metrics.riskIndex ? 12 : 0} colorClass="text-rose-500">
           <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-rose-500 to-orange-500" style={{ width: `${metrics.riskIndex}%` }}></div>
           </div>
           <p className="text-[9px] font-bold text-slate-400 mt-2 tracking-widest uppercase">Threshold Alert Level: High</p>
        </AnalyticsCard>
        <AnalyticsCard title="Detection Velocity" value={metrics.detectionVelocity.toFixed(1)} icon={Zap} trend={metrics.detectionVelocity ? -5 : 0} colorClass="text-amber-500">
           <div className="h-10 w-full">
             <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={remediationVelocity}>
                 <Area type="monotone" dataKey="findings" stroke="#f59e0b" fill="#fef3c7" strokeWidth={2} />
               </AreaChart>
             </ResponsiveContainer>
           </div>
        </AnalyticsCard>
        <AnalyticsCard title="SLA Compliance" value={`${metrics.slaCompliance.toFixed(1)}%`} icon={ShieldCheck} colorClass="text-emerald-500">
           <div className="flex items-center gap-2 mt-2">
              <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">
                {metrics.fixedCount} findings verified
              </span>
           </div>
        </AnalyticsCard>
        <AnalyticsCard title="Attack Coverage" value={`${metrics.coverage}%`} icon={Fingerprint} colorClass="text-slate-800">
           <div className="flex gap-1 items-end h-10">
              {remediationVelocity.map((entry, i) => (
                <div key={entry.day + i} className="flex-1 bg-slate-800 rounded-sm" style={{ height: `${Math.min(100, entry.findings * 12)}%` }}></div>
              ))}
           </div>
        </AnalyticsCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* Main Chart Area */}
        <div className="lg:col-span-8 bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm space-y-10">
          <header className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight">Remediation Pulse</h3>
              <p className="text-xs text-slate-400 font-bold tracking-widest uppercase mt-1">Findings Ingress vs. Verification Flow</p>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
               {(['week', 'month', 'quarter'] as const).map((range) => (
                 <button
                   key={range}
                   onClick={() => setPulseRange(range)}
                   className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm transition-colors ${
                     pulseRange === range ? 'bg-white text-slate-800' : 'text-slate-400 hover:text-slate-600'
                   }`}
                 >
                   {range === 'week' ? 'Week' : range === 'month' ? 'Month' : 'Quarter'}
                 </button>
               ))}
            </div>
          </header>
          
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={remediationVelocity}>
                <defs>
                  <linearGradient id="colorFindings" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorFixed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 800 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 800 }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontSize: '11px', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="findings" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorFindings)" name="New Discovery" />
                <Area type="monotone" dataKey="fixed" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorFixed)" name="Verified Patch" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-10 border-t border-slate-50">
             {severityData.map(s => (
                <div key={s.name} className="bg-slate-50/50 p-4 rounded-2xl border border-transparent hover:border-slate-100 transition-all text-center">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{s.name}</p>
                   <p className="text-2xl font-black text-slate-800 tabular-nums">{s.count}</p>
                   <div className="h-1 w-full mt-2 rounded-full overflow-hidden bg-slate-200">
                      <div className="h-full" style={{ backgroundColor: s.fill, width: `${metrics.total ? (s.count / metrics.total) * 100 : 0}%` }}></div>
                   </div>
                </div>
             ))}
          </div>
        </div>

        {/* Intelligence Sidebar */}
        <div className="lg:col-span-4 space-y-10">
          
          {/* Exposure Heatmap */}
          <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm flex flex-col h-[400px]">
            <h3 className="text-base font-black text-slate-800 tracking-tight mb-2">Exposure Matrix</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-8">Asset Risk Concentration</p>
            <div className="flex-1 relative mb-6">
               <div className="absolute -left-10 top-1/2 -translate-y-1/2 -rotate-90 text-[8px] font-black text-slate-300 uppercase tracking-[0.4em]">IMPACT</div>
               <div className="absolute left-1/2 -bottom-6 -translate-x-1/2 text-[8px] font-black text-slate-300 uppercase tracking-[0.4em]">ATTACK SURFACE</div>
               <RiskHeatmap heatLevel={exposureMatrix.heatLevel} />
            </div>
            <div className="pt-6 border-t border-slate-50 flex items-center justify-between">
               <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{exposureMatrix.criticalRatio}% Critical</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{exposureMatrix.highRatio}% High</span>
                  </div>
               </div>
               <div className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">
                 Avg CVSS {exposureMatrix.avgCvss}
               </div>
            </div>
          </div>

          {/* Tactical Feed */}
          <div className="bg-slate-900 rounded-[3rem] shadow-xl overflow-hidden flex flex-col">
            <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/5">
              <h3 className="font-black text-white tracking-tight text-sm">Operation Logs</h3>
              <div className="flex items-center gap-1 bg-indigo-500/20 text-indigo-400 px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-widest">
                 Live Feed <Activity size={10} />
              </div>
            </div>
            <div className="divide-y divide-white/5 max-h-[450px] overflow-y-auto custom-scrollbar bg-slate-900">
              {recentActivity.length ? recentActivity.map((activity) => (
                <div key={activity.id} className="p-6 flex items-start gap-4 hover:bg-white/5 transition-all cursor-pointer group">
                  <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shrink-0">
                    <Clock size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-300 font-medium leading-snug">
                      <span className="font-black text-white">{activity.user}</span> {activity.action}
                    </p>
                    <p className="text-[10px] font-bold text-indigo-400 truncate mt-0.5 uppercase tracking-widest">{activity.target}</p>
                    <p className="text-[8px] text-slate-500 font-black mt-1 uppercase tracking-[0.2em]">{activity.timestamp}</p>
                  </div>
                </div>
              )) : (
                <div className="p-8 text-center text-[9px] font-black uppercase tracking-[0.3em] text-slate-500">
                  No recent activity
                </div>
              )}
            </div>
            <button className="p-5 bg-white/5 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-white transition-all">
               Deep Dive Tactical Logs
            </button>
          </div>

        </div>
      </div>

      {/* Surface Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
         <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm space-y-8">
            <div className="flex items-center justify-between">
               <h3 className="text-xl font-black text-slate-800 tracking-tight">Finding Types</h3>
               <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Internal vs External</p>
            </div>
            <div className="flex items-center justify-center h-[280px]">
               <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                     <Pie data={categoryData} cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={8} dataKey="value" stroke="none">
                        {categoryData.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                     </Pie>
                     <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', fontWeight: 'bold', fontSize: '11px' }} />
                  </PieChart>
               </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-3">
               {categoryData.map(c => (
                  <div key={c.name} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                     <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.fill }}></div>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{c.name}</span>
                     </div>
                     <span className="text-xs font-black text-slate-800">
                       {metrics.total ? Math.round((c.value / metrics.total) * 100) : 0}%
                     </span>
                  </div>
               ))}
            </div>
         </div>

         <div className="bg-gradient-to-br from-indigo-600 to-indigo-900 p-10 rounded-[3rem] shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-16 opacity-10 pointer-events-none group-hover:scale-125 transition-transform duration-[2000ms]">
               <Shield size={260} strokeWidth={1} color="white" />
            </div>
            <div className="relative z-10 space-y-10">
               <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
                    <Target className="text-white" size={20} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-100">Tactical Recommendation</span>
               </div>
               <div className="space-y-4">
                  <h4 className="text-3xl font-black text-white tracking-tight leading-tight">Remediation Sprint: Identity Mapping</h4>
                  <p className="text-indigo-100/70 text-base font-medium leading-relaxed">
                     Anomalies detected in 'Cloud Infrastructure' nodes suggest correlated AuthZ failures. Strategic fix of this cluster will reduce overall surface exposure by <span className="text-emerald-400 font-black">22%</span>.
                  </p>
               </div>
               <div className="space-y-3 pt-4">
                  <p className="text-[9px] font-black text-indigo-300 uppercase tracking-[0.3em]">Critical Action Items:</p>
                  <div className="space-y-2">
                     {topFindings.length ? topFindings.map(f => (
                        <div key={f.id} className="flex items-center justify-between p-4 bg-white/10 rounded-2xl border border-white/10 hover:bg-white/20 transition-all cursor-pointer">
                           <div className="flex items-center gap-4">
                              <span className={`text-[8px] font-black px-2 py-1 rounded-full uppercase ${f.impact === 'Critical' ? 'bg-rose-500 text-white' : 'bg-indigo-400/30 text-indigo-100'}`}>
                                 {f.impact}
                              </span>
                              <span className="text-xs font-bold text-white tracking-tight">{f.title}</span>
                           </div>
                           <span className="text-indigo-300 font-black text-[10px]">CVSS {f.score}</span>
                        </div>
                     )) : (
                        <div className="p-4 bg-white/10 rounded-2xl border border-white/10 text-[9px] font-black uppercase tracking-[0.3em] text-indigo-100 text-center">
                          No findings yet
                        </div>
                     )}
                  </div>
               </div>
               <button className="w-full bg-white text-indigo-900 py-5 rounded-[2rem] font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl hover:bg-indigo-50 transition-all active:scale-95">
                  Initialize Resolution Protocol
               </button>
            </div>
         </div>
      </div>
    </div>
  );
};

export default Dashboard;
