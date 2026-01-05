/**
 * Type definitions for The Watch game
 * These define the shape of all game objects
 */

/**
 * @typedef {Object} Citizen
 * @property {number} id
 * @property {{x: number, y: number}} homeLocation
 * @property {'trusting' | 'neutral' | 'wary' | 'hostile'} trustLevel
 * @property {number} watchExposure - Cumulative days in patrolled areas
 * @property {boolean} isWarden
 * @property {number|null} wardenId - Reference to Warden if recruited
 */

/**
 * @typedef {Object} Warden
 * @property {number} id
 * @property {number} citizenId - Which citizen became this warden
 * @property {{x: number, y: number}} position
 * @property {number} patrolRadius - Fixed at 1 for MVG
 * @property {number} corruptionLevel - 0-100, hidden from player
 * @property {number} daysEmployed
 * @property {number} incidentsHandled
 * @property {CorruptAction[]} corruptActions - Logged for audit
 */

/**
 * @typedef {Object} CorruptAction
 * @property {number} day
 * @property {'excessive_force' | 'false_arrest' | 'harassment' | 'planting_evidence'} type
 * @property {{x: number, y: number}} location
 * @property {string} description
 * @property {number[]} affectedCitizenIds
 */

/**
 * @typedef {Object} GridSquare
 * @property {number} x
 * @property {number} y
 * @property {number} crimeDensity - 0.2, 0.5, or 0.8
 * @property {Crime[]} crimes - Crimes that occurred here
 */

/**
 * @typedef {Object} Crime
 * @property {number} id
 * @property {{x: number, y: number}} location
 * @property {string} timeOfDay - "2:34pm" for flavor
 * @property {'assault' | 'theft' | 'vandalism' | 'harassment' | 'traffic'} type
 * @property {'prevented' | 'responded' | 'reported' | 'unreported'} status
 * @property {number|null} wardenResponder
 * @property {boolean} isWardenGenerated - If corrupt warden created it
 */

/**
 * @typedef {Object} Report
 * @property {number} day
 * @property {number} crimesPrevented
 * @property {number} crimesResponded
 * @property {number} crimesReported
 * @property {{min: number, max: number}} estimatedUnreported
 * @property {string[]} notableIncidents - 2-4 descriptive strings
 * @property {{id: number, position: {x: number, y: number}}[]} wardenDeployment
 */

/**
 * @typedef {Object} AuditData
 * @property {number} reportedCrimesTotal
 * @property {number} actualCrimesTotal
 * @property {number} unreportedCrimesTotal
 * @property {number} averageHappiness - 0-100
 * @property {{trusting: number, neutral: number, wary: number, hostile: number}} trustDistribution
 * @property {WardenAuditDetail[]} wardenCorruption
 * @property {string} classification
 */

/**
 * @typedef {Object} WardenAuditDetail
 * @property {number} wardenId
 * @property {number} corruptionLevel
 * @property {string[]} actions - Descriptive list
 */

/**
 * @typedef {Object} GameState
 * @property {number} currentDay - 1-3
 * @property {'placement' | 'transition' | 'report' | 'audit'} phase
 * @property {Citizen[]} citizens
 * @property {Warden[]} wardens
 * @property {GridSquare[]} grid
 * @property {Report[]} dailyReports
 * @property {AuditData|null} finalAudit
 * @property {number|null} selectedWardenId - UI state
 */

export {};
