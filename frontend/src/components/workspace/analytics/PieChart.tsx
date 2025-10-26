import React, { useRef, useEffect, useState } from 'react';
import type { PieChartProps } from './types';

const PieChart: React.FC<PieChartProps> = ({
  data,
  title,
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

    const centerX = canvas.offsetWidth / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 40;

    // Calculate total value
    const total = data.reduce((sum, item) => sum + item.value, 0);

    // Draw pie slices
    let currentAngle = -Math.PI / 2; // Start from top

    data.forEach((item, index) => {
      const sliceAngle = (item.value / total) * 2 * Math.PI;

      // Draw slice
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
      ctx.closePath();

      // Fill with color
      ctx.fillStyle = item.color || `hsl(${(index * 137.5) % 360}, 70%, 50%)`;
      ctx.fill();

      // Draw border
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      currentAngle += sliceAngle;
    });

    // Draw center circle for donut effect
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.6, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Draw legend
    const legendX = centerX + radius + 20;
    const legendY = centerY - (data.length * 20) / 2;

    data.forEach((item, index) => {
      const y = legendY + index * 20;

      // Legend color box
      ctx.fillStyle = item.color || `hsl(${(index * 137.5) % 360}, 70%, 50%)`;
      ctx.fillRect(legendX, y - 6, 12, 12);

      // Legend text
      ctx.fillStyle = '#374151';
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(item.label, legendX + 16, y + 4);

      // Percentage
      const percentage = ((item.value / total) * 100).toFixed(1);
      ctx.fillStyle = '#6b7280';
      ctx.fillText(`${percentage}%`, legendX + 16, y + 16);
    });

  }, [data, title, height]);

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
                      
                      // Clear canvas
                      ctx.clearRect(0, 0, modalWidth, modalHeight);
                      
                      // Better positioning for pie chart
                      const centerX = modalWidth * 0.35; // Move pie to the left
                      const centerY = modalHeight / 2;
                      const radius = Math.min(centerX, centerY) - 40;
                      
                      // Calculate total value
                      const total = data.reduce((sum, item) => sum + item.value, 0);
                      
                      // Draw pie slices
                      let currentAngle = -Math.PI / 2; // Start from top
                      
                      data.forEach((item, index) => {
                        const sliceAngle = (item.value / total) * 2 * Math.PI;
                        
                        // Draw slice
                        ctx.beginPath();
                        ctx.moveTo(centerX, centerY);
                        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
                        ctx.closePath();
                        
                        // Fill with color
                        ctx.fillStyle = item.color || `hsl(${(index * 137.5) % 360}, 70%, 50%)`;
                        ctx.fill();
                        
                        // Draw border
                        ctx.strokeStyle = '#ffffff';
                        ctx.lineWidth = 4;
                        ctx.stroke();
                        
                        // Draw percentage labels on slices
                        if (sliceAngle > 0.1) { // Only show labels for slices larger than 0.1 radians
                          const labelAngle = currentAngle + sliceAngle / 2;
                          const labelRadius = radius * 0.7;
                          const labelX = centerX + Math.cos(labelAngle) * labelRadius;
                          const labelY = centerY + Math.sin(labelAngle) * labelRadius;
                          
                          ctx.fillStyle = '#ffffff';
                          ctx.font = 'bold 14px Inter, sans-serif';
                          ctx.textAlign = 'center';
                          ctx.textBaseline = 'middle';
                          const percentage = ((item.value / total) * 100).toFixed(1);
                          ctx.fillText(`${percentage}%`, labelX, labelY);
                        }
                        
                        currentAngle += sliceAngle;
                      });
                      
                      // Draw center circle for donut effect
                      ctx.beginPath();
                      ctx.arc(centerX, centerY, radius * 0.5, 0, 2 * Math.PI);
                      ctx.fillStyle = '#ffffff';
                      ctx.fill();
                      
                      // Draw total value in center
                      ctx.fillStyle = '#1f2937';
                      ctx.font = 'bold 18px Inter, sans-serif';
                      ctx.textAlign = 'center';
                      ctx.textBaseline = 'middle';
                      ctx.fillText('Total', centerX, centerY - 10);
                      ctx.fillText(total.toLocaleString(), centerX, centerY + 10);
                      
                      // Draw legend with better positioning
                      const legendX = modalWidth * 0.6; // Position legend to the right
                      const legendY = centerY - (data.length * 40) / 2;
                      
                      data.forEach((item, index) => {
                        const y = legendY + index * 40;
                        
                        // Legend color box
                        ctx.fillStyle = item.color || `hsl(${(index * 137.5) % 360}, 70%, 50%)`;
                        ctx.fillRect(legendX, y - 12, 20, 20);
                        
                        // Legend border
                        ctx.strokeStyle = '#e5e7eb';
                        ctx.lineWidth = 1;
                        ctx.strokeRect(legendX, y - 12, 20, 20);
                        
                        // Legend text
                        ctx.fillStyle = '#1f2937';
                        ctx.font = 'bold 16px Inter, sans-serif';
                        ctx.textAlign = 'left';
                        ctx.fillText(item.label, legendX + 30, y + 2);
                        
                        // Value and percentage
                        const percentage = ((item.value / total) * 100).toFixed(1);
                        ctx.fillStyle = '#4b5563';
                        ctx.font = 'bold 14px Inter, sans-serif';
                        ctx.fillText(`${item.value.toLocaleString()} (${percentage}%)`, legendX + 30, y + 20);
                      });
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

export default PieChart;
