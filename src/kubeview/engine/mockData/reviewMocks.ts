import type { ReviewItem } from '../../store/reviewStore';

const now = Date.now();
const hour = 3_600_000;

export const REVIEW_MOCK_DATA: ReviewItem[] = [
  {
    id: 'rev-001',
    title: 'Scale payment-api replicas',
    description:
      'Increase replica count from 2 to 4 based on sustained CPU utilization above 75% over the last 24 hours.',
    riskLevel: 'low',
    agentName: 'SRE Agent',
    agentIcon: 'bot',
    resourceType: 'Deployment',
    resourceName: 'payment-api',
    namespace: 'payments',
    diff: {
      before: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: payment-api
  namespace: payments
spec:
  replicas: 2
  selector:
    matchLabels:
      app: payment-api
  template:
    spec:
      containers:
        - name: payment-api
          image: registry.internal/payment-api:v3.2.1
          resources:
            requests:
              cpu: 250m
              memory: 512Mi`,
      after: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: payment-api
  namespace: payments
spec:
  replicas: 4
  selector:
    matchLabels:
      app: payment-api
  template:
    spec:
      containers:
        - name: payment-api
          image: registry.internal/payment-api:v3.2.1
          resources:
            requests:
              cpu: 250m
              memory: 512Mi`,
      fields: [{ key: 'spec.replicas', before: '2', after: '4' }],
    },
    businessImpact: 'Improves payment processing throughput during peak hours. Estimated additional cost: 500m CPU, 1Gi memory.',
    status: 'pending',
    createdAt: now - 2 * hour,
  },
  {
    id: 'rev-002',
    title: 'Modify NetworkPolicy for checkout-svc',
    description:
      'Open ingress from monitoring namespace to allow Prometheus scraping on port 9090.',
    riskLevel: 'high',
    agentName: 'Security Agent',
    agentIcon: 'shield',
    resourceType: 'NetworkPolicy',
    resourceName: 'checkout-svc-policy',
    namespace: 'checkout',
    diff: {
      before: `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: checkout-svc-policy
  namespace: checkout
spec:
  podSelector:
    matchLabels:
      app: checkout-svc
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: frontend
      ports:
        - port: 8080
          protocol: TCP`,
      after: `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: checkout-svc-policy
  namespace: checkout
spec:
  podSelector:
    matchLabels:
      app: checkout-svc
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: frontend
      ports:
        - port: 8080
          protocol: TCP
    - from:
        - namespaceSelector:
            matchLabels:
              name: monitoring
      ports:
        - port: 9090
          protocol: TCP`,
      fields: [{ key: 'spec.ingress', before: '1 rule', after: '2 rules' }],
    },
    businessImpact: 'Enables Prometheus metrics collection for checkout service. Opens a new network path from monitoring namespace.',
    status: 'pending',
    createdAt: now - 4 * hour,
  },
  {
    id: 'rev-003',
    title: 'Update CPU limits for order-processor',
    description:
      'Raise CPU limit from 500m to 1000m after repeated throttling detected in the last 6 hours.',
    riskLevel: 'medium',
    agentName: 'SRE Agent',
    agentIcon: 'bot',
    resourceType: 'Deployment',
    resourceName: 'order-processor',
    namespace: 'orders',
    diff: {
      before: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: order-processor
  namespace: orders
spec:
  replicas: 3
  template:
    spec:
      containers:
        - name: order-processor
          image: registry.internal/order-processor:v2.8.0
          resources:
            requests:
              cpu: 250m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi`,
      after: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: order-processor
  namespace: orders
spec:
  replicas: 3
  template:
    spec:
      containers:
        - name: order-processor
          image: registry.internal/order-processor:v2.8.0
          resources:
            requests:
              cpu: 250m
              memory: 256Mi
            limits:
              cpu: "1"
              memory: 512Mi`,
      fields: [{ key: 'resources.limits.cpu', before: '500m', after: '1000m' }],
    },
    businessImpact: 'Eliminates CPU throttling for order processing. May increase node utilization by ~5%.',
    status: 'pending',
    createdAt: now - 5 * hour,
  },
  {
    id: 'rev-004',
    title: 'Enable privileged SCC for debug-tools',
    description:
      'Grant privileged SecurityContextConstraint to debug-tools ServiceAccount for node-level debugging.',
    riskLevel: 'critical',
    agentName: 'Security Agent',
    agentIcon: 'shield',
    resourceType: 'ClusterRoleBinding',
    resourceName: 'debug-tools-privileged',
    namespace: 'kube-system',
    diff: {
      before: `# No existing ClusterRoleBinding`,
      after: `apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: debug-tools-privileged
subjects:
  - kind: ServiceAccount
    name: debug-tools
    namespace: kube-system
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: system:openshift:scc:privileged`,
      fields: [{ key: 'SCC', before: 'restricted', after: 'privileged' }],
    },
    businessImpact: 'Grants full host access to debug-tools pods. Critical security risk if ServiceAccount token is compromised.',
    status: 'pending',
    createdAt: now - 1 * hour,
  },
  {
    id: 'rev-005',
    title: 'Add resource quotas to dev namespace',
    description:
      'Apply default ResourceQuota to prevent unbounded resource consumption in the dev namespace.',
    riskLevel: 'low',
    agentName: 'SRE Agent',
    agentIcon: 'bot',
    resourceType: 'ResourceQuota',
    resourceName: 'dev-quota',
    namespace: 'dev',
    diff: {
      before: `# No existing ResourceQuota`,
      after: `apiVersion: v1
kind: ResourceQuota
metadata:
  name: dev-quota
  namespace: dev
spec:
  hard:
    requests.cpu: "8"
    requests.memory: 16Gi
    limits.cpu: "16"
    limits.memory: 32Gi
    pods: "50"
    services: "20"`,
      fields: [
        { key: 'spec.hard.pods', before: 'unlimited', after: '50' },
        { key: 'spec.hard.requests.cpu', before: 'unlimited', after: '8' },
      ],
    },
    businessImpact: 'Prevents dev namespace from consuming excessive cluster resources. May block deployments that exceed quota.',
    status: 'pending',
    createdAt: now - 8 * hour,
  },
  {
    id: 'rev-006',
    title: 'Rotate TLS certificates for ingress',
    description:
      'Replace expiring TLS certificate on wildcard ingress. Current cert expires in 7 days.',
    riskLevel: 'medium',
    agentName: 'Security Agent',
    agentIcon: 'shield',
    resourceType: 'Secret',
    resourceName: 'wildcard-tls',
    namespace: 'openshift-ingress',
    diff: {
      before: `apiVersion: v1
kind: Secret
metadata:
  name: wildcard-tls
  namespace: openshift-ingress
type: kubernetes.io/tls
data:
  tls.crt: <base64-encoded-cert>
  tls.key: <base64-encoded-key>
# Expires: 2026-04-06`,
      after: `apiVersion: v1
kind: Secret
metadata:
  name: wildcard-tls
  namespace: openshift-ingress
type: kubernetes.io/tls
data:
  tls.crt: <base64-encoded-new-cert>
  tls.key: <base64-encoded-new-key>
# Expires: 2027-04-06`,
      fields: [{ key: 'tls.crt', before: 'expires 2026-04-06', after: 'expires 2027-04-06' }],
    },
    businessImpact: 'Prevents TLS expiration that would cause service outage for all ingress routes. Zero-downtime rotation.',
    status: 'pending',
    createdAt: now - 3 * hour,
  },
  {
    id: 'rev-007',
    title: 'Increase PVC size for postgres-data',
    description:
      'Expand PersistentVolumeClaim from 50Gi to 100Gi. Current usage at 82%.',
    riskLevel: 'medium',
    agentName: 'SRE Agent',
    agentIcon: 'bot',
    resourceType: 'PersistentVolumeClaim',
    resourceName: 'postgres-data',
    namespace: 'database',
    diff: {
      before: `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-data
  namespace: database
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: gp3-csi
  resources:
    requests:
      storage: 50Gi`,
      after: `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-data
  namespace: database
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: gp3-csi
  resources:
    requests:
      storage: 100Gi`,
      fields: [{ key: 'spec.resources.requests.storage', before: '50Gi', after: '100Gi' }],
    },
    businessImpact: 'Prevents database disk full condition. Storage class supports online expansion. Estimated cost increase: ~$25/month.',
    status: 'pending',
    createdAt: now - 6 * hour,
  },
  {
    id: 'rev-008',
    title: 'Add pod anti-affinity rules to api-gateway',
    description:
      'Spread api-gateway pods across availability zones for improved fault tolerance.',
    riskLevel: 'low',
    agentName: 'SRE Agent',
    agentIcon: 'bot',
    resourceType: 'Deployment',
    resourceName: 'api-gateway',
    namespace: 'gateway',
    diff: {
      before: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
  namespace: gateway
spec:
  replicas: 3
  template:
    spec:
      containers:
        - name: api-gateway
          image: registry.internal/api-gateway:v1.12.0
          ports:
            - containerPort: 8443`,
      after: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
  namespace: gateway
spec:
  replicas: 3
  template:
    spec:
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchExpressions:
                    - key: app
                      operator: In
                      values:
                        - api-gateway
                topologyKey: topology.kubernetes.io/zone
      containers:
        - name: api-gateway
          image: registry.internal/api-gateway:v1.12.0
          ports:
            - containerPort: 8443`,
      fields: [{ key: 'spec.template.spec.affinity', before: 'none', after: 'podAntiAffinity (zone spread)' }],
    },
    businessImpact: 'Improves availability during zone failures. May cause pending pods if zones have insufficient capacity.',
    status: 'pending',
    createdAt: now - 10 * hour,
  },
];
