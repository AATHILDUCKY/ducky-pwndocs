import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth';
import { deleteProjectIssue } from '@/lib/issuesStore';
import { canUserAccessProject, findProjectById, updateProjectIssueCounts } from '@/lib/projectsStore';

const getSession = (request: NextRequest) => {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
};

type RouteContext = {
  params: Promise<{ projectId: string; issueId: string }>;
};

export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const { projectId, issueId } = await context.params;
  if (!projectId?.trim() || !issueId?.trim()) {
    return NextResponse.json({ error: 'Project id and issue id are required.' }, { status: 400 });
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

  let issues;
  try {
    issues = deleteProjectIssue(normalizedProjectId, issueId.trim());
    updateProjectIssueCounts(normalizedProjectId, issues);
  } catch (error) {
    console.error('Failed to delete finding', error);
    return NextResponse.json({ error: 'Unable to delete finding. Check APP_DATA_DIR permissions.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, issues });
}
