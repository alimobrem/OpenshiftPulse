import { Route, Navigate } from 'react-router-dom';

export function redirectRoutes() {
  return (
    <>
      <Route path="software" element={<Navigate to="/create/v1~pods" replace />} />
      <Route path="operators" element={<Navigate to="/admin" replace />} />
      <Route path="operatorhub" element={<Navigate to="/create/v1~pods?tab=operators" replace />} />
      <Route path="dashboard" element={<Navigate to="/pulse" replace />} />
      <Route path="morning-report" element={<Navigate to="/pulse" replace />} />
      <Route path="troubleshoot" element={<Navigate to="/pulse" replace />} />
      <Route path="config-compare" element={<Navigate to="/admin" replace />} />
      <Route path="timeline" element={<Navigate to="/admin?tab=timeline" replace />} />
    </>
  );
}
