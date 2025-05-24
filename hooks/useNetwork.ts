// hooks/useNetwork.ts
import { useState, useEffect } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

/**
 * Hook to monitor the network status of the device.
 *
 * It provides real-time updates on connectivity and connection type.
 *
 * @returns The current NetInfoState, which includes properties like
 * `isConnected`, `isInternetReachable`, and `type`.
 */
export const useNetwork = () => {
  const [netInfo, setNetInfo] = useState<NetInfoState | null>(null);

  useEffect(() => {
    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener(state => {
      setNetInfo(state);
    });

    // Fetch the current state once on mount
    NetInfo.fetch().then(state => {
      setNetInfo(state);
    });

    // Unsubscribe when the component unmounts
    return () => {
      unsubscribe();
    };
  }, []);

  return {
      isConnected: netInfo?.isConnected ?? null,
      isInternetReachable: netInfo?.isInternetReachable ?? null,
      connectionType: netInfo?.type ?? null,
      details: netInfo?.details ?? null,
      isLoading: netInfo === null, // True until first check completes
  };
};