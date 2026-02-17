import React, { useState, useEffect, useRef } from 'react';
import { Tag, X, Plus } from 'lucide-react';
import { apiService } from '../../../services/api';
import type { Tag as TagType } from '../../../services/api';

interface TagSelectorProps {
  workspaceId: number;
  selectedTags: TagType[];
  onTagsChange: (tags: TagType[]) => void;
}

const TAG_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
];

const TagSelector: React.FC<TagSelectorProps> = ({
  workspaceId,
  selectedTags,
  onTagsChange,
}) => {
  const [allTags, setAllTags] = useState<TagType[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadTags();
  }, [workspaceId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsCreating(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const loadTags = async () => {
    try {
      const response = await apiService.getTags(workspaceId);
      if (response.data) {
        setAllTags(response.data.tags);
      }
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  };

  const handleToggleTag = (tag: TagType) => {
    const isSelected = selectedTags.some(t => t.id === tag.id);
    if (isSelected) {
      onTagsChange(selectedTags.filter(t => t.id !== tag.id));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  const handleRemoveTag = (tagId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    onTagsChange(selectedTags.filter(t => t.id !== tagId));
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    setLoading(true);
    try {
      const response = await apiService.createTag(workspaceId, newTagName.trim(), selectedColor);
      if (response.data) {
        const newTag = response.data.tag;
        setAllTags([...allTags, newTag]);
        onTagsChange([...selectedTags, newTag]);
        setNewTagName('');
        setSelectedColor(TAG_COLORS[0]);
        setIsCreating(false);
      }
    } catch (error) {
      console.error('Error creating tag:', error);
    } finally {
      setLoading(false);
    }
  };

  const availableTags = allTags.filter(
    tag => !selectedTags.some(selected => selected.id === tag.id)
  );

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Selected Tags Display */}
      <div className="flex flex-wrap gap-2 mb-2">
        {selectedTags.map(tag => (
          <div
            key={tag.id}
            className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium text-white"
            style={{ backgroundColor: tag.color }}
          >
            {tag.name}
            <button
              onClick={(e) => handleRemoveTag(tag.id, e)}
              className="hover:bg-white/20 rounded-full p-0.5 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Add Tag Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
      >
        <Tag className="w-4 h-4" />
        Add Tag
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 max-h-80 overflow-y-auto">
          {/* Available Tags */}
          {!isCreating && (
            <div className="p-2">
              <div className="text-xs font-semibold text-gray-500 uppercase mb-2 px-2">
                Select Tags
              </div>
              {availableTags.length > 0 ? (
                <div className="space-y-1">
                  {availableTags.map(tag => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => handleToggleTag(tag)}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-lg transition-colors text-left"
                    >
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="text-sm text-gray-700">{tag.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500 px-3 py-2">No tags available</div>
              )}

              {/* Create New Tag Button */}
              <button
                type="button"
                onClick={() => setIsCreating(true)}
                className="w-full flex items-center gap-2 px-3 py-2 mt-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create New Tag
              </button>
            </div>
          )}

          {/* Create Tag Form */}
          {isCreating && (
            <div className="p-3">
              <div className="text-xs font-semibold text-gray-500 uppercase mb-3">
                Create New Tag
              </div>

              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateTag();
                  } else if (e.key === 'Escape') {
                    setIsCreating(false);
                    setNewTagName('');
                  }
                }}
                placeholder="Tag name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm mb-3"
                autoFocus
              />

              <div className="mb-3">
                <div className="text-xs font-medium text-gray-700 mb-2">Color</div>
                <div className="flex flex-wrap gap-2">
                  {TAG_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setSelectedColor(color)}
                      className={`w-6 h-6 rounded-full transition-all ${
                        selectedColor === color
                          ? 'ring-2 ring-offset-2 ring-gray-400'
                          : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCreateTag}
                  disabled={!newTagName.trim() || loading}
                  className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Creating...' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setNewTagName('');
                  }}
                  className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TagSelector;

