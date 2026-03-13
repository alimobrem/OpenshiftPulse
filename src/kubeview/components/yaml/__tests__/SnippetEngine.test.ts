import { describe, it, expect } from 'vitest';
import { snippets, getSnippetSuggestions, resolveSnippet } from '../SnippetEngine';

describe('SnippetEngine', () => {
  it('should have built-in snippets', () => {
    expect(snippets.length).toBeGreaterThan(0);
    expect(snippets.find(s => s.prefix === 'deploy')).toBeDefined();
    expect(snippets.find(s => s.prefix === 'svc')).toBeDefined();
    expect(snippets.find(s => s.prefix === 'ing')).toBeDefined();
  });

  it('should get snippet suggestions by prefix', () => {
    const results = getSnippetSuggestions('deploy');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].prefix).toBe('deploy');
  });

  it('should get snippet suggestions by partial match', () => {
    const results = getSnippetSuggestions('serv');
    expect(results.some(s => s.prefix === 'svc')).toBe(true);
    expect(results.some(s => s.prefix === 'sa')).toBe(true);
  });

  it('should resolve snippet placeholders', () => {
    const snippet = snippets.find(s => s.prefix === 'ns');
    expect(snippet).toBeDefined();

    const resolved = resolveSnippet(snippet!);
    expect(resolved).toContain('kind: Namespace');
    expect(resolved).toContain('name: my-namespace');
    expect(resolved).not.toContain('${');
  });

  it('should have all required snippet types', () => {
    const requiredPrefixes = ['deploy', 'svc', 'ing', 'pvc', 'cm', 'secret', 'rb', 'cj', 'hpa', 'ns', 'sa', 'np'];
    for (const prefix of requiredPrefixes) {
      expect(snippets.find(s => s.prefix === prefix)).toBeDefined();
    }
  });

  it('deployment snippet should have correct structure', () => {
    const deploy = snippets.find(s => s.prefix === 'deploy');
    expect(deploy).toBeDefined();
    expect(deploy!.body).toContain('apiVersion: apps/v1');
    expect(deploy!.body).toContain('kind: Deployment');
    expect(deploy!.body).toContain('replicas:');
    expect(deploy!.body).toContain('selector:');
    expect(deploy!.body).toContain('template:');
  });

  it('service snippet should have correct structure', () => {
    const svc = snippets.find(s => s.prefix === 'svc');
    expect(svc).toBeDefined();
    expect(svc!.body).toContain('apiVersion: v1');
    expect(svc!.body).toContain('kind: Service');
    expect(svc!.body).toContain('type: ClusterIP');
    expect(svc!.body).toContain('selector:');
    expect(svc!.body).toContain('ports:');
  });

  it('should return empty array for no matches', () => {
    const results = getSnippetSuggestions('nonexistent-xyz-123');
    expect(results).toEqual([]);
  });
});
