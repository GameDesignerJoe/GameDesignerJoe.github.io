import { ContentType } from '../../App';
import './AnalysisPanel.css';

interface AnalysisData {
  contentDistribution: {
    [key: string]: number;
  };
  densityMap: {
    [key: string]: number[][];
  };
  warnings: string[];
}

interface AnalysisPanelProps {
  analysisData: AnalysisData;
  contentTypes: ContentType[];
}

const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
  analysisData,
  contentTypes,
}) => {
  const hasData = Object.keys(analysisData.contentDistribution).length > 0;
  
  // Function to render the distribution chart
  const renderDistributionChart = () => {
    return (
      <div className="distribution-chart">
        {contentTypes.map(type => {
          const percentage = analysisData.contentDistribution[type.id] || 0;
          const requestedPercentage = type.percentage;
          
          // Determine if there's a significant difference
          const diff = Math.abs(percentage - requestedPercentage);
          const isSignificantDiff = diff > 10;
          
          return (
            <div key={type.id} className="chart-item">
              <div className="chart-label">
                <div 
                  className="chart-color" 
                  style={{ backgroundColor: type.color }}
                />
                <span className="chart-name">{type.name}</span>
              </div>
              
              <div className="chart-bars">
                <div className="chart-bar-container">
                  <div 
                    className="chart-bar actual"
                    style={{ 
                      width: `${percentage}%`,
                      backgroundColor: type.color,
                    }}
                  />
                  <span className="chart-value">{percentage}%</span>
                </div>
                
                <div className="chart-bar-container">
                  <div 
                    className="chart-bar requested"
                    style={{ 
                      width: `${requestedPercentage}%`,
                      backgroundColor: `${type.color}80`, // 50% opacity
                    }}
                  />
                  <span className="chart-value">{requestedPercentage}%</span>
                </div>
              </div>
              
              {isSignificantDiff && (
                <div className="chart-diff-warning">
                  Significant difference detected
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };
  
  return (
    <div className="analysis-panel">
      <h2 className="panel-title">Analysis Panel</h2>
      
      {!hasData ? (
        <div className="empty-analysis">
          <p>Generate a map to see analysis data</p>
        </div>
      ) : (
        <div className="analysis-content">
          <div className="panel-section">
            <h3>Content Distribution</h3>
            <div className="distribution-legend">
              <div className="legend-item">
                <div className="legend-bar actual" />
                <span>Actual</span>
              </div>
              <div className="legend-item">
                <div className="legend-bar requested" />
                <span>Requested</span>
              </div>
            </div>
            {renderDistributionChart()}
          </div>
          
          <div className="panel-section">
            <h3>Warnings</h3>
            {analysisData.warnings.length === 0 ? (
              <p className="no-warnings">No warnings detected</p>
            ) : (
              <ul className="warnings-list">
                {analysisData.warnings.map((warning, index) => (
                  <li key={index} className="warning-item">
                    {warning}
                  </li>
                ))}
              </ul>
            )}
          </div>
          
          <div className="panel-section">
            <h3>Metrics</h3>
            <div className="metrics-grid">
              <div className="metric-item">
                <span className="metric-label">Content Types:</span>
                <span className="metric-value">{contentTypes.length}</span>
              </div>
              <div className="metric-item">
                <span className="metric-label">Total Cells:</span>
                <span className="metric-value">
                  {Object.values(analysisData.contentDistribution).reduce((sum, val) => sum + val, 0)}
                </span>
              </div>
              <div className="metric-item">
                <span className="metric-label">Distribution Balance:</span>
                <span className="metric-value">
                  {analysisData.warnings.length === 0 ? 'Good' : 'Needs Improvement'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalysisPanel;
