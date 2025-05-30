#!/usr/bin/env node

/**
 * Script to verify that the Firestore migration is working correctly
 * This script checks that trip operations are now using Firestore instead of Realtime Database
 */

import { firestoreTripService } from '../services/firestoreTripService';
import { PlannedTripLeg } from '../modules/map/utils/routeTypes';

const testMigration = async () => {
  console.log('🔍 Verifying Firestore migration...');
  
  try {
    // Test 1: Check if we can create a test trip
    console.log('\n1. Testing trip creation...');
    
    const startLocation = {
      name: 'Test Start Location',
      latitude: 14.5995,
      longitude: 120.9842
    };
    
    const endLocation = {
      name: 'Test End Location',
      latitude: 14.6042,
      longitude: 120.9822
    };
    
    const mockTripLegs: PlannedTripLeg[] = [
      {
        type: 'walk',
        distance: 500,
        duration: 300,
        coordinates: [
          { latitude: 14.5995, longitude: 120.9842 },
          { latitude: 14.6000, longitude: 120.9840 }
        ],
        instructions: 'Walk to boarding point'
      },
      {
        type: 'jeepney',
        distance: 2000,
        duration: 600,
        routeName: 'Test Route',
        routeColor: '#FF0000',
        coordinates: [
          { latitude: 14.6000, longitude: 120.9840 },
          { latitude: 14.6040, longitude: 120.9825 }
        ],
        instructions: 'Take jeepney to destination'
      },
      {
        type: 'walk',
        distance: 200,
        duration: 120,
        coordinates: [
          { latitude: 14.6040, longitude: 120.9825 },
          { latitude: 14.6042, longitude: 120.9822 }
        ],
        instructions: 'Walk to final destination'
      }
    ];
    
    const tripId = await firestoreTripService.createTrip(
      startLocation,
      endLocation,
      0,
      mockTripLegs
    );
    
    if (tripId) {
      console.log('✅ Trip creation successful! Trip ID:', tripId);
      
      // Test 2: Check if we can retrieve the trip
      console.log('\n2. Testing trip retrieval...');
      const retrievedTrip = await firestoreTripService.getTripById(tripId);
      
      if (retrievedTrip) {
        console.log('✅ Trip retrieval successful!');
        console.log('   - Status:', retrievedTrip.status);
        console.log('   - Steps:', retrievedTrip.steps.length);
        console.log('   - Start Location:', retrievedTrip.startLocation.name);
        console.log('   - End Location:', retrievedTrip.endLocation.name);
        
        // Test 3: Complete first step
        console.log('\n3. Testing step completion...');
        const firstStep = retrievedTrip.steps[0];
        const stepCompleted = await firestoreTripService.completeStep(tripId, firstStep.id);
        
        if (stepCompleted) {
          console.log('✅ Step completion successful!');
          
          // Test 4: Complete trip by completing all remaining steps
          console.log('\n4. Testing trip completion...');
          let success = true;
          for (let i = 1; i < retrievedTrip.steps.length; i++) {
            const stepSuccess = await firestoreTripService.completeStep(tripId, retrievedTrip.steps[i].id);
            if (!stepSuccess) {
              success = false;
              break;
            }
          }
          
          if (success) {
            console.log('✅ Trip completion successful!');
            
            // Test 5: Verify trip is marked as completed
            console.log('\n5. Verifying trip status...');
            const completedTrip = await firestoreTripService.getTripById(tripId);
            
            if (completedTrip && completedTrip.status === 'completed') {
              console.log('✅ Trip is correctly marked as completed in Firestore!');
              
              // Test 6: Get user trips to verify it appears in the list
              console.log('\n6. Testing trip listing...');
              const userTrips = await firestoreTripService.getUserTrips({
                status: 'completed',
                limit: 5
              });
              
              const foundTrip = userTrips.find(trip => trip.id === tripId);
              if (foundTrip) {
                console.log('✅ Completed trip appears in user trips list!');
                
                // Clean up test trip
                console.log('\n7. Cleaning up test data...');
                const deleted = await firestoreTripService.deleteTrip(tripId);
                if (deleted) {
                  console.log('✅ Test trip cleaned up successfully!');
                } else {
                  console.log('⚠️ Could not clean up test trip');
                }
                
                console.log('\n🎉 MIGRATION VERIFICATION COMPLETE!');
                console.log('✅ All tests passed - completed trips are now being saved to Firestore!');
                
              } else {
                console.log('❌ Trip not found in user trips list');
              }
            } else {
              console.log('❌ Trip status not updated correctly');
            }
          } else {
            console.log('❌ Failed to complete all trip steps');
          }
        } else {
          console.log('❌ Step completion failed');
        }
      } else {
        console.log('❌ Trip retrieval failed');
      }
    } else {
      console.log('❌ Trip creation failed');
    }
    
  } catch (error) {
    console.error('❌ Migration verification failed:', error);
    console.log('\nNote: Make sure you are authenticated and have proper Firestore permissions.');
  }
};

// Only run if called directly
if (require.main === module) {
  testMigration();
}

export { testMigration };
