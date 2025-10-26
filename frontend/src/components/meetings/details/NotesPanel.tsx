import React, { useState } from 'react';
import type { NotesPanelProps, MeetingNote } from './types';

const NotesPanel: React.FC<NotesPanelProps> = ({
  notes,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  currentTime
}) => {
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newNote, setNewNote] = useState({
    content: '',
    type: 'manual' as 'timeline' | 'manual',
    color: '#3b82f6',
    tags: [] as string[]
  });
  const [editingNote, setEditingNote] = useState<string | null>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAddNote = () => {
    if (!newNote.content.trim()) return;

    const note: Omit<MeetingNote, 'id'> = {
      content: newNote.content,
      author: {
        id: '1',
        name: 'Current User',
        avatar: 'CU'
      },
      timestamp: newNote.type === 'timeline' ? currentTime : 0,
      type: newNote.type,
      color: newNote.color,
      tags: newNote.tags
    };

    onAddNote(note);
    setNewNote({
      content: '',
      type: 'manual',
      color: '#3b82f6',
      tags: []
    });
    setIsAddingNote(false);
  };

  const handleEditNote = (note: MeetingNote) => {
    setEditingNote(note.id);
    setNewNote({
      content: note.content,
      type: note.type,
      color: note.color,
      tags: note.tags
    });
  };

  const handleUpdateNote = (id: string) => {
    if (!newNote.content.trim()) return;

    onUpdateNote(id, {
      content: newNote.content,
      color: newNote.color,
      tags: newNote.tags
    });

    setEditingNote(null);
    setNewNote({
      content: '',
      type: 'manual',
      color: '#3b82f6',
      tags: []
    });
  };

  const handleDeleteNote = (id: string) => {
    if (window.confirm('Are you sure you want to delete this note?')) {
      onDeleteNote(id);
    }
  };

  const colorOptions = [
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Green', value: '#10b981' },
    { name: 'Yellow', value: '#f59e0b' },
    { name: 'Red', value: '#ef4444' },
    { name: 'Purple', value: '#8b5cf6' },
    { name: 'Pink', value: '#ec4899' }
  ];

  const timelineNotes = notes.filter(note => note.type === 'timeline');
  const manualNotes = notes.filter(note => note.type === 'manual');

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          Notes
        </h3>
        <button
          onClick={() => setIsAddingNote(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
        >
          Add Note
        </button>
      </div>

      {/* Add/Edit Note Form */}
      {(isAddingNote || editingNote) && (
        <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
          <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-3">
            {editingNote ? 'Edit Note' : 'Add New Note'}
          </h4>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Note Type
              </label>
              <select
                value={newNote.type}
                onChange={(e) => setNewNote({ ...newNote, type: e.target.value as 'timeline' | 'manual' })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="manual">Manual Note</option>
                <option value="timeline">Timeline Note (at {formatTime(currentTime)})</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Content
              </label>
              <textarea
                value={newNote.content}
                onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                placeholder="Enter your note..."
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Color
              </label>
              <div className="flex gap-2">
                {colorOptions.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => setNewNote({ ...newNote, color: color.value })}
                    className={`w-6 h-6 rounded-full border-2 ${
                      newNote.color === color.value ? 'border-slate-400' : 'border-slate-200 dark:border-slate-600'
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={editingNote ? () => handleUpdateNote(editingNote) : handleAddNote}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
              >
                {editingNote ? 'Update Note' : 'Add Note'}
              </button>
              <button
                onClick={() => {
                  setIsAddingNote(false);
                  setEditingNote(null);
                  setNewNote({
                    content: '',
                    type: 'manual',
                    color: '#3b82f6',
                    tags: []
                  });
                }}
                className="px-4 py-2 bg-slate-300 hover:bg-slate-400 dark:bg-slate-600 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-md transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Timeline Notes */}
      {timelineNotes.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-3">
            Timeline Notes
          </h4>
          <div className="space-y-3">
            {timelineNotes.map((note) => (
              <div
                key={note.id}
                className="border border-slate-200 dark:border-slate-700 rounded-lg p-3"
                style={{ borderLeftColor: note.color, borderLeftWidth: '4px' }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                      {formatTime(note.timestamp)}
                    </span>
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: note.color }} />
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEditNote(note)}
                      className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded text-slate-500 dark:text-slate-400"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded text-slate-500 dark:text-slate-400"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  {note.content}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    by {note.author.name}
                  </span>
                  {note.tags.length > 0 && (
                    <div className="flex gap-1">
                      {note.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-400 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manual Notes */}
      {manualNotes.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-3">
            Manual Notes
          </h4>
          <div className="space-y-3">
            {manualNotes.map((note) => (
              <div
                key={note.id}
                className="border border-slate-200 dark:border-slate-700 rounded-lg p-3"
                style={{ borderLeftColor: note.color, borderLeftWidth: '4px' }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: note.color }} />
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Manual Note
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEditNote(note)}
                      className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded text-slate-500 dark:text-slate-400"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded text-slate-500 dark:text-slate-400"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  {note.content}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    by {note.author.name}
                  </span>
                  {note.tags.length > 0 && (
                    <div className="flex gap-1">
                      {note.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-400 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {notes.length === 0 && !isAddingNote && (
        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
          <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <p>No notes yet</p>
          <p className="text-sm">Click "Add Note" to get started</p>
        </div>
      )}
    </div>
  );
};

export default NotesPanel;
