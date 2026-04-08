import React from 'react';
import type { BarChartProps } from './types';

const BarChart: React.FC<BarChartProps> = ({
  data,
  title,
  xAxisLabel,
  yAxisLabel,
  height = 300,
  className = ''
}) => {
  const validData = data.filter(d => typeof d.value === 'number' && isFinite(d.value) && d.value >= 0);
  const hasData = validData.length > 0;
  const maxValue = hasData ? Math.max(...validData.map(d => d.value)) : 1;
  const BAR_AREA_HEIGHT = height - 80; // reserve space for labels above & below

  return (
    <div className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden ${className}`}>
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
        {yAxisLabel && (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{yAxisLabel}</p>
        )}
      </div>

      <div className="px-5 py-4" style={{ height: `${height}px` }}>
        {!hasData ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500 gap-2">
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-xs font-medium">No data available</p>
          </div>
        ) : (
          <div className="h-full flex flex-col gap-2">
            {/* Bars */}
            <div className="flex items-end justify-around gap-2 flex-1" style={{ minHeight: `${BAR_AREA_HEIGHT}px` }}>
              {validData.map((item, index) => {
                const pct = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
                const barColor = item.color || '#8b5cf6';
                return (
                  <div key={index} className="flex flex-col items-center gap-1 flex-1 min-w-0">
                    {/* Value — always visible */}
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-none">
                      {item.value}
                    </span>
                    {/* Bar */}
                    <div
                      className="w-full rounded-t transition-all duration-500 hover:brightness-110 cursor-default"
                      style={{
                        height: `${Math.max(pct * BAR_AREA_HEIGHT / 100, 4)}px`,
                        backgroundColor: barColor,
                        minHeight: '4px'
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {/* X labels */}
            <div className="flex justify-around gap-2">
              {validData.map((item, index) => (
                <div key={index} className="flex-1 min-w-0 text-center">
                  <p
                    className="text-xs text-slate-500 dark:text-slate-400 truncate leading-tight"
                    title={item.label}
                  >
                    {item.label}
                  </p>
                </div>
              ))}
            </div>

            {xAxisLabel && (
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center">{xAxisLabel}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BarChart;
