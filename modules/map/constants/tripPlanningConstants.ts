// pasada-gemini/modules/map/constants/tripPlanningConstants.ts

export const MAX_WALK_TO_JEEP_METERS = 700;
export const MAX_FINAL_WALK_METERS = 1500;
export const ALIGNMENT_PROXIMITY_THRESHOLD_METERS = 200;
export const MIN_JEEP_RIDE_PROGRESS_METERS = 200;
export const DESIRED_PATH_SEARCH_AHEAD_METERS = 600;
export const DIVERGENCE_THRESHOLD_METERS = 250;
export const JEEP_TERMINAL_NO_BOARD_VERTEX_COUNT = 25;

// Constants for Post-Processing Refinement Optimization
export const REFINE_SEARCH_RADIUS_METERS = 120; // General search radius for refinements
export const REFINE_MIN_WALK_SAVING_METERS = 50; // General minimum saving for a walk leg refinement
export const REFINE_MAX_WALK_FOR_CONNECTION = 400;
export const MIN_CANDIDATE_SEPARATION_METERS = 40;
export const REFINE_EARLY_EXIT_WALK_THRESHOLD = 15;
export const ALIGHTING_POINT_SEARCH_TOLERANCE_METERS = 50;
export const OVERLAP_CUT_THRESHOLD_METERS = 30;
export const OVERLAP_WALK_POINTS_TO_CHECK_V7 = 4;
export const MAX_TRIP_OPTIONS_TO_RETURN = 3;

export const MAX_TRIP_LEGS = 10;

// Constants for Direct Route Optimization
export const DIRECT_BOARDING_PROXIMITY_THRESHOLD = 75;
export const MIN_SAVING_FOR_DIRECT_ROUTE_SWITCH_METERS = 200;

// --- Constants for Trip Option Evaluation & Filtering ---
export const TRANSFER_PENALTY_SCORE = 50000;
export const WALK_METER_PENALTY_SCORE = 1;
export const JEEP_DURATION_PENALTY_SCORE = 0.5;
export const INITIAL_WALK_PENALTY_MULTIPLIER = 1.5;
export const SIMILARITY_FINGERPRINT_COORD_PRECISION = 4;
export const SIMILARITY_MAX_WALK_DIFF_METERS = 250;
export const SIMILARITY_MAX_DURATION_DIFF_SECONDS = 300;
export const SIMILARITY_TRANSFER_POINT_PROXIMITY_METERS = 100;
// export const SIMILARITY_TERMINAL_POINT_PROXIMITY_METERS = 150; // Not currently used
// export const SIMILARITY_ROUTE_SEQUENCE_MUST_MATCH = true; // Logic embedded

// --- Constants for Individual Walk-to-Jeep Connection Optimization ---
// export const WALK_OPTIMIZATION_SEARCH_RADIUS_METERS = 200; // REMOVED - Will be dynamic
export const MIN_WALK_SAVING_FOR_CONNECTION_OPTIMIZATION = 30; // New walk must be at least this much shorter
