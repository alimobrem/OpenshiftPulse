import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('FleetView navigation links', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../FleetView.tsx'), 'utf-8'
  );

  it('has Resources navigation link to fleet resource browser', () => {
    expect(source).toContain('/fleet/r/apps~v1~deployments');
    expect(source).toContain('Resources');
  });

  it('has Workloads navigation link', () => {
    expect(source).toContain('/fleet/workloads');
    expect(source).toContain('Workloads');
  });

  it('has Alerts navigation link', () => {
    expect(source).toContain('/fleet/alerts');
    expect(source).toContain('Alerts');
  });

  it('has Compare navigation link', () => {
    expect(source).toContain('/fleet/compare');
    expect(source).toContain('Compare');
  });

  it('imports navigation icons', () => {
    expect(source).toContain('Layers');
    expect(source).toContain('Bell');
    expect(source).toContain('GitCompare');
    expect(source).toContain('Box');
  });
});
