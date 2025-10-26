import React, { useState, useRef, useEffect } from 'react';
import { Download, ChevronDown, FileText, FileImage, Share2 } from 'lucide-react';

interface ExportDropdownProps {
  meeting: {
    title?: string;
    recordingUrl?: string;
    transcript?: any[];
  };
  onExportTranscript: () => void;
  onDownloadRecording: () => void;
  onShareMeeting: () => void;
}

const ExportDropdown: React.FC<ExportDropdownProps> = ({
  meeting,
  onExportTranscript,
  onDownloadRecording,
  onShareMeeting
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const exportOptions = [
    {
      id: 'download-recording',
      label: 'Download Recording',
      icon: <Download className="w-4 h-4" />,
      onClick: onDownloadRecording,
      description: 'Download the meeting recording'
    },
    {
      id: 'export-transcript',
      label: 'Export Transcript',
      icon: <FileText className="w-4 h-4" />,
      onClick: onExportTranscript,
      description: 'Export transcript as text file'
    },
    {
      id: 'share-meeting',
      label: 'Share Meeting',
      icon: <Share2 className="w-4 h-4" />,
      onClick: onShareMeeting,
      description: 'Share meeting link with others'
    }
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm hover:shadow-md"
      >
        <Download className="w-4 h-4" />
        <span>Export</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-50">
          <div className="p-2">
            <div className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Export Options
            </div>
            {exportOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => {
                  option.onClick();
                  setIsOpen(false);
                }}
                className="w-full flex items-start space-x-3 px-3 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors group"
              >
                <div className="flex-shrink-0 mt-0.5 text-slate-600 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                  {option.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                    {option.label}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {option.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExportDropdown;
