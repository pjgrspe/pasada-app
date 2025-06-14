import { ref, onValue, off } from 'firebase/database';
import { realtimeDatabase } from '../../../FirebaseConfig';
import { Coordinate } from '../utils/routeTypes';

export interface JeepLocation {
  jeepId: string;
  routeId: string;
  isOn: boolean;
  longitude: number;
  latitude: number;
  timestamp?: number;
}

export interface JeepTrackingCallbacks {
  onJeepUpdate: (jeep: JeepLocation) => void;
  onJeepOffline: (jeepId: string, routeId: string) => void;
  onError: (error: Error) => void;
}

class JeepTrackingService {
  private activeListeners: Map<string, any> = new Map();
  private jeepLocations: Map<string, JeepLocation> = new Map();
  private callbacks?: JeepTrackingCallbacks;
  private pollingInterval?: number;

  /**
   * Initialize the jeep tracking service
   */
  public initialize(callbacks: JeepTrackingCallbacks): void {
    this.callbacks = callbacks;
    console.log('[JeepTrackingService] Initialized');
  }

  /**
   * Start tracking jeeps for specific routes
   */
  public startTracking(routeIds: string[]): void {
    console.log('[JeepTrackingService] Starting tracking for routes:', routeIds);
    
    // Stop any existing tracking first
    this.stopTracking();

    // Start listening to each route
    routeIds.forEach(routeId => {
      this.startRouteTracking(routeId);
    });

    // Start polling interval for updates
    this.startPolling();
  }

  /**
   * Stop all tracking
   */
  public stopTracking(): void {
    console.log('[JeepTrackingService] Stopping all tracking');
    
    // Remove all listeners
    this.activeListeners.forEach((listener, path) => {
      const dbRef = ref(realtimeDatabase, path);
      off(dbRef);
    });
    this.activeListeners.clear();

    // Clear polling
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }

    // Clear cached locations
    this.jeepLocations.clear();
  }

  /**
   * Get current jeep locations for a specific route
   */
  public getJeepsForRoute(routeId: string): JeepLocation[] {
    const jeeps: JeepLocation[] = [];
    this.jeepLocations.forEach(jeep => {
      if (jeep.routeId === routeId && jeep.isOn) {
        jeeps.push(jeep);
      }
    });
    return jeeps;
  }

  /**
   * Get all current active jeep locations
   */
  public getAllActiveJeeps(): JeepLocation[] {
    const jeeps: JeepLocation[] = [];
    this.jeepLocations.forEach(jeep => {
      if (jeep.isOn) {
        jeeps.push(jeep);
      }
    });
    return jeeps;
  }

  /**
   * Start tracking a specific route
   */
  private startRouteTracking(routeId: string): void {
    const routePath = routeId;
    const dbRef = ref(realtimeDatabase, routePath);

    console.log(`[JeepTrackingService] Setting up listener for route: ${routeId}`);

    const listener = onValue(dbRef, (snapshot) => {
      if (snapshot.exists()) {
        const routeData = snapshot.val();
        this.processRouteData(routeId, routeData);
      } else {
        console.log(`[JeepTrackingService] No data found for route: ${routeId}`);
      }
    }, (error) => {
      console.error(`[JeepTrackingService] Error listening to route ${routeId}:`, error);
      this.callbacks?.onError(error);
    });

    this.activeListeners.set(routePath, listener);
  }

  /**
   * Process route data from Firebase
   */
  private processRouteData(routeId: string, routeData: any): void {
    if (!routeData || typeof routeData !== 'object') {
      return;
    }

    Object.keys(routeData).forEach(jeepId => {
      const jeepData = routeData[jeepId];
      
      if (this.isValidJeepData(jeepData)) {
        const jeepLocation: JeepLocation = {
          jeepId,
          routeId,
          isOn: jeepData.IsOn === true || jeepData.IsOn === 'true',
          longitude: parseFloat(jeepData.Longitude),
          latitude: parseFloat(jeepData.Latitude),
          timestamp: Date.now()
        };

        const jeepKey = `${routeId}-${jeepId}`;
        const previousLocation = this.jeepLocations.get(jeepKey);

        // Update cached location
        this.jeepLocations.set(jeepKey, jeepLocation);

        // Notify callbacks
        if (jeepLocation.isOn) {
          this.callbacks?.onJeepUpdate(jeepLocation);
        } else if (previousLocation?.isOn) {
          // Jeep went offline
          this.callbacks?.onJeepOffline(jeepId, routeId);
        }

        console.log(`[JeepTrackingService] Updated ${jeepId} on ${routeId}: ${jeepLocation.isOn ? 'online' : 'offline'} at (${jeepLocation.latitude}, ${jeepLocation.longitude})`);
      }
    });
  }

  /**
   * Validate jeep data structure
   */
  private isValidJeepData(data: any): boolean {
    return data && 
           typeof data === 'object' &&
           'IsOn' in data &&
           'Longitude' in data &&
           'Latitude' in data &&
           !isNaN(parseFloat(data.Longitude)) &&
           !isNaN(parseFloat(data.Latitude));
  }

  /**
   * Start polling for periodic updates (every 5 seconds)
   */
  private startPolling(): void {
    this.pollingInterval = setInterval(() => {
      // Trigger a refresh by checking timestamp and notifying about stale data
      const now = Date.now();
      const staleThreshold = 30000; // 30 seconds

      this.jeepLocations.forEach((jeep, key) => {
        if (jeep.isOn && jeep.timestamp && (now - jeep.timestamp) > staleThreshold) {
          console.log(`[JeepTrackingService] Jeep ${jeep.jeepId} data is stale`);
          // You could mark as potentially offline here
        }
      });
    }, 5000); // 5 second interval
  }

  /**
   * Check if a jeep is currently online
   */
  public isJeepOnline(jeepId: string, routeId: string): boolean {
    const jeepKey = `${routeId}-${jeepId}`;
    const jeep = this.jeepLocations.get(jeepKey);
    return jeep?.isOn || false;
  }

  /**
   * Get specific jeep location
   */
  public getJeepLocation(jeepId: string, routeId: string): JeepLocation | null {
    const jeepKey = `${routeId}-${jeepId}`;
    return this.jeepLocations.get(jeepKey) || null;
  }
}

// Export singleton instance
export const jeepTrackingService = new JeepTrackingService();
