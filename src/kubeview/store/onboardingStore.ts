/**
 * Onboarding Store — tracks first-run state for AI features.
 * Persisted to localStorage so onboarding hints show once.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface OnboardingState {
  /** Whether the user has seen the main AI onboarding card */
  aiOnboardingSeen: boolean;
  /** Dismiss the onboarding (set to seen) */
  dismissOnboarding: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      aiOnboardingSeen: false,
      dismissOnboarding: () => set({ aiOnboardingSeen: true }),
    }),
    { name: 'openshiftpulse-onboarding' },
  ),
);
