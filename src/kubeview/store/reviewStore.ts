/**
 * Review Store — tracks AI-proposed infrastructure changes awaiting human review.
 *
 * Persisted to localStorage so pending reviews survive page refreshes.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface DiffField {
  key: string;
  before: string;
  after: string;
}

export interface DiffData {
  before: string;
  after: string;
  fields: DiffField[];
}

export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'changes_requested';

export interface ReviewItem {
  id: string;
  title: string;
  description: string;
  riskLevel: RiskLevel;
  agentName: string;
  agentIcon: string;
  resourceType: string;
  resourceName: string;
  namespace: string;
  diff: DiffData;
  businessImpact: string;
  status: ReviewStatus;
  createdAt: number;
  reviewedAt?: number;
}

export interface ReviewFilters {
  riskLevel?: RiskLevel;
  resourceType?: string;
  namespace?: string;
  search?: string;
}

interface ReviewState {
  reviews: ReviewItem[];
  activeTab: 'pending' | 'approved' | 'rejected';
  filters: ReviewFilters;
  expandedId: string | null;

  approveReview: (id: string) => void;
  rejectReview: (id: string) => void;
  requestChanges: (id: string) => void;
  setFilter: (filters: Partial<ReviewFilters>) => void;
  setActiveTab: (tab: 'pending' | 'approved' | 'rejected') => void;
  setExpanded: (id: string | null) => void;
  loadMockData: (items: ReviewItem[]) => void;
}

function updateReviewStatus(set: (fn: (s: ReviewState) => Partial<ReviewState>) => void, id: string, status: ReviewStatus) {
  set((state) => ({
    reviews: state.reviews.map((r) =>
      r.id === id ? { ...r, status, reviewedAt: Date.now() } : r,
    ),
  }));
}

export const useReviewStore = create<ReviewState>()(
  persist(
    (set) => ({
      reviews: [],
      activeTab: 'pending',
      filters: {},
      expandedId: null,

      approveReview: (id) => updateReviewStatus(set, id, 'approved'),
      rejectReview: (id) => updateReviewStatus(set, id, 'rejected'),
      requestChanges: (id) => updateReviewStatus(set, id, 'changes_requested'),

      setFilter: (filters) =>
        set((state) => ({ filters: { ...state.filters, ...filters } })),

      setActiveTab: (tab) => set({ activeTab: tab }),

      setExpanded: (id) => set({ expandedId: id }),

      loadMockData: (items) =>
        set((state) => {
          if (state.reviews.length > 0) return state;
          return { reviews: items };
        }),
    }),
    {
      name: 'openshiftpulse-reviews',
      partialize: (state) => ({
        reviews: state.reviews,
        activeTab: state.activeTab,
      }),
    },
  ),
);
