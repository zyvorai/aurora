'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './marketing.module.css';

type Variant = 'home' | 'features';

export function MarketingHeroActions({ variant }: { variant: Variant }) {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    setAuthed(!!localStorage.getItem('token'));
  }, []);

  if (authed) {
    return (
      <div className={styles.heroBtnrow}>
        <Link href="/dashboard" className={styles.btnPrimary}>
          Dashboard
        </Link>
        {variant === 'home' ? (
          <Link href="/features" className={styles.linkCta}>
            Learn more <span aria-hidden>›</span>
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className={styles.heroBtnrow}>
      <Link href="/login" className={styles.btnPrimary}>
        Get started
      </Link>
      {variant === 'home' ? (
        <Link href="/features" className={styles.linkCta}>
          Learn more <span aria-hidden>›</span>
        </Link>
      ) : (
        <Link href="/login" className={styles.linkCta}>
          Sign in <span aria-hidden>›</span>
        </Link>
      )}
    </div>
  );
}

export function MarketingBottomCta() {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    setAuthed(!!localStorage.getItem('token'));
  }, []);

  return (
    <Link href={authed ? '/dashboard' : '/login'} className={styles.btnPrimary}>
      {authed ? 'Open dashboard' : 'Get started'}
    </Link>
  );
}
