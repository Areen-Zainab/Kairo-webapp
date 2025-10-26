import React, { useRef, useEffect, useState } from 'react';
import type { BarChartProps } from './types';

const BarChart: React.FC<BarChartProps> = ({
  data,
  title,
  xAxisLabel = 'Category',
  yAxisLabel = 'Value',
  height = 300,
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = height * 2;
    ctx.scale(2, 2);

    // Clear canvas
    ctx.clearRect(0, 0, canvas.offsetWidth, height);

    const padding = 40;
    const chartWidth = canvas.offsetWidth - padding * 2;
    const chartHeight = height - padding * 2;

    // Find max value
    const maxValue = Math.max(...data.map(d => d.value));

    // Draw axes
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(canvas.offsetWidth - padding, height - padding);
    ctx.stroke();

    // Draw grid lines
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 5; i++) {
      const y = padding + (chartHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(canvas.offsetWidth - padding, y);
      ctx.stroke();
    }

    // Draw bars
    const barWidth = chartWidth / data.length * 0.8;
    const barSpacing = chartWidth / data.length * 0.2;

    data.forEach((item, index) => {
      const x = padding + (chartWidth / data.length) * index + barSpacing / 2;
      const barHeight = (item.value / maxValue) * chartHeight;
      const y = height - padding - barHeight;

      // Bar gradient
      const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
      gradient.addColorStop(0, item.color || '#3b82f6');
      gradient.addColorStop(1, item.color || '#1d4ed8');

      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, barWidth, barHeight);

      // Bar border
      ctx.strokeStyle = item.color || '#1d4ed8';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, barWidth, barHeight);
    });

    // Draw labels
    ctx.fillStyle = '#64748b';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'center';

    // X-axis labels
    data.forEach((item, index) => {
      const x = padding + (chartWidth / data.length) * index + (chartWidth / data.length) / 2;
      ctx.fillText(item.label, x, height - padding + 15);
    });

    // Y-axis labels
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
      const value = (maxValue / 5) * i;
      const y = height - padding - (chartHeight / 5) * i;
      ctx.fillText(value.toLocaleString(), padding - 10, y + 4);
    }

    // Axis labels
    ctx.fillStyle = '#475569';
    ctx.font = '14px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(xAxisLabel, canvas.offsetWidth / 2, height - 5);
    
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(yAxisLabel, 0, 0);
    ctx.restore();

  }, [data, title, xAxisLabel, yAxisLabel, height]);

  return (
    <>
      <div className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 ${className}`}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {title}
          </h3>
          <div className="w-2 h-2 bg-blue-500"></div>
        </div>
        <div className="relative">
          <canvas
            ref={canvasRef}
            className="w-full cursor-pointer hover:opacity-90 transition-opacity"
            style={{ height: `${height}px` }}
            onClick={() => setIsModalOpen(true)}
            title="Click to expand chart"
          />
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6 max-w-6xl max-h-[90vh] w-full mx-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-semibold text-slate-900 dark:text-white">
                {title}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="relative">
              <canvas
                ref={(ref) => {
                  if (ref && isModalOpen) {
                    // Re-render canvas for modal with larger size
                    const ctx = ref.getContext('2d');
                    if (ctx) {
                      const modalHeight = 600;
                      const modalWidth = ref.offsetWidth;
                      ref.width = modalWidth * 2;
                      ref.height = modalHeight * 2;
                      ctx.scale(2, 2);
                      
                      // Re-draw the chart for modal with better spacing
                      const leftPadding = 80;
                      const rightPadding = 40;
                      const topPadding = 60;
                      const bottomPadding = 80;
                      const chartWidth = modalWidth - leftPadding - rightPadding;
                      const chartHeight = modalHeight - topPadding - bottomPadding;
                      
                      // Clear canvas
                      ctx.clearRect(0, 0, modalWidth, modalHeight);
                      
                      // Find max value
                      const maxValue = Math.max(...data.map(d => d.value));
                      
                      // Draw axes
                      ctx.strokeStyle = '#e2e8f0';
                      ctx.lineWidth = 2;
                      ctx.beginPath();
                      ctx.moveTo(leftPadding, topPadding);
                      ctx.lineTo(leftPadding, modalHeight - bottomPadding);
                      ctx.lineTo(modalWidth - rightPadding, modalHeight - bottomPadding);
                      ctx.stroke();
                      
                      // Draw grid lines
                      ctx.strokeStyle = '#f1f5f9';
                      ctx.lineWidth = 1;
                      for (let i = 0; i <= 5; i++) {
                        const y = topPadding + (chartHeight / 5) * i;
                        ctx.beginPath();
                        ctx.moveTo(leftPadding, y);
                        ctx.lineTo(modalWidth - rightPadding, y);
                        ctx.stroke();
                      }
                      
                      // Draw bars with better spacing
                      const barWidth = Math.max(30, chartWidth / data.length * 0.7);
                      const barSpacing = (chartWidth - (barWidth * data.length)) / (data.length + 1);
                      
                      data.forEach((item, index) => {
                        const x = leftPadding + barSpacing + (barWidth + barSpacing) * index;
                        const barHeight = (item.value / maxValue) * chartHeight;
                        const y = modalHeight - bottomPadding - barHeight;
                        
                        // Bar gradient
                        const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
                        gradient.addColorStop(0, item.color || '#3b82f6');
                        gradient.addColorStop(1, item.color || '#1d4ed8');
                        
                        ctx.fillStyle = gradient;
                        ctx.fillRect(x, y, barWidth, barHeight);
                        
                        // Bar border
                        ctx.strokeStyle = item.color || '#1d4ed8';
                        ctx.lineWidth = 2;
                        ctx.strokeRect(x, y, barWidth, barHeight);
                        
                        // Value labels on top of bars
                        ctx.fillStyle = '#1f2937';
                        ctx.font = 'bold 12px Inter, sans-serif';
                        ctx.textAlign = 'center';
                        ctx.fillText(item.value.toLocaleString(), x + barWidth / 2, y - 8);
                      });
                      
                      // Draw labels with better positioning
                      ctx.fillStyle = '#374151';
                      ctx.font = 'bold 14px Inter, sans-serif';
                      ctx.textAlign = 'center';
                      
                      // X-axis labels
                      data.forEach((item, index) => {
                        const x = leftPadding + barSpacing + (barWidth + barSpacing) * index + barWidth / 2;
                        const label = item.label;
                        // Truncate long labels
                        const truncatedLabel = label.length > 15 ? label.substring(0, 15) + '...' : label;
                        ctx.fillText(truncatedLabel, x, modalHeight - bottomPadding + 25);
                      });
                      
                      // Y-axis labels
                      ctx.textAlign = 'right';
                      ctx.font = 'bold 14px Inter, sans-serif';
                      for (let i = 0; i <= 5; i++) {
                        const value = (maxValue / 5) * i;
                        const y = modalHeight - bottomPadding - (chartHeight / 5) * i;
                        ctx.fillText(value.toLocaleString(), leftPadding - 15, y + 5);
                      }
                      
                      // Axis labels with better positioning
                      ctx.fillStyle = '#1f2937';
                      ctx.font = 'bold 16px Inter, sans-serif';
                      ctx.textAlign = 'center';
                      ctx.fillText(xAxisLabel, modalWidth / 2, modalHeight - 20);
                      
                      ctx.save();
                      ctx.translate(30, modalHeight / 2);
                      ctx.rotate(-Math.PI / 2);
                      ctx.fillText(yAxisLabel, 0, 0);
                      ctx.restore();
                    }
                  }
                }}
                className="w-full"
                style={{ height: '600px' }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BarChart;
