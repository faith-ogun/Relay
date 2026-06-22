import React, { useState } from 'react';
import { ArrowLeft, Download, CreditCard, ShieldCheck, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useIdentity } from '../hooks/useIdentity';
import { usePlan } from '../hooks/usePlan';
import { PLAN_META } from './ohmlet/entitlements';
import { openBillingPortal } from '../services/billing';
import { exportMyData, deleteMyAccount } from '../services/privacy';

interface AccountPageProps {
  onBack: () => void;
  onUpgrade: () => void;
}

export const AccountPage: React.FC<AccountPageProps> = ({ onBack, onUpgrade }) => {
  const { user, signOut } = useAuth();
  const { userId } = useIdentity();
  const { plan } = usePlan(userId);
  const planMeta = PLAN_META[plan];
  const isFree = plan === 'free';

  const [exporting, setExporting] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleExport = async () => {
    setExporting(true);
    setNotice(null);
    const ok = await exportMyData();
    setExporting(false);
    setNotice(ok ? 'Your data is downloading as a JSON file.' : 'Could not export right now. Please try again.');
  };

  const handlePortal = async () => {
    setPortalBusy(true);
    const ok = await openBillingPortal();
    if (!ok) {
      setPortalBusy(false);
      setNotice('Could not open billing. Please try again.');
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    const ok = await deleteMyAccount();
    if (!ok) {
      setDeleting(false);
      setDeleteError('We could not delete your account. Please contact hello@ohmlet.org.');
      return;
    }
    await signOut().catch(() => {});
    window.location.assign('/');
  };

  return (
    <div className="min-h-screen bg-ohmlet-cream font-display text-ohmlet-ink">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-black text-ohmlet-ink-soft transition-colors hover:text-ohmlet-ink"
        >
          <ArrowLeft className="h-4 w-4" /> Back to workspace
        </button>

        <h1 className="mt-6 text-4xl font-black tracking-[-0.03em]">Account</h1>

        {/* Profile + plan */}
        <section className="mt-6 rounded-[1.4rem] border-[2.5px] border-ohmlet-ink bg-white p-6 shadow-press-sm">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-ohmlet-ink-soft">Signed in as</p>
          <p className="mt-1 text-lg font-black">{user?.email || user?.displayName || 'Your account'}</p>
          <div className="mt-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-ohmlet-ink-soft">Plan</p>
              <p className="mt-1 text-base font-black capitalize">{planMeta.label}</p>
            </div>
            {isFree ? (
              <button
                onClick={onUpgrade}
                className="rounded-2xl border-[2.5px] border-ohmlet-ink bg-ohmlet-gold px-5 py-2.5 text-sm font-black shadow-press-sm transition-all hover:translate-y-[2px] hover:shadow-none"
              >
                Upgrade
              </button>
            ) : (
              <button
                onClick={handlePortal}
                disabled={portalBusy}
                className="inline-flex items-center gap-2 rounded-2xl border-[2.5px] border-ohmlet-ink bg-white px-5 py-2.5 text-sm font-black shadow-press-sm transition-all enabled:hover:translate-y-[2px] enabled:hover:shadow-none disabled:opacity-60"
              >
                {portalBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                Manage billing
              </button>
            )}
          </div>
        </section>

        {/* Privacy & data */}
        <section className="mt-5 rounded-[1.4rem] border-2 border-ohmlet-line bg-white p-6 shadow-soft">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-ohmlet-green" />
            <h2 className="text-lg font-black">Your data &amp; privacy</h2>
          </div>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-ohmlet-ink-soft">
            Download everything we hold about you, or permanently delete your account. You're in control.
          </p>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="mt-4 inline-flex items-center gap-2 rounded-2xl border-2 border-ohmlet-ink bg-ohmlet-cream px-5 py-2.5 text-sm font-black transition-all enabled:hover:bg-ohmlet-line disabled:opacity-60"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download my data
          </button>
          {notice && <p className="mt-3 text-xs font-bold text-ohmlet-ink-soft">{notice}</p>}
        </section>

        {/* Danger zone */}
        <section className="mt-5 rounded-[1.4rem] border-2 border-ohmlet-red/40 bg-ohmlet-red/[0.04] p-6">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-ohmlet-red" />
            <h2 className="text-lg font-black text-ohmlet-red">Delete account</h2>
          </div>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-ohmlet-ink-soft">
            Permanently deletes your account, learning progress, and personal data, and cancels any subscription. This
            cannot be undone.
          </p>
          <button
            onClick={() => { setConfirmOpen(true); setConfirmText(''); setDeleteError(null); }}
            className="mt-4 inline-flex items-center gap-2 rounded-2xl border-[2.5px] border-ohmlet-red bg-white px-5 py-2.5 text-sm font-black text-ohmlet-red shadow-press-sm transition-all hover:translate-y-[2px] hover:shadow-none"
          >
            <Trash2 className="h-4 w-4" /> Delete my account
          </button>
        </section>
      </div>

      {/* Confirmation modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ohmlet-ink/40 px-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[1.6rem] border-[2.5px] border-ohmlet-ink bg-white p-7 shadow-press">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-ohmlet-red" />
              <h3 className="text-xl font-black">Delete your account?</h3>
            </div>
            <p className="mt-3 text-sm font-semibold leading-relaxed text-ohmlet-ink-soft">
              This is permanent. To confirm, type <span className="font-black text-ohmlet-ink">DELETE</span> below.
            </p>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              autoFocus
              className="mt-4 w-full rounded-xl border-2 border-ohmlet-ink bg-ohmlet-cream px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-ohmlet-red"
            />
            {deleteError && <p className="mt-3 text-xs font-bold text-ohmlet-red">{deleteError}</p>}
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmOpen(false)}
                disabled={deleting}
                className="rounded-2xl px-4 py-2.5 text-sm font-black text-ohmlet-ink-soft transition-colors hover:text-ohmlet-ink disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={confirmText.trim() !== 'DELETE' || deleting}
                className="inline-flex items-center gap-2 rounded-2xl border-[2.5px] border-ohmlet-red bg-ohmlet-red px-5 py-2.5 text-sm font-black text-white shadow-press-sm transition-all enabled:hover:translate-y-[2px] enabled:hover:shadow-none disabled:opacity-50"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete forever
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
