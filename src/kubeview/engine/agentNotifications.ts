/**
 * Agent Notifications — background polling service that queries the agent
 * for predicted issues and pushes toast notifications.
 */

import { AgentClient } from './agentClient';
import type { AgentEvent } from './agentClient';
import { useUIStore } from '../store/uiStore';

const DEFAULT_INTERVAL = 300_000; // 5 minutes
const PROMPT = 'Briefly check for any critical issues, impending problems, or anomalies in the cluster. Respond in 2-3 sentences maximum. If nothing notable, respond with just "OK".';

let client: AgentClient | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;
let running = false;

function query(): Promise<string> {
  return new Promise((resolve, reject) => {
    const c = new AgentClient('sre');
    client = c;

    const unsub = c.on((event: AgentEvent) => {
      switch (event.type) {
        case 'connected':
          c.send(PROMPT);
          break;
        case 'done':
          unsub();
          c.disconnect();
          client = null;
          resolve(event.full_response);
          break;
        case 'error':
          unsub();
          c.disconnect();
          client = null;
          reject(new Error(event.message));
          break;
        case 'disconnected':
          // If we haven't resolved yet, reject
          client = null;
          reject(new Error('Disconnected'));
          break;
      }
    });

    c.connect();
  });
}

async function poll() {
  try {
    const response = await query();
    const trimmed = response.trim();

    // Only notify if the agent found something notable
    if (trimmed && trimmed !== 'OK' && trimmed.toLowerCase() !== 'ok') {
      useUIStore.getState().addToast({
        type: 'warning',
        title: 'AI Insight',
        detail: trimmed,
        duration: 15000,
      });
    }
  } catch {
    // Silently skip — agent may be unavailable
  }
}

export function startAgentNotifications(intervalMs = DEFAULT_INTERVAL) {
  if (running) return;
  running = true;

  // Don't poll immediately — wait for the first interval
  intervalId = setInterval(poll, intervalMs);
}

export function stopAgentNotifications() {
  running = false;
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  if (client) {
    client.disconnect();
    client = null;
  }
}

export function isAgentNotificationsRunning(): boolean {
  return running;
}
