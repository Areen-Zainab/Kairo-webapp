import React from 'react';
import type { BarChartProps } from './types';

const BarChart: React.FC<BarChartProps> = ({
  data,
  title,
  xAxisLabel = 'Category',
  yAxisLabel = 'Value',
  height = 300,
  className = ''
}) => {
  // Safety checks for data
  const validData = data.filter(d => typeof d.value === 'number' && isFinite(d.value) && d.value >= 0);
  const hasData = validData.length > 0;
  const maxValue = hasData ? Math.max(...validData.map(d => d.value)) : 1;

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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-sm font-medium">No data available</p>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            {/* Chart Area */}
            <div className="flex-1 flex items-end justify-around gap-3 px-2">
              {validData.map((item, index) => {
                const percentage = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
                const barColor = item.color || '#8b5cf6';
                
                return (
                  <div key={index} className="flex flex-col items-center flex-1 group">
                    {/* Value Label (appears on hover) */}
                    <div className="mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-md shadow-sm">
                        {item.value}
                      </span>
                    </div>

                    {/* Bar */}
                    <div className="w-full relative" style={{ height: '100%', minHeight: '100px' }}>
                      <div className="absolute bottom-0 w-full flex items-end justify-center">
                        <div
                          className="w-full rounded-t-lg transition-all duration-500 ease-out hover:opacity-90 cursor-pointer shadow-lg relative overflow-hidden"
                          style={{
                            height: `${Math.max(percentage, 2)}%`,
                            background: `linear-gradient(180deg, ${barColor} 0%, ${barColor}dd 100%)`,
                            boxShadow: `0 -2px 12px ${barColor}33`
                          }}
                        >
                          {/* Animated shine effect */}
                          <div 
                            className="absolute inset-0 opacity-30"
                            style={{
                              background: 'linear-gradient(180deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 50%)'
                            }}
                          />
                          
                          {/* Value display inside bar for larger bars */}
                          {percentage > 20 && (
                            <div className="absolute top-2 left-0 right-0 text-center">
                              <span className="text-white font-bold text-sm drop-shadow-md">
                                {item.value}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Label */}
                    <div className="mt-3 text-center w-full">
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-400 truncate px-1" title={item.label}>
                        {item.label}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* X-Axis Label */}
            {xAxisLabel && (
              <div className="text-center mt-4">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{xAxisLabel}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Optional: Max Value Indicator */}
      {hasData && maxValue > 0 && (
        <div className="px-6 pb-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>Min: 0</span>
          <span className="font-semibold">Max: {maxValue}</span>
        </div>
      )}
    </div>
  );
};

export default BarChart;
