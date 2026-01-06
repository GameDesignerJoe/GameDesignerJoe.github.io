import React from 'react';

/**
 * AuditResults Component
 * Displays the independent audit - the big reveal
 */
export default function AuditResults({ auditResults, onRestart }) {
  const getOutcomeColor = (outcome) => {
    const colors = {
      balanced: 'text-green-600',
      authoritarian: 'text-red-600',
      neglectful: 'text-yellow-600',
      chaos: 'text-purple-600',
      mixed: 'text-blue-600'
    };
    return colors[outcome] || 'text-gray-600';
  };

  const getOutcomeLabel = (outcome) => {
    const labels = {
      balanced: 'Balanced Approach',
      authoritarian: 'Authoritarian Control',
      neglectful: 'Neglectful Oversight',
      chaos: 'Systemic Failure',
      mixed: 'Mixed Results'
    };
    return labels[outcome] || 'Unknown';
  };

  const getScoreColor = (score) => {
    if (score >= 70) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-blue-900 text-white p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-4">Independent Audit Results</h1>
          <p className="text-xl text-gray-300">3-Day Review - Final Evaluation</p>
        </div>

        {/* Outcome Classification */}
        <div className="bg-white bg-opacity-10 backdrop-blur rounded-lg p-8 mb-6 text-center">
          <h2 className="text-2xl font-semibold mb-4">Outcome Classification</h2>
          <p className={`text-4xl font-bold mb-2 ${getOutcomeColor(auditResults.outcome)}`}>
            {getOutcomeLabel(auditResults.outcome)}
          </p>
          <div className="text-lg text-gray-300 mt-4">
            Overall Score: <span className={`font-bold text-2xl ${getScoreColor(auditResults.scores.overall)}`}>
              {auditResults.scores.overall}/100
            </span>
          </div>
        </div>

        {/* Score Breakdown */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white bg-opacity-10 backdrop-blur rounded-lg p-6 text-center">
            <h3 className="text-lg font-semibold mb-2">Crime Control</h3>
            <p className={`text-4xl font-bold ${getScoreColor(auditResults.scores.crimeControl)}`}>
              {auditResults.scores.crimeControl}
            </p>
            <p className="text-sm text-gray-300 mt-2">Prevention & Response</p>
          </div>
          
          <div className="bg-white bg-opacity-10 backdrop-blur rounded-lg p-6 text-center">
            <h3 className="text-lg font-semibold mb-2">Warden Integrity</h3>
            <p className={`text-4xl font-bold ${getScoreColor(auditResults.scores.corruption)}`}>
              {auditResults.scores.corruption}
            </p>
            <p className="text-sm text-gray-300 mt-2">Low Corruption</p>
          </div>
          
          <div className="bg-white bg-opacity-10 backdrop-blur rounded-lg p-6 text-center">
            <h3 className="text-lg font-semibold mb-2">Citizen Trust</h3>
            <p className={`text-4xl font-bold ${getScoreColor(auditResults.scores.trust)}`}>
              {auditResults.scores.trust}
            </p>
            <p className="text-sm text-gray-300 mt-2">Community Relations</p>
          </div>
        </div>

        {/* Narrative */}
        <div className="bg-white bg-opacity-10 backdrop-blur rounded-lg p-8 mb-6">
          <h2 className="text-2xl font-semibold mb-4">Auditor's Analysis</h2>
          <div className="space-y-3 text-gray-200">
            {auditResults.narrative.map((paragraph, idx) => (
              <p key={idx} className="leading-relaxed">{paragraph}</p>
            ))}
          </div>
        </div>

        {/* Hidden Metrics Revealed */}
        <div className="bg-red-900 bg-opacity-30 backdrop-blur rounded-lg p-8 mb-6 border-2 border-red-500">
          <h2 className="text-2xl font-semibold mb-4 flex items-center">
            <span className="mr-2">⚠️</span> Hidden Metrics Revealed
          </h2>
          <div className="grid grid-cols-2 gap-6">
            {/* Warden Corruption */}
            <div>
              <h3 className="text-lg font-semibold mb-3 text-red-300">Warden Corruption</h3>
              <div className="space-y-2 text-sm">
                <p>Average: <span className="font-bold text-red-400">{auditResults.wardenMetrics.averageCorruption.toFixed(1)}%</span></p>
                <p>Maximum: <span className="font-bold text-red-400">{auditResults.wardenMetrics.maxCorruption}%</span></p>
                <p>Corrupted Wardens: <span className="font-bold text-red-400">{auditResults.wardenMetrics.corruptWardenCount}/{auditResults.wardenMetrics.totalWardens}</span></p>
              </div>
            </div>

            {/* Citizen Trust */}
            <div>
              <h3 className="text-lg font-semibold mb-3 text-yellow-300">Citizen Trust</h3>
              <div className="space-y-2 text-sm">
                <p>Trusting: <span className="font-bold text-green-400">{auditResults.trustMetrics.distribution.trusting}</span></p>
                <p>Neutral: <span className="font-bold text-yellow-400">{auditResults.trustMetrics.distribution.neutral}</span></p>
                <p>Wary: <span className="font-bold text-orange-400">{auditResults.trustMetrics.distribution.wary}</span></p>
                <p>Hostile: <span className="font-bold text-red-400">{auditResults.trustMetrics.distribution.hostile}</span></p>
                <p className="mt-3">Avg Watch Exposure: <span className="font-bold">{auditResults.trustMetrics.averageWatchExposure.toFixed(1)} days</span></p>
              </div>
            </div>
          </div>
        </div>

        {/* Crime Statistics */}
        <div className="bg-white bg-opacity-10 backdrop-blur rounded-lg p-8 mb-6">
          <h2 className="text-2xl font-semibold mb-4">Crime Statistics</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-400">Total Crimes:</p>
              <p className="text-2xl font-bold">{auditResults.crimeStats.total}</p>
            </div>
            <div>
              <p className="text-gray-400">Prevented:</p>
              <p className="text-2xl font-bold text-green-400">{auditResults.crimeStats.prevented}</p>
            </div>
            <div>
              <p className="text-gray-400">Responded:</p>
              <p className="text-2xl font-bold text-blue-400">{auditResults.crimeStats.responded}</p>
            </div>
            <div>
              <p className="text-gray-400">Reported Only:</p>
              <p className="text-2xl font-bold text-yellow-400">{auditResults.crimeStats.reported}</p>
            </div>
            <div className="col-span-2">
              <p className="text-gray-400">Unreported (Est):</p>
              <p className="text-2xl font-bold text-red-400">{auditResults.crimeStats.unreported}</p>
            </div>
          </div>
        </div>

        {/* Key Findings */}
        <div className="bg-white bg-opacity-10 backdrop-blur rounded-lg p-8 mb-6">
          <h2 className="text-2xl font-semibold mb-4">Key Findings</h2>
          <ul className="space-y-2">
            {auditResults.keyFindings.map((finding, idx) => (
              <li key={idx} className="flex items-start">
                <span className="mr-2">{finding.startsWith('✓') ? '✓' : '⚠️'}</span>
                <span className="text-gray-200">{finding.replace(/^[✓⚠️]\s*/, '')}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="text-center space-y-4">
          <button
            onClick={onRestart}
            className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg transition-colors text-lg"
          >
            Try Different Approach
          </button>
          <p className="text-sm text-gray-400">
            The Watch is a meditation on authority, surveillance, and the corrupting nature of power.
          </p>
        </div>
      </div>
    </div>
  );
}
