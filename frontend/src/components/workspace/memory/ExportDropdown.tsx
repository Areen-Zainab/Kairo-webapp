import React, { useState, useRef, useEffect } from 'react';

interface ExportDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  graphData: any;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

const ExportDropdown: React.FC<ExportDropdownProps> = ({
  isOpen,
  onClose,
  graphData,
  canvasRef,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const exportOptions = [
    {
      id: 'png',
      label: 'PNG Image',
      description: 'High-quality image format',
      icon: '🖼️',
      action: () => exportAsImage('png')
    },
    {
      id: 'jpeg',
      label: 'JPEG Image',
      description: 'Compressed image format',
      icon: '📷',
      action: () => exportAsImage('jpeg')
    },
    {
      id: 'svg',
      label: 'SVG Vector',
      description: 'Scalable vector format',
      icon: '📐',
      action: () => exportAsSVG()
    },
    {
      id: 'json',
      label: 'JSON Data',
      description: 'Raw graph data',
      icon: '📄',
      action: () => exportAsJSON()
    },
    {
      id: 'txt',
      label: 'Text Summary',
      description: 'Human-readable summary',
      icon: '📝',
      action: () => exportAsText()
    }
  ];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const downloadFile = (content: string | Blob, filename: string, mimeType: string) => {
    let blob: Blob;
    
    if (content instanceof Blob) {
      blob = content;
    } else if (content.startsWith('data:')) {
      // Handle data URLs properly
      const byteString = atob(content.split(',')[1]);
      const mimeString = content.split(',')[0].split(':')[1].split(';')[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      blob = new Blob([ab], { type: mimeString });
    } else {
      blob = new Blob([content], { type: mimeType });
    }
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportAsImage = async (format: 'png' | 'jpeg') => {
    if (!canvasRef.current) {
      alert('Canvas not available for export');
      return;
    }
    
    setIsExporting(true);
    
    // Small delay to ensure canvas is fully rendered
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      const canvas = canvasRef.current;
      
      // Create a high-quality version of the canvas
      const scaleFactor = 2; // Higher resolution
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      
      if (!tempCtx) {
        throw new Error('Could not create temporary canvas context');
      }
      
      tempCanvas.width = canvas.width * scaleFactor;
      tempCanvas.height = canvas.height * scaleFactor;
      
      // Scale up the canvas for better quality
      tempCtx.scale(scaleFactor, scaleFactor);
      tempCtx.drawImage(canvas, 0, 0);
      
      // Export with proper MIME type
      const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
      const quality = format === 'jpeg' ? 0.95 : undefined;
      
      const dataURL = tempCanvas.toDataURL(mimeType, quality);
      const filename = `memory-graph-${new Date().toISOString().split('T')[0]}.${format}`;
      
      downloadFile(dataURL, filename, mimeType);
    } catch (error) {
      console.error('Error exporting image:', error);
      alert('Failed to export image. Please try again.');
    } finally {
      setIsExporting(false);
      onClose();
    }
  };

  const exportAsSVG = () => {
    setIsExporting(true);
    try {
      const svgContent = generateSVG();
      const filename = `memory-graph-${new Date().toISOString().split('T')[0]}.svg`;
      downloadFile(svgContent, filename, 'image/svg+xml');
    } catch (error) {
      console.error('Error exporting SVG:', error);
      alert('Failed to export SVG. Please try again.');
    } finally {
      setIsExporting(false);
      onClose();
    }
  };

  const exportAsJSON = () => {
    setIsExporting(true);
    try {
      const jsonContent = JSON.stringify(graphData, null, 2);
      const filename = `memory-graph-${new Date().toISOString().split('T')[0]}.json`;
      downloadFile(jsonContent, filename, 'application/json');
    } catch (error) {
      console.error('Error exporting JSON:', error);
      alert('Failed to export JSON. Please try again.');
    } finally {
      setIsExporting(false);
      onClose();
    }
  };

  const exportAsText = () => {
    setIsExporting(true);
    try {
      const textContent = generateTextSummary();
      const filename = `memory-graph-${new Date().toISOString().split('T')[0]}.txt`;
      downloadFile(textContent, filename, 'text/plain');
    } catch (error) {
      console.error('Error exporting text:', error);
      alert('Failed to export text. Please try again.');
    } finally {
      setIsExporting(false);
      onClose();
    }
  };

  const generateSVG = (): string => {
    if (!canvasRef.current) return '';
    
    const canvas = canvasRef.current;
    const width = canvas.width;
    const height = canvas.height;
    
    // Create a high-quality version for SVG
    const scaleFactor = 2;
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    if (!tempCtx) return '';
    
    tempCanvas.width = width * scaleFactor;
    tempCanvas.height = height * scaleFactor;
    
    // Scale up the canvas for better quality
    tempCtx.scale(scaleFactor, scaleFactor);
    tempCtx.drawImage(canvas, 0, 0);
    
    // Get high-quality data URL
    const dataURL = tempCanvas.toDataURL('image/png');
    
    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <image href="${dataURL}" width="${width}" height="${height}"/>
</svg>`;
  };

  const generateTextSummary = (): string => {
    const summary = [];
    summary.push('MEMORY GRAPH EXPORT');
    summary.push('==================');
    summary.push(`Generated: ${new Date().toLocaleString()}`);
    summary.push('');
    
    if (graphData?.nodes) {
      summary.push('NODES:');
      summary.push(`Total: ${graphData.nodes.length}`);
      
      const nodeTypes = graphData.nodes.reduce((acc: any, node: any) => {
        acc[node.type] = (acc[node.type] || 0) + 1;
        return acc;
      }, {});
      
      Object.entries(nodeTypes).forEach(([type, count]) => {
        summary.push(`- ${type}: ${count}`);
      });
      summary.push('');
    }
    
    if (graphData?.edges) {
      summary.push('EDGES:');
      summary.push(`Total: ${graphData.edges.length}`);
      summary.push('');
    }
    
    if (graphData?.nodes) {
      summary.push('DETAILED NODES:');
      graphData.nodes.forEach((node: any, index: number) => {
        summary.push(`${index + 1}. ${node.label} (${node.type})`);
        if (node.summary) {
          summary.push(`   Summary: ${node.summary.substring(0, 100)}...`);
        }
        summary.push('');
      });
    }
    
    return summary.join('\n');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black bg-opacity-20 backdrop-blur-sm" onClick={onClose} />
      
      {/* Dropdown */}
      <div
        ref={dropdownRef}
        className="relative bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 max-w-md w-full mx-4 animate-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Export Graph</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="space-y-2">
          {exportOptions.map((option) => (
            <button
              key={option.id}
              onClick={option.action}
              disabled={isExporting}
              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="text-2xl">{option.icon}</span>
              <div className="flex-1 text-left">
                <div className="font-medium text-slate-900 dark:text-white">{option.label}</div>
                <div className="text-sm text-slate-600 dark:text-slate-400">{option.description}</div>
              </div>
              {isExporting && (
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              )}
            </button>
          ))}
        </div>
        
        {isExporting && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 text-sm">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              Preparing download...
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExportDropdown;
