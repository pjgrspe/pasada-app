// scripts/migrateToFirestore.ts
// Migration script to move trip data from Firebase Realtime Database to Firestore
import { auth } from '../FirebaseConfig';
import { getDatabase, ref, get } from 'firebase/database';
import { firestoreTripService, FirestoreTrip, FirestoreTripStep } from '../services/firestoreTripService';
import { Timestamp } from 'firebase/firestore';

const realtimeDb = getDatabase();

interface OldTrip {
  id?: string;
  date: string;
  startTime: string;
  endTime: string;
  startLocation: string;
  endLocation: string;
  distance: string;
  duration: string;
  status: 'active' | 'completed' | 'cancelled';
  routeCoordinates?: { latitude: number; longitude: number }[];
  steps?: any[];
}

export class TripMigrationService {
  async migrateUserTrips(userId: string): Promise<{ success: number; failed: number; errors: string[] }> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    try {
      console.log(`Starting migration for user: ${userId}`);

      // Get all trips from Realtime Database
      const tripsRef = ref(realtimeDb, `trips/${userId}`);
      const snapshot = await get(tripsRef);

      if (!snapshot.exists()) {
        console.log('No trips found in Realtime Database');
        return results;
      }

      const oldTrips = snapshot.val() as Record<string, OldTrip>;
      console.log(`Found ${Object.keys(oldTrips).length} trips to migrate`);

      // Process each trip
      for (const [tripId, oldTrip] of Object.entries(oldTrips)) {
        try {
          const firestoreTrip = await this.convertOldTripToFirestore(tripId, oldTrip, userId);
            // Create the trip in Firestore
          const newTripId = await firestoreTripService.createTrip(
            firestoreTrip.startLocation,
            firestoreTrip.endLocation,
            firestoreTrip.selectedRouteIndex || 0,
            firestoreTrip.steps.map(step => ({
              type: step.type as 'walk' | 'jeepney',
              routeId: step.routeId,
              routeName: step.routeName,
              routeColor: step.routeColor,
              coordinates: step.coordinates,
              instructions: step.instructions || '',
              distance: step.distance,
              duration: step.duration
            }))
          );

          if (newTripId) {
            // Update with additional data that wasn't available during creation
            await this.updateTripWithMigrationData(newTripId, firestoreTrip);
            results.success++;
            console.log(`Successfully migrated trip: ${tripId} -> ${newTripId}`);
          } else {
            results.failed++;
            results.errors.push(`Failed to create Firestore trip for: ${tripId}`);
          }
        } catch (error) {
          results.failed++;
          results.errors.push(`Error migrating trip ${tripId}: ${(error as Error).message}`);
          console.error(`Error migrating trip ${tripId}:`, error);
        }
      }

      console.log(`Migration completed. Success: ${results.success}, Failed: ${results.failed}`);
      return results;

    } catch (error) {
      console.error('Migration failed:', error);
      results.errors.push(`Migration failed: ${(error as Error).message}`);
      return results;
    }
  }

  private async convertOldTripToFirestore(oldTripId: string, oldTrip: OldTrip, userId: string): Promise<FirestoreTrip> {
    // Parse the old trip data
    const startDate = new Date(oldTrip.date + ' ' + oldTrip.startTime);
    const endDate = oldTrip.endTime !== 'In progress' ? new Date(oldTrip.date + ' ' + oldTrip.endTime) : null;

    // Convert distance from string (e.g., "5.2 km") to meters
    const distanceInKm = parseFloat(oldTrip.distance.replace(' km', '')) || 0;
    const totalDistance = distanceInKm * 1000;

    // Convert duration from string (e.g., "25m") to seconds
    const durationMatch = oldTrip.duration.match(/(\d+)m/);
    const estimatedDuration = durationMatch ? parseInt(durationMatch[1]) * 60 : 0;

    // Create basic trip steps from route coordinates
    const steps = this.createStepsFromCoordinates(oldTrip.routeCoordinates || []);

    // Extract start and end locations from coordinates or use string locations
    const startLocation = this.extractLocationFromCoordinates(
      oldTrip.routeCoordinates?.[0],
      oldTrip.startLocation
    );    const endLocation = this.extractLocationFromCoordinates(
      oldTrip.routeCoordinates?.[oldTrip.routeCoordinates.length - 1],
      oldTrip.endLocation
    );

    return {
      id: undefined, // Will be set by Firestore
      userId,
      startLocation,
      endLocation,
      selectedRouteIndex: 0, // Default value for migration
      steps,
      status: oldTrip.status,
      createdAt: Timestamp.fromDate(startDate),
      startTime: Timestamp.fromDate(startDate),
      endTime: endDate ? Timestamp.fromDate(endDate) : null,
      estimatedDuration,
      actualDuration: endDate ? Math.floor((endDate.getTime() - startDate.getTime()) / 1000) : undefined,
      totalDistance,
      totalFare: undefined, // Not available in old data
      rating: undefined, // Not available in old data
      notes: undefined, // Not available in old data
      tags: [], // Not available in old data
    };
  }

  private createStepsFromCoordinates(coordinates: { latitude: number; longitude: number }[]): FirestoreTripStep[] {
    if (coordinates.length < 2) {
      return [];
    }

    const steps: FirestoreTripStep[] = [];
    
    // Create a simple walking step for the entire route
    // In a real migration, you might want to preserve more detailed step information
    const step: FirestoreTripStep = {
      id: 'migrated-step-1',
      type: 'walk',
      startLocation: {
        name: 'Start',
        latitude: coordinates[0].latitude,
        longitude: coordinates[0].longitude,
      },
      endLocation: {
        name: 'End',
        latitude: coordinates[coordinates.length - 1].latitude,
        longitude: coordinates[coordinates.length - 1].longitude,
      },
      status: 'completed',
      distance: this.calculateDistance(coordinates),
      duration: 0, // Will be calculated
      startTime: null,
      endTime: null,
      coordinates: coordinates,
      instructions: 'Migrated route from Realtime Database'
    };

    steps.push(step);
    return steps;
  }

  private extractLocationFromCoordinates(
    coordinate?: { latitude: number; longitude: number },
    fallbackName?: string
  ) {
    return {
      name: fallbackName || 'Unknown Location',
      latitude: coordinate?.latitude || 0,
      longitude: coordinate?.longitude || 0,
      placeId: undefined // Use undefined instead of null for optional property
    };
  }

  private calculateDistance(coordinates: { latitude: number; longitude: number }[]): number {
    if (coordinates.length < 2) return 0;

    let totalDistance = 0;
    for (let i = 1; i < coordinates.length; i++) {
      totalDistance += this.haversineDistance(coordinates[i - 1], coordinates[i]);
    }
    return totalDistance;
  }

  private haversineDistance(
    coord1: { latitude: number; longitude: number },
    coord2: { latitude: number; longitude: number }
  ): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.degToRad(coord2.latitude - coord1.latitude);
    const dLon = this.degToRad(coord2.longitude - coord1.longitude);
    
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.degToRad(coord1.latitude)) *
        Math.cos(this.degToRad(coord2.latitude)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private degToRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  private async updateTripWithMigrationData(tripId: string, firestoreTrip: FirestoreTrip): Promise<void> {
    // Update the trip with status and timing information that couldn't be set during creation
    if (firestoreTrip.status === 'completed' && firestoreTrip.endTime) {
      // Mark all steps as completed
      for (const step of firestoreTrip.steps) {
        await firestoreTripService.completeStep(tripId, step.id);
      }
    }
    
    // Handle cancelled trips
    if (firestoreTrip.status === 'cancelled') {
      await firestoreTripService.cancelTrip(tripId);
    }
  }
}

