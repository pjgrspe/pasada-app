"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.firestoreTripService = exports.FirestoreTripService = void 0;
const FirebaseConfig_1 = require("../FirebaseConfig");
const firestore_1 = require("firebase/firestore");
const react_native_uuid_1 = require("react-native-uuid");
const db = (0, firestore_1.getFirestore)();
// Trip Service Class
class FirestoreTripService {
    constructor() {
        this.unsubscribeCallbacks = new Map();
    }
    static getInstance() {
        if (!FirestoreTripService.instance) {
            FirestoreTripService.instance = new FirestoreTripService();
        }
        return FirestoreTripService.instance;
    }
    // Create a new trip
    async createTrip(startLocation, endLocation, selectedRouteIndex, tripLegs) {
        try {
            const user = FirebaseConfig_1.auth.currentUser;
            if (!user) {
                console.error('No authenticated user found');
                return null;
            }
            // Convert trip legs to Firestore steps
            const steps = tripLegs.map((leg, index) => {
                const coordinates = leg.coordinates || [];
                const routeId = leg.routeId || `${leg.type}-${String(react_native_uuid_1.default.v4()).substring(0, 8)}`;
                return {
                    id: `step-${index}`,
                    type: leg.type,
                    routeId,
                    routeName: leg.routeName || (leg.type === 'walk' ? 'Walking' : 'Unknown Route'),
                    routeColor: leg.routeColor || (leg.type === 'walk' ? '#777777' : '#0066CC'),
                    startLocation: {
                        name: leg.jeepBoardingPointInfo || (index === 0 ? startLocation.name : '') || 'Start point',
                        latitude: coordinates[0]?.latitude || 0,
                        longitude: coordinates[0]?.longitude || 0,
                    },
                    endLocation: {
                        name: leg.jeepAlightingPointInfo || (index === tripLegs.length - 1 ? endLocation.name : '') || 'End point',
                        latitude: coordinates[coordinates.length - 1]?.latitude || 0,
                        longitude: coordinates[coordinates.length - 1]?.longitude || 0,
                    },
                    status: index === 0 ? 'active' : 'pending',
                    distance: typeof leg.distance === 'number' ? leg.distance : 0,
                    duration: typeof leg.duration === 'number' ? leg.duration : 0,
                    startTime: index === 0 ? firestore_1.Timestamp.now() : null,
                    endTime: null,
                    coordinates,
                    instructions: leg.instructions || undefined,
                    fare: leg.type === 'jeepney' ? this.calculateEstimatedFare(Number(leg.distance) || 0) : 0,
                };
            });
            // Calculate totals
            const totalDistance = steps.reduce((sum, step) => sum + step.distance, 0);
            const estimatedDuration = steps.reduce((sum, step) => sum + step.duration, 0);
            const totalFare = steps.reduce((sum, step) => sum + (step.fare || 0), 0);
            // Create trip document
            const tripData = {
                userId: user.uid,
                status: 'active',
                createdAt: firestore_1.Timestamp.now(),
                startTime: firestore_1.Timestamp.now(),
                endTime: null,
                startLocation,
                endLocation,
                selectedRouteIndex,
                totalDistance,
                estimatedDuration,
                totalFare,
                steps,
                tags: [], // Empty by default, user can add later
            };
            // Save to Firestore
            const tripsCollection = (0, firestore_1.collection)(db, 'trips');
            const docRef = await (0, firestore_1.addDoc)(tripsCollection, tripData);
            console.log('Trip created with ID:', docRef.id);
            return docRef.id;
        }
        catch (error) {
            console.error('Error creating trip:', error);
            return null;
        }
    }
    // Get user trips with optional filters
    async getUserTrips(filters) {
        try {
            const user = FirebaseConfig_1.auth.currentUser;
            if (!user)
                return [];
            let q = (0, firestore_1.query)((0, firestore_1.collection)(db, 'trips'), (0, firestore_1.where)('userId', '==', user.uid), (0, firestore_1.orderBy)('createdAt', 'desc'));
            // Apply filters
            if (filters?.status) {
                q = (0, firestore_1.query)(q, (0, firestore_1.where)('status', '==', filters.status));
            }
            if (filters?.startDate) {
                q = (0, firestore_1.query)(q, (0, firestore_1.where)('createdAt', '>=', firestore_1.Timestamp.fromDate(filters.startDate)));
            }
            if (filters?.endDate) {
                q = (0, firestore_1.query)(q, (0, firestore_1.where)('createdAt', '<=', firestore_1.Timestamp.fromDate(filters.endDate)));
            }
            if (filters?.limit) {
                q = (0, firestore_1.query)(q, (0, firestore_1.limit)(filters.limit));
            }
            const querySnapshot = await (0, firestore_1.getDocs)(q);
            const trips = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                trips.push({
                    id: doc.id,
                    ...data,
                });
            });
            // Apply tag filter client-side (Firestore doesn't support array-contains-any with other conditions)
            if (filters?.tags && filters.tags.length > 0) {
                return trips.filter(trip => trip.tags?.some(tag => filters.tags.includes(tag)));
            }
            return trips;
        }
        catch (error) {
            console.error('Error fetching user trips:', error);
            return [];
        }
    }
    // Get active trip
    async getActiveTrip() {
        try {
            const user = FirebaseConfig_1.auth.currentUser;
            if (!user)
                return null;
            const q = (0, firestore_1.query)((0, firestore_1.collection)(db, 'trips'), (0, firestore_1.where)('userId', '==', user.uid), (0, firestore_1.where)('status', '==', 'active'), (0, firestore_1.limit)(1));
            const querySnapshot = await (0, firestore_1.getDocs)(q);
            if (querySnapshot.empty)
                return null;
            const doc = querySnapshot.docs[0];
            return {
                id: doc.id,
                ...doc.data(),
            };
        }
        catch (error) {
            console.error('Error getting active trip:', error);
            return null;
        }
    }
    // Get trip by ID
    async getTripById(tripId) {
        try {
            const user = FirebaseConfig_1.auth.currentUser;
            if (!user)
                return null;
            const tripDoc = await (0, firestore_1.getDoc)((0, firestore_1.doc)(db, 'trips', tripId));
            if (!tripDoc.exists()) {
                return null;
            }
            const tripData = tripDoc.data();
            // Verify that this trip belongs to the current user
            if (tripData.userId !== user.uid) {
                return null;
            }
            return {
                id: tripDoc.id,
                ...tripData,
            };
        }
        catch (error) {
            console.error('Error getting trip by ID:', error);
            return null;
        }
    }
    // Complete a step
    async completeStep(tripId, stepId) {
        try {
            const user = FirebaseConfig_1.auth.currentUser;
            if (!user)
                return false;
            const tripRef = (0, firestore_1.doc)(db, 'trips', tripId);
            const tripDoc = await (0, firestore_1.getDoc)(tripRef);
            if (!tripDoc.exists())
                return false;
            const tripData = tripDoc.data();
            const steps = [...tripData.steps];
            const stepIndex = steps.findIndex(step => step.id === stepId);
            if (stepIndex === -1)
                return false;
            // Update current step
            steps[stepIndex] = {
                ...steps[stepIndex],
                status: 'completed',
                endTime: firestore_1.Timestamp.now(),
            };
            // Calculate actual duration
            if (steps[stepIndex].startTime) {
                const actualDuration = firestore_1.Timestamp.now().seconds - steps[stepIndex].startTime.seconds;
                steps[stepIndex].actualDuration = actualDuration;
            }
            const updates = { steps };
            // Check if there's a next step
            if (stepIndex < steps.length - 1) {
                // Activate next step
                steps[stepIndex + 1] = {
                    ...steps[stepIndex + 1],
                    status: 'active',
                    startTime: firestore_1.Timestamp.now(),
                };
            }
            else {
                // Trip completed
                updates.status = 'completed';
                updates.endTime = firestore_1.Timestamp.now();
                // Calculate actual trip duration
                const actualDuration = firestore_1.Timestamp.now().seconds - tripData.startTime.seconds;
                updates.actualDuration = actualDuration;
            }
            await (0, firestore_1.updateDoc)(tripRef, updates);
            return true;
        }
        catch (error) {
            console.error('Error completing step:', error);
            return false;
        }
    }
    // Cancel trip
    async cancelTrip(tripId) {
        try {
            const user = FirebaseConfig_1.auth.currentUser;
            if (!user)
                return false;
            const tripRef = (0, firestore_1.doc)(db, 'trips', tripId);
            await (0, firestore_1.updateDoc)(tripRef, {
                status: 'cancelled',
                endTime: firestore_1.Timestamp.now(),
            });
            return true;
        }
        catch (error) {
            console.error('Error cancelling trip:', error);
            return false;
        }
    }
    // Add rating and notes to completed trip
    async updateTripFeedback(tripId, rating, notes) {
        try {
            const user = FirebaseConfig_1.auth.currentUser;
            if (!user)
                return false;
            const tripRef = (0, firestore_1.doc)(db, 'trips', tripId);
            await (0, firestore_1.updateDoc)(tripRef, {
                rating: Math.max(1, Math.min(5, rating)), // Ensure rating is between 1-5
                notes: notes || '',
            });
            return true;
        }
        catch (error) {
            console.error('Error updating trip feedback:', error);
            return false;
        }
    }
    // Add/remove tags
    async updateTripTags(tripId, tags) {
        try {
            const user = FirebaseConfig_1.auth.currentUser;
            if (!user)
                return false;
            const tripRef = (0, firestore_1.doc)(db, 'trips', tripId);
            await (0, firestore_1.updateDoc)(tripRef, { tags });
            return true;
        }
        catch (error) {
            console.error('Error updating trip tags:', error);
            return false;
        }
    }
    // Get trip statistics
    async getTripStats(startDate, endDate) {
        try {
            const user = FirebaseConfig_1.auth.currentUser;
            if (!user) {
                return {
                    totalTrips: 0,
                    totalDistance: 0,
                    totalDuration: 0,
                    averageDistance: 0,
                    averageDuration: 0,
                    mostUsedRoutes: [],
                    favoriteDestinations: [],
                };
            }
            const filters = { status: 'completed' };
            if (startDate)
                filters.startDate = startDate;
            if (endDate)
                filters.endDate = endDate;
            const trips = await this.getUserTrips(filters);
            const completedTrips = trips.filter(trip => trip.status === 'completed');
            if (completedTrips.length === 0) {
                return {
                    totalTrips: 0,
                    totalDistance: 0,
                    totalDuration: 0,
                    averageDistance: 0,
                    averageDuration: 0,
                    mostUsedRoutes: [],
                    favoriteDestinations: [],
                };
            }
            const totalDistance = completedTrips.reduce((sum, trip) => sum + trip.totalDistance, 0);
            const totalDuration = completedTrips.reduce((sum, trip) => sum + (trip.actualDuration || trip.estimatedDuration), 0);
            // Calculate route usage
            const routeUsage = new Map();
            const destinationUsage = new Map();
            completedTrips.forEach(trip => {
                trip.steps.forEach(step => {
                    if (step.type === 'jeepney' && step.routeName) {
                        routeUsage.set(step.routeName, (routeUsage.get(step.routeName) || 0) + 1);
                    }
                });
                destinationUsage.set(trip.endLocation.name, (destinationUsage.get(trip.endLocation.name) || 0) + 1);
            });
            const mostUsedRoutes = Array.from(routeUsage.entries())
                .map(([routeName, count]) => ({ routeName, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10);
            const favoriteDestinations = Array.from(destinationUsage.entries())
                .map(([locationName, count]) => ({ locationName, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10);
            return {
                totalTrips: completedTrips.length,
                totalDistance,
                totalDuration,
                averageDistance: totalDistance / completedTrips.length,
                averageDuration: totalDuration / completedTrips.length,
                mostUsedRoutes,
                favoriteDestinations,
            };
        }
        catch (error) {
            console.error('Error calculating trip stats:', error);
            return {
                totalTrips: 0,
                totalDistance: 0,
                totalDuration: 0,
                averageDistance: 0,
                averageDuration: 0,
                mostUsedRoutes: [],
                favoriteDestinations: [],
            };
        }
    }
    // Real-time subscription to trip updates
    subscribeToTrip(tripId, callback) {
        // Clean up any existing subscription for this trip
        const existingUnsubscribe = this.unsubscribeCallbacks.get(tripId);
        if (existingUnsubscribe) {
            existingUnsubscribe();
        }
        const tripRef = (0, firestore_1.doc)(db, 'trips', tripId);
        const unsubscribe = (0, firestore_1.onSnapshot)(tripRef, (doc) => {
            if (doc.exists()) {
                const tripData = doc.data();
                callback({
                    id: doc.id,
                    ...tripData,
                });
            }
            else {
                callback(null);
            }
        }, (error) => {
            console.error('Error in trip subscription:', error);
            callback(null);
        });
        // Store the unsubscribe function
        this.unsubscribeCallbacks.set(tripId, unsubscribe);
        // Return cleanup function
        return () => {
            unsubscribe();
            this.unsubscribeCallbacks.delete(tripId);
        };
    }
    // Cleanup all subscriptions
    cleanup() {
        this.unsubscribeCallbacks.forEach(unsubscribe => unsubscribe());
        this.unsubscribeCallbacks.clear();
    }
    // Delete trip (for testing or data cleanup)
    async deleteTrip(tripId) {
        try {
            const user = FirebaseConfig_1.auth.currentUser;
            if (!user)
                return false;
            // Verify ownership before deletion
            const tripRef = (0, firestore_1.doc)(db, 'trips', tripId);
            const tripDoc = await (0, firestore_1.getDoc)(tripRef);
            if (!tripDoc.exists())
                return false;
            const tripData = tripDoc.data();
            if (tripData.userId !== user.uid)
                return false;
            await (0, firestore_1.deleteDoc)(tripRef);
            return true;
        }
        catch (error) {
            console.error('Error deleting trip:', error);
            return false;
        }
    }
    // Helper method to calculate estimated fare
    calculateEstimatedFare(distance) {
        // Basic fare calculation for jeepney (adjust based on your local rates)
        const baseRate = 15; // PHP base rate
        const perKmRate = 2; // PHP per kilometer
        const distanceKm = distance / 1000;
        return baseRate + (distanceKm * perKmRate);
    }
    // Export trip data (for backup or analysis)
    async exportUserTrips(format = 'json') {
        try {
            const trips = await this.getUserTrips();
            if (format === 'csv') {
                // Convert to CSV format
                const headers = [
                    'id', 'status', 'startTime', 'endTime', 'startLocation', 'endLocation',
                    'totalDistance', 'estimatedDuration', 'actualDuration', 'totalFare', 'rating'
                ];
                const csvRows = trips.map(trip => [
                    trip.id,
                    trip.status,
                    trip.startTime.toDate().toISOString(),
                    trip.endTime?.toDate().toISOString() || '',
                    trip.startLocation.name,
                    trip.endLocation.name,
                    trip.totalDistance,
                    trip.estimatedDuration,
                    trip.actualDuration || '',
                    trip.totalFare || '',
                    trip.rating || ''
                ]);
                return [headers, ...csvRows].map(row => row.join(',')).join('\n');
            }
            // JSON format (default)
            return JSON.stringify(trips, null, 2);
        }
        catch (error) {
            console.error('Error exporting trips:', error);
            return '';
        }
    }
}
exports.FirestoreTripService = FirestoreTripService;
// Export singleton instance
exports.firestoreTripService = FirestoreTripService.getInstance();
