// pasada-app/modules/map/services/mapApiService.ts
// Placeholder for map API interactions (e.g., Google Directions API)

interface Coordinate {
    latitude: number;
    longitude: number;
}

interface GeocodeResponse {
    coordinate: Coordinate;
    formattedAddress: string;
}

interface RouteResponse {
    coordinates: Coordinate[];
    distance: number; // in meters
    duration: number; // in seconds
}

const mapApiService = {
    getDirections: async (start: Coordinate, end: Coordinate): Promise<RouteResponse | null> => {
        console.warn("mapApiService.getDirections is not implemented. Using mock data.");
        await new Promise(resolve => setTimeout(resolve, 500));
        return {
            coordinates: [start, { latitude: (start.latitude + end.latitude) / 2, longitude: (start.longitude + end.longitude) / 2 }, end],
            distance: 10000, // 10km
            duration: 600, // 10 mins
        };
    },

    geocode: async (address: string): Promise<GeocodeResponse | null> => {
        console.warn(`mapApiService.geocode is not implemented. Using mock data for: ${address}`);
        await new Promise(resolve => setTimeout(resolve, 300));
        // Simulate geocoding - replace with actual API call
        if (address.toLowerCase().includes("manila")) {
            return {
                coordinate: { latitude: 14.5995, longitude: 120.9842 },
                formattedAddress: "Manila, Metro Manila, Philippines",
            };
        } else if (address.toLowerCase().includes("quezon city")) {
            return {
                coordinate: { latitude: 14.6760, longitude: 121.0437 },
                formattedAddress: "Quezon City, Metro Manila, Philippines",
            };
        } else if (address.toLowerCase().includes("malolos")) {
            return {
                coordinate: { latitude: 14.8433, longitude: 120.8134 },
                formattedAddress: "Malolos, Bulacan, Philippines",
            };
        }
        console.warn(`No mock geocode found for: ${address}`);
        return null;
    },
};

export default mapApiService;