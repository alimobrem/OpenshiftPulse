import { useAgentStore } from '../store/agentStore';
import { useMonitorStore } from '../store/monitorStore';
import { useUIStore } from '../store/uiStore';

export const WS_AUTH_FAILURE_CODE = 4001;

export function disconnectAll(): void {
  useAgentStore.getState().disconnect();
  useMonitorStore.getState().disconnect();
}

export function performLogout(): void {
  disconnectAll();
  window.location.href = '/oauth/sign_out';
}

export function handleAuthError(errorMessage: string): void {
  if (errorMessage.includes(String(WS_AUTH_FAILURE_CODE))) {
    useUIStore.getState().addDegradedReason('session_expired');
  }
}
