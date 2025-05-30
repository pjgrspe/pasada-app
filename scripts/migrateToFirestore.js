// scripts/migrateToFirestore.js
// Migration script to move trip data from Firebase Realtime Database to Firestore (JavaScript version)

const { auth, realtimeDb } = require('./firebaseConfigNode');
const { ref, get } = require('firebase/database');
const { firestoreTripService } = require('../services/firestoreTripService');
const { Timestamp } = require('firebase/firestore');

class TripMigrationService {
  async migrateUserTrips(userId) {
    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    try {
      console.log(`🔍 Fetching trips for user: ${userId}`);
      
      // Get trips from Realtime Database
      const userTripsRef = ref(realtimeDb, `users/${userId}/trips`);
      const snapshot = await get(userTripsRef);
      
      if (!snapshot.exists()) {
        console.log(`⚠️  No trips found for user: ${userId}`);
        return results;
      }

      const oldTrips = snapshot.val();
      const tripIds = Object.keys(oldTrips);
      
      console.log(`📊 Found ${tripIds.length} trips to migrate`);

      // Migrate each trip
      for (const tripId of tripIds) {
        try {
          console.log(`🔄 Migrating trip: ${tripId}`);
          
          const oldTrip = { id: tripId, ...oldTrips[tripId] };
          const firestoreTrip = await this.convertOldTripToFirestore(oldTrip);
          
          // Save to Firestore
          await firestoreTripService.saveTrip(userId, firestoreTrip);
          
          results.success++;
          console.log(`✅ Successfully migrated trip: ${tripId}`);
          
        } catch (error) {
          results.failed++;
          const errorMsg = `Failed to migrate trip ${tripId}: ${error.message}`;
          results.errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
        }
      }

    } catch (error) {
      const errorMsg = `Failed to fetch trips for user ${userId}: ${error.message}`;
      results.errors.push(errorMsg);
      console.error(`❌ ${errorMsg}`);
    }

    return results;
  }

  async convertOldTripToFirestore(oldTrip) {
    const steps = await this.createStepsFromCoordinates(oldTrip.routeCoordinates || []);
    
    return {
      id: oldTrip.id,
      createdAt: Timestamp.fromDate(new Date(oldTrip.date + ' ' + oldTrip.startTime)),
      updatedAt: Timestamp.fromDate(new Date()),
      userId: '', // Will be set by the service
      startLocation: this.extractLocationFromCoordinates(oldTrip.routeCoordinates, 0) || {
        latitude: 0,
        longitude: 0,
        address: oldTrip.startLocation || ''
      },
      endLocation: this.extractLocationFromCoordinates(oldTrip.routeCoordinates, -1) || {
        latitude: 0,
        longitude: 0,
        address: oldTrip.endLocation || ''
      },
      status: oldTrip.status || 'completed',
      startTime: oldTrip.startTime || '',
      endTime: oldTrip.endTime || '',
      totalDistance: this.parseDistance(oldTrip.distance),
      totalDuration: this.parseDuration(oldTrip.duration),
      steps: steps,
      metadata: {
        migratedFrom: 'realtime-database',
        migratedAt: Timestamp.fromDate(new Date()),
        originalId: oldTrip.id
      }
    };
  }

  createStepsFromCoordinates(coordinates) {
    if (!coordinates || coordinates.length < 2) {
      return [];
    }

    const steps = [];
    for (let i = 0; i < coordinates.length - 1; i++) {
      const start = coordinates[i];
      const end = coordinates[i + 1];
      const distance = this.calculateDistance(start, end);
      
      steps.push({
        id: `step-${i}`,
        type: i === 0 ? 'walk' : 'jeepney',
        startLocation: {
          latitude: start.latitude,
          longitude: start.longitude,
          address: ''
        },
        endLocation: {
          latitude: end.latitude,
          longitude: end.longitude,
          address: ''
        },
        distance: distance,
        estimatedDuration: Math.round(distance / 10), // Rough estimate: 10m/minute
        instructions: `${i === 0 ? 'Walk' : 'Take jeepney'} to destination`,
        polylinePoints: [start, end]
      });
    }

    return steps;
  }

  extractLocationFromCoordinates(coordinates, index) {
    if (!coordinates || coordinates.length === 0) {
      return null;
    }

    const coord = index === -1 ? coordinates[coordinates.length - 1] : coordinates[index];
    if (!coord) {
      return null;
    }

    return {
      latitude: coord.latitude,
      longitude: coord.longitude,
      address: ''
    };
  }

  parseDistance(distanceStr) {
    if (typeof distanceStr === 'number') {
      return distanceStr;
    }
    
    if (typeof distanceStr === 'string') {
      const match = distanceStr.match(/[\d.]+/);
      return match ? parseFloat(match[0]) : 0;
    }
    
    return 0;
  }

  parseDuration(durationStr) {
    if (typeof durationStr === 'number') {
      return durationStr;
    }
    
    if (typeof durationStr === 'string') {
      const match = durationStr.match(/[\d.]+/);
      return match ? parseFloat(match[0]) : 0;
    }
    
    return 0;
  }

  calculateDistance(point1, point2) {
    return this.haversineDistance(
      point1.latitude,
      point1.longitude,
      point2.latitude,
      point2.longitude
    );
  }

  haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }
}

// Main execution logic for command-line usage
async function main() {
  const userId = process.argv[2];
  
  if (!userId) {
    console.error('❌ Error: User ID is required');
    console.log('Usage: node migrateToFirestore.js <userId>');
    console.log('Example: node migrateToFirestore.js user123');
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

module.exports = { TripMigrationService, main };
