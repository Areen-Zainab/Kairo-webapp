import React, { useState } from 'react';
import type { MeetingNote } from './types';

interface AddNoteFABProps {
  onAddNote: (note: Omit<MeetingNote, 'id'>) => void;
  currentTime: number;
}

const AddNoteFAB: React.FC<AddNoteFABProps> = ({ onAddNote, currentTime }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [noteType, setNoteType] = useState<'timeline' | 'manual'>('timeline');
  const [noteColor, setNoteColor] = useState('#3b82f6');

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAddNote = () => {
    if (!noteContent.trim()) return;

    const note: Omit<MeetingNote, 'id'> = {
      content: noteContent,
      author: {
        id: '1',
        name: 'Current User',
        avatar: 'CU'
      },
      timestamp: noteType === 'timeline' ? currentTime : 0,
      type: noteType,
      color: noteColor,
      tags: []
    };

    onAddNote(note);
    setNoteContent('');
    setIsOpen(false);
  };

  const colorOptions = [
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Green', value: '#10b981' },
    { name: 'Yellow', value: '#f59e0b' },
    { name: 'Red', value: '#ef4444' },
    { name: 'Purple', value: '#8b5cf6' },
    { name: 'Pink', value: '#ec4899' }
  ];

  return (
    <>
      {/* Floating Action Button */}
      <div className="fixed bottom-6 left-6 z-40">
        <button
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center group"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
        
        {/* Tooltip */}
        <div className="absolute bottom-16 left-0 bg-slate-900 dark:bg-slate-700 text-white text-sm px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
          Add Note at {formatTime(currentTime)}
          <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900 dark:border-t-slate-700"></div>
        </div>
      </div>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Add Note
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Note Type */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Note Type
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setNoteType('timeline')}
                    className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      noteType === 'timeline'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    Timeline Note ({formatTime(currentTime)})
                  </button>
                  <button
                    onClick={() => setNoteType('manual')}
                    className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      noteType === 'manual'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    Manual Note
                  </button>
                </div>
              </div>

              {/* Note Content */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Note Content
                </label>
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Enter your note..."
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  rows={3}
                />
              </div>

              {/* Color Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Color
                </label>
                <div className="flex gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => setNoteColor(color.value)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        noteColor === color.value 
                          ? 'border-slate-400 scale-110' 
                          : 'border-slate-200 dark:border-slate-600 hover:scale-105'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-4">
                <button
                  onClick={handleAddNote}
                  disabled={!noteContent.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-md transition-colors"
                >
                  Add Note
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 bg-slate-300 hover:bg-slate-400 dark:bg-slate-600 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-md transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AddNoteFAB;
