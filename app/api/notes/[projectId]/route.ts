import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth';
import { canUserAccessProject, findProjectById } from '@/lib/projectsStore';
import { listProjectNotes, upsertProjectNote } from '@/lib/notesStore';
import type { Note } from '@/types';

const getSession = (request: NextRequest) => {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
};

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

type UpsertNotePayload = {
  note?: Note;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const session = getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const { projectId } = await context.params;
  const normalizedProjectId = projectId?.trim() || '';
  if (!normalizedProjectId) {
    return NextResponse.json({ error: 'Project id is required.' }, { status: 400 });
  }

  const project = findProjectById(normalizedProjectId);
  if (!project) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
  }

  const isAdmin = session.role === 'Admin';
  if (!canUserAccessProject(project, session.username, isAdmin)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  return NextResponse.json({ notes: listProjectNotes(normalizedProjectId) });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const { projectId } = await context.params;
  const normalizedProjectId = projectId?.trim() || '';
  if (!normalizedProjectId) {
    return NextResponse.json({ error: 'Project id is required.' }, { status: 400 });
  }

  const project = findProjectById(normalizedProjectId);
  if (!project) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
  }

  const isAdmin = session.role === 'Admin';
  if (!canUserAccessProject(project, session.username, isAdmin)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  let payload: UpsertNotePayload = {};
  try {
    payload = (await request.json()) as UpsertNotePayload;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (!payload.note?.id) {
    return NextResponse.json({ error: 'Note payload is required.' }, { status: 400 });
  }

  const notes = upsertProjectNote(normalizedProjectId, payload.note);
  return NextResponse.json({ ok: true, notes });
}
