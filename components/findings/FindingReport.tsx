
import React from 'react';
import { BookOpen } from 'lucide-react';
import { Issue } from '../../types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { SeverityBadge } from '../ui/Elements';

export const FindingReport: React.FC<{ finding: Issue }> = ({ finding }) => {
  return (
    <div className="max-w-5xl mx-auto bg-white rounded-none overflow-hidden min-h-screen">
      <div className="p-8 lg:p-12 space-y-16">
        
        {/* Report Identity Profile */}
        <div className="space-y-12">
          <div className="space-y-5">
            <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em] border-b border-indigo-50 pb-3">Security Finding Intelligence</h4>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter leading-tight">{finding.title}</h1>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-12 gap-y-10">
            <div className="space-y-2">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">CVSS Base</h4>
              <p className={`text-2xl font-black ${parseFloat(finding.cvssScore) >= 7 ? 'text-rose-600' : 'text-indigo-600'} tabular-nums`}>{finding.cvssScore}</p>
            </div>
            <div className="space-y-2">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Severity</h4>
              <SeverityBadge severity={finding.severity} />
            </div>
            <div className="space-y-2 lg:col-span-1">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Vector String</h4>
              <p className="text-[11px] font-mono text-slate-500 break-all leading-relaxed">{finding.cvssVector}</p>
            </div>
            <div className="space-y-2">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Security Domain</h4>
              <p className="text-sm font-bold text-slate-800">{finding.type}</p>
            </div>
            <div className="space-y-2">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Affected Surface</h4>
              <p className="text-sm font-bold text-slate-800">{finding.affected || 'General Scope'}</p>
            </div>
          </div>
        </div>

        {/* Primary Narrative Section */}
        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm shadow-indigo-100">
              <BookOpen size={18} />
            </div>
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-widest">Description</h3>
          </div>
          <div className="ml-5 border-l-2 border-slate-100 pl-10">
            <MarkdownRenderer content={finding.description} />
          </div>
        </section>

        {/* Reorderable Tactical Attributes (The "Bottom" items) */}
        {finding.customFields && finding.customFields.length > 0 && (
          <div className="pt-16 border-t border-slate-50 space-y-16 pb-24">
            {finding.customFields.map(f => (
              <section key={f.id} className="space-y-4 ml-5 border-l-2 border-slate-100 pl-10">
                <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] leading-none">{f.label || 'Tactical Context'}</h4>
                <div className="text-[15px] text-slate-800">
                  <MarkdownRenderer content={f.value} />
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
