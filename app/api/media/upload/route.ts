import fs from 'node:fs';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth';
import { DATA_DIRECTORY } from '@/lib/db';

const MEDIA_DIR = path.join(DATA_DIRECTORY, 'media');
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_VIDEO_BYTES = 80 * 1024 * 1024;

const ensureMediaDir = () => {
  if (!fs.existsSync(MEDIA_DIR)) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
  }
};

const safeExtFromName = (filename: string) => {
  const ext = path.extname(filename || '').toLowerCase().replace(/[^a-z0-9.]/g, '');
  if (!ext || ext.length > 10) return '';
  return ext;
};

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid upload payload.' }, { status: 400 });
  }

  const maybeFile = formData.get('file');
  if (!(maybeFile instanceof File)) {
    return NextResponse.json({ error: 'File is required.' }, { status: 400 });
  }

  const mediaType = String(formData.get('mediaType') || '').trim().toLowerCase();
  const isImage = mediaType === 'image' || maybeFile.type.startsWith('image/');
  const isVideo = mediaType === 'video' || maybeFile.type.startsWith('video/');

  if (!isImage && !isVideo) {
    return NextResponse.json({ error: 'Unsupported media type.' }, { status: 400 });
  }

  if (isImage && maybeFile.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: 'Image is too large. Max 12MB.' }, { status: 400 });
  }
  if (isVideo && maybeFile.size > MAX_VIDEO_BYTES) {
    return NextResponse.json({ error: 'Video is too large. Max 80MB.' }, { status: 400 });
  }

  const ext = safeExtFromName(maybeFile.name) || (isImage ? '.png' : '.mp4');
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
  const filePath = path.join(MEDIA_DIR, filename);

  ensureMediaDir();

  const arrayBuffer = await maybeFile.arrayBuffer();
  fs.writeFileSync(filePath, Buffer.from(arrayBuffer));

  return NextResponse.json({
    ok: true,
    name: maybeFile.name,
    url: `/api/media/${encodeURIComponent(filename)}`,
  });
}
