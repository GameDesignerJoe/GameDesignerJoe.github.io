import React from 'react';
import MapView from './MapView.jsx';

/**
 * IncidentReport Component
 * Displays daily crime statistics, map visualization, and notable incidents
 */
export default function IncidentReport({ report, day, onContinue, isLastDay, grid, wardens }) {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Crime Map Visualization */}
        {grid && wardens && (
          <div className="bg-white rounded-lg shadow-xl p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Crime Map - Day {day}</h2>
            <MapView
              grid={grid}
              wardens={wardens}
              selectedWardenId={null}
              onSquareClick={() => {}} // No interaction in report view
              onWardenClick={() => {}} // No interaction in report view
              showCrimes={true}
            />
            {/* Legend */}
            <div className="mt-4 flex flex-wrap gap-4 justify-center text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-green-500 border border-white"></div>
                <span>Prevented</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-blue-500 border border-white"></div>
                <span>Responded</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500 border border-white"></div>
                <span>Reported</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-red-500 border border-white"></div>
                <span>Unreported</span>
              </div>
            </div>
          </div>
        )}

        {/* Report Stats */}
        <div className="bg-white rounded-lg shadow-xl p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6 border-b pb-4">
            Day {day} Incident Report
          </h1>

          {/* Crime Summary */}
          <section className="mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Crime Summary</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Crimes Prevented</p>
                <p className="text-3xl font-bold text-green-700">{report.crimesPrevented}</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Crimes Responded</p>
                <p className="text-3xl font-bold text-blue-700">{report.crimesResponded}</p>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Crimes Reported</p>
                <p className="text-3xl font-bold text-yellow-700">{report.crimesReported}</p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Estimated Unreported</p>
                <p className="text-3xl font-bold text-red-700">
                  {report.estimatedUnreported.min}-{report.estimatedUnreported.max}
                </p>
              </div>
            </div>
          </section>

          {/* Watch Deployment */}
          <section className="mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Watch Deployment</h2>
            <div className="bg-gray-50 p-4 rounded-lg">
              {report.wardenDeployment.map(warden => (
                <div key={warden.id} className="flex items-center space-x-3 mb-2">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                    W{warden.id + 1}
                  </div>
                  <span className="text-sm text-gray-700">
                    Grid [{warden.position.x}, {warden.position.y}] - Patrol Radius 1
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Notable Incidents */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Notable Incidents</h2>
            <div className="space-y-2">
              {report.notableIncidents.length > 0 ? (
                report.notableIncidents.map((incident, idx) => (
                  <div key={idx} className="bg-gray-50 p-3 rounded text-sm text-gray-700 border-l-4 border-blue-500">
                    • {incident}
                  </div>
                ))
              ) : (
                <p className="text-gray-500 italic">No notable incidents to report</p>
              )}
            </div>
          </section>

          {/* Continue Button */}
          <div className="text-center">
            <button
              onClick={onContinue}
              className="px-8 py-3 bg-blue-600 text-white font-bold rounded-lg shadow-md hover:bg-blue-700 transition-colors"
            >
              {isLastDay ? 'View Independent Audit Results' : `Continue to Day ${day + 1}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
