
import React, { useState } from 'react';
import { 
  Upload, 
  Terminal, 
  Search, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  Zap,
  HardDrive
} from 'lucide-react';

const SUPPORTED_TOOLS = [
  'Nessus (XML)',
  'Burp Suite (HTML/XML)',
  'Acunetix 360',
  'Metasploit Pro',
  'Netsparker',
  'Nmap (XML)',
  'Zap (JSON)',
];

const UploadPanel = () => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedTool, setSelectedTool] = useState(SUPPORTED_TOOLS[0]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Data Ingestion</h2>
        <p className="text-slate-500 mt-1">Import findings from your favorite security scanning tools.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Tool Selector */}
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Zap size={18} className="text-amber-500" />
              1. Select Source Tool
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SUPPORTED_TOOLS.map(tool => (
                <button
                  key={tool}
                  onClick={() => setSelectedTool(tool)}
                  className={`px-4 py-3 rounded-xl border text-sm font-bold transition-all text-left flex items-center justify-between ${
                    selectedTool === tool 
                      ? 'bg-indigo-50 border-indigo-600 text-indigo-700' 
                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {tool}
                  {selectedTool === tool && <CheckCircle2 size={16} />}
                </button>
              ))}
            </div>
          </div>

          {/* Upload Dropzone */}
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
              <HardDrive size={18} className="text-indigo-500" />
              2. Upload Results
            </h3>
            <div 
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              className={`border-2 border-dashed rounded-2xl p-12 transition-all flex flex-col items-center justify-center text-center group cursor-pointer ${
                dragActive ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50/50'
              }`}
            >
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-all ${
                dragActive ? 'bg-indigo-600 text-white scale-110 shadow-lg' : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-500'
              }`}>
                <Upload size={32} />
              </div>
              <p className="text-slate-800 font-bold text-lg">Drop scan output here</p>
              <p className="text-slate-400 text-sm mt-1 mb-6">Support for .xml, .json, .csv files up to 50MB</p>
              <input type="file" className="hidden" id="file-upload" />
              <label htmlFor="file-upload" className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-100 cursor-pointer">
                Select Files
              </label>
            </div>
          </div>
        </div>

        {/* Status & Console */}
        <div className="space-y-6">
          <div className="bg-slate-900 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Terminal size={16} className="text-emerald-400" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ingestion Console</span>
              </div>
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
              </div>
            </div>
            <div className="font-mono text-[11px] space-y-2 h-[400px] overflow-y-auto scrollbar-hide">
              <p className="text-slate-500">[SYSTEM] Session initialized...</p>
              <p className="text-emerald-400">[READY] Waiting for payload ingest.</p>
              <p className="text-slate-500 mt-4">_</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h4 className="font-bold text-slate-800 text-sm mb-4">Ingestion History</h4>
            <div className="space-y-4">
              {[
                { name: 'nessus_scan_01.xml', status: 'Success', time: '2h ago' },
                { name: 'burp_findings.json', status: 'Warning', time: '5h ago' },
                { name: 'audit_log_raw.csv', status: 'Error', time: '1d ago' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg ${
                      item.status === 'Success' ? 'bg-emerald-100 text-emerald-600' : 
                      item.status === 'Warning' ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'
                    }`}>
                      {item.status === 'Success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-700">{item.name}</p>
                      <p className="text-[10px] text-slate-400 font-medium">{item.time}</p>
                    </div>
                  </div>
                  <button className="opacity-0 group-hover:opacity-100 text-xs font-bold text-indigo-600 hover:underline">Retry</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadPanel;
