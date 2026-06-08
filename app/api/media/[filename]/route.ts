import fs from 'node:fs';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth';
import { DATA_DIRECTORY } from '@/lib/db';

const MEDIA_DIR = path.join(DATA_DIRECTORY, 'media');

const CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
};

type RouteContext = {
  params: Promise<{ filename: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const { filename } = await context.params;
  const normalized = path.basename((filename || '').trim());
  if (!normalized) {
    return NextResponse.json({ error: 'File name is required.' }, { status: 400 });
  }

  const resolved = path.resolve(path.join(MEDIA_DIR, normalized));
  const mediaRoot = path.resolve(MEDIA_DIR) + path.sep;
  if (!resolved.startsWith(mediaRoot)) {
    return NextResponse.json({ error: 'Invalid file path.' }, { status: 400 });
  }

  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    return NextResponse.json({ error: 'Media file not found.' }, { status: 404 });
  }

  const ext = path.extname(normalized).toLowerCase();
  const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';
  const data = fs.readFileSync(resolved);

  return new NextResponse(data, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=86400',
    },
  });
}
