import type { ReactNode } from 'react';
import { type ColumnDef, type K8sResource, getDefaultColumns } from '../renderers/index';

export interface DetailSection {
  id: string;
  title: string;
  priority: number;   // ordering
  render: (resource: K8sResource) => ReactNode;
}

export interface InlineAction {
  id: string;
  label: string;
  icon: string;
  render: (resource: K8sResource, onAction: (action: string, payload?: unknown) => void) => ReactNode;
}

export interface ResourceEnhancer {
  // GVR patterns this enhancer handles (can use wildcards)
  matches: string[];   // e.g., ["apps/v1/deployments", "v1/pods"]

  // Additional columns for list view
  columns: ColumnDef[];

  // Additional detail sections
  detailSections?: DetailSection[];

  // Inline actions for list view rows
  inlineActions?: InlineAction[];

  // Default sort column
  defaultSort?: { column: string; direction: 'asc' | 'desc' };
}

// Built-in enhancers registry
const enhancers: ResourceEnhancer[] = [];

export function registerEnhancer(enhancer: ResourceEnhancer): void {
  enhancers.push(enhancer);
}

// Match GVR key against patterns (supports wildcards)
function matchesPattern(gvrKey: string, pattern: string): boolean {
  // Exact match
  if (gvrKey === pattern) return true;

  // Wildcard matching
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
  return regex.test(gvrKey);
}

export function getEnhancer(gvrKey: string): ResourceEnhancer | undefined {
  return enhancers.find((e) => e.matches.some((pattern) => matchesPattern(gvrKey, pattern)));
}

export function getColumnsForResource(gvrKey: string, namespaced: boolean): ColumnDef[] {
  const enhancer = getEnhancer(gvrKey);

  const defaultCols = getDefaultColumns(namespaced);

  if (!enhancer) {
    return defaultCols;
  }

  // Merge enhancer columns with defaults
  // Enhancer columns are inserted before the "Age" column
  const ageIndex = defaultCols.findIndex((c: { id: string }) => c.id === 'age');

  if (ageIndex === -1) {
    return [...defaultCols, ...enhancer.columns];
  }

  return [
    ...defaultCols.slice(0, ageIndex),
    ...enhancer.columns,
    ...defaultCols.slice(ageIndex),
  ];
}
