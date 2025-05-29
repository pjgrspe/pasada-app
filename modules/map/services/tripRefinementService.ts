// pasada-gemini/modules/map/services/tripRefinementService.ts
import { Coordinate, PlannedTripLeg } from '../utils/routeTypes'; // Adjusted path
import { useMapStore } from '../store/useMapStore'; // Adjusted path
// Import the individual refinement strategies
import {
    refineOverlappingWalkAfterJeep,
    refineInitialWalk,
    refineFinalWalk,
    refineTransferWalk
} from './refinementStrategies'; // Import from the new strategies file

/**
 * Main orchestrator for refining trip legs.
 * Applies a series of refinement strategies to optimize the planned trip.
 */
export async function postProcessTripLegs(
    legs: PlannedTripLeg[],
    finalDestination: Coordinate
): Promise<PlannedTripLeg[]> {
    const { setLoadingStatus } = useMapStore.getState();
    
    if (legs.length === 0) return legs;

    setLoadingStatus('🔧 Starting route optimization process...');

    // Create a deep copy of the legs to mutate, ensuring the original array is not modified.
    let refinedLegs: PlannedTripLeg[] = JSON.parse(JSON.stringify(legs));

    const MAX_REFINEMENT_ITERATIONS = 3; // Limit iterations to prevent infinite loops and control processing time.
    for (let iter = 0; iter < MAX_REFINEMENT_ITERATIONS; iter++) {
        setLoadingStatus(`🔄 Optimization pass ${iter + 1}/3 - Analyzing ${refinedLegs.length} route segments...`);
        
        let legsChangedInIteration = false;
        // Work on a copy for the current iteration to correctly manage changes.
        const currentIterationLegs: PlannedTripLeg[] = JSON.parse(JSON.stringify(refinedLegs));

        for (let i = 0; i < currentIterationLegs.length; i++) {
            const currentLeg = currentIterationLegs[i];

            // Strategy 1: Refine overlapping walk after a jeepney leg
            if (currentLeg.type === 'walk' && i > 0 && currentIterationLegs[i - 1]?.type === 'jeepney') {
                const prevJeepLeg = currentIterationLegs[i - 1];
                setLoadingStatus(`⚡ Optimizing walk segment after ${prevJeepLeg.routeName || 'jeepney'}...`);
                
                const { updatedPrevJeepLeg, updatedWalkLeg } = await refineOverlappingWalkAfterJeep(
                    prevJeepLeg,
                    currentLeg
                );
                // Check if the distance actually changed to confirm a modification
                if (updatedPrevJeepLeg.distance !== prevJeepLeg.distance || updatedWalkLeg.distance !== currentLeg.distance ) {
                    currentIterationLegs[i - 1] = updatedPrevJeepLeg;
                    currentIterationLegs[i] = updatedWalkLeg; // Update current leg for subsequent checks in this loop
                    legsChangedInIteration = true;
                }
            }

            // Re-fetch currentLeg as it might have been updated by the previous strategy
            const legToRefine = currentIterationLegs[i];

            // Strategy 2: Refine specific types of walk legs (initial, final, transfer)
            if (legToRefine.type === 'walk') {
                if (i === 0 && currentIterationLegs.length > 1 && currentIterationLegs[i+1]?.type === 'jeepney') {
                    // Initial Walk
                    const nextJeepLeg = currentIterationLegs[i+1];
                    setLoadingStatus(`🚶 Optimizing initial walk to ${nextJeepLeg.routeName || 'jeepney'}...`);
                    
                    const { refinedWalkLeg, updatedNextJeepLeg } = await refineInitialWalk(legToRefine, nextJeepLeg);
                    if (refinedWalkLeg.distance !== legToRefine.distance || updatedNextJeepLeg.distance !== nextJeepLeg.distance) {
                        currentIterationLegs[i] = refinedWalkLeg;
                        currentIterationLegs[i+1] = updatedNextJeepLeg;
                        legsChangedInIteration = true;
                    }
                } else if (i === currentIterationLegs.length - 1 && i > 0 && currentIterationLegs[i-1]?.type === 'jeepney') {
                    // Final Walk
                    const prevJeepLeg = currentIterationLegs[i-1];
                    setLoadingStatus(`🎯 Optimizing final walk from ${prevJeepLeg.routeName || 'jeepney'}...`);
                    
                    const { updatedPrevJeepLeg, refinedWalkLeg } = await refineFinalWalk(prevJeepLeg, legToRefine, finalDestination);
                    if (updatedPrevJeepLeg.distance !== prevJeepLeg.distance || refinedWalkLeg.distance !== legToRefine.distance) {
                        currentIterationLegs[i-1] = updatedPrevJeepLeg;
                        currentIterationLegs[i] = refinedWalkLeg;
                        legsChangedInIteration = true;
                    }
                } else if (i > 0 && i < currentIterationLegs.length - 1 && currentIterationLegs[i-1]?.type === 'jeepney' && currentIterationLegs[i+1]?.type === 'jeepney') {
                    // Transfer Walk
                    const prevJeepLeg = currentIterationLegs[i-1];
                    const nextJeepLeg = currentIterationLegs[i+1];
                    setLoadingStatus(`🔄 Optimizing transfer from ${prevJeepLeg.routeName || 'jeepney'} to ${nextJeepLeg.routeName || 'jeepney'}...`);
                    
                    const { updatedPrevJeepLeg, refinedWalkLeg, updatedNextJeepLeg } = await refineTransferWalk(prevJeepLeg, legToRefine, nextJeepLeg);
                     if (updatedPrevJeepLeg.distance !== prevJeepLeg.distance || refinedWalkLeg.distance !== legToRefine.distance || updatedNextJeepLeg.distance !== nextJeepLeg.distance) {
                        currentIterationLegs[i-1] = updatedPrevJeepLeg;
                        currentIterationLegs[i] = refinedWalkLeg;
                        currentIterationLegs[i+1] = updatedNextJeepLeg;
                        legsChangedInIteration = true;
                    }
                }
            }
        }
        // Update the main refinedLegs array with changes from this iteration.
        refinedLegs = JSON.parse(JSON.stringify(currentIterationLegs));

        if (!legsChangedInIteration) {
            // If no legs were changed in this iteration, further iterations are unlikely to yield more refinements.
            setLoadingStatus('✅ Route optimization complete - No further improvements possible');
            break;
        } else {
            setLoadingStatus(`💡 Pass ${iter + 1} improved route efficiency`);
        }
    }

    setLoadingStatus('📋 Finalizing optimized route segments...');

    // Final filtering of legs that might have become too short or invalid after refinement.
    const finalFilteredLegs = refinedLegs.filter(leg =>
        leg.coordinates &&
        leg.coordinates.length > 0 && // Leg must have some path
        (
            (leg.type === 'walk' && typeof leg.distance === 'number' && leg.distance > 1) || // Walk legs must be more than 1 meter
            (leg.type === 'jeepney' && typeof leg.distance === 'number' && leg.distance > 10) // Jeepney legs should be meaningful
        )
    );

    return finalFilteredLegs;
}
