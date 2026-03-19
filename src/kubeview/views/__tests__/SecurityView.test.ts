import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(__dirname, '../SecurityView.tsx'), 'utf-8');

describe('SecurityView', () => {
  describe('security audit checks', () => {
    it('checks identity provider configuration', () => {
      expect(source).toContain('Identity Provider configured');
      expect(source).toContain('identityProviders');
    });

    it('checks kubeadmin removal', () => {
      expect(source).toContain('kubeadmin user removed');
      expect(source).toContain('kubeadminExists');
    });

    it('checks TLS security profile', () => {
      expect(source).toContain('TLS security profile');
      expect(source).toContain('tlsProfile');
    });

    it('checks encryption at rest', () => {
      expect(source).toContain('Encryption at rest');
      expect(source).toContain('encryptionType');
    });

    it('checks cluster-admin access', () => {
      expect(source).toContain('Cluster-admin access limited');
      expect(source).toContain('clusterAdmins');
    });

    it('checks network policies in user namespaces', () => {
      expect(source).toContain('Network policies in user namespaces');
      expect(source).toContain('unprotectedNamespaces');
    });

    it('checks SCCs', () => {
      expect(source).toContain('Privileged SCCs tracked');
      expect(source).toContain('securitycontextconstraints');
    });

    it('checks TLS certificates', () => {
      expect(source).toContain('TLS certificates managed');
    });

    it('shows pass/fail count', () => {
      expect(source).toContain('passCount');
      expect(source).toContain('checks passing');
    });
  });

  describe('cluster-admin tracking', () => {
    it('lists non-system cluster-admin subjects', () => {
      expect(source).toContain("roleRef?.name !== 'cluster-admin'");
      expect(source).toContain("bn.startsWith('system:')");
    });

    it('shows subject kind badges', () => {
      expect(source).toContain('admin.kind');
      expect(source).toContain('admin.name');
    });
  });

  describe('SCCs', () => {
    it('shows SCC table with security flags', () => {
      expect(source).toContain('allowPrivilegedContainer');
      expect(source).toContain('allowHostNetwork');
      expect(source).toContain('allowHostPID');
    });

    it('is collapsible', () => {
      expect(source).toContain('setExpanded');
    });
  });

  describe('unprotected namespaces', () => {
    it('shows namespaces without network policies', () => {
      expect(source).toContain('Without Network Policies');
    });

    it('only shows user namespaces', () => {
      expect(source).toContain("startsWith('openshift-')");
      expect(source).toContain("startsWith('kube-')");
    });
  });

  describe('navigation', () => {
    it('has route in App.tsx', () => {
      const app = fs.readFileSync(path.join(__dirname, '../../App.tsx'), 'utf-8');
      expect(app).toContain('SecurityView');
      expect(app).toContain("path=\"security\"");
    });

    it('links to related views', () => {
      expect(source).toContain('/access-control');
      expect(source).toContain('/users');
      expect(source).toContain('/admin?tab=certificates');
      expect(source).toContain('/admin?tab=readiness');
      expect(source).toContain('/networking');
    });
  });

  describe('data sources', () => {
    it('fetches OAuth config', () => {
      expect(source).toContain('oauths/cluster');
    });

    it('fetches API server config', () => {
      expect(source).toContain('apiservers/cluster');
    });

    it('fetches SCCs', () => {
      expect(source).toContain('securitycontextconstraints');
    });

    it('fetches network policies', () => {
      expect(source).toContain('networkpolicies');
    });
  });
});
