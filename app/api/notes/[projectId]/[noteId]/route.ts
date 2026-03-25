import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth';
import { canUserAccessProject, findProjectById } from '@/lib/projectsStore';
import { deleteProjectNote } from '@/lib/notesStore';

const getSession = (request: NextRequest) => {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
};

type RouteContext = {
  params: Promise<{ projectId: string; noteId: string }>;
};

export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const { projectId, noteId } = await context.params;
  const normalizedProjectId = projectId?.trim() || '';
  const normalizedNoteId = noteId?.trim() || '';
  if (!normalizedProjectId || !normalizedNoteId) {
    return NextResponse.json({ error: 'Project id and note id are required.' }, { status: 400 });
  }

  const project = findProjectById(normalizedProjectId);
  if (!project) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
  }

  const isAdmin = session.role === 'Admin';
  if (!canUserAccessProject(project, session.username, isAdmin)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const notes = deleteProjectNote(normalizedProjectId, normalizedNoteId);
  return NextResponse.json({ ok: true, notes });
}
