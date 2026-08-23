'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface Options {
  storageKey: string;
  defaultWidth: number;
  min: number;
  max: number;
  collapsedWidth?: number;
  /** Which edge the drag handle sits on -- 'right' (rail: dragging right grows it)
   * or 'left' (dock: dragging left grows it, since the handle is its left edge). */
  handleSide: 'left' | 'right';
}

/** Shared resize/collapse behavior for the console's left rail and right run-log
 * dock -- width and collapsed state persist per-browser via localStorage (a
 * per-viewer convenience, not app data, so localStorage is the right fit here). */
export function useResizableRail({ storageKey, defaultWidth, min, max, collapsedWidth = 56, handleSide }: Options) {
  const [width, setWidth] = useState(defaultWidth);
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const dragging = useRef(false);

  useEffect(() => {
    try {
      const storedWidth = localStorage.getItem(`${storageKey}-width`);
      const storedCollapsed = localStorage.getItem(`${storageKey}-collapsed`);
      if (storedWidth) setWidth(Math.min(max, Math.max(min, parseInt(storedWidth, 10))));
      if (storedCollapsed) setCollapsed(storedCollapsed === '1');
    } catch {
      // localStorage unavailable (private mode, etc) -- defaults stand
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(`${storageKey}-width`, String(width));
    } catch {
      // ignore
    }
  }, [hydrated, storageKey, width]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(`${storageKey}-collapsed`, collapsed ? '1' : '0');
    } catch {
      // ignore
    }
  }, [hydrated, storageKey, collapsed]);

  const startDrag = useCallback(
    (e: React.MouseEvent) => {
      if (collapsed) return;
      e.preventDefault();
      dragging.current = true;
      const startX = e.clientX;
      const startWidth = width;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      function onMove(ev: MouseEvent) {
        const raw = handleSide === 'right' ? ev.clientX - startX : startX - ev.clientX;
        setWidth(Math.min(max, Math.max(min, startWidth + raw)));
      }
      function onUp() {
        dragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      }
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [collapsed, width, min, max, handleSide],
  );

  return {
    width,
    collapsed,
    setCollapsed,
    effectiveWidth: collapsed ? collapsedWidth : width,
    startDrag,
  };
}
