export interface QuickAction {
  label: string;
  route: string;
  icon: string;
}

export interface AskPulseResponse {
  text: string;
  suggestions: string[];
  actions: QuickAction[];
  /** True when the response came from the live Pulse Agent, false for mock/fallback */
  fromAgent?: boolean;
}
