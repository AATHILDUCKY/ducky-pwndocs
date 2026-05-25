
import React, { useState, useMemo, useEffect, useCallback, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  AlertTriangle,
  CheckSquare,
  Search,
  Bell,
  Plus,
  Briefcase,
  X,
  ChevronDown,
  SearchX,
  Loader2,
  Trash2,
  RefreshCw,
  Users,
  UserPlus,
  Link2,
} from 'lucide-react';

const Dashboard = lazy(() => import('./components/Dashboard'));
const IssueList = lazy(() => import('./components/IssueList'));
const MethodologyTracker = lazy(() => import('./components/MethodologyTracker'));
const AdminUsersPage = lazy(() => import('./components/AdminUsersPage'));
const AdminDashboardPage = lazy(() => import('./components/AdminDashboardPage'));
import { ManagedUser, Project, UserProfile, UserProfileInput, SmtpSettings, ReportPermissions } from './types';
import { fetchProjects, createProject, deleteProject, updateProjectCollaborators } from './services/projectService';
import {
  createUserProfile,
  ensureAdminUser,
  fetchActiveUser,
  fetchUsers,
  setActiveUser,
  updateUserProfile,
} from './services/userService';
import { fetchSmtpSettings, saveSmtpSettings } from './services/emailService';
import ProfilePage from './components/ProfilePage';
import HistoryPage from './components/HistoryPage';
import ToastHost from './components/ui/ToastHost';
import { notify } from './utils/notify';

const Navigation: React.FC<{ onRefresh: () => void; isAdmin?: boolean; onOpenProjectAccess?: () => void; activeProjectId?: string }> = ({ onRefresh, isAdmin = false, onOpenProjectAccess, activeProjectId }) => {
  const location = useLocation();
  const navItems = [
    { path: '/', label: 'Overview', icon: LayoutDashboard },
    { path: '/issues', label: 'Register', icon: AlertTriangle },
    { path: '/methodologies', label: 'Methodology', icon: CheckSquare },
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
      <div className="flex items-center gap-2">
        {isAdmin && activeProjectId && (
          <button
            onClick={onOpenProjectAccess}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 transition-all"
            title="Manage project user access"
          >
            <UserPlus size={13} />
            Project Access
          </button>
        )}
        <button
          onClick={onRefresh}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-slate-50 transition-all"
          title="Refresh"
        >
          <RefreshCw size={16} />
        </button>
      </div>
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
  onDelete: () => void;
  isExpanded: boolean;
  onCopyLink?: () => void;
}> = ({ project, isActive, hasChildren, depth, onSelect, onToggle, onDelete, isExpanded, onCopyLink }) => {
  const total = project.issueCount.critical + project.issueCount.high + project.issueCount.medium + project.issueCount.low;
  const hasCritical = project.issueCount.critical > 0;
  const hasHigh = !hasCritical && project.issueCount.high > 0;

  return (
    <div className="space-y-1" style={{ paddingLeft: depth ? depth * 12 : 0 }}>
      <div
        onClick={onSelect}
        className={`group flex items-center gap-3 py-2.5 px-3 rounded-xl cursor-pointer transition-all border ${
          isActive
            ? 'bg-white border-slate-200 shadow-sm'
            : 'bg-transparent border-transparent text-slate-500 hover:bg-slate-50'
        }`}
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all ${
          isActive ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500'
        }`}>
          <Briefcase size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className={`text-sm font-semibold truncate leading-tight ${isActive ? 'text-slate-900' : project.status === 'archived' ? 'text-slate-400' : 'text-slate-700'}`}>{project.name}</p>
            {project.status === 'archived' && <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full shrink-0">Archived</span>}
            {project.status !== 'archived' && hasCritical && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" title="Critical issues" />}
            {project.status !== 'archived' && !hasCritical && hasHigh && <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" title="High issues" />}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-slate-400 truncate">{project.client}</p>
            {total > 0 && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
                hasCritical ? 'bg-red-50 text-red-500' : hasHigh ? 'bg-orange-50 text-orange-500' : 'bg-slate-100 text-slate-400'
              }`}>
                {total}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(event) => { event.stopPropagation(); onCopyLink?.(); }}
            className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-md transition-all"
            title="Copy project link"
          >
            <Link2 size={12} />
          </button>
          {hasChildren && (
            <button
              onClick={(event) => { event.stopPropagation(); onToggle(); }}
              className="w-6 h-6 flex items-center justify-center text-slate-400 hover:bg-slate-100 rounded-md transition-all"
              title="Toggle children"
            >
              <ChevronDown size={13} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
          )}
          <button
            onClick={(event) => { event.stopPropagation(); onDelete(); }}
            className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
            title="Delete project"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {isExpanded && <div className="ml-6 pl-3 border-l-2 border-slate-100 space-y-1 py-1 animate-in slide-in-from-top-2 duration-200" />}
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
}> = ({ profile, users: _users, isAdmin: _isAdmin, onOpenProfile, onOpenDashboard, onLogout, onSwitchUser: _onSwitchUser }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 sticky top-0 z-[100]">
    <div className="flex items-center gap-3">
      <div className="bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
        <img src="/assets/app-logo.png" alt="Welford logo" className="w-8 h-8 object-contain" />
      </div>
      <div>
        <h1 className="text-lg font-black text-slate-800 tracking-tighter leading-none">Welford Systems VM</h1>
        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.14em] mt-0.5">ISO 27001 Vulnerability Management</p>
      </div>
    </div>

    <div className="flex-1 max-w-md mx-12">
      <div className="relative group">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={14} />
        <input 
          type="text" 
          placeholder="Search projects or vulnerabilities..."
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
  name: 'Loading projects...',
  client: 'Please wait',
  issueCount: { critical: 0, high: 0, medium: 0, low: 0 },
  lastUpdate: '',
  status: 'active'
};

