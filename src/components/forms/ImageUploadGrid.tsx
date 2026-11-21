import { ChangeEvent, useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { compressImageToBase64, isImageFile } from '../../lib/imageUtils';
import {
  MAX_LISTING_IMAGES,
  MIN_LISTING_IMAGES,
} from '../../lib/listingValidation';

interface ImageUploadGridProps {
  images: string[];
  onChange: (nextImages: string[]) => void;
  label?: string;
  helperText?: string;
  error?: string;
  aspectClass?: string;
  maxImages?: number;
  maxDocumentBytes?: number;
  inputId?: string;
}

export function ImageUploadGrid({
  images,
  onChange,
  label = 'Photos',
  helperText,
  error,
  aspectClass = 'aspect-square',
  maxImages = MAX_LISTING_IMAGES,
  maxDocumentBytes = 850_000,
  inputId = 'listing-images-upload',
}: ImageUploadGridProps) {
  const { showToast } = useToast();
  const [compressing, setCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    const remainingSlots = maxImages - images.length;
    if (remainingSlots <= 0) {
      showToast(`You can upload up to ${maxImages} images.`, 'info');
      return;
    }

    const validFiles = files.filter((file) => isImageFile(file));
    if (validFiles.length < files.length) {
      showToast('Only image files (JPG, PNG, WEBP) are supported.', 'error');
    }
    if (validFiles.length === 0) return;

    const toProcess = validFiles.slice(0, remainingSlots);
    if (validFiles.length > remainingSlots) {
      showToast(`Maximum ${maxImages} images allowed.`, 'info');
    }

    setCompressing(true);
    try {
      const nextBase64List: string[] = [];
      for (const file of toProcess) {
        const base64 = await compressImageToBase64(file);
        nextBase64List.push(base64);
      }

      const combined = [...images, ...nextBase64List];
      const totalChars = combined.reduce((sum, img) => sum + img.length, 0);
      if (totalChars > maxDocumentBytes) {
        showToast(
          'Combined images exceed Firestore size limit. Please remove a photo or use smaller images.',
          'error'
        );
        return;
      }

      onChange(combined);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Unable to process image.',
        'error'
      );
    } finally {
      setCompressing(false);
    }
  };

  const handleRemove = (indexToRemove: number) => {
    onChange(images.filter((_, idx) => idx !== indexToRemove));
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-slate-700 dark:text-slate-200"
        >
          {label} <span className="text-red-500 ml-0.5">*</span>{' '}
          <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
            (Min {MIN_LISTING_IMAGES}, Max {maxImages} images, auto-compressed)
          </span>
        </label>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
          {images.length} / {maxImages} selected
        </span>
      </div>

      <input
        ref={fileInputRef}
        id={inputId}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => void handleFileChange(e)}
        className="hidden"
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {images.map((imgSrc, idx) => (
          <div
            key={`${imgSrc.slice(0, 24)}-${idx}`}
            className={`relative ${aspectClass} rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 group`}
          >
            <img
              src={imgSrc}
              alt={`Uploaded preview ${idx + 1}`}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={() => handleRemove(idx)}
              aria-label={`Remove image ${idx + 1}`}
              title="Remove image"
              className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-slate-900/80 hover:bg-red-600 text-white shadow-sm flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-white"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
            {idx === 0 && (
              <span className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded bg-slate-900/75 text-[10px] font-semibold text-white">
                Cover
              </span>
            )}
          </div>
        ))}

        {images.length < maxImages && (
          <button
            type="button"
            disabled={compressing}
            onClick={() => fileInputRef.current?.click()}
            className={`${aspectClass} rounded-xl border-2 border-dashed ${
              error
                ? 'border-red-300 dark:border-red-700 bg-red-50/30 dark:bg-red-950/30 hover:border-red-400'
                : 'border-slate-300 dark:border-slate-700 hover:border-blue-500 hover:bg-blue-50/40 dark:hover:bg-blue-950/30'
            } flex flex-col items-center justify-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors p-3 text-center disabled:opacity-60`}
          >
            {compressing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <ImagePlus className="w-6 h-6" />
            )}
            <span className="text-xs font-medium">
              {compressing ? 'Compressing...' : 'Add Photo'}
            </span>
          </button>
        )}
      </div>

      {helperText && !error && (
        <p className="text-xs text-slate-500 dark:text-slate-400">{helperText}</p>
      )}
      {error && (
        <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
