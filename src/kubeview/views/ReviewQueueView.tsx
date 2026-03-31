import React, { useEffect, useMemo } from 'react';
import { GitPullRequest, Search, Filter, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useReviewStore } from '../store/reviewStore';
import type { ReviewFilters, ReviewItem, RiskLevel } from '../store/reviewStore';
import { REVIEW_MOCK_DATA } from '../engine/mockData/reviewMocks';
import { ReviewCard } from './reviews/ReviewCard';

const TABS = [
  { key: 'pending' as const, label: 'Pending' },
  { key: 'approved' as const, label: 'Approved' },
  { key: 'rejected' as const, label: 'Rejected' },
];

const RISK_OPTIONS: Array<{ value: RiskLevel | ''; label: string }> = [
  { value: '', label: 'All risks' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

function applyFilters(reviews: ReviewItem[], filters: ReviewFilters, tab: string): ReviewItem[] {
  return reviews.filter((r) => {
    // Tab filter
    if (tab === 'pending' && r.status !== 'pending' && r.status !== 'changes_requested') return false;
    if (tab === 'approved' && r.status !== 'approved') return false;
    if (tab === 'rejected' && r.status !== 'rejected') return false;

    // Risk filter
    if (filters.riskLevel && r.riskLevel !== filters.riskLevel) return false;

    // Search filter
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const searchable = `${r.title} ${r.resourceName} ${r.namespace} ${r.resourceType}`.toLowerCase();
      if (!searchable.includes(q)) return false;
    }

    return true;
  });
}

export default function ReviewQueueView() {
  const reviews = useReviewStore((s) => s.reviews);
  const activeTab = useReviewStore((s) => s.activeTab);
  const filters = useReviewStore((s) => s.filters);
  const setActiveTab = useReviewStore((s) => s.setActiveTab);
  const setFilter = useReviewStore((s) => s.setFilter);
  const loadMockData = useReviewStore((s) => s.loadMockData);

  // Load mock data on first mount
  useEffect(() => {
    loadMockData(REVIEW_MOCK_DATA);
  }, [loadMockData]);

  const filtered = useMemo(
    () => applyFilters(reviews, filters, activeTab),
    [reviews, filters, activeTab],
  );

  const tabCounts = useMemo(() => {
    let pending = 0, approved = 0, rejected = 0;
    for (const r of reviews) {
      if (r.status === 'pending' || r.status === 'changes_requested') pending++;
      else if (r.status === 'approved') approved++;
      else if (r.status === 'rejected') rejected++;
    }
    return { pending, approved, rejected };
  }, [reviews]);

  return (
    <div className="h-full overflow-auto bg-slate-950">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <GitPullRequest className="w-6 h-6 text-violet-400" />
          <div>
            <h1 className="text-xl font-bold text-slate-100">Review Queue</h1>
            <p className="text-sm text-slate-500">AI-proposed infrastructure changes awaiting your review</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-slate-800">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.key
                  ? 'border-violet-500 text-violet-400'
                  : 'border-transparent text-slate-500 hover:text-slate-300',
              )}
            >
              {tab.label}
              {tabCounts[tab.key] > 0 && (
                <span className={cn(
                  'ml-1.5 px-1.5 py-0.5 rounded-full text-xs',
                  activeTab === tab.key ? 'bg-violet-500/20 text-violet-400' : 'bg-slate-800 text-slate-500',
                )}>
                  {tabCounts[tab.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search reviews..."
              value={filters.search || ''}
              onChange={(e) => setFilter({ search: e.target.value || undefined })}
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-slate-600"
            />
          </div>

          {/* Risk filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <select
              value={filters.riskLevel || ''}
              onChange={(e) => setFilter({ riskLevel: (e.target.value || undefined) as RiskLevel | undefined })}
              className="pl-8 pr-6 py-2 rounded-lg bg-slate-900 border border-slate-800 text-sm text-slate-300 appearance-none focus:outline-none focus:border-slate-600"
            >
              {RISK_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Review list */}
        {filtered.length > 0 ? (
          <div className="space-y-2">
            {filtered.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <Inbox className="w-10 h-10 mb-3 text-slate-700" />
            <p className="text-sm font-medium">No reviews found</p>
            <p className="text-xs mt-1">
              {activeTab === 'pending'
                ? 'All caught up — no changes awaiting review.'
                : `No ${activeTab} reviews match the current filters.`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
