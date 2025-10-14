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
          className="w-full px-2.5 py-2 bg-slate-800/50 border border-slate-700/50 rounded text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
          rows={2}
        />
        <div className="mt-1.5 flex items-center gap-2">
          <label htmlFor="note-privacy" className="text-xs text-slate-400">Visibility</label>
          <select
            id="note-privacy"
            value={newNotePrivacy}
            onChange={(e) => onChangePrivacy(e.target.value as 'public' | 'private')}
            className="px-2 py-1 rounded bg-slate-800/60 border border-slate-700/60 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
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
        <div key={note.id} className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">{note.author}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${note.isPrivate ? 'border-red-500/40 text-red-300 bg-red-500/10' : 'border-green-500/40 text-green-300 bg-green-500/10'}`}>{note.isPrivate ? 'Private' : 'Public'}</span>
            </div>
            <span className="text-xs text-slate-500">{note.timestamp}</span>
          </div>
          <p className="text-sm text-white">{note.text}</p>
        </div>
      ))}
    </div>
  );
};

export default NotesTab;

