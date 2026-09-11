import React from 'react';
import { Github, Heart, X } from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import { SUPPORT_LINKS } from '../config/support';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Standalone support sheet — opened from the sidebar under Settings. */
export const SupportModal: React.FC<SupportModalProps> = ({ isOpen, onClose }) => {
  const { t } = useI18n();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-white/5">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-bold text-zinc-900 dark:text-white">{t('supportTitle')}</h3>
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{t('supportSectionHint')}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 transition-colors hover:bg-zinc-100 dark:hover:bg-white/5">
            <X size={20} className="text-zinc-500" />
          </button>
        </div>

        <div className="space-y-5 p-5 text-sm text-zinc-600 dark:text-zinc-400">
          <p className="leading-6">{t('supportBody')}</p>
          <div className="flex flex-col gap-3">
            {SUPPORT_LINKS.githubSponsors && (
              <a
                href={SUPPORT_LINKS.githubSponsors}
                target="_blank"
                rel="noopener noreferrer"
                className="support-rainbow-btn inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-bold tracking-wide text-white"
              >
                <Heart size={16} className="shrink-0 fill-white" />
                {t('supportGithubSponsors')}
              </a>
            )}
            {SUPPORT_LINKS.repository && (
              <a
                href={SUPPORT_LINKS.repository}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-300 px-4 py-2.5 text-xs font-medium text-zinc-600 transition-colors hover:border-zinc-400 dark:border-white/15 dark:text-zinc-300"
              >
                <Github size={14} />
                {t('supportStarRepo')}
              </a>
            )}
          </div>
          <p className="text-xs leading-5 text-zinc-500">{t('supportThanks')}</p>
        </div>
      </div>
    </div>
  );
};
