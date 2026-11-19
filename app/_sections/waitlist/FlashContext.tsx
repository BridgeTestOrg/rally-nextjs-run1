"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { WaitlistState } from "@/lib/waitlist";

const IDLE: WaitlistState = { status: "idle" };

const WaitlistFlashContext = createContext<WaitlistState>(IDLE);

/** Hands the result of a no-JavaScript post, read from the cookie, to the form. */
export function WaitlistFlashProvider({
  state,
  children,
}: {
  state: WaitlistState | null;
  children: ReactNode;
}) {
  return (
    <WaitlistFlashContext value={state ?? IDLE}>{children}</WaitlistFlashContext>
  );
}

export function useWaitlistFlash(): WaitlistState {
  return useContext(WaitlistFlashContext);
}
