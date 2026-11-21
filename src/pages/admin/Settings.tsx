import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Settings, ShieldAlert, Wrench } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  subscribeToPlatformSettings,
  updateMaintenanceMode,
} from '../../lib/platformSettingsService';
import { useLoadCap } from '../../lib/loadTimeout';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { Card } from '../../components/ui/Card';

export function AdminSettings() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useLoadCap(loading, () => setLoading(false));

  useEffect(() => {
    const unsubscribe = subscribeToPlatformSettings(
      (settings) => {
        setMaintenanceMode(settings.maintenanceMode);
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        showToast(
          err.message || 'Unable to load platform settings.',
          'error'
        );
      }
    );

    return () => unsubscribe();
  }, [showToast]);

  const handleToggleMaintenance = async () => {
    if (saving || loading) return;
    const nextValue = !maintenanceMode;
    setSaving(true);
    try {
      await updateMaintenanceMode(nextValue, user?.email);
      setMaintenanceMode(nextValue);
      showToast(
        nextValue
          ? 'Maintenance Mode enabled. Public visitors see the maintenance screen.'
          : 'Maintenance Mode disabled. Platform is live for all users.',
        nextValue ? 'info' : 'success'
      );
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : 'Failed to update Maintenance Mode.',
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout
      title="Platform Settings"
      subtitle="Control global platform availability and maintenance mode across LASUEDPLUG."
    >
      <div className="space-y-6">
        <Card hoverable={false} className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                  maintenanceMode
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-emerald-50 text-emerald-700'
                }`}
              >
                {maintenanceMode ? (
                  <Wrench className="w-5 h-5" aria-hidden="true" />
                ) : (
                  <Settings className="w-5 h-5" aria-hidden="true" />
                )}
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900">
                    Maintenance Mode
                  </h2>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold ${
                      maintenanceMode
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {maintenanceMode ? 'Active' : 'Site Live'}
                  </span>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed max-w-xl">
                  When enabled, public visitors and regular student accounts see a
                  full-screen &ldquo;We&apos;ll be right back&rdquo; maintenance notice.
                  Your verified Admin session keeps full access so you can finish
                  updates and turn Maintenance Mode back off.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-start sm:self-center shrink-0">
              <button
                type="button"
                role="switch"
                aria-checked={maintenanceMode}
                aria-label="Toggle Maintenance Mode"
                disabled={loading || saving}
                onClick={() => void handleToggleMaintenance()}
                className={`relative inline-flex h-8 w-14 min-h-[44px] items-center rounded-full px-1 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 ${
                  maintenanceMode ? 'bg-amber-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform duration-200 ${
                    maintenanceMode ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className="text-sm font-semibold text-slate-800 min-w-[68px]">
                {loading
                  ? 'Loading...'
                  : saving
                  ? 'Saving...'
                  : maintenanceMode
                  ? 'On'
                  : 'Off'}
              </span>
            </div>
          </div>

          <div
            className={`rounded-xl border p-4 flex items-start gap-3 text-sm ${
              maintenanceMode
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            {maintenanceMode ? (
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            )}
            <p className="leading-relaxed">
              {maintenanceMode
                ? 'Maintenance Mode is currently ON. Non-admin users cannot browse listings or submit forms until you switch this back off.'
                : 'LASUEDPLUG is currently open to all students and visitors.'}
            </p>
          </div>
        </Card>

        <Card hoverable={false} className="bg-slate-50 border-slate-200 space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <ShieldAlert className="w-4 h-4 text-primary-600" aria-hidden="true" />
            <span>Firestore Security Enforcement</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Settings are stored at <code className="font-mono text-xs bg-white px-1.5 py-0.5 rounded border border-slate-200">platform_settings/global</code> and write-locked exclusively to the verified Admin account.
          </p>
        </Card>
      </div>
    </AdminLayout>
  );
}
