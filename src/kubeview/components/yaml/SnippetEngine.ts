export interface Snippet {
  prefix: string;         // trigger text, e.g., "deploy"
  label: string;          // display name
  description: string;
  body: string;           // YAML template with ${1:placeholder} markers
}

// Built-in snippets for common Kubernetes resources
export const snippets: Snippet[] = [
  {
    prefix: 'deploy',
    label: 'Deployment',
    description: 'Create a Deployment',
    body: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: \${1:my-app}
  namespace: \${2:default}
spec:
  replicas: \${3:1}
  selector:
    matchLabels:
      app: \${1:my-app}
  template:
    metadata:
      labels:
        app: \${1:my-app}
    spec:
      containers:
      - name: \${1:my-app}
        image: \${4:nginx:latest}
        ports:
        - containerPort: \${5:80}`,
  },
  {
    prefix: 'svc',
    label: 'Service',
    description: 'Create a Service (ClusterIP)',
    body: `apiVersion: v1
kind: Service
metadata:
  name: \${1:my-service}
  namespace: \${2:default}
spec:
  type: ClusterIP
  selector:
    app: \${3:my-app}
  ports:
  - name: \${4:http}
    port: \${5:80}
    targetPort: \${6:8080}
    protocol: TCP`,
  },
  {
    prefix: 'ing',
    label: 'Ingress',
    description: 'Create an Ingress',
    body: `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: \${1:my-ingress}
  namespace: \${2:default}
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  rules:
  - host: \${3:example.com}
    http:
      paths:
      - path: /\${4:path}
        pathType: Prefix
        backend:
          service:
            name: \${5:my-service}
            port:
              number: \${6:80}`,
  },
  {
    prefix: 'pvc',
    label: 'PersistentVolumeClaim',
    description: 'Create a PersistentVolumeClaim',
    body: `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: \${1:my-pvc}
  namespace: \${2:default}
spec:
  accessModes:
  - \${3:ReadWriteOnce}
  resources:
    requests:
      storage: \${4:10Gi}
  storageClassName: \${5:standard}`,
  },
  {
    prefix: 'cm',
    label: 'ConfigMap',
    description: 'Create a ConfigMap',
    body: `apiVersion: v1
kind: ConfigMap
metadata:
  name: \${1:my-config}
  namespace: \${2:default}
data:
  \${3:key}: \${4:value}`,
  },
  {
    prefix: 'secret',
    label: 'Secret',
    description: 'Create a Secret (Opaque)',
    body: `apiVersion: v1
kind: Secret
metadata:
  name: \${1:my-secret}
  namespace: \${2:default}
type: Opaque
data:
  \${3:key}: \${4:base64-encoded-value}`,
  },
  {
    prefix: 'rb',
    label: 'RoleBinding',
    description: 'Create a RoleBinding',
    body: `apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: \${1:my-role-binding}
  namespace: \${2:default}
subjects:
- kind: \${3:User}
  name: \${4:jane}
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: \${5:pod-reader}
  apiGroup: rbac.authorization.k8s.io`,
  },
  {
    prefix: 'cj',
    label: 'CronJob',
    description: 'Create a CronJob',
    body: `apiVersion: batch/v1
kind: CronJob
metadata:
  name: \${1:my-cronjob}
  namespace: \${2:default}
spec:
  schedule: "\${3:0 0 * * *}"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: \${4:job}
            image: \${5:busybox:latest}
            command:
            - /bin/sh
            - -c
            - \${6:date; echo Hello from CronJob}
          restartPolicy: OnFailure`,
  },
  {
    prefix: 'hpa',
    label: 'HorizontalPodAutoscaler',
    description: 'Create a HorizontalPodAutoscaler',
    body: `apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: \${1:my-hpa}
  namespace: \${2:default}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: \${3:my-app}
  minReplicas: \${4:1}
  maxReplicas: \${5:10}
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: \${6:80}`,
  },
  {
    prefix: 'ns',
    label: 'Namespace',
    description: 'Create a Namespace',
    body: `apiVersion: v1
kind: Namespace
metadata:
  name: \${1:my-namespace}`,
  },
  {
    prefix: 'sa',
    label: 'ServiceAccount',
    description: 'Create a ServiceAccount',
    body: `apiVersion: v1
kind: ServiceAccount
metadata:
  name: \${1:my-service-account}
  namespace: \${2:default}`,
  },
  {
    prefix: 'np',
    label: 'NetworkPolicy',
    description: 'Create a NetworkPolicy',
    body: `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: \${1:my-network-policy}
  namespace: \${2:default}
spec:
  podSelector:
    matchLabels:
      \${3:app}: \${4:my-app}
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          \${5:app}: \${6:frontend}
    ports:
    - protocol: TCP
      port: \${7:80}
  egress:
  - to:
    - podSelector:
        matchLabels:
          \${8:app}: \${9:backend}
    ports:
    - protocol: TCP
      port: \${10:8080}`,
  },
];

/**
 * Get snippet suggestions for a given prefix
 */
export function getSnippetSuggestions(prefix: string): Snippet[] {
  const lowercasePrefix = prefix.toLowerCase();
  return snippets.filter(
    snippet =>
      snippet.prefix.toLowerCase().includes(lowercasePrefix) ||
      snippet.label.toLowerCase().includes(lowercasePrefix) ||
      snippet.description.toLowerCase().includes(lowercasePrefix)
  );
}

/**
 * Resolve a snippet body by replacing ${N:default} with default values
 * This is a simplified version - a real implementation would support tab stops
 */
export function resolveSnippet(snippet: Snippet): string {
  let resolved = snippet.body;

  // Replace ${N:default} with just the default value
  resolved = resolved.replace(/\$\{(\d+):([^}]+)\}/g, (_match, _index, defaultValue) => {
    return defaultValue;
  });

  // Replace ${N} with empty string
  resolved = resolved.replace(/\$\{\d+\}/g, '');

  return resolved;
}
