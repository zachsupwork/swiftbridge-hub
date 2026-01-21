import { useCallback } from 'react';

// Local storage key for attribution tracking
const ATTRIBUTION_KEY = 'earn_attribution';

interface AttributionData {
  protocol: string;
  chain: string;
  asset: string;
  timestamp: number;
}

export function useEarnAnalytics() {
  const trackEvent = useCallback((eventName: string, data?: Record<string, unknown>) => {
    // Log to console in dev mode
    if (import.meta.env.DEV) {
      console.log(`[Earn Analytics] ${eventName}`, data);
    }
    
    // In production, this could send to analytics service
    // For now, we'll just log and store attribution
    try {
      const event = {
        event: eventName,
        timestamp: Date.now(),
        ...data,
      };
      
      // Could be extended to send to analytics endpoint
      console.log('[Analytics Event]', event);
    } catch (error) {
      console.error('Failed to track event:', error);
    }
  }, []);

  const trackEarnView = useCallback(() => {
    trackEvent('earn_view');
  }, [trackEvent]);

  const trackFilterChange = useCallback((filters: { protocol?: string; chain?: string; search?: string }) => {
    trackEvent('earn_filter_change', filters);
  }, [trackEvent]);

  const trackMarketOpen = useCallback((protocol: string, chain: string, asset: string) => {
    trackEvent('earn_market_open', { protocol, chain, asset });
  }, [trackEvent]);

  const trackSupplyClick = useCallback((protocol: string, chain: string, asset: string) => {
    trackEvent('earn_supply_click', { protocol, chain, asset });
    
    // Store attribution for tracking
    const attribution: AttributionData = {
      protocol,
      chain,
      asset,
      timestamp: Date.now(),
    };
    
    try {
      localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
    } catch (error) {
      console.error('Failed to store attribution:', error);
    }
  }, [trackEvent]);

  const getLastAttribution = useCallback((): AttributionData | null => {
    try {
      const data = localStorage.getItem(ATTRIBUTION_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }, []);

  return {
    trackEarnView,
    trackFilterChange,
    trackMarketOpen,
    trackSupplyClick,
    getLastAttribution,
  };
}