const AppContent = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const activeProjectId = useMemo(
    () => new URLSearchParams(location.search).get('project')?.trim() || '',
    [location.search]
  );
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', client: '' });
  const [vaultSearch, setVaultSearch] = useState('');
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [showArchived, setShowArchived] = useState(false);
  // Incremented on every sidebar project click so IssueList always remounts (even same project).
  const [selectorKey, setSelectorKey] = useState(0);
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
    } catch (error) {
      console.error('Failed to load projects', error);
      notify('Failed to load projects.');
      setProjects([]);
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
        let sessionEmail = 'admin@welford.local';
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
    if (!isAdmin) {
      notify('Only Admin can create projects.');
      return;
    }
    if (!newProject.name) return;
    try {
      setIsCreatingProject(true);
      setProjectError(null);
      const created = await createProject({ ...newProject, parentId: null });
      await refreshProjects();
      navigate({ pathname: '/issues', search: `?project=${created.id}` }, { replace: true });
      setIsAddingProject(false);
      setNewProject({ name: '', client: '' });
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

  const archivedCount = useMemo(() => visibleProjects.filter(p => p.status === 'archived').length, [visibleProjects]);

  const filteredVaultProjects = useMemo(() => {
    return visibleProjects.filter(p => {
      if (!showArchived && p.status === 'archived') return false;
      return (
        p.name.toLowerCase().includes(vaultSearch.toLowerCase()) ||
        p.client.toLowerCase().includes(vaultSearch.toLowerCase())
      );
    });
  }, [visibleProjects, vaultSearch, showArchived]);

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
          onSelect={() => {
            setSelectorKey((k) => k + 1);
            navigate({ pathname: '/issues', search: `?project=${project.id}` }, { replace: true });
          }}
          onToggle={() => setExpandedProjects((prev) => ({ ...prev, [project.id]: !isExpanded }))}
          onDelete={() => handleDeleteProject(project)}
          isExpanded={isExpanded}
          onCopyLink={async () => {
            try {
              const full = `${window.location.origin}/issues?project=${project.id}`;
              await navigator.clipboard.writeText(full);
              notify('Project link copied.', 'success');
            } catch {
              notify('Unable to copy project link.');
            }
          }}
        />
      );
      const childNodes = isExpanded ? renderVaultNodes(project.id, depth + 1) : [];
      return [node, ...childNodes];
    });
  };

  useEffect(() => {
    if (!visibleProjects.length) {
      if (activeProjectId) {
        navigate({ pathname: location.pathname, search: '' }, { replace: true });
      }
      return;
    }
    if (!activeProjectId || !visibleProjects.some((project) => project.id === activeProjectId)) {
      navigate({ pathname: location.pathname, search: `?project=${visibleProjects[0].id}` }, { replace: true });
    }
  }, [visibleProjects, activeProjectId, location.pathname, navigate]);

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
      <Navigation
        onRefresh={refreshProjects}
        isAdmin={isAdmin}
        activeProjectId={activeProjectId}
        onOpenProjectAccess={() => {
          if (!activeProjectId) return;
          const project = projects.find((p) => p.id === activeProjectId);
          setAccessProjectId(activeProjectId);
          setSelectedCollaborators(project?.collaboratorUsernames || []);
          setAccessUserSearch('');
          setAccessTab('current');
          setAccessError(null);
          setShowAccessModal(true);
        }}
      />
      
      <div className="flex-1 flex overflow-hidden">
        {/* Project Sidebar */}
        <aside className="w-[21.5rem] 2xl:w-80 border-r border-slate-200 bg-white/50 backdrop-blur-xl overflow-y-auto hidden lg:block custom-scrollbar">
          <div className="p-6 space-y-8">
            <div className="space-y-6">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-indigo-600"></div>
                   <h2 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.14em]">Projects</h2>
                   <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">{visibleProjects.filter(p => p.status !== 'archived').length}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {archivedCount > 0 && (
                    <button
                      onClick={() => setShowArchived(prev => !prev)}
                      title={showArchived ? 'Hide archived projects' : `Show ${archivedCount} archived`}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${
                        showArchived
                          ? 'bg-slate-200 text-slate-600 border-slate-300'
                          : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100'
                      }`}
                    >
                      {showArchived ? 'Hide' : `+${archivedCount}`} archived
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => { setIsAddingProject(true); }}
                      className="w-7 h-7 flex items-center justify-center text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-all active:scale-90"
                    >
                      <Plus size={16} />
                    </button>
                  )}
                </div>
              </div>

              <div className="px-1">
                <div className="relative group">
                  <Search size={14} className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors ${vaultSearch ? 'text-indigo-500' : 'text-slate-300'}`} />
                  <input 
                    type="text" 
                    placeholder="Search projects..."
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
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.14em] mt-2">Loading projects...</p>
                  </div>
                ) : filteredVaultProjects.length > 0 ? (
                  renderVaultNodes(null)
                ) : (
                  <div className="py-12 flex flex-col items-center justify-center text-center px-4 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                    <SearchX size={20} className="text-slate-300 mb-3" />
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.14em] leading-relaxed">No matching<br/>projects found</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* Workspace */}
        <main className="flex-1 overflow-y-auto bg-slate-50/10 custom-scrollbar">
          <div className="max-w-7xl mx-auto px-5 py-6 md:px-7 md:py-8 xl:px-8 xl:py-8 2xl:px-10 2xl:py-10">
            {projectError ? (
              <div className="min-h-[400px] flex flex-col items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.14em] text-rose-400">
                {projectError}
              </div>
            ) : isLoadingProjects && !projects.length ? (
              <div className="min-h-[400px] flex flex-col items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                <Loader2 size={30} className="animate-spin text-indigo-400" />
                Loading project workspace...
              </div>
            ) : (
              <Suspense
                fallback={
                  <div className="min-h-[400px] flex flex-col items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                    <Loader2 size={30} className="animate-spin text-indigo-400" />
                    Loading workspace...
                  </div>
                }
              >
                <Routes>
                  <Route path="/" element={<Dashboard activeProjectId={activeProjectId} activeProject={activeProject} profile={profile} />} />
                  <Route
                    path="/issues"
                    element={
                      <IssueList
                        key={`${activeProjectId}-${selectorKey}`}
                        activeProjectId={activeProjectId}
                        activeProject={activeProject}
                        refreshProjects={refreshProjects}
                        currentUsername={profile?.username || sessionIdentity.username}
                        currentUserRole={effectiveRole}
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
                </Routes>
              </Suspense>
            )}
          </div>
        </main>
      </div>

      {/* Create Project Modal */}
      {isAddingProject && isAdmin && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => { setIsAddingProject(false); setNewProject({ name: '', client: '' }); }} />
          <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-100">
                  <Briefcase size={16} className="text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    New Project
                  </h3>
                  <p className="text-xs text-slate-400">Add a vulnerability management scope</p>
                </div>
              </div>
              <button
                onClick={() => { setIsAddingProject(false); setNewProject({ name: '', client: '' }); }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">Project Name</label>
                <input
                  type="text"
                  placeholder="e.g. Q3 Cloud Security Audit"
                  value={newProject.name}
                  autoFocus
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter' && newProject.name) handleCreateProject(); }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 focus:bg-white transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">Client / Organisation</label>
                <input
                  type="text"
                  placeholder="e.g. Acme Corp"
                  value={newProject.client}
                  onChange={(e) => setNewProject({ ...newProject, client: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter' && newProject.name) handleCreateProject(); }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 focus:bg-white transition-all"
                />
                <p className="text-xs text-slate-400">Press Enter on either field to create quickly</p>
              </div>

              {projectError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-xs font-medium px-3 py-2.5 rounded-xl">
                  <AlertTriangle size={13} />
                  {projectError}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
              <button
                onClick={() => { setIsAddingProject(false); setNewProject({ name: '', client: '' }); }}
                className="flex-1 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-sm font-medium transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProject}
                disabled={!newProject.name || isCreatingProject}
                className="flex-[2] py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm shadow-indigo-100 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isCreatingProject ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus size={15} />
                    Create Project
                  </>
                )}
              </button>
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
                  {accessSaving ? 'Saving...' : 'Save Access'}
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
  <BrowserRouter>
    <AppContent />
  </BrowserRouter>
);

export default App;
