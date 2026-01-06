import { GAME_STRUCTURE } from '../config/gameConfig.js';

// Game Constants - MVG Version
// These will be updated when scaling to full game

// Grid Configuration
export const GRID_SIZE = 5; // 5x5 grid = 25 squares

// Population Configuration
export const CITIZEN_COUNT = 10; // 8 civilians + 2 wardens
export const STARTING_WARDENS = 2;

// Game Duration (from config)
export const TOTAL_DAYS = GAME_STRUCTURE.totalDays;

// Crime Density Values
export const CRIME_DENSITY = {
  LOW: 0.2,
  MEDIUM: 0.5,
  HIGH: 0.8
};

// Trust Levels
export const TRUST_LEVELS = {
  TRUSTING: 'trusting',
  NEUTRAL: 'neutral',
  WARY: 'wary',
  HOSTILE: 'hostile'
};

// Crime Types
export const CRIME_TYPES = {
  ASSAULT: 'assault',
  THEFT: 'theft',
  VANDALISM: 'vandalism',
  HARASSMENT: 'harassment',
  TRAFFIC: 'traffic'
};

// Crime Status
export const CRIME_STATUS = {
  PREVENTED: 'prevented',
  RESPONDED: 'responded',
  REPORTED: 'reported',
  UNREPORTED: 'unreported'
};

// Warden Configuration
export const PATROL_RADIUS = 1; // Fixed for MVG (3x3 coverage)
