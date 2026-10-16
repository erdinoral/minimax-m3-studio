import React from 'react';
import { Bug, Github, Lightbulb, X } from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import { SPONSORS, SUPPORT_LINKS } from '../config/support';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CARD = 'rounded-xl border border-zinc-200 p-4 dark:border-white/10';
const SECONDARY =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-300 px-4 py-2.5 text-xs font-medium text-zinc-600 transition-colors hover:border-zinc-400 dark:border-white/15 dark:text-zinc-300';

/** Standalone support sheet — opened from the sidebar under Settings. */
export const SupportModal: React.FC<SupportModalProps> = ({ isOpen, onClose }) => {
  const { t } = useI18n();
  if (!isOpen) return null;

  const first = SPONSORS.find((sponsor) => sponsor.first);
  const others = SPONSORS.filter((sponsor) => !sponsor.first);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-white/5">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-bold text-zinc-900 dark:text-white">{t('support')}</h3>
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{t('supportSectionHint')}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 transition-colors hover:bg-zinc-100 dark:hover:bg-white/5">
            <X size={20} className="text-zinc-500" />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto p-5 text-sm text-zinc-600 dark:text-zinc-400">
          <section className="space-y-4">
            <h4 className="font-semibold text-zinc-900 dark:text-white">{t('supportTitle')}</h4>
            <p className="leading-6">{t('supportBody')}</p>
            <a
              href={SUPPORT_LINKS.buyMeACoffee}
              target="_blank"
              rel="noopener noreferrer"
              className="support-rainbow-btn flex items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-bold tracking-wide text-white"
            >
              ☕ Buy me a coffee
            </a>

            <div className="space-y-2">
              <h4 className="font-semibold text-zinc-900 dark:text-white">{t('supportSponsorsTitle')}</h4>
              {first && (
                <article className={CARD}>
                  <p>
                    <strong className="text-zinc-900 dark:text-white">{first.name}</strong>
                    <span className="text-zinc-500"> · {first.amount}</span>
                  </p>
                  <p className="mt-1 text-xs leading-5">{t('supportFirstSponsor')}</p>
                </article>
              )}
              {others.length > 0 && (
                <p className="text-xs leading-5">
                  {others.map((sponsor) => `${sponsor.name} · ${sponsor.amount}`).join('  ·  ')}
                </p>
              )}
            </div>

            <p className="text-xs leading-5 text-zinc-500">{t('supportThanks')}</p>
            {SUPPORT_LINKS.repository && (
              <a href={SUPPORT_LINKS.repository} target="_blank" rel="noopener noreferrer" className={SECONDARY}>
                <Github size={14} />
                {t('supportStarRepo')}
              </a>
            )}
          </section>

          <section className="space-y-3 border-t border-zinc-200 pt-5 dark:border-white/5">
            <p className="text-xs leading-5">{t('supportIntro')}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <article className={`${CARD} flex flex-col gap-3`}>
                <h4 className="font-semibold text-zinc-900 dark:text-white">{t('supportBugTitle')}</h4>
                <p className="flex-1 text-xs leading-5">{t('supportBugText')}</p>
                <a href={SUPPORT_LINKS.newBug} target="_blank" rel="noopener noreferrer" className={SECONDARY}>
                  <Bug size={14} />
                  {t('supportBugButton')}
                </a>
              </article>
              <article className={`${CARD} flex flex-col gap-3`}>
                <h4 className="font-semibold text-zinc-900 dark:text-white">{t('supportIdeaTitle')}</h4>
                <p className="flex-1 text-xs leading-5">{t('supportIdeaText')}</p>
                <a href={SUPPORT_LINKS.newIdea} target="_blank" rel="noopener noreferrer" className={SECONDARY}>
                  <Lightbulb size={14} />
                  {t('supportIdeaButton')}
                </a>
              </article>
            </div>
            <p className="text-xs text-zinc-500">
              {t('supportOpenIssues')}:{' '}
              <a href={SUPPORT_LINKS.issues} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-brand">
                {SUPPORT_LINKS.issues.replace('https://', '')}
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};
