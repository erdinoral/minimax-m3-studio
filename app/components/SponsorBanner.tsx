import React, { useEffect, useState } from 'react';
import { useI18n } from '../context/I18nContext';
import { SPONSORS, SUPPORT_LINKS } from '../config/support';

const FIRST_DELAY_MS = 1000;
const EVERY_MS = 10000;
const VISIBLE_MS = 7000;

/** Neon sign above the player: thanks each sponsor in turn, then asks for support. */
export const SponsorBanner: React.FC = () => {
  const { t } = useI18n();
  const [turn, setTurn] = useState(-1);
  const [showing, setShowing] = useState(false);

  useEffect(() => {
    let hideTimer: number | undefined;
    const show = () => {
      if (document.hidden) return;
      setTurn((previous) => previous + 1);
      setShowing(true);
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => setShowing(false), VISIBLE_MS);
    };
    const first = window.setTimeout(show, FIRST_DELAY_MS);
    const every = window.setInterval(show, EVERY_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(every);
      window.clearTimeout(hideTimer);
    };
  }, []);

  const position = turn < 0 ? 0 : turn % (SPONSORS.length + 1);
  const sponsor = SPONSORS[position];
  const message = sponsor
    ? t(sponsor.first ? 'sponsorBannerFirst' : 'sponsorBannerThanks')
        .replace('{name}', sponsor.name)
        .replace('{amount}', sponsor.amount)
    : t('sponsorBannerCall');

  return (
    <a
      href={SUPPORT_LINKS.buyMeACoffee}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Buy me a coffee"
      className={`sponsor-banner${showing ? ' is-showing' : ''}`}
    >
      {turn >= 0 && (
        <span key={turn} className="sponsor-banner-message">
          {message}
        </span>
      )}
    </a>
  );
};
