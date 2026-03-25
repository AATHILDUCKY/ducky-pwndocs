
import React from 'react';
import { Severity } from '../../types';

export const Badge: React.FC<{ children: React.ReactNode; variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = ({ children, variant = 'neutral' }) => {
  const styles = {
    success: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    warning: 'bg-orange-50 text-orange-600 border-orange-100',
    danger: 'bg-rose-50 text-rose-600 border-rose-100',
    info: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    neutral: 'bg-slate-50 text-slate-500 border-slate-200',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${styles[variant]}`}>
      {children}
    </span>
  );
};

export const SeverityBadge: React.FC<{ severity: Severity }> = ({ severity }) => {
  const variant = severity === 'Critical' || severity === 'High' ? 'danger' : severity === 'Medium' ? 'warning' : severity === 'Low' ? 'info' : 'neutral';
  return <Badge variant={variant}>{severity}</Badge>;
};

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }> = ({ children, variant = 'primary', className = '', ...props }) => {
  const base = "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50";
  const styles = {
    primary: "bg-indigo-600 text-white shadow-xl shadow-indigo-100 hover:bg-indigo-700",
    secondary: "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50",
    ghost: "bg-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50",
    danger: "bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100"
  };
  return (
    <button className={`${base} ${styles[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};
