type MediaResult = { url: string; name: string; file?: File } | null;

const TARGET_MIN_IMAGE_BYTES = 20 * 1024;
const TARGET_MAX_IMAGE_BYTES = 70 * 1024;
const TARGET_MID_IMAGE_BYTES = 45 * 1024;
const MAX_LONG_EDGE = 1920;
const RESIZE_FACTOR = 0.86;
const MAX_RESIZE_PASSES = 6;
const QUALITY_LOW = 0.42;
const QUALITY_HIGH = 0.92;
const QUALITY_STEPS = 8;

const readAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Unable to read selected file.'));
    reader.readAsDataURL(file);
  });

const loadImageFromFile = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Unable to decode image file.'));
    };
    image.src = url;
  });

const canvasToWebpBlob = (canvas: HTMLCanvasElement, quality: number): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Unable to encode WebP image.'));
          return;
        }
        resolve(blob);
      },
      'image/webp',
      quality
    );
  });

const optimizeImageToWebp = async (file: File): Promise<File> => {
  const image = await loadImageFromFile(file);

  const longEdge = Math.max(image.naturalWidth, image.naturalHeight) || 1;
  const baseScale = Math.min(1, MAX_LONG_EDGE / longEdge);
  let width = Math.max(1, Math.round(image.naturalWidth * baseScale));
  let height = Math.max(1, Math.round(image.naturalHeight * baseScale));

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return file;

  let bestBlob: Blob | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let pass = 0; pass < MAX_RESIZE_PASSES; pass += 1) {
    canvas.width = width;
    canvas.height = height;
    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    let localBest: Blob | null = null;
    let localBestScore = Number.POSITIVE_INFINITY;

    let low = QUALITY_LOW;
    let high = QUALITY_HIGH;
    for (let step = 0; step < QUALITY_STEPS; step += 1) {
      const quality = (low + high) / 2;
      const blob = await canvasToWebpBlob(canvas, quality);
      const size = blob.size;
      const score = Math.abs(size - TARGET_MID_IMAGE_BYTES);
      if (score < localBestScore) {
        localBest = blob;
        localBestScore = score;
      }

      if (size > TARGET_MAX_IMAGE_BYTES) {
        high = quality;
      } else {
        low = quality;
      }
    }

    if (localBest && localBestScore < bestScore) {
      bestBlob = localBest;
      bestScore = localBestScore;
    }

    if (localBest && localBest.size >= TARGET_MIN_IMAGE_BYTES && localBest.size <= TARGET_MAX_IMAGE_BYTES) {
      bestBlob = localBest;
      break;
    }

    if (localBest && localBest.size > TARGET_MAX_IMAGE_BYTES) {
      width = Math.max(1, Math.round(width * RESIZE_FACTOR));
      height = Math.max(1, Math.round(height * RESIZE_FACTOR));
      continue;
    }

    // If image is already smaller than target range, do not upscale.
    break;
  }

  if (!bestBlob) return file;

  const baseName = (file.name || 'image').replace(/\.[^.]+$/, '');
  return new File([bestBlob], `${baseName}.webp`, {
    type: 'image/webp',
    lastModified: Date.now(),
  });
};

const pickFileFallback = (accept: string): Promise<MediaResult> =>
  new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      try {
        if (file.type.startsWith('image/')) {
          const optimizedFile = await optimizeImageToWebp(file);
          const dataUrl = await readAsDataUrl(optimizedFile);
          if (dataUrl) {
            resolve({ url: dataUrl, name: optimizedFile.name, file: optimizedFile });
            return;
          }
        }

        resolve({
          url: URL.createObjectURL(file),
          name: file.name,
          file,
        });
      } catch {
        resolve({
          url: URL.createObjectURL(file),
          name: file.name,
          file,
        });
      }
    };
    input.click();
  });

export const selectMediaFile = async (mediaType: 'image' | 'video'): Promise<MediaResult> => {
  const accept = mediaType === 'video' ? 'video/*' : 'image/*';
  return pickFileFallback(accept);
};

export const uploadMediaFile = async (
  file: File,
  mediaType: 'image' | 'video'
): Promise<{ url: string; name: string }> => {
  const uploadFile = mediaType === 'image' ? await optimizeImageToWebp(file).catch(() => file) : file;

  const formData = new FormData();
  formData.append('file', uploadFile);
  formData.append('mediaType', mediaType);

  const response = await fetch('/api/media/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error || 'Failed to upload media file.');
  }

  const payload = (await response.json()) as { url?: string; name?: string };
  if (!payload.url) {
    throw new Error('Upload completed but URL was not returned.');
  }

  return {
    url: payload.url,
    name: payload.name || uploadFile.name,
  };
};