// Usage function for running the migration
export async function runMigration(userId?: string): Promise<void> {
  try {
    const currentUser = auth.currentUser;
    const targetUserId = userId || currentUser?.uid;

    if (!targetUserId) {
      throw new Error('No user ID provided and no authenticated user found');
    }

    console.log('Starting trip migration...');
    const migrationService = new TripMigrationService();
    const results = await migrationService.migrateUserTrips(targetUserId);

    console.log('\n=== Migration Results ===');
    console.log(`Successfully migrated: ${results.success} trips`);
    console.log(`Failed migrations: ${results.failed} trips`);
    
    if (results.errors.length > 0) {
      console.log('\nErrors encountered:');      results.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }
    
    console.log('\nMigration completed!');
  } catch (error) {
    console.error('Migration script failed:', error);
  }
}

export default TripMigrationService;

// Main execution logic for command-line usage
async function main() {
  const userId = process.argv[2];
  
  if (!userId) {
    console.error('❌ Error: User ID is required');
    console.log('Usage: npx ts-node migrateToFirestore.ts <userId>');
    console.log('Example: npx ts-node migrateToFirestore.ts user123');
    process.exit(1);
  }
  
  console.log(`🔄 Starting migration for user: ${userId}\n`);
  
  try {
    const migrationService = new TripMigrationService();
    const results = await migrationService.migrateUserTrips(userId);
      console.log('\n📊 Migration Summary:');
    console.log(`✅ Successfully migrated: ${results.success} trips`);
    console.log(`❌ Failed migrations: ${results.failed} trips`);
    
    if (results.errors.length > 0) {
      console.log('\n🚨 Errors encountered:');
      results.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }
    
    console.log('\n🎉 Migration completed!');
    process.exit(0);
  } catch (error) {
    console.error('💥 Migration script failed:', error);
    process.exit(1);
  }
}

// Run main function if this script is executed directly
if (require.main === module) {
  main();
}
