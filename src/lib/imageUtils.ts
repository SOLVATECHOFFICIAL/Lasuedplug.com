import imageCompression from 'browser-image-compression';

const MAX_DIMENSION_PX = 800;
const MAX_SIZE_MB = 0.07;
// Base64 expands binary by ~33%, so 98,000 chars keeps even the Base64 Data URL < 100 KB
const MAX_DATA_URL_LENGTH = 98_000;

export function isImageFile(file: File): boolean {
  if (file.type && file.type.startsWith('image/')) {
    return true;
  }
  return /\.(jpe?g|png|webp|gif|bmp|svg|avif|heic|heif)$/i.test(file.name);
}

function toReadableError(err: unknown, fallbackMessage: string): Error {
  if (err instanceof Error) return err;
  if (typeof err === 'string' && err.trim()) return new Error(err);
  if (
    err &&
    typeof err === 'object' &&
    'message' in err &&
    typeof (err as { message?: unknown }).message === 'string'
  ) {
    return new Error(String((err as { message: string }).message));
  }
  return new Error(fallbackMessage);
}

function blobToBase64DataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert compressed image to Base64.'));
      }
    };
    reader.onerror = () =>
      reject(new Error('Failed to read image file in this browser.'));
    reader.readAsDataURL(blob);
  });
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error('Unable to decode selected image file. Please try another photo (JPG or PNG).'));
    img.src = src;
  });
}

async function compressViaCanvas(
  source: Blob,
  maxDimension = MAX_DIMENSION_PX,
  maxDataUrlLength = MAX_DATA_URL_LENGTH
): Promise<string> {
  const sourceDataUrl = await blobToBase64DataUrl(source);
  const img = await loadImageElement(sourceDataUrl);

  const naturalWidth = img.naturalWidth || img.width || maxDimension;
  const naturalHeight = img.naturalHeight || img.height || maxDimension;
  const scale = Math.min(1, maxDimension / Math.max(naturalWidth, naturalHeight));

  let targetWidth = Math.max(1, Math.round(naturalWidth * scale));
  let targetHeight = Math.max(1, Math.round(naturalHeight * scale));

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Image processing canvas is unavailable in this browser.');
  }

  for (const dimensionFactor of [1, 0.75, 0.55]) {
    canvas.width = Math.max(1, Math.round(targetWidth * dimensionFactor));
    canvas.height = Math.max(1, Math.round(targetHeight * dimensionFactor));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.8, 0.65, 0.5, 0.35, 0.25, 0.15]) {
      const candidate = canvas.toDataURL('image/jpeg', quality);
      if (candidate.length <= maxDataUrlLength) {
        return candidate;
      }
    }
  }

  return canvas.toDataURL('image/jpeg', 0.15);
}

/**
 * Compresses an image File to <= 0.1 MB (100 KB) and max 800px dimension,
 * returning a Base64 Data URL string ready for Firestore storage.
 */
export async function compressImageToBase64(file: File): Promise<string> {
  if (!isImageFile(file)) {
    throw new Error(`"${file.name}" is not a supported image file.`);
  }

  const options = {
    maxSizeMB: MAX_SIZE_MB,
    maxWidthOrHeight: MAX_DIMENSION_PX,
    fileType: 'image/jpeg',
    useWebWorker: true,
  };

  let compressedBlob: Blob | null = null;

  try {
    compressedBlob = await imageCompression(file, options);
  } catch {
    try {
      compressedBlob = await imageCompression(file, {
        ...options,
        useWebWorker: false,
      });
    } catch {
      compressedBlob = null;
    }
  }

  if (compressedBlob) {
    try {
      const dataUrl = await blobToBase64DataUrl(compressedBlob);
      if (dataUrl.length <= MAX_DATA_URL_LENGTH) {
        return dataUrl;
      }
      return await compressViaCanvas(compressedBlob);
    } catch {
      // Fall through to direct canvas compression from original file
    }
  }

  try {
    return await compressViaCanvas(file);
  } catch (err) {
    throw toReadableError(
      err,
      `Unable to process "${file.name}". Please choose a JPG or PNG photo.`
    );
  }
}

export function dataUrlToInlinePart(dataUrl: string): {
  mimeType: string;
  data: string;
} {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (match) {
    return {
      mimeType: match[1],
      data: match[2],
    };
  }
  return {
    mimeType: 'image/jpeg',
    data: dataUrl.replace(/^data:[^;]+;base64,/, ''),
  };
}
