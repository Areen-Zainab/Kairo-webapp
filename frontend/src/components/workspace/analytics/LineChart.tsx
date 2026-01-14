import React from 'react';
import type { LineChartProps } from './types';

const LineChart: React.FC<LineChartProps> = ({
  data,
  title,
  xAxisLabel = 'Date',
  yAxisLabel = 'Value',
  height = 300,
  className = ''
}) => {
  // Safety checks for data
  const validData = data.filter(d => typeof d.value === 'number' && isFinite(d.value) && d.value >= 0);
  const hasData = validData.length > 0;
  const maxValue = hasData ? Math.max(...validData.map(d => d.value)) : 1;
  const minValue = hasData ? Math.min(...validData.map(d => d.value)) : 0;
  const valueRange = maxValue - minValue || 1;

  return (
    <div className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
        {yAxisLabel && (
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{yAxisLabel}</p>
        )}
      </div>

      {/* Chart Container */}
      <div className="p-6" style={{ height: `${height}px` }}>
        {!hasData ? (
          <div className="flex items-center justify-center h-full text-slate-400 dark:text-slate-500">
            <div className="text-center">
              <svg className="mx-auto h-12 w-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
              <p className="text-sm font-medium">No data available</p>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            {/* Chart Area */}
            <div className="flex-1 relative">
              {/* Grid lines */}
              <div className="absolute inset-0 flex flex-col justify-between py-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center">
                    <span className="text-xs text-slate-400 dark:text-slate-500 w-12 text-right pr-2">
                      {Math.round(maxValue - (i * (maxValue / 4)))}
                    </span>
                    <div className="flex-1 border-t border-slate-200 dark:border-slate-700 border-dashed"></div>
                  </div>
                ))}
              </div>

              {/* Line and Area Chart */}
              <svg className="absolute inset-0 w-full h-full" style={{ paddingLeft: '50px', paddingTop: '8px', paddingBottom: '8px' }}>
                <defs>
                  <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style={{ stopColor: '#8b5cf6', stopOpacity: 0.3 }} />
                    <stop offset="100%" style={{ stopColor: '#8b5cf6', stopOpacity: 0.05 }} />
                  </linearGradient>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>

                {/* Calculate points */}
                {(() => {
                  const chartHeight = height - 50;
                  const chartWidth = window.innerWidth > 768 ? 600 : 300; // Approximate width
                  const stepX = chartWidth / (validData.length - 1 || 1);
                  
                  const points = validData.map((d, i) => {
                    const x = i * stepX;
                    const normalizedValue = valueRange > 0 ? (d.value - minValue) / valueRange : 0.5;
                    const y = chartHeight - (normalizedValue * (chartHeight - 20)) - 10;
                    return { x, y, value: d.value };
                  });

                  const linePathD = points.map((p, i) => 
                    `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
                  ).join(' ');

                  const areaPathD = `${linePathD} L ${points[points.length - 1].x} ${chartHeight} L 0 ${chartHeight} Z`;

                  return (
                    <>
                      {/* Area under the line */}
                      <path
                        d={areaPathD}
                        fill="url(#lineGradient)"
                        className="transition-all duration-500"
                      />
                      
                      {/* Line */}
                      <path
                        d={linePathD}
                        fill="none"
                        stroke="#8b5cf6"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        filter="url(#glow)"
                        className="transition-all duration-500"
                      />

                      {/* Data points */}
                      {points.map((p, i) => (
                        <g key={i}>
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r="5"
                            fill="#8b5cf6"
                            stroke="#fff"
                            strokeWidth="2"
                            className="transition-all duration-300 hover:r-7 cursor-pointer"
                          />
                          {/* Tooltip on hover */}
                          <g className="opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
                            <rect
                              x={p.x - 25}
                              y={p.y - 40}
                              width="50"
                              height="25"
                              rx="4"
                              fill="#1e293b"
                              className="dark:fill-slate-700"
                            />
                            <text
                              x={p.x}
                              y={p.y - 22}
                              textAnchor="middle"
                              fill="#fff"
                              fontSize="12"
                              fontWeight="600"
                            >
                              {p.value}
                            </text>
                          </g>
                        </g>
                      ))}
                    </>
                  );
                })()}
              </svg>
            </div>

            {/* X-Axis Labels */}
            <div className="flex justify-between mt-4 px-12">
              {validData.length <= 10 ? (
                // Show all labels if <= 10 points
                validData.map((item, index) => (
                  <div key={index} className="text-center">
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400 transform -rotate-0">
                      {item.label || item.date || index}
                    </p>
                  </div>
                ))
              ) : (
                // Show only first, middle, and last for more points
                <>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    {validData[0].label || validData[0].date}
                  </p>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    {validData[Math.floor(validData.length / 2)].label || validData[Math.floor(validData.length / 2)].date}
                  </p>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    {validData[validData.length - 1].label || validData[validData.length - 1].date}
                  </p>
                </>
              )}
            </div>

            {/* X-Axis Label */}
            {xAxisLabel && (
              <div className="text-center mt-3">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{xAxisLabel}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Summary Stats */}
      {hasData && (
        <div className="px-6 pb-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-700 pt-3">
          <div className="flex gap-4">
            <span>Min: <strong className="text-slate-700 dark:text-slate-300">{minValue}</strong></span>
            <span>Max: <strong className="text-slate-700 dark:text-slate-300">{maxValue}</strong></span>
            <span>Avg: <strong className="text-slate-700 dark:text-slate-300">
              {Math.round(validData.reduce((sum, d) => sum + d.value, 0) / validData.length)}
            </strong></span>
          </div>
          <span className="text-slate-400">{validData.length} data points</span>
        </div>
      )}
    </div>
  );
};

export default LineChart;
