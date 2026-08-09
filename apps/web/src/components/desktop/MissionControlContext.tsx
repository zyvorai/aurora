'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

interface MissionControlContextValue {
  open: boolean;
  openMissionControl: () => void;
  closeMissionControl: () => void;
}

const MissionControlContext = createContext<MissionControlContextValue | null>(null);

const EVENT_NAME = 'emissary-open-mission-control';
const SESSION_KEY = 'desktop_mission_control_open';

/** Dispatch this from anywhere (e.g. a global F3 listener) without needing a hook. */
export function dispatchOpenMissionControl() {
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function MissionControlProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mission') === '1' || sessionStorage.getItem(SESSION_KEY) === '1') {
      setOpen(true);
    }
    function onEvent() {
      setOpen(true);
    }
    window.addEventListener(EVENT_NAME, onEvent);
    return () => window.removeEventListener(EVENT_NAME, onEvent);
  }, []);

  const openMissionControl = useCallback(() => {
    setOpen(true);
    sessionStorage.setItem(SESSION_KEY, '1');
  }, []);

  const closeMissionControl = useCallback(() => {
    setOpen(false);
    sessionStorage.removeItem(SESSION_KEY);
  }, []);

  return (
    <MissionControlContext.Provider value={{ open, openMissionControl, closeMissionControl }}>
      {children}
    </MissionControlContext.Provider>
  );
}

export function useMissionControl(): MissionControlContextValue {
  const ctx = useContext(MissionControlContext);
  if (!ctx) throw new Error('useMissionControl must be used within MissionControlProvider');
  return ctx;
}
