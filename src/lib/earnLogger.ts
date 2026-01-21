/**
 * Earn Event Logger
 * 
 * Handles logging for earn-related events including:
 * - Deep link clicks
 * - Fee transactions
 * - Supply transactions
 * - Errors
 * 
 * Events are stored in localStorage and optionally sent to a remote endpoint.
 */

import { EARN_LOG_ENDPOINT } from './env';

export type EarnEventAction = 
  | 'deeplink_aave'
  | 'fee_tx_sent'
  | 'fee_tx_success'
  | 'fee_tx_failed'
  | 'supply_tx_sent'
  | 'supply_tx_success'
  | 'supply_tx_failed'
  | 'approval_tx_sent'
  | 'approval_tx_success'
  | 'approval_tx_failed'
  | 'user_cancelled'
  | 'error';

export interface EarnEvent {
  action: EarnEventAction;
  timestamp: number;
  chainId?: number;
  assetSymbol?: string;
  assetAddress?: string;
  walletAddress?: string;
  amount?: string;
  feeAmount?: string;
  txHash?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

const EARN_EVENTS_KEY = 'earn_events';
const EARN_CLICKS_KEY = 'earn_clicks';
const MAX_STORED_EVENTS = 100;

/**
 * Log an earn event
 */
export function logEarnEvent(event: Omit<EarnEvent, 'timestamp'>): void {
  const fullEvent: EarnEvent = {
    ...event,
    timestamp: Date.now(),
  };
  
  // Console log in dev
  if (import.meta.env.DEV) {
    console.log('[Earn Event]', fullEvent);
  }
  
  // Store in localStorage
  storeEventLocally(fullEvent);
  
  // Send to remote endpoint if configured
  if (EARN_LOG_ENDPOINT) {
    sendEventToEndpoint(fullEvent);
  }
}

/**
 * Log a deep link click
 */
export function logDeepLinkClick(params: {
  chainId: number;
  assetSymbol: string;
  assetAddress: string;
  walletAddress?: string;
}): void {
  const clickEvent = {
    ...params,
    action: 'deeplink_aave' as const,
    timestamp: Date.now(),
  };
  
  // Store in earn_clicks array
  try {
    const existing = localStorage.getItem(EARN_CLICKS_KEY);
    const clicks = existing ? JSON.parse(existing) : [];
    clicks.push(clickEvent);
    
    // Keep only last 50 clicks
    if (clicks.length > 50) {
      clicks.splice(0, clicks.length - 50);
    }
    
    localStorage.setItem(EARN_CLICKS_KEY, JSON.stringify(clicks));
  } catch (error) {
    console.error('Failed to store click event:', error);
  }
  
  // Also log as regular event
  logEarnEvent(clickEvent);
}

/**
 * Store event in localStorage
 */
function storeEventLocally(event: EarnEvent): void {
  try {
    const existing = localStorage.getItem(EARN_EVENTS_KEY);
    const events: EarnEvent[] = existing ? JSON.parse(existing) : [];
    
    events.push(event);
    
    // Keep only recent events
    if (events.length > MAX_STORED_EVENTS) {
      events.splice(0, events.length - MAX_STORED_EVENTS);
    }
    
    localStorage.setItem(EARN_EVENTS_KEY, JSON.stringify(events));
  } catch (error) {
    console.error('Failed to store earn event:', error);
  }
}

/**
 * Send event to remote endpoint (fire-and-forget)
 */
function sendEventToEndpoint(event: EarnEvent): void {
  if (!EARN_LOG_ENDPOINT) return;
  
  try {
    fetch(EARN_LOG_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }).catch(() => {
      // Silently fail - don't break user experience
    });
  } catch {
    // Silently fail
  }
}

/**
 * Get stored events (for debugging)
 */
export function getStoredEvents(): EarnEvent[] {
  try {
    const data = localStorage.getItem(EARN_EVENTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Get stored clicks (for debugging)
 */
export function getStoredClicks(): Array<{
  chainId: number;
  assetSymbol: string;
  assetAddress: string;
  walletAddress?: string;
  timestamp: number;
}> {
  try {
    const data = localStorage.getItem(EARN_CLICKS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Clear stored events (for debugging)
 */
export function clearStoredEvents(): void {
  try {
    localStorage.removeItem(EARN_EVENTS_KEY);
    localStorage.removeItem(EARN_CLICKS_KEY);
  } catch {
    // Ignore
  }
}
