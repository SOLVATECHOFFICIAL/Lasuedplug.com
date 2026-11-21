import { useState } from 'react';
import { Flag, Loader2, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { submitReport } from '../../lib/adminService';
import { Button } from '../ui/Button';

interface ReportUserModalProps {
  open: boolean;
  targetUserId: string;
  targetUserName: string;
  onClose: () => void;
  onReported?: () => void;
}

export function ReportUserModal({
  open,
  targetUserId,
  targetUserName,
  onClose,
  onReported,
}: ReportUserModalProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!user?.uid || !targetUserId.trim() || submitting) return;
    setSubmitting(true);
    try {
      await submitReport({
        reporterId: user.uid,
        targetId: targetUserId.trim(),
        targetType: 'user',
        reason,
      });
      setReason('');
      showToast(
        'User report submitted. LASUEDPLUG Admins will review it shortly.',
        'success'
      );
      onReported?.();
      onClose();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Unable to submit user report.',
        'error'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-user-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
      onClick={() => !submitting && onClose()}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0">
              <Flag className="w-4 h-4" />
            </div>
            <h2
              id="report-user-modal-title"
              className="text-lg font-bold text-slate-900"
            >
              Report User
            </h2>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            aria-label="Close report user modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Report <span className="font-semibold text-slate-900">{targetUserName}</span>{' '}
          to LASUEDPLUG Admins if you suspect fraud, impersonation, harassment, or unsafe conduct.
        </p>

        <textarea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Describe why you are reporting this user..."
          className="block w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />

        <div className="flex items-center justify-end gap-2.5 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={submitting}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            disabled={submitting || reason.trim().length < 5}
            onClick={() => void handleSubmit()}
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Submitting...</span>
              </>
            ) : (
              <span>Submit Report</span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
