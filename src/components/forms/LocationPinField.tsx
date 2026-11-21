import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, MapPin } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import {
  isGpsAccuracyAcceptable,
  isValidGpsCoordinates,
  MAX_GPS_ACCURACY_METERS,
  WEAK_GPS_TOAST_MESSAGE,
} from '../../lib/listingValidation';
import { Button } from '../ui/Button';

interface LocationPinFieldProps {
  latitude?: number;
  longitude?: number;
  onPin: (coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
  }) => void;
  onClear: () => void;
  label?: string;
  helperText?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}

export function LocationPinField({
  latitude,
  longitude,
  onPin,
  onClear,
  label = 'Exact GPS Location',
  helperText = 'Required for physical locations so students can find you accurately.',
  error,
  required = true,
  disabled = false,
}: LocationPinFieldProps) {
  const { showToast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pinning, setPinning] = useState(false);
  const [lastAccuracy, setLastAccuracy] = useState<number | null>(null);
  const [gpsNotice, setGpsNotice] = useState<string | null>(null);

  const isPinned = isValidGpsCoordinates(latitude, longitude);

  const handleConfirmPin = () => {
    setConfirmOpen(false);
    setGpsNotice(null);

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      const msg = 'Geolocation is not supported by your browser.';
      setGpsNotice(msg);
      showToast(msg, 'error');
      return;
    }

    setPinning(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const {
          latitude: lat,
          longitude: lng,
          accuracy,
        } = position.coords;

        if (!isGpsAccuracyAcceptable(accuracy)) {
          setPinning(false);
          setGpsNotice(WEAK_GPS_TOAST_MESSAGE);
          showToast(WEAK_GPS_TOAST_MESSAGE, 'error');
          return;
        }

        const roundedAcc = Math.round(accuracy);
        setLastAccuracy(roundedAcc);
        setGpsNotice(null);
        onPin({ latitude: lat, longitude: lng, accuracy: roundedAcc });
        showToast(
          `Location pinned accurately (±${roundedAcc}m).`,
          'success'
        );
        setPinning(false);
      },
      (geoErr) => {
        const msg =
          geoErr.code === geoErr.PERMISSION_DENIED
            ? 'Location permission denied. Please enable GPS access in your browser settings.'
            : geoErr.code === geoErr.TIMEOUT
              ? WEAK_GPS_TOAST_MESSAGE
              : 'Unable to lock your GPS signal right now. Please step outside and try again.';
        setGpsNotice(msg);
        showToast(msg, 'error');
        setPinning(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  const handleRemovePin = () => {
    setLastAccuracy(null);
    setGpsNotice(null);
    onClear();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="block text-sm font-medium text-slate-700">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </span>
        {isPinned && (
          <span className="text-xs font-medium text-emerald-700 inline-flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>
              Pinned{lastAccuracy !== null ? ` (±${lastAccuracy}m)` : ''}
            </span>
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <Button
          type="button"
          variant={isPinned ? 'outline' : 'secondary'}
          size="md"
          disabled={pinning || disabled}
          onClick={() => {
            if (!disabled) setConfirmOpen(true);
          }}
        >
          {pinning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Getting accurate GPS (≤{MAX_GPS_ACCURACY_METERS}m)...</span>
            </>
          ) : (
            <span>
              {isPinned ? '📍 Re-pin Exact Location' : '📍 Pin Exact Location'}
            </span>
          )}
        </Button>

        {isPinned && !disabled && (
          <button
            type="button"
            onClick={handleRemovePin}
            disabled={pinning}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-50"
          >
            <span>❌ Remove Pin</span>
          </button>
        )}
      </div>

      {isPinned && typeof latitude === 'number' && typeof longitude === 'number' && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 tabular-nums">
          <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
          <span>
            GPS Locked: {latitude.toFixed(5)}, {longitude.toFixed(5)}
            {lastAccuracy !== null ? ` (Accuracy: ±${lastAccuracy}m)` : ''}
          </span>
        </div>
      )}

      {helperText && !error && !gpsNotice && (
        <p className="text-xs text-slate-500">{helperText}</p>
      )}

      {(error || gpsNotice) && (
        <p role="alert" className="text-xs font-medium text-red-600">
          {error || gpsNotice}
        </p>
      )}

      {/* Critical GPS Pinning Warning Modal */}
      {confirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pin-location-modal-title"
          className="fixed inset-0 z-[70] bg-slate-900/55 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setConfirmOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1.5">
                <h3
                  id="pin-location-modal-title"
                  className="text-lg font-bold text-slate-900"
                >
                  Pin Your Exact Location
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  ⚠️ Please make sure you are standing exactly at the location of your shop, room, or item. Buyers will use this to find you.
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleConfirmPin}
              >
                I am here, Pin Location
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
