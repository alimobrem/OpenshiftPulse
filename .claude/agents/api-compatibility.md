# API Compatibility Checker

Verifies that typed K8s interfaces and API paths in the codebase match the actual cluster resources.

## Instructions

1. **Check typed interfaces against live API**: For each major type in `src/kubeview/engine/types/`, verify the API path exists:
   - Run `curl -s http://localhost:8001/apis/apps/v1 | jq .resources[].name` for apps group
   - Run `curl -s http://localhost:8001/api/v1 | jq .resources[].name` for core group
   - Compare against the typed interfaces (Pod, Deployment, Node, Service, etc.)

2. **Verify API paths in hooks**: Search for all `apiPath:` and `k8sList`/`k8sGet` calls. Verify each path returns 200:
   ```
   grep -rn "apiPath:\|k8sList(\|k8sGet(" src/kubeview/ --include="*.ts" --include="*.tsx" | grep -oP "'/api[^']*'" | sort -u
   ```
   Test each unique path against `http://localhost:8001`.

3. **Check ArgoCD availability**: Verify `/apis/argoproj.io/v1alpha1` exists if ArgoCD features are expected.

4. **Check HyperShift detection**: Verify Infrastructure resource topology field matches cluster state.

5. **Report any 404s or mismatched fields** that could cause runtime errors.

## Report Format

| API Path | Status | Notes |
|----------|--------|-------|
| /api/v1/pods | 200 OK | |
| /apis/argoproj.io/v1alpha1 | 404 | ArgoCD not installed (expected) |
