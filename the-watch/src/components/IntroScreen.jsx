import React from 'react';

/**
 * IntroScreen Component
 * Welcome screen with game premise and instructions
 */
export default function IntroScreen({ onStart }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-gray-900 text-white flex items-center justify-center p-8">
      <div className="max-w-3xl">
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-6xl font-bold mb-4">The Watch</h1>
          <p className="text-xl text-gray-300">A Game About Authority, Surveillance, and Trust</p>
        </div>

        {/* Story Setup */}
        <div className="bg-white bg-opacity-10 backdrop-blur rounded-lg p-8 mb-6">
          <h2 className="text-2xl font-semibold mb-4">The Situation</h2>
          <div className="space-y-3 text-gray-200 leading-relaxed">
            <p>
              You've been appointed to lead <strong>The Watch</strong> - a new law enforcement initiative 
              in a small community struggling with crime.
            </p>
            <p>
              You have <strong>2 wardens</strong> to deploy across a <strong>5×5 grid</strong> representing 
              the neighborhood. Each warden patrols a 3×3 area around their position.
            </p>
            <p>
              Over <strong>3 days</strong>, you'll position your wardens and watch the results unfold. 
              At the end, an independent audit will reveal the hidden consequences of your choices.
            </p>
          </div>
        </div>

        {/* The Catch */}
        <div className="bg-red-900 bg-opacity-30 backdrop-blur rounded-lg p-8 mb-6 border-2 border-red-500">
          <h2 className="text-2xl font-semibold mb-4 flex items-center">
            <span className="mr-2">⚠️</span> The Catch
          </h2>
          <div className="space-y-3 text-gray-200 leading-relaxed">
            <p>
              <strong>Power corrupts.</strong> The longer wardens are deployed, the more corrupt they become. 
              Boredom in quiet areas accelerates this. Burnout in busy areas does too.
            </p>
            <p>
              <strong>Surveillance erodes trust.</strong> Citizens in heavily patrolled areas lose faith 
              in the system, even as crime decreases.
            </p>
            <p>
              <strong>The data lies.</strong> Daily reports show crime statistics, but they don't reveal 
              corruption or trust levels. You're operating blind until the final audit.
            </p>
          </div>
        </div>

        {/* How to Play */}
        <div className="bg-white bg-opacity-10 backdrop-blur rounded-lg p-8 mb-6">
          <h2 className="text-2xl font-semibold mb-4">How to Play</h2>
          <ol className="space-y-2 text-gray-200 list-decimal list-inside">
            <li><strong>Position wardens:</strong> Click a warden, then click a square to move them</li>
            <li><strong>Run the day:</strong> Click "Run Day" to simulate 24 hours</li>
            <li><strong>Review the report:</strong> See what crimes occurred and how wardens responded</li>
            <li><strong>Adjust strategy:</strong> Reposition wardens for the next day</li>
            <li><strong>Face the audit:</strong> After 3 days, discover the true cost of your approach</li>
          </ol>
        </div>

        {/* The Question */}
        <div className="bg-white bg-opacity-10 backdrop-blur rounded-lg p-6 mb-8 text-center">
          <p className="text-xl italic text-gray-300">
            "Can you maintain order without becoming what you're trying to prevent?"
          </p>
        </div>

        {/* Start Button */}
        <div className="text-center">
          <button
            onClick={onStart}
            className="px-12 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg transition-colors text-xl"
          >
            Begin The Watch
          </button>
        </div>

        {/* Footer Note */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-400">
            This is a 3-day simulation. Each playthrough takes about 5-10 minutes.
          </p>
        </div>
      </div>
    </div>
  );
}
