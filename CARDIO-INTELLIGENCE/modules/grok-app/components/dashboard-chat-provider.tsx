"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type DashboardChatContextValue = {
  open: boolean;
  toggle: () => void;
  openChat: () => void;
  close: () => void;
};

const DashboardChatContext = createContext<DashboardChatContextValue | null>(
  null,
);

export function DashboardChatProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((o) => !o), []);
  const openChat = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);
  const value = useMemo(
    () => ({ open, toggle, openChat, close }),
    [open, toggle, openChat, close],
  );
  return (
    <DashboardChatContext.Provider value={value}>
      {children}
    </DashboardChatContext.Provider>
  );
}

export function useDashboardChat() {
  const ctx = useContext(DashboardChatContext);
  if (!ctx)
    throw new Error(
      "useDashboardChat must be used within DashboardChatProvider",
    );
  return ctx;
}
