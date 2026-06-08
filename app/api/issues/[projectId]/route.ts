import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth';
import { listProjectIssues, upsertProjectIssue } from '@/lib/issuesStore';
import { canUserAccessProject, findProjectById, updateProjectIssueCounts } from '@/lib/projectsStore';
import type { Issue } from '@/types';

const getSession = (request: NextRequest) => {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
};

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

type UpsertIssuePayload = {
  issue?: Issue;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const session = getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const { projectId } = await context.params;
  if (!projectId?.trim()) {
    return NextResponse.json({ error: 'Project id is required.' }, { status: 400 });
  }

  const normalizedProjectId = projectId.trim();
  const project = findProjectById(normalizedProjectId);
  if (!project) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
  }

  const isAdmin = session.role === 'Admin';
  if (!canUserAccessProject(project, session.username, isAdmin)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  try {
    return NextResponse.json({ issues: listProjectIssues(normalizedProjectId) });
  } catch (error) {
    console.error('Failed to read findings', error);
    return NextResponse.json({ error: 'Finding data store is unavailable. Check APP_DATA_DIR permissions.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const { projectId } = await context.params;
  if (!projectId?.trim()) {
    return NextResponse.json({ error: 'Project id is required.' }, { status: 400 });
  }

  const normalizedProjectId = projectId.trim();
  const project = findProjectById(normalizedProjectId);
  if (!project) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
  }

  const isAdmin = session.role === 'Admin';
  if (!canUserAccessProject(project, session.username, isAdmin)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  let payload: UpsertIssuePayload = {};
  try {
    payload = (await request.json()) as UpsertIssuePayload;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (!payload.issue?.id) {
    return NextResponse.json({ error: 'Issue payload is required.' }, { status: 400 });
  }

  let issues;
  try {
    issues = upsertProjectIssue(normalizedProjectId, payload.issue);
    updateProjectIssueCounts(normalizedProjectId, issues);
  } catch (error) {
    console.error('Failed to save finding', error);
    return NextResponse.json({ error: 'Unable to save finding. Check APP_DATA_DIR permissions.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, issues });
}
