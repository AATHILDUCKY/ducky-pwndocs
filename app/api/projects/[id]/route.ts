import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, getAdminCredentials, verifySessionToken } from '@/lib/auth';
import { listAuthUsers } from '@/lib/authUsersStore';
import { canUserAccessProject, deleteProjectRecord, findProjectById, updateProjectCollaborators } from '@/lib/projectsStore';
import { removeIssuesForProjects } from '@/lib/issuesStore';
import { removeNotesForProjects } from '@/lib/notesStore';

const getSession = (request: NextRequest) => {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
};

type RouteContext = {
  params: Promise<{ id: string }>;
};

type UpdateAccessPayload = {
  collaboratorUsernames?: string[];
};

export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: 'Project id is required.' }, { status: 400 });
  }

  const normalizedId = id.trim();
  const existing = findProjectById(normalizedId);
  if (!existing) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
  }

  const isAdmin = session.role === 'Admin';
  if (!canUserAccessProject(existing, session.username, isAdmin)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const result = deleteProjectRecord(normalizedId);
  removeIssuesForProjects(result.deletedIds);
  removeNotesForProjects(result.deletedIds);
  return NextResponse.json({ ok: true, deletedIds: result.deletedIds });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  if (session.role !== 'Admin') {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const { id } = await context.params;
  const normalizedId = id?.trim() || '';
  if (!normalizedId) {
    return NextResponse.json({ error: 'Project id is required.' }, { status: 400 });
  }

  const existing = findProjectById(normalizedId);
  if (!existing) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
  }

  let payload: UpdateAccessPayload = {};
  try {
    payload = (await request.json()) as UpdateAccessPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const collaborators = Array.isArray(payload.collaboratorUsernames) ? payload.collaboratorUsernames : [];
  const owner = (existing.ownerUsername || '').trim().toLowerCase();
  const adminUsername = getAdminCredentials().username.trim().toLowerCase();
  const managedAdmins = new Set(
    listAuthUsers()
      .filter((user) => user.role === 'Admin')
      .map((user) => user.username.trim().toLowerCase())
  );

  const sanitized = collaborators
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry) => {
      const normalized = entry.toLowerCase();
      if (normalized === owner) return false;
      if (normalized === adminUsername) return false;
      if (managedAdmins.has(normalized)) return false;
      return true;
    });

  const updated = updateProjectCollaborators(normalizedId, sanitized);
  if (!updated) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, project: updated });
}
