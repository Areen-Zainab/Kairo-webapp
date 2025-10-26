import React, { useRef, useEffect, useState } from 'react';
import type { LineChartProps } from './types';

const LineChart: React.FC<LineChartProps> = ({
  data,
  title,
  xAxisLabel = 'Time',
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

    // Find min and max values
    const values = data.map(d => d.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const valueRange = maxValue - minValue;

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

    // Draw line
    if (data.length > 1) {
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.beginPath();

      data.forEach((point, index) => {
        const x = padding + (chartWidth / (data.length - 1)) * index;
        const y = height - padding - ((point.value - minValue) / valueRange) * chartHeight;

        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();

      // Draw points
      ctx.fillStyle = '#3b82f6';
      data.forEach((point, index) => {
        const x = padding + (chartWidth / (data.length - 1)) * index;
        const y = height - padding - ((point.value - minValue) / valueRange) * chartHeight;

        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Draw labels
    ctx.fillStyle = '#64748b';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'center';

    // X-axis labels
    data.forEach((point, index) => {
      const x = padding + (chartWidth / (data.length - 1)) * index;
      ctx.fillText(point.label || point.date, x, height - padding + 15);
    });

    // Y-axis labels
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
      const value = minValue + (valueRange / 5) * i;
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
                      
                      // Find min and max values
                      const values = data.map(d => d.value);
                      const minValue = Math.min(...values);
                      const maxValue = Math.max(...values);
                      const valueRange = maxValue - minValue;
                      
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
                      
                      // Draw line
                      if (data.length > 1) {
                        ctx.strokeStyle = '#3b82f6';
                        ctx.lineWidth = 4;
                        ctx.beginPath();
                        
                        data.forEach((point, index) => {
                          const x = leftPadding + (chartWidth / (data.length - 1)) * index;
                          const y = modalHeight - bottomPadding - ((point.value - minValue) / valueRange) * chartHeight;
                          
                          if (index === 0) {
                            ctx.moveTo(x, y);
                          } else {
                            ctx.lineTo(x, y);
                          }
                        });
                        
                        ctx.stroke();
                        
                        // Draw points
                        ctx.fillStyle = '#3b82f6';
                        data.forEach((point, index) => {
                          const x = leftPadding + (chartWidth / (data.length - 1)) * index;
                          const y = modalHeight - bottomPadding - ((point.value - minValue) / valueRange) * chartHeight;
                          
                          ctx.beginPath();
                          ctx.arc(x, y, 8, 0, Math.PI * 2);
                          ctx.fill();
                          
                          // White border around points
                          ctx.strokeStyle = '#ffffff';
                          ctx.lineWidth = 3;
                          ctx.stroke();
                        });
                      }
                      
                      // Draw labels with better positioning
                      ctx.fillStyle = '#374151';
                      ctx.font = 'bold 14px Inter, sans-serif';
                      ctx.textAlign = 'center';
                      
                      // X-axis labels
                      data.forEach((point, index) => {
                        const x = leftPadding + (chartWidth / (data.length - 1)) * index;
                        const label = point.label || point.date;
                        // Truncate long labels
                        const truncatedLabel = label.length > 12 ? label.substring(0, 12) + '...' : label;
                        ctx.fillText(truncatedLabel, x, modalHeight - bottomPadding + 25);
                      });
                      
                      // Y-axis labels
                      ctx.textAlign = 'right';
                      ctx.font = 'bold 14px Inter, sans-serif';
                      for (let i = 0; i <= 5; i++) {
                        const value = minValue + (valueRange / 5) * i;
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

export default LineChart;
