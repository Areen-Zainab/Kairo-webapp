import React, { useState } from 'react';
import type { PieChartProps } from './types';

const PieChart: React.FC<PieChartProps> = ({
  data,
  title,
  height = 300,
  className = ''
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Safety checks for data
  const validData = data.filter(d => typeof d.value === 'number' && isFinite(d.value) && d.value >= 0);
  const hasData = validData.length > 0 && validData.some(d => d.value > 0);
  const total = hasData ? validData.reduce((sum, d) => sum + d.value, 0) : 0;

  // Calculate percentages
  const dataWithPercentages = validData.map(d => ({
    ...d,
    percentage: total > 0 ? (d.value / total) * 100 : 0
  }));

  // Color palette if not provided
  const defaultColors = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4'];

  return (
    <div className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
        {total > 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Total: {total}</p>
        )}
      </div>

      {/* Chart Container */}
      <div className="p-6" style={{ minHeight: `${height}px` }}>
        {!hasData ? (
          <div className="flex items-center justify-center h-full text-slate-400 dark:text-slate-500" style={{ minHeight: `${height - 40}px` }}>
            <div className="text-center">
              <svg className="mx-auto h-12 w-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
              </svg>
              <p className="text-sm font-medium">No data available</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            {/* Donut Chart */}
            <div className="flex items-center justify-center">
              <div className="relative" style={{ width: '200px', height: '200px' }}>
                <svg viewBox="0 0 200 200" className="transform -rotate-90">
                  <defs>
                    {dataWithPercentages.map((item, index) => (
                      <filter key={`glow-${index}`} id={`glow-${index}`}>
                        <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                        <feMerge>
                          <feMergeNode in="coloredBlur"/>
                          <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                      </filter>
                    ))}
                  </defs>
                  
                  {/* Background circle */}
                  <circle
                    cx="100"
                    cy="100"
                    r="80"
                    fill="none"
                    stroke="#f1f5f9"
                    strokeWidth="40"
                    className="dark:stroke-slate-700"
                  />

                  {/* Data segments */}
                  {(() => {
                    let currentAngle = 0;
                    return dataWithPercentages.map((item, index) => {
                      const segmentAngle = (item.value / total) * 360;
                      const startAngle = currentAngle;
                      currentAngle += segmentAngle;

                      const startAngleRad = (startAngle * Math.PI) / 180;
                      const endAngleRad = ((startAngle + segmentAngle) * Math.PI) / 180;

                      const x1 = 100 + 80 * Math.cos(startAngleRad);
                      const y1 = 100 + 80 * Math.sin(startAngleRad);
                      const x2 = 100 + 80 * Math.cos(endAngleRad);
                      const y2 = 100 + 80 * Math.sin(endAngleRad);

                      const largeArcFlag = segmentAngle > 180 ? 1 : 0;

                      const pathData = [
                        `M 100 100`,
                        `L ${x1} ${y1}`,
                        `A 80 80 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                        'Z'
                      ].join(' ');

                      const color = item.color || defaultColors[index % defaultColors.length];
                      const isHovered = hoveredIndex === index;

                      return (
                        <path
                          key={index}
                          d={pathData}
                          fill={color}
                          stroke="#fff"
                          strokeWidth="2"
                          className="transition-all duration-300 cursor-pointer dark:stroke-slate-800"
                          style={{
                            opacity: isHovered ? 1 : hoveredIndex !== null ? 0.6 : 0.9,
                            transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                            transformOrigin: 'center',
                            filter: isHovered ? `url(#glow-${index})` : 'none'
                          }}
                          onMouseEnter={() => setHoveredIndex(index)}
                          onMouseLeave={() => setHoveredIndex(null)}
                        />
                      );
                    });
                  })()}

                  {/* Center circle (donut hole) */}
                  <circle
                    cx="100"
                    cy="100"
                    r="50"
                    fill="white"
                    className="dark:fill-slate-800"
                  />
                </svg>

                {/* Center text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">{total}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Total</p>
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="space-y-3">
              {dataWithPercentages.map((item, index) => {
                const color = item.color || defaultColors[index % defaultColors.length];
                const isHovered = hoveredIndex === index;

                return (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-3 rounded-lg transition-all duration-200 cursor-pointer ${
                      isHovered ? 'bg-slate-50 dark:bg-slate-700/50 scale-105' : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'
                    }`}
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div
                        className="w-4 h-4 rounded-full shadow-md"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                        {item.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {item.value}
                      </span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 w-12 text-right">
                        {item.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PieChart;
