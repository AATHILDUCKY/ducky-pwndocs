
import React, { useState, useMemo, useEffect, useCallback, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Shield, 
  LayoutDashboard, 
  AlertTriangle, 
  CheckSquare, 
  Download, 
  Search, 
  Bell, 
  Plus, 
  Briefcase, 
  X, 
  ChevronDown, 
  FileText, 
  Layers, 
  Database, 
  Monitor, 
  SearchX,
  Command,
  Loader2,
  Trash2,
  RefreshCw,
  Users,
  UserPlus
} from 'lucide-react';

const Dashboard = lazy(() => import('./components/Dashboard'));
const IssueList = lazy(() => import('./components/IssueList'));
const MethodologyTracker = lazy(() => import('./components/MethodologyTracker'));
const ExportPanel = lazy(() => import('./components/ExportPanel'));
const NotesPanel = lazy(() => import('./components/NotesPanel'));
const AdminUsersPage = lazy(() => import('./components/AdminUsersPage'));
const AdminDashboardPage = lazy(() => import('./components/AdminDashboardPage'));
import { ManagedUser, Project, UserProfile, UserProfileInput, SmtpSettings, ReportPermissions } from './types';
import { fetchProjects, createProject, deleteProject, updateProjectCollaborators } from './services/projectService';
import {
  createUserProfile,
  ensureAdminUser,
  fetchActiveUser,
  fetchUserProfile,
  fetchUsers,
  setActiveUser,
  updateUserProfile,
} from './services/userService';
import { fetchSmtpSettings, saveSmtpSettings } from './services/emailService';
import ProfilePage from './components/ProfilePage';
import HistoryPage from './components/HistoryPage';
import ToastHost from './components/ui/ToastHost';
import { notify } from './utils/notify';

const Navigation: React.FC<{ onRefresh: () => void; isAdmin?: boolean }> = ({ onRefresh, isAdmin = false }) => {
  const location = useLocation();
  const navItems = [
    { path: '/', label: 'Overview', icon: LayoutDashboard },
    { path: '/notes', label: 'Notes', icon: FileText },
    { path: '/issues', label: 'Findings', icon: AlertTriangle },
    { path: '/methodologies', label: 'Methodology', icon: CheckSquare },
    { path: '/export', label: 'Deliverables', icon: Download },
    ...(isAdmin ? [{ path: '/dashboard', label: 'Admin Dashboard', icon: Users }] : []),
  ];

  return (
    <nav className="flex items-center justify-between gap-3 border-b border-slate-200 px-6 bg-white/80 backdrop-blur-md sticky top-16 z-[90]">
      <div className="flex items-center gap-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-2 px-5 py-4 text-xs font-black uppercase tracking-[0.12em] leading-none whitespace-nowrap transition-all relative ${
              isActive ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Icon size={14} strokeWidth={2.5} />
            {item.label}
            {isActive && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full shadow-[0_-2px_8px_rgba(79,70,229,0.3)]" />
            )}
          </Link>
        );
      })}
      </div>
      <button
        onClick={onRefresh}
        className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-slate-50 transition-all"
        title="Refresh"
      >
        <RefreshCw size={16} />
      </button>
    </nav>
  );
};

