import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Clock } from 'lucide-react';
import { Issue, UserProfile } from '../types';
import { fetchIssues } from '../services/issueService';
import { notify } from '../utils/notify';

const PAGE_SIZE = 10;

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

const OperationLogsPage: React.FC<{ activeProjectId: string; profile?: UserProfile | null }> = ({ activeProjectId, profile }) => {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

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
        setDataError(error?.message || 'Unable to load operation logs.');
        notify(error?.message || 'Unable to load operation logs.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [activeProjectId]);

  const activityUser = profile?.username || 'Analyst';

  const activities = useMemo(() => {
    const sorted = [...issues].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return sorted.map((issue) => ({
      id: issue.id,
      user: activityUser,
      action: issue.isFixed || issue.state === 'Fixed' ? 'verified fix' : 'updated finding',
      target: issue.title || 'Untitled finding',
      timestamp: formatRelativeTime(issue.updatedAt),
    }));
  }, [issues, activityUser]);

  const visibleActivities = useMemo(() => activities.slice(0, visibleCount), [activities, visibleCount]);
  const hasMore = visibleCount < activities.length;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activities.length, activeProjectId]);

  useEffect(() => {
    if (!hasMore) return;
    const node = loadMoreRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, activities.length));
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, activities.length]);

  return (
    <div className="flex flex-col gap-6 sm:gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700 h-[calc(100vh-220px)] min-h-[520px]">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-3xl sm:text-4xl font-black text-slate-800 tracking-tight">Operation Logs</h2>
          <p className="text-slate-500 font-medium text-sm">Real-time activity feed for the active project vault.</p>
        </div>
      </div>

      {dataError && (
        <div className="bg-rose-50/80 border border-rose-100 text-rose-500 text-[10px] font-black uppercase tracking-[0.3em] px-6 py-3 rounded-2xl">
          {dataError}
        </div>
      )}

      {isLoading && !dataError && (
        <div className="bg-slate-50/80 border border-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] px-6 py-3 rounded-2xl">
          Syncing operation feed...
        </div>
      )}

      <div className="flex-1 min-h-0 bg-white rounded-[3rem] shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="p-6 sm:p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <h3 className="font-black text-slate-800 tracking-tight text-sm">Operation Logs</h3>
          <div className="flex items-center gap-1 bg-indigo-50 text-indigo-600 px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-widest">
            Live Feed <Activity size={10} />
          </div>
        </div>
        <div className="flex-1 min-h-0 divide-y divide-slate-100 overflow-y-auto custom-scrollbar no-scrollbar">
          {visibleActivities.length ? visibleActivities.map((activity) => (
            <div key={activity.id} className="p-5 sm:p-6 flex items-start gap-4 hover:bg-slate-50/60 transition-all cursor-pointer group">
              <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-indigo-600 group-hover:text-white transition-all shrink-0">
                <Clock size={14} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-700 font-medium leading-snug">
                  <span className="font-black text-slate-900">{activity.user}</span> {activity.action}
                </p>
                <p className="text-[10px] font-bold text-indigo-600 truncate mt-0.5 uppercase tracking-widest">{activity.target}</p>
                <p className="text-[8px] text-slate-400 font-black mt-1 uppercase tracking-[0.2em]">{activity.timestamp}</p>
              </div>
            </div>
          )) : (
            <div className="p-8 text-center text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">
              No recent activity
            </div>
          )}
          {hasMore && (
            <div ref={loadMoreRef} className="py-4 text-center text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">
              Loading more…
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OperationLogsPage;
