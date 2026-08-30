import type { ReactNode } from 'react';
import Link from 'next/link';
import styles from './PortalAuthShell.module.css';

export function PortalAuthShell({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.shell}>
      <div className={styles.atmosphere} aria-hidden />
      <div className={styles.inner}>
        <Link href="/" className={styles.wordmark}>
          Aurora
        </Link>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1 className={styles.title}>{title}</h1>
        <div className={styles.panel}>{children}</div>
      </div>
    </div>
  );
}
