
import React, { useEffect, useMemo, useState } from 'react';
import { 
  CheckCircle2, 
  Circle, 
  Plus, 
  Settings, 
  MoreHorizontal,
  ChevronRight,
  Target,
  Pencil,
  Trash2
} from 'lucide-react';
import { Methodology, Project } from '../types';
import {
  createMethodology,
  createMethodologyTask,
  deleteMethodology,
  fetchMethodologies,
  migrateLegacyMethodologiesToProject,
  updateMethodology,
  updateMethodologyTask
} from '../services/methodologyService';
import { notify } from '../utils/notify';

const MethodologyTracker: React.FC<{ activeProjectId: string; activeProject?: Project | null }> = ({ activeProjectId, activeProject }) => {
  const [methodologies, setMethodologies] = useState<Methodology[]>([]);
  const [activeMethodology, setActiveMethodology] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newMethodName, setNewMethodName] = useState('');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskStatus, setNewTaskStatus] = useState<'todo' | 'in-progress' | 'done'>('todo');
  const [taskTargetMethodology, setTaskTargetMethodology] = useState<string>('');
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<'todo' | 'in-progress' | 'done' | null>(null);
  const [editTask, setEditTask] = useState<{ id: string; title: string; status: 'todo' | 'in-progress' | 'done' } | null>(null);
  const [editTaskName, setEditTaskName] = useState('');
  const [editTaskStatus, setEditTaskStatus] = useState<'todo' | 'in-progress' | 'done'>('todo');
  const [showEditMethodModal, setShowEditMethodModal] = useState(false);
  const [editMethodName, setEditMethodName] = useState('');
  const [editMethodId, setEditMethodId] = useState<string>('');

  const loadMethodologies = async () => {
    if (!activeProjectId) {
      setMethodologies([]);
      setActiveMethodology('');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await migrateLegacyMethodologiesToProject(activeProjectId);
      const data = await fetchMethodologies(activeProjectId);
      setMethodologies(data);
      setActiveMethodology((prev) => (prev && data.some((m) => m.id === prev) ? prev : data[0]?.id || ''));
    } catch (err) {
      console.error('Failed to load methodologies', err);
      setMethodologies([]);
      setActiveMethodology('');
      setError('Data store unavailable. Please refresh and try again.');
      notify('Failed to load methodologies.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMethodologies();
  }, [activeProjectId]);

  const current = useMemo(
    () => methodologies.find(m => m.id === activeMethodology) || methodologies[0],
    [activeMethodology, methodologies]
  );

  const handleCreateMethodology = async () => {
    const name = newMethodName.trim();
    if (!name || !activeProjectId) return;
    try {
      setError(null);
      await createMethodology(activeProjectId, name);
      await loadMethodologies();
      setNewMethodName('');
      setShowCreateModal(false);
    } catch (err) {
      console.error('Failed to create methodology', err);
      setError('Unable to create methodology. Please try again.');
      notify('Unable to create methodology.');
    }
  };

  const handleCreateTask = async () => {
    const title = newTaskName.trim();
    if (!title || !taskTargetMethodology || !activeProjectId) return;
    try {
      setError(null);
      await createMethodologyTask(activeProjectId, taskTargetMethodology, title, newTaskStatus);
      await loadMethodologies();
      setNewTaskName('');
      setShowTaskModal(false);
    } catch (err) {
      console.error('Failed to create task', err);
      setError('Unable to create task. Please try again.');
      notify('Unable to create task.');
    }
  };

  const handleDropTask = async (status: 'todo' | 'in-progress' | 'done') => {
    if (!dragTaskId || !activeProjectId) return;
    try {
      await updateMethodologyTask(activeProjectId, dragTaskId, { status });
      await loadMethodologies();
    } catch (err) {
      console.error('Failed to update task status', err);
      setError('Unable to move task. Please try again.');
      notify('Unable to move task.');
    } finally {
      setDragTaskId(null);
      setDragOverStatus(null);
    }
  };

  const openEditTask = (task: { id: string; title: string; status: 'todo' | 'in-progress' | 'done' }) => {
    setEditTask(task);
    setEditTaskName(task.title);
    setEditTaskStatus(task.status);
  };

  const openEditMethodology = (method: Methodology) => {
    setEditMethodId(method.id);
    setEditMethodName(method.name);
    setShowEditMethodModal(true);
  };

  const handleSaveTask = async () => {
    if (!editTask || !activeProjectId) return;
    try {
      setError(null);
      await updateMethodologyTask(activeProjectId, editTask.id, {
        title: editTaskName.trim(),
        status: editTaskStatus,
      });
      await loadMethodologies();
      setEditTask(null);
    } catch (err) {
      console.error('Failed to update task', err);
      setError('Unable to update task. Please try again.');
      notify('Unable to update task.');
    }
  };

  const handleSaveMethodology = async () => {
    const name = editMethodName.trim();
    if (!editMethodId || !name || !activeProjectId) return;
    try {
      setError(null);
      await updateMethodology(activeProjectId, editMethodId, name);
      await loadMethodologies();
      setShowEditMethodModal(false);
      setEditMethodId('');
      setEditMethodName('');
    } catch (err) {
      console.error('Failed to update methodology', err);
      setError('Unable to update methodology. Please try again.');
      notify('Unable to update methodology.');
    }
  };

  const handleDeleteMethodology = async (method: Methodology) => {
    if (!activeProjectId) return;
    const confirmed = window.confirm(`Delete "${method.name}" and all its tasks?`);
    if (!confirmed) return;
    try {
      setError(null);
      await deleteMethodology(activeProjectId, method.id);
      await loadMethodologies();
    } catch (err) {
      console.error('Failed to delete methodology', err);
      setError('Unable to delete methodology. Please try again.');
      notify('Unable to delete methodology.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Methodologies</h2>
          <p className="text-slate-500 mt-1">
            Guided testing workflows for {activeProject?.name || 'this project'}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors flex items-center gap-2">
            Import Template
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={!activeProjectId}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-indigo-100 flex items-center gap-2"
          >
            <Plus size={18} />
            New Methodology
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Selector */}
        <div className="lg:col-span-1 space-y-3">
          {!activeProjectId ? (
            <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-6 text-xs font-semibold text-slate-400">
              Select a project to manage methodologies.
            </div>
          ) : isLoading ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 text-xs font-semibold text-slate-400">
              Loading methodologies...
            </div>
          ) : error ? (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-xs font-semibold text-rose-400">
              {error}
            </div>
          ) : methodologies.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-6 text-xs font-semibold text-slate-400">
              No methodologies yet. Create one to get started.
            </div>
          ) : (
            methodologies.map(m => (
              <button
                key={m.id}
                onClick={() => setActiveMethodology(m.id)}
                className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between group ${
                  activeMethodology === m.id 
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' 
                    : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                }`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <Target size={18} className={activeMethodology === m.id ? 'text-white' : 'text-slate-400'} />
                  <span className="font-bold text-sm truncate">{m.name}</span>
                </div>
                <ChevronRight size={16} className={`transition-transform ${activeMethodology === m.id ? 'translate-x-1' : 'group-hover:translate-x-1 opacity-50'}`} />
              </button>
            ))
          )}
        </div>

        {/* Task Board */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">{current?.name || 'Methodology'}</h3>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-widest mt-1">
                  Progress: {current?.tasks?.length ? Math.round((current.tasks.filter(t => t.status === 'done').length / current.tasks.length) * 100) : 0}%
                </p>
              </div>
              <div className="flex items-center gap-2">
                {current && (
                  <>
                    <button
                      onClick={() => openEditMethodology(current)}
                      className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"
                      title="Edit methodology"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteMethodology(current)}
                      className="p-2 hover:bg-rose-50 rounded-lg text-rose-500 transition-colors"
                      title="Delete methodology"
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
                <button className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors">
                  <Settings size={18} />
                </button>
                <button className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors">
                  <MoreHorizontal size={18} />
                </button>
              </div>
            </div>

            <div className="p-4 bg-slate-50/30">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Columns */}
                {(['todo', 'in-progress', 'done'] as const).map(status => (
                  <div key={status} className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {status === 'todo' ? 'Backlog' : status === 'in-progress' ? 'In Progress' : 'Completed'}
                      </h4>
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                        {current?.tasks?.filter(t => t.status === status).length || 0}
                      </span>
                    </div>

                    <div
                      className={`space-y-3 min-h-[300px] p-2 rounded-2xl transition-all ${
                        dragOverStatus === status ? 'bg-indigo-50/60 border border-dashed border-indigo-200' : ''
                      }`}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDragOverStatus(status);
                      }}
                      onDragLeave={() => setDragOverStatus(null)}
                      onDrop={(event) => {
                        event.preventDefault();
                        handleDropTask(status);
                      }}
                    >
                      {current?.tasks?.filter(t => t.status === status).map(task => (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={() => setDragTaskId(task.id)}
                          onDragEnd={() => setDragTaskId(null)}
                          className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-300 transition-all group cursor-grab active:cursor-grabbing"
                        >
                          <div className="flex items-start gap-3">
                            <button className={`mt-0.5 transition-colors ${task.status === 'done' ? 'text-emerald-500' : 'text-slate-300 hover:text-indigo-400'}`}>
                              {task.status === 'done' ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                            </button>
                            <span className={`text-sm font-semibold leading-snug ${task.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                              {task.title}
                            </span>
                          </div>
                          <div className="mt-4 flex items-center justify-end">
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                openEditTask(task);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-100 rounded transition-all text-slate-400"
                              title="Edit task"
                            >
                              <MoreHorizontal size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          if (!current?.id) return;
                          setTaskTargetMethodology(current.id);
                          setNewTaskStatus(status);
                          setShowTaskModal(true);
                        }}
                        className="w-full py-3 rounded-xl border border-dashed border-slate-300 text-slate-400 hover:text-indigo-500 hover:border-indigo-300 transition-all text-xs font-bold flex items-center justify-center gap-2"
                      >
                        <Plus size={14} />
                        Add Task
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <CreateMethodologyModal
        isOpen={showCreateModal}
        value={newMethodName}
        onChange={setNewMethodName}
        onClose={() => { setShowCreateModal(false); setNewMethodName(''); }}
        onSubmit={handleCreateMethodology}
        error={error}
      />

      <CreateTaskModal
        isOpen={showTaskModal}
        name={newTaskName}
        status={newTaskStatus}
        onNameChange={setNewTaskName}
        onStatusChange={setNewTaskStatus}
        onClose={() => { setShowTaskModal(false); setNewTaskName(''); }}
        onSubmit={handleCreateTask}
        error={error}
      />

      <EditTaskModal
        isOpen={!!editTask}
        name={editTaskName}
        status={editTaskStatus}
        onNameChange={setEditTaskName}
        onStatusChange={setEditTaskStatus}
        onClose={() => setEditTask(null)}
        onSubmit={handleSaveTask}
        error={error}
      />

      <EditMethodologyModal
        isOpen={showEditMethodModal}
        name={editMethodName}
        onNameChange={setEditMethodName}
        onClose={() => { setShowEditMethodModal(false); setEditMethodId(''); }}
        onSubmit={handleSaveMethodology}
        error={error}
      />
    </div>
  );
};

export default MethodologyTracker;

function CreateMethodologyModal({
  isOpen,
  value,
  onChange,
  onClose,
  onSubmit,
  error,
}: {
  isOpen: boolean;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  error: string | null;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden">
        <div className="p-10 space-y-8">
          <div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight">Create Methodology</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Welford Systems VM Protocol</p>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest px-1">Methodology Name</label>
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="e.g. OWASP Top 10"
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all shadow-sm"
            />
          </div>
          <div className="flex gap-4 pt-2">
            <button onClick={onClose} className="flex-1 py-4 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all">Cancel</button>
            <button
              onClick={onSubmit}
              disabled={!value.trim()}
              className="flex-[2] py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 transition-all active:scale-95 disabled:opacity-50"
            >
              Create Methodology
            </button>
          </div>
          {error && (
            <p className="text-[10px] font-black uppercase tracking-widest text-rose-500">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateTaskModal({
  isOpen,
  name,
  status,
  onNameChange,
  onStatusChange,
  onClose,
  onSubmit,
  error,
}: {
  isOpen: boolean;
  name: string;
  status: 'todo' | 'in-progress' | 'done';
  onNameChange: (value: string) => void;
  onStatusChange: (value: 'todo' | 'in-progress' | 'done') => void;
  onClose: () => void;
  onSubmit: () => void;
  error: string | null;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden">
        <div className="p-10 space-y-8">
          <div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight">Add Task</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Methodology Task</p>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest px-1">Task Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="e.g. A01: Broken Access Control"
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all shadow-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Status</label>
            <select
              value={status}
              onChange={(e) => onStatusChange(e.target.value as 'todo' | 'in-progress' | 'done')}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-900 outline-none"
            >
              <option value="todo">Backlog</option>
              <option value="in-progress">In Progress</option>
              <option value="done">Completed</option>
            </select>
          </div>
          <div className="flex gap-4 pt-2">
            <button onClick={onClose} className="flex-1 py-4 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all">Cancel</button>
            <button
              onClick={onSubmit}
              disabled={!name.trim()}
              className="flex-[2] py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 transition-all active:scale-95 disabled:opacity-50"
            >
              Add Task
            </button>
          </div>
          {error && (
            <p className="text-[10px] font-black uppercase tracking-widest text-rose-500">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function EditTaskModal({
  isOpen,
  name,
  status,
  onNameChange,
  onStatusChange,
  onClose,
  onSubmit,
  error,
}: {
  isOpen: boolean;
  name: string;
  status: 'todo' | 'in-progress' | 'done';
  onNameChange: (value: string) => void;
  onStatusChange: (value: 'todo' | 'in-progress' | 'done') => void;
  onClose: () => void;
  onSubmit: () => void;
  error: string | null;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden">
        <div className="p-10 space-y-8">
          <div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight">Edit Task</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Update title or status</p>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest px-1">Task Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all shadow-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Status</label>
            <select
              value={status}
              onChange={(e) => onStatusChange(e.target.value as 'todo' | 'in-progress' | 'done')}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-900 outline-none"
            >
              <option value="todo">Backlog</option>
              <option value="in-progress">In Progress</option>
              <option value="done">Completed</option>
            </select>
          </div>
          <div className="flex gap-4 pt-2">
            <button onClick={onClose} className="flex-1 py-4 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all">Cancel</button>
            <button
              onClick={onSubmit}
              disabled={!name.trim()}
              className="flex-[2] py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 transition-all active:scale-95 disabled:opacity-50"
            >
              Save Changes
            </button>
          </div>
          {error && (
            <p className="text-[10px] font-black uppercase tracking-widest text-rose-500">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function EditMethodologyModal({
  isOpen,
  name,
  onNameChange,
  onClose,
  onSubmit,
  error,
}: {
  isOpen: boolean;
  name: string;
  onNameChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  error: string | null;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden">
        <div className="p-10 space-y-8">
          <div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight">Edit Methodology</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Rename your workflow</p>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest px-1">Methodology Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all shadow-sm"
            />
          </div>
          <div className="flex gap-4 pt-2">
            <button onClick={onClose} className="flex-1 py-4 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all">Cancel</button>
            <button
              onClick={onSubmit}
              disabled={!name.trim()}
              className="flex-[2] py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 transition-all active:scale-95 disabled:opacity-50"
            >
              Save Changes
            </button>
          </div>
          {error && (
            <p className="text-[10px] font-black uppercase tracking-widest text-rose-500">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
