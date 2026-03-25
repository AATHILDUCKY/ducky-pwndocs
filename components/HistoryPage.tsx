import React, { useEffect, useState } from 'react';
import { ChevronLeft, Mail, Clock, Inbox, Activity, User } from 'lucide-react';
import { fetchChangeHistory, fetchEmailHistory, EmailHistoryEntry } from '../services/historyService';
import type { ChangeHistoryEntry } from '../types';
import { notify } from '../utils/notify';

type HistoryPageProps = {
  onBack: () => void;
};

const PAGE_SIZE = 10;

type TabKey = 'mail' | 'changes';

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const targetLabel = (entry: ChangeHistoryEntry) => {
  return entry.targetName || entry.targetType || 'Record';
};

const HistoryPage: React.FC<HistoryPageProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<TabKey>('changes');
  const [mailEntries, setMailEntries] = useState<EmailHistoryEntry[]>([]);
  const [changeEntries, setChangeEntries] = useState<ChangeHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const loadPage = async (nextOffset: number, tab: TabKey) => {
    setIsLoading(true);
    try {
      if (tab === 'mail') {
        const data = await fetchEmailHistory({ limit: PAGE_SIZE, offset: nextOffset });
        setMailEntries((prev) => (nextOffset === 0 ? data : [...prev, ...data]));
        setOffset(nextOffset);
        setHasMore(data.length === PAGE_SIZE);
        return;
      }

      const data = await fetchChangeHistory({ limit: PAGE_SIZE, offset: nextOffset });
      setChangeEntries((prev) => (nextOffset === 0 ? data : [...prev, ...data]));
      setOffset(nextOffset);
      setHasMore(data.length === PAGE_SIZE);
    } catch (error) {
      console.error('Failed to load history', error);
      notify('Failed to load history.');
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPage(0, activeTab);
  }, [activeTab]);

  const visibleItems = activeTab === 'mail' ? mailEntries : changeEntries;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-4xl font-black text-slate-800 tracking-tight">History</h2>
          <p className="text-slate-500 font-medium text-sm">Mail and collaborator activity timeline.</p>
        </div>
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2"
        >
          <ChevronLeft size={14} />
          Back
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setActiveTab('changes')}
          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
            activeTab === 'changes'
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
          }`}
        >
          Activity History
        </button>
        <button
          onClick={() => setActiveTab('mail')}
          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
            activeTab === 'mail'
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
          }`}
        >
          Mail History
        </button>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        {visibleItems.length === 0 && !isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center text-center space-y-4 bg-slate-50/60">
            <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center text-slate-300">
              <Inbox size={28} />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {activeTab === 'mail' ? 'No emails sent yet' : 'No collaborator changes recorded'}
            </p>
          </div>
        ) : (
          <div className="max-h-[520px] overflow-y-auto custom-scrollbar divide-y divide-slate-100">
            {activeTab === 'mail' &&
              mailEntries.map((entry) => (
                <div key={entry.id} className="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <Mail size={18} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] font-black text-slate-800 uppercase tracking-widest">
                        {entry.issue_title ? 'Issue Report' : 'Project Report'}
                      </p>
                      <p className="text-sm font-bold text-slate-700">{entry.subject || 'Report Email'}</p>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        To: {entry.recipient} · Format: {entry.format || 'pdf'}
                      </p>
                      {entry.project_name && (
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                          Project: {entry.project_name}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <Clock size={12} />
                    {formatDate(entry.sent_at)}
                  </div>
                </div>
              ))}

            {activeTab === 'changes' &&
              changeEntries.map((entry) => (
                <div key={entry.id} className="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Activity size={18} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] font-black text-slate-800 uppercase tracking-widest">{entry.action}</p>
                      <p className="text-sm font-bold text-slate-700">{targetLabel(entry)}</p>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                        <User size={11} />
                        {entry.actorName} · {entry.actorRole}
                      </p>
                      {entry.details && (
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{entry.details}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <Clock size={12} />
                    {formatDate(entry.createdAt)}
                  </div>
                </div>
              ))}

            {hasMore && (
              <div className="p-6 text-center">
                <button
                  onClick={() => loadPage(offset + PAGE_SIZE, activeTab)}
                  disabled={isLoading}
                  className="px-5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-white transition-all"
                >
                  {isLoading ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryPage;
