import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth';
import { canUserAccessProject, createProjectRecord, findProjectById, listProjects, listProjectsForUser } from '@/lib/projectsStore';

type CreateProjectPayload = {
  name?: string;
  client?: string;
  ownerUsername?: string;
  collaboratorUsernames?: string[];
  parentId?: string | null;
  id?: string;
  issueCount?: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  lastUpdate?: string;
  status?: 'active' | 'archived';
};

const getSession = (request: NextRequest) => {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
};

export async function GET(request: NextRequest) {
  const session = getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const isAdmin = session.role === 'Admin';
  const projects = isAdmin ? listProjects() : listProjectsForUser(session.username);
  return NextResponse.json({ projects });
}

export async function POST(request: NextRequest) {
  const session = getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (session.role !== 'Admin') {
    return NextResponse.json({ error: 'Only Admin can create projects.' }, { status: 403 });
  }

  let payload: CreateProjectPayload = {};
  try {
    payload = (await request.json()) as CreateProjectPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (!payload.name?.trim()) {
    return NextResponse.json({ error: 'Project name is required.' }, { status: 400 });
  }

  const parentId = typeof payload.parentId === 'string' ? payload.parentId.trim() : '';
  if (parentId) {
    const parent = findProjectById(parentId);
    if (!parent) {
      return NextResponse.json({ error: 'Parent project not found.' }, { status: 400 });
    }
    const isAdmin = session.role === 'Admin';
    if (!canUserAccessProject(parent, session.username, isAdmin)) {
      return NextResponse.json({ error: 'Cannot create sub-project under another user project.' }, { status: 403 });
    }
  }

  const project = createProjectRecord({
    name: payload.name,
    client: payload.client?.trim() || '',
    ownerUsername: session.username,
    collaboratorUsernames: payload.collaboratorUsernames,
    parentId: parentId || null,
    id: payload.id,
    issueCount: payload.issueCount,
    lastUpdate: payload.lastUpdate,
    status: payload.status,
  });

  return NextResponse.json({ ok: true, project }, { status: 201 });
}