const VaultNode: React.FC<{ 
  project: Project; 
  isActive: boolean; 
  hasChildren: boolean;
  depth: number;
  onSelect: () => void;
  onToggle: () => void;
  onCreateSub: () => void;
  onManageAccess?: () => void;
  onDelete: () => void;
  isExpanded: boolean;
  canManageAccess?: boolean;
}> = ({ project, isActive, hasChildren, depth, onSelect, onToggle, onCreateSub, onManageAccess, onDelete, isExpanded, canManageAccess = false }) => {
  const total = project.issueCount.critical + project.issueCount.high + project.issueCount.medium + project.issueCount.low;
  const progress = Math.min(Math.round((project.issueCount.low / (total || 1)) * 100) + 20, 100);

  return (
    <div className="space-y-1" style={{ paddingLeft: depth ? depth * 12 : 0 }}>
      <div 
        onClick={onSelect}
        className={`group flex items-center gap-3 py-3 px-3 rounded-2xl cursor-pointer transition-all border ${
          isActive 
            ? 'bg-white border-slate-200 shadow-sm ring-1 ring-indigo-500/5' 
            : 'bg-transparent border-transparent text-slate-500 hover:bg-slate-100/60'
        }`}
      >
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
          isActive ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400 group-hover:bg-white'
        }`}>
          <Briefcase size={15} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-[11px] font-black truncate leading-tight ${isActive ? 'text-slate-900' : 'text-slate-700'}`}>{project.name}</p>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{project.client}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(event) => {
              event.stopPropagation();
              onCreateSub();
            }}
            className="w-6 h-6 flex items-center justify-center text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-all active:scale-90"
            title="Add sub project"
          >
            <Plus size={12} />
          </button>
          {canManageAccess && (
            <button
              onClick={(event) => {
                event.stopPropagation();
                onManageAccess?.();
              }}
              className="w-6 h-6 inline-flex items-center justify-center text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg transition-all active:scale-95 border border-sky-100"
              title="Add user"
            >
              <UserPlus size={11} />
            </button>
          )}
          {hasChildren && (
            <button
              onClick={(event) => {
                event.stopPropagation();
                onToggle();
              }}
              className="w-6 h-6 flex items-center justify-center text-slate-400 hover:bg-slate-100 rounded-lg transition-all"
              title="Toggle"
            >
              <ChevronDown size={14} className={`text-slate-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
          )}
          <button
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
            title="Delete project"
          >
            <Trash2 size={12} />
          </button>
          {project.issueCount.critical > 0 && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>}
        </div>
      </div>

      {isExpanded && (
        <div className="ml-7 pl-4 border-l-2 border-slate-100 space-y-1 py-1 animate-in slide-in-from-top-2 duration-200">
          <Link to="/notes" className="flex items-center gap-2.5 py-1.5 text-[9px] font-black text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-[0.2em]">
            <FileText size={12} className="text-indigo-400" /> Notes
          </Link>
        </div>
      )}
    </div>
  );
};

const Header: React.FC<{
  profile: UserProfile | null;
  users: ManagedUser[];
  isAdmin: boolean;
  onOpenProfile: () => void;
  onOpenDashboard: () => void;
  onLogout: () => void;
  onSwitchUser: (userId: string) => void;
}> = ({ profile, users, isAdmin, onOpenProfile, onOpenDashboard, onLogout, onSwitchUser }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 sticky top-0 z-[100]">
    <div className="flex items-center gap-3">
      <div className="bg-slate-900 p-2 rounded-xl text-white shadow-lg">
        <Shield size={20} strokeWidth={2.5} />
      </div>
      <div>
        <h1 className="text-lg font-black text-slate-800 tracking-tighter leading-none">Ducky Pwn Docs</h1>
        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-0.5">Secure Collaboration</p>
      </div>
    </div>

    <div className="flex-1 max-w-md mx-12">
      <div className="relative group">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={14} />
        <input 
          type="text" 
          placeholder="Quick Command Search..." 
          className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-2xl text-[11px] font-bold focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all outline-none"
        />
      </div>
    </div>

    <div className="flex items-center gap-3">
      <button className="w-10 h-10 flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded-xl transition-all relative">
        <Bell size={18} />
        <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-rose-500 rounded-full border-2 border-white"></span>
      </button>
      <div className="h-8 w-[1px] bg-slate-200 mx-1"></div>
      <div className="relative">
        <button
          className="flex items-center gap-3 pl-2 cursor-pointer group"
          onClick={() => setIsMenuOpen((prev) => !prev)}
        >
        <div className="text-right hidden sm:block">
          <p className="text-[10px] font-black text-slate-700 leading-none">{profile?.fullName || profile?.username || 'User'}</p>
          <p className="text-[8px] text-slate-400 font-bold uppercase mt-0.5">{profile?.role || 'Owner'}</p>
        </div>
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-black shadow-lg shadow-indigo-100 overflow-hidden"
          style={{ backgroundColor: profile?.avatarColor || '#4f46e5' }}
        >
          {profile?.avatarUrl ? (
            <img src={profile.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            (profile?.username || 'U').slice(0, 2).toUpperCase()
          )}
        </div>
        </button>
        {isMenuOpen && (
          <div className="absolute right-0 top-12 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
            <button
              onClick={() => {
                setIsMenuOpen(false);
                onOpenDashboard();
              }}
              className="block w-full px-5 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50"
            >
              Dashboard
            </button>
            <button onClick={() => { setIsMenuOpen(false); onOpenProfile(); }} className="block w-full px-5 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50">Profile</button>
            <button onClick={() => { setIsMenuOpen(false); onLogout(); }} className="block w-full px-5 py-3 text-left text-[10px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-50 border-t border-slate-100">Logout</button>
          </div>
        )}
      </div>
    </div>
  </header>
  );
};

const LOADING_PROJECT: Project = {
  id: '',
  name: 'Syncing vault...',
  client: 'Please wait',
  issueCount: { critical: 0, high: 0, medium: 0, low: 0 },
  lastUpdate: '',
  status: 'active'
};

const AppContent = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>('');
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', client: '' });
  const [vaultSearch, setVaultSearch] = useState('');
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [newProjectParentId, setNewProjectParentId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [sessionIdentity, setSessionIdentity] = useState<{
    username: string;
    email?: string;
    fullName?: string;
    role?: 'Admin' | 'Analyst' | 'Viewer' | 'User';
    permissions?: ReportPermissions;
  }>({ username: 'admin', role: 'Admin' });
  const [smtpSettings, setSmtpSettings] = useState<SmtpSettings | null>(null);
  const [smtpForm, setSmtpForm] = useState<SmtpSettings>({
    host: '',
    port: 0,
    user: '',
    pass: '',
    from: '',
  });
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpError, setSmtpError] = useState<string | null>(null);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [accessProjectId, setAccessProjectId] = useState<string | null>(null);
  const [selectedCollaborators, setSelectedCollaborators] = useState<string[]>([]);
  const [accessSaving, setAccessSaving] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [accessUserSearch, setAccessUserSearch] = useState('');
  const [accessTab, setAccessTab] = useState<'current' | 'available'>('current');

  const refreshProjects = useCallback(async () => {
    setIsLoadingProjects(true);
    setProjectError(null);
    try {
      const data = await fetchProjects();
      setProjects(data);
      setActiveProjectId((prev) => {
        if (!data.length) return '';
        if (prev && data.some((project) => project.id === prev)) return prev;
        return data[0].id;
      });
    } catch (error) {
      console.error('Failed to load projects', error);
      notify('Failed to load projects.');
      setProjects([]);
      setActiveProjectId('');
      setProjectError('Data store unavailable. Please refresh and try again.');
    } finally {
      setIsLoadingProjects(false);
    }
  }, []);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  const refreshUsers = useCallback(async () => {
    const data = await fetchUsers();
    setUsers(data);
    const active = await fetchActiveUser();
    if (active) {
      setProfile(active);
      return active;
    }
    return null;
  }, []);

  useEffect(() => {
    const boot = async () => {
      try {
        let sessionUsername = 'admin';
        let sessionEmail = 'admin@localhost';
        let sessionRole: 'Admin' | 'Analyst' | 'Viewer' | 'User' = 'Admin';
        let sessionFullName = 'Administrator';
        let sessionPermissions: ReportPermissions = { canView: true, canCreate: true, canEdit: true };

        try {
          const response = await fetch('/api/auth/session', { cache: 'no-store' });
          if (response.ok) {
            const body = (await response.json()) as {
              username?: string;
              email?: string;
              role?: 'Admin' | 'Analyst' | 'Viewer' | 'User';
              fullName?: string;
              permissions?: ReportPermissions;
            };
            sessionUsername = body.username || sessionUsername;
            sessionEmail = body.email || sessionEmail;
            sessionRole = body.role || sessionRole;
            sessionFullName = body.fullName || sessionFullName;
            if (body.permissions) sessionPermissions = body.permissions;
          }
        } catch {
          // session endpoint unavailable in local mode
        }

        setSessionIdentity({
          username: sessionUsername,
          email: sessionEmail,
          role: sessionRole,
          fullName: sessionFullName,
          permissions: sessionPermissions,
        });

        if (sessionRole === 'Admin') {
          await ensureAdminUser({
            username: sessionUsername,
            email: sessionEmail,
            fullName: sessionFullName || 'Administrator',
          });
        }

        const existingUsers = await fetchUsers();
        const matchedUser = existingUsers.find(
          (user) => user.username.trim().toLowerCase() === sessionUsername.trim().toLowerCase()
        );

        if (matchedUser) {
          await setActiveUser(matchedUser.id);
          await refreshUsers();
          return;
        }

        const created = await createUserProfile({
          username: sessionUsername,
          fullName: sessionFullName || sessionUsername,
          role: sessionRole === 'User' ? 'Analyst' : sessionRole,
          email: sessionEmail,
          avatarColor: '#4f46e5',
          avatarUrl: '',
        });

        if (created?.id) {
          await setActiveUser(created.id);
        }

        await refreshUsers();
      } catch (error) {
        console.error('Failed to load user profile', error);
        notify('Failed to load user profile.');
      }
    };
    boot();
  }, [refreshUsers]);

  useEffect(() => {
    const loadSmtp = async () => {
      try {
        const settings = await fetchSmtpSettings();
        if (settings) {
          setSmtpSettings(settings);
          setSmtpForm(settings);
        }
      } catch (error) {
        console.error('Failed to load SMTP settings', error);
        notify('Failed to load SMTP settings.');
      }
    };
    loadSmtp();
  }, []);

  useEffect(() => {
    if (smtpSettings) {
      setSmtpForm(smtpSettings);
    }
  }, [smtpSettings]);

  const handleCreateProject = async () => {
    if (!newProject.name || !newProject.client) return;
    try {
      setIsCreatingProject(true);
      setProjectError(null);
      await createProject({ ...newProject, parentId: newProjectParentId });
      await refreshProjects();
      setIsAddingProject(false);
      setNewProject({ name: '', client: '' });
      setNewProjectParentId(null);
    } catch (error) {
      console.error('Could not create project', error);
      notify('Unable to create project.');
      setProjectError('Unable to create project. Please try again.');
    } finally {
      setIsCreatingProject(false);
    }
  };

  const handleDeleteProject = async (project: Project) => {
    const confirmed = window.confirm(`Delete "${project.name}" and all child projects?`);
    if (!confirmed) return;
    try {
      setProjectError(null);
      await deleteProject(project.id);
      await refreshProjects();
    } catch (error) {
      console.error('Could not delete project', error);
      notify('Unable to delete project.');
      setProjectError('Unable to delete project. Please try again.');
    }
  };

  const activeManagedUser = profile as ManagedUser | null;
  const isAdmin = (sessionIdentity.role || '').toLowerCase() === 'admin';
  const isSwitchingUserView = isAdmin
    && Boolean(activeManagedUser?.username)
    && activeManagedUser!.username.trim().toLowerCase() !== (sessionIdentity.username || '').trim().toLowerCase();

  const visibleProjects = useMemo(() => {
    if (!isSwitchingUserView || !activeManagedUser?.username) return projects;
    const actor = activeManagedUser.username.trim().toLowerCase();
    return projects.filter((project) => {
      const owner = (project.ownerUsername || '').trim().toLowerCase();
      if (owner === actor) return true;
      return (project.collaboratorUsernames || []).some((entry) => entry.trim().toLowerCase() === actor);
    });
  }, [projects, isSwitchingUserView, activeManagedUser?.username]);

  const filteredVaultProjects = useMemo(() => {
    return visibleProjects.filter(p => 
      p.name.toLowerCase().includes(vaultSearch.toLowerCase()) || 
      p.client.toLowerCase().includes(vaultSearch.toLowerCase())
    );
  }, [visibleProjects, vaultSearch]);

  const projectTree = useMemo(() => {
    const byParent = new Map<string | null, Project[]>();
    filteredVaultProjects.forEach((project) => {
      const parent = project.parentId || null;
      if (!byParent.has(parent)) byParent.set(parent, []);
      byParent.get(parent)?.push(project);
    });
    return byParent;
  }, [filteredVaultProjects]);

  const renderVaultNodes = (parentId: string | null, depth = 0): React.ReactNode[] => {
    const nodes = projectTree.get(parentId) || [];
    return nodes.flatMap((project) => {
      const children = projectTree.get(project.id) || [];
      const isExpanded = expandedProjects[project.id] ?? true;
      const node = (
        <VaultNode
          key={project.id}
          project={project}
          isActive={activeProjectId === project.id}
          hasChildren={children.length > 0}
          depth={depth}
          onSelect={() => setActiveProjectId(project.id)}
          onToggle={() => setExpandedProjects((prev) => ({ ...prev, [project.id]: !isExpanded }))}
          onCreateSub={() => {
            setNewProjectParentId(project.id);
            setIsAddingProject(true);
          }}
          onManageAccess={() => {
            setAccessProjectId(project.id);
            setSelectedCollaborators(project.collaboratorUsernames || []);
            setAccessUserSearch('');
            setAccessTab('current');
            setAccessError(null);
            setShowAccessModal(true);
          }}
          onDelete={() => handleDeleteProject(project)}
          isExpanded={isExpanded}
          canManageAccess={isAdmin}
        />
      );
      const childNodes = isExpanded ? renderVaultNodes(project.id, depth + 1) : [];
      return [node, ...childNodes];
    });
  };

  useEffect(() => {
    if (!visibleProjects.length) {
      setActiveProjectId('');
      return;
    }
    if (!visibleProjects.some((project) => project.id === activeProjectId)) {
      setActiveProjectId(visibleProjects[0].id);
    }
  }, [visibleProjects, activeProjectId]);

  const activeProject = useMemo(() => {
    if (!visibleProjects.length) return LOADING_PROJECT;
    return visibleProjects.find(p => p.id === activeProjectId) || visibleProjects[0];
  }, [activeProjectId, visibleProjects]);

  const effectiveRole = (isSwitchingUserView ? activeManagedUser?.role : sessionIdentity.role) || activeManagedUser?.role || 'User';
  const basePermissions = (isSwitchingUserView ? activeManagedUser?.permissions : sessionIdentity.permissions) || activeManagedUser?.permissions || {
    canView: true,
    canCreate: true,
    canEdit: true,
  };
  const reportPermissions = effectiveRole === 'Viewer'
    ? { canView: true, canCreate: false, canEdit: false }
    : basePermissions;

  const handleSwitchUser = useCallback(async (userId: string) => {
    try {
      const switched = await setActiveUser(userId);
      if (!switched) return;
      setProfile(switched);
      setUsers(await fetchUsers());
      await refreshProjects();
      notify(`Switched to ${switched.username}.`, 'success');
    } catch (error) {
      console.error('Failed to switch user', error);
      notify('Failed to switch user.');
    }
  }, [refreshProjects]);

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // no-op: still force navigation to re-check auth state
    } finally {
      window.location.href = '/';
    }
  }, []);

  const handleUpdateProjectCollaborators = useCallback(
    async (projectId: string, collaboratorUsernames: string[]) => {
      const updated = await updateProjectCollaborators(projectId, collaboratorUsernames);
      setProjects((prev) => prev.map((project) => (project.id === updated.id ? { ...project, ...updated } : project)));
    },
    []
  );

  const accessProject = useMemo(
    () => (accessProjectId ? projects.find((project) => project.id === accessProjectId) || null : null),
    [accessProjectId, projects]
  );

  const eligibleCollaboratorUsers = useMemo(() => {
    const owner = (accessProject?.ownerUsername || '').trim().toLowerCase();
    return users.filter((user) => user.role !== 'Admin').filter((user) => user.username.trim().toLowerCase() !== owner);
  }, [users, accessProject?.ownerUsername]);

  const filteredEligibleCollaboratorUsers = useMemo(() => {
    const query = accessUserSearch.trim().toLowerCase();
    const alreadySelected = new Set(selectedCollaborators.map((entry) => entry.trim().toLowerCase()));
    const candidates = eligibleCollaboratorUsers.filter(
      (user) => !alreadySelected.has(user.username.trim().toLowerCase())
    );

    if (!query) return candidates;
    return candidates.filter((user) => {
      const username = user.username.trim().toLowerCase();
      const fullName = (user.fullName || '').trim().toLowerCase();
      const email = (user.email || '').trim().toLowerCase();
      return username.includes(query) || fullName.includes(query) || email.includes(query);
    });
  }, [eligibleCollaboratorUsers, accessUserSearch, selectedCollaborators]);

  const selectedCollaboratorUsers = useMemo(() => {
    return selectedCollaborators.map((username) => {
      const found = users.find((user) => user.username.trim().toLowerCase() === username.trim().toLowerCase());
      return {
        id: found?.id || `manual-${username}`,
        username,
        fullName: found?.fullName || username,
      };
    });
  }, [selectedCollaborators, users]);

  return (
    <div className="min-h-screen flex flex-col bg-[#fcfdfe] overflow-x-hidden">
      <ToastHost />
      <Header
        profile={profile}
        users={users}
        isAdmin={isAdmin}
        onOpenProfile={() => navigate('/profile')}
        onOpenDashboard={() => navigate('/dashboard')}
        onLogout={handleLogout}
        onSwitchUser={handleSwitchUser}
      />
      <Navigation onRefresh={refreshProjects} isAdmin={isAdmin} />
      
      <div className="flex-1 flex overflow-hidden">
        {/* Project Vault Sidebar */}
        <aside className="w-[21.5rem] 2xl:w-80 border-r border-slate-200 bg-white/50 backdrop-blur-xl overflow-y-auto hidden lg:block custom-scrollbar">
          <div className="p-6 space-y-8">
            <div className="space-y-6">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-indigo-600"></div>
                   <h2 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.3em]">Project Vault</h2>
                </div>
                <button 
                  onClick={() => { setNewProjectParentId(null); setIsAddingProject(true); }}
                  className="w-7 h-7 flex items-center justify-center text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-all active:scale-90"
                >
                  <Plus size={16} />
                </button>
              </div>

              <div className="px-1">
                <div className="relative group">
                  <Search size={14} className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors ${vaultSearch ? 'text-indigo-500' : 'text-slate-300'}`} />
                  <input 
                    type="text" 
                    placeholder="Filter Vault..." 
                    value={vaultSearch}
                    onChange={(e) => setVaultSearch(e.target.value)}
                    className="w-full pl-10 pr-9 py-2.5 bg-white border border-slate-100 rounded-2xl text-[10px] font-black focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-100 outline-none transition-all shadow-sm uppercase tracking-widest placeholder:text-slate-300"
                  />
                  {vaultSearch && (
                    <button onClick={() => setVaultSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 p-1">
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                {projectError ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center px-4 bg-rose-50/60 rounded-3xl border border-dashed border-rose-200">
                    <SearchX size={20} className="text-rose-300 mb-3" />
                    <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest leading-relaxed">{projectError}</p>
                  </div>
                ) : isLoadingProjects ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center px-4 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                    <Loader2 size={26} className="text-indigo-400 animate-spin" />
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">Syncing vault data...</p>
                  </div>
                ) : filteredVaultProjects.length > 0 ? (
                  renderVaultNodes(null)
                ) : (
                  <div className="py-12 flex flex-col items-center justify-center text-center px-4 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                    <SearchX size={20} className="text-slate-300 mb-3" />
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">No matching<br/>intelligence found</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* Workspace */}
        <main className="flex-1 overflow-y-auto bg-slate-50/10 custom-scrollbar">
          <div className={`${location.pathname === '/notes' ? 'max-w-[1400px]' : 'max-w-7xl'} mx-auto px-5 py-6 md:px-7 md:py-8 xl:px-8 xl:py-8 2xl:px-10 2xl:py-10`}>
            {projectError ? (
              <div className="min-h-[400px] flex flex-col items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-rose-400">
                {projectError}
              </div>
            ) : isLoadingProjects && !projects.length ? (
              <div className="min-h-[400px] flex flex-col items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                <Loader2 size={30} className="animate-spin text-indigo-400" />
                Central vault initializing...
              </div>
            ) : (
              <Suspense
                fallback={
                  <div className="min-h-[400px] flex flex-col items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                    <Loader2 size={30} className="animate-spin text-indigo-400" />
                    Loading workspace...
                  </div>
                }
              >
                <Routes>
                  <Route path="/" element={<Dashboard activeProjectId={activeProjectId} activeProject={activeProject} profile={profile} />} />
                  <Route
                    path="/notes"
                    element={
                      <NotesPanel
                        activeProjectId={activeProjectId}
                        activeProject={activeProject}
                        reportPermissions={reportPermissions}
                      />
                    }
                  />
                  <Route 
                    path="/issues" 
                    element={
                      <IssueList
                        activeProjectId={activeProjectId}
                        activeProject={activeProject}
                        refreshProjects={refreshProjects}
                        reportPermissions={reportPermissions}
                      />
                    } 
                  />
                  <Route
                    path="/profile"
                    element={
                      <ProfilePage
                        profile={profile}
                        setProfile={setProfile}
                        smtpForm={smtpForm}
                        setSmtpForm={setSmtpForm}
                        smtpSaving={smtpSaving}
                        smtpError={smtpError}
                        setSmtpError={setSmtpError}
                        onSaveProfile={async () => {
                          try {
                            if (!profile) return;
                            const updated = await updateUserProfile(profile as UserProfile & UserProfileInput);
                            setProfile(updated || profile);
                            setUsers(await fetchUsers());
                          } catch (error) {
                            console.error('Failed to update profile', error);
                            notify('Failed to update profile.');
                          }
                        }}
                        onSaveSmtp={async () => {
                          try {
                            setSmtpSaving(true);
                            setSmtpError(null);
                            const saved = await saveSmtpSettings(smtpForm);
                            setSmtpSettings(saved || smtpForm);
                          } catch (error) {
                            console.error('Failed to save SMTP settings', error);
                            notify('Failed to save SMTP settings.');
                            setSmtpError('Unable to save mail settings. Please try again.');
                          } finally {
                            setSmtpSaving(false);
                          }
                        }}
                        onBack={() => navigate(-1)}
                        onOpenHistory={() => navigate('/history')}
                        isAdmin={isAdmin}
                        adminIdentity={sessionIdentity}
                        onOpenAdminUsers={() => navigate('/dashboard')}
                      />
                    }
                  />
                  <Route path="/history" element={<HistoryPage onBack={() => navigate(-1)} />} />
                  <Route
                    path="/dashboard"
                    element={
                      isAdmin ? (
                        <AdminDashboardPage
                          profile={profile}
                          users={users}
                          onBack={() => navigate(-1)}
                          onUsersChanged={(nextUsers, activeUser) => {
                            setUsers(nextUsers);
                            if (activeUser) setProfile(activeUser);
                          }}
                          onSaveProfile={async (next) => {
                            const updated = await updateUserProfile(next as UserProfile & UserProfileInput);
                            if (updated) setProfile(updated);
                            setUsers(await fetchUsers());
                          }}
                        />
                      ) : (
                        <Dashboard activeProjectId={activeProjectId} activeProject={activeProject} profile={profile} />
                      )
                    }
                  />
                  <Route
                    path="/admin-dashboard"
                    element={
                      isAdmin ? (
                        <AdminDashboardPage
                          profile={profile}
                          users={users}
                          onBack={() => navigate(-1)}
                          onUsersChanged={(nextUsers, activeUser) => {
                            setUsers(nextUsers);
                            if (activeUser) setProfile(activeUser);
                          }}
                          onSaveProfile={async (next) => {
                            const updated = await updateUserProfile(next as UserProfile & UserProfileInput);
                            if (updated) setProfile(updated);
                            setUsers(await fetchUsers());
                          }}
                        />
                      ) : (
                        <div className="min-h-[320px] flex items-center justify-center text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                          Admin access required.
                        </div>
                      )
                    }
                  />
                  <Route
                    path="/admin-users"
                    element={
                      isAdmin ? (
                        <AdminUsersPage
                          currentUserId={profile?.id || ''}
                          onBack={() => navigate(-1)}
                          onUsersChanged={(nextUsers, activeUser) => {
                            setUsers(nextUsers);
                            if (activeUser) setProfile(activeUser);
                          }}
                        />
                      ) : (
                        <div className="min-h-[320px] flex items-center justify-center text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                          Admin access required.
                        </div>
                      )
                    }
                  />
                  <Route path="/methodologies" element={<MethodologyTracker activeProjectId={activeProjectId} activeProject={activeProject} />} />
                  <Route 
                    path="/export" 
                    element={<ExportPanel externalProjects={projects} externalActiveId={activeProjectId} onProjectSelect={setActiveProjectId} />} 
                  />
                </Routes>
              </Suspense>
            )}
          </div>
        </main>
      </div>

      {/* Initialize Modal */}
      {isAddingProject && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsAddingProject(false)} />
          <div className="relative bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200">
            <div className="p-10 space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight">Initialize Vault</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">New Strategic Engagement</p>
                </div>
                <button onClick={() => setIsAddingProject(false)} className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-all">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest px-1">Vault Identity</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Annual Cloud Audit"
                    value={newProject.name}
                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all shadow-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest px-1">Client Entity</label>
                  <input 
                    type="text" 
                    placeholder="e.g. OmniConsumer Corp"
                    value={newProject.client}
                    onChange={(e) => setNewProject({ ...newProject, client: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all shadow-sm"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button onClick={() => setIsAddingProject(false)} className="flex-1 py-4 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all">Cancel</button>
                <button 
                  onClick={handleCreateProject}
                  disabled={!newProject.name || !newProject.client}
                  className="flex-[2] py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isCreatingProject ? 'Creating...' : 'Create Vault'}
                </button>
              </div>
              {newProjectParentId && (
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Creating sub project
                </p>
              )}
              {projectError && (
                <p className="text-[10px] font-black uppercase tracking-widest text-rose-500">
                  {projectError}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {showAccessModal && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => {
              if (accessSaving) return;
              setShowAccessModal(false);
            }}
          />
          <div className="relative bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden border border-slate-200">
            <div className="p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight">Project Access</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">
                    {accessProject?.name || 'Select collaborators'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (accessSaving) return;
                    setShowAccessModal(false);
                    setAccessUserSearch('');
                    setAccessTab('current');
                    setAccessError(null);
                  }}
                  className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto rounded-2xl border border-slate-100 bg-slate-50 p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setAccessTab('current')}
                    className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.16em] border transition-all ${
                      accessTab === 'current'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100'
                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Current Access ({selectedCollaboratorUsers.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccessTab('available')}
                    className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.16em] border transition-all ${
                      accessTab === 'available'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100'
                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Available Users ({filteredEligibleCollaboratorUsers.length})
                  </button>
                </div>

                <div className="relative mb-2">
                  <Search size={14} className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${accessUserSearch ? 'text-indigo-500' : 'text-slate-300'}`} />
                  <input
                    type="text"
                    value={accessUserSearch}
                    onChange={(event) => setAccessUserSearch(event.target.value)}
                    placeholder="Search user / email..."
                    className="w-full pl-10 pr-9 py-2.5 bg-white border border-slate-100 rounded-xl text-[10px] font-black focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-100 outline-none transition-all shadow-sm uppercase tracking-widest placeholder:text-slate-300"
                  />
                  {accessUserSearch && (
                    <button
                      onClick={() => setAccessUserSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-rose-500"
                      title="Clear search"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {accessTab === 'current' && (
                <div className="space-y-2">
                  <p className="px-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                    Current Access ({selectedCollaboratorUsers.length})
                  </p>
                  {selectedCollaboratorUsers.length ? (
                    selectedCollaboratorUsers.map((user) => (
                      <div
                        key={`selected-${user.id}`}
                        className="flex items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 px-3 py-2"
                      >
                        <div>
                          <p className="text-[11px] font-black text-slate-800">{user.fullName}</p>
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">@{user.username}</p>
                        </div>
                        <button
                          type="button"
                          className="w-7 h-7 inline-flex items-center justify-center rounded-lg bg-white border border-indigo-100 text-rose-500 hover:bg-rose-50"
                          title={`Remove ${user.username}`}
                          onClick={() =>
                            setSelectedCollaborators((prev) =>
                              prev.filter((entry) => entry.trim().toLowerCase() !== user.username.trim().toLowerCase())
                            )
                          }
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                      No users added yet
                    </div>
                  )}
                </div>
                )}

                {accessTab === 'available' && (
                <div className="pt-2 space-y-2">
                  <p className="px-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                    Available Users ({filteredEligibleCollaboratorUsers.length})
                  </p>
                  {filteredEligibleCollaboratorUsers.length ? filteredEligibleCollaboratorUsers.map((user) => {
                    const checked = selectedCollaborators.some(
                      (entry) => entry.trim().toLowerCase() === user.username.trim().toLowerCase()
                    );

                    return (
                      <label
                        key={`eligible-${user.id}`}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2 cursor-pointer"
                      >
                        <div>
                          <p className="text-[11px] font-black text-slate-800">{user.fullName || user.username}</p>
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">@{user.username}</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => {
                            const username = user.username.trim();
                            if (event.target.checked) {
                              setSelectedCollaborators((prev) =>
                                prev.some((entry) => entry.trim().toLowerCase() === username.toLowerCase())
                                  ? prev
                                  : [...prev, username]
                              );
                              return;
                            }
                            setSelectedCollaborators((prev) =>
                              prev.filter((entry) => entry.trim().toLowerCase() !== username.toLowerCase())
                            );
                          }}
                        />
                      </label>
                    );
                  }) : (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                      No users match this filter
                    </div>
                  )}
                </div>
                )}
              </div>

              {accessError && (
                <p className="text-[10px] font-black uppercase tracking-widest text-rose-500">{accessError}</p>
              )}

              <div className="flex gap-4 pt-2">
                <button
                  onClick={() => {
                    if (accessSaving) return;
                    setShowAccessModal(false);
                    setAccessUserSearch('');
                    setAccessTab('current');
                    setAccessError(null);
                  }}
                  className="flex-1 py-3 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!accessProjectId) return;
                    try {
                      setAccessSaving(true);
                      setAccessError(null);
                      await handleUpdateProjectCollaborators(accessProjectId, selectedCollaborators);
                      setShowAccessModal(false);
                      setAccessUserSearch('');
                      setAccessTab('current');
                      notify('Project access updated.', 'success');
                    } catch (error) {
                      console.error('Failed to update project collaborators', error);
                      const message = error instanceof Error ? error.message : 'Unable to update project access.';
                      setAccessError(message);
                      notify(message);
                    } finally {
                      setAccessSaving(false);
                    }
                  }}
                  disabled={accessSaving || !accessProjectId}
                  className="flex-[2] py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 transition-all active:scale-95 disabled:opacity-50"
                >
                  {accessSaving ? 'Saving...' : 'Add User'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


    </div>
  );
};

const App = () => (
  <HashRouter>
    <AppContent />
  </HashRouter>
);

export default App;
