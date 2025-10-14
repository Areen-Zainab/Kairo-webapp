import React from 'react';

interface Note { id: string; text: string; timestamp: string; author: string; isPrivate: boolean }

interface NotesTabProps {
  notes: Note[];
  newNote: string;
  newNotePrivacy: 'public' | 'private';
  onChangeNewNote: (v: string) => void;
  onChangePrivacy: (v: 'public' | 'private') => void;
  onAddNote: () => void;
}

const NotesTab: React.FC<NotesTabProps> = ({ notes, newNote, newNotePrivacy, onChangeNewNote, onChangePrivacy, onAddNote }) => {
  return (
    <div className="space-y-2">
      <div className="mb-3">
        <textarea
          value={newNote}
          onChange={(e) => onChangeNewNote(e.target.value)}
          placeholder="Take a note..."
          className="w-full px-2.5 py-2 rounded text-sm resize-none bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-500/40 dark:bg-slate-800/50 dark:border-slate-700/50 dark:text-white dark:placeholder-slate-500"
          rows={2}
        />
        <div className="mt-1.5 flex items-center gap-2">
          <label htmlFor="note-privacy" className="text-xs text-gray-600 dark:text-slate-400">Visibility</label>
          <select
            id="note-privacy"
            value={newNotePrivacy}
            onChange={(e) => onChangePrivacy(e.target.value as 'public' | 'private')}
            className="px-2 py-1 rounded text-xs focus:outline-none focus:ring-1 focus:ring-purple-500/40 bg-white border border-gray-300 text-gray-900 dark:bg-slate-800/60 dark:border-slate-700/60 dark:text-slate-200"
          >
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>
          <button onClick={onAddNote} className="ml-auto px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded text-white text-sm font-medium transition-colors">
            Add Note
          </button>
        </div>
      </div>
      {notes.map((note) => (
        <div key={note.id} className="rounded-lg p-3 bg-white border border-gray-200 dark:bg-slate-800/40 dark:border-slate-700/50">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600 dark:text-slate-400">{note.author}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${note.isPrivate ? 'border-red-300 text-red-700 bg-red-100 dark:border-red-500/40 dark:text-red-300 dark:bg-red-500/10' : 'border-green-300 text-green-700 bg-green-100 dark:border-green-500/40 dark:text-green-300 dark:bg-green-500/10'}`}>{note.isPrivate ? 'Private' : 'Public'}</span>
            </div>
            <span className="text-xs text-gray-500 dark:text-slate-500">{note.timestamp}</span>
          </div>
          <p className="text-sm text-gray-900 dark:text-white">{note.text}</p>
        </div>
      ))}
    </div>
  );
};

export default NotesTab;

