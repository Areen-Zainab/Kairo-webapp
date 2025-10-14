import { useState } from 'react';
import { Save, Check, X } from 'lucide-react';

export default function WorkspaceAIPreferencesTab() {
  const [tone, setTone] = useState('professional');
  const [goals, setGoals] = useState('Improve team collaboration and streamline product development');
  const [focusAreas, setFocusAreas] = useState(['Product Development', 'Customer Feedback']);

  const toneOptions = [
    { value: 'professional', label: 'Professional', desc: 'Formal and business-appropriate' },
    { value: 'concise', label: 'Concise', desc: 'Brief and to the point' },
    { value: 'creative', label: 'Creative', desc: 'Innovative and expressive' },
    { value: 'friendly', label: 'Friendly', desc: 'Warm and conversational' },
  ];

  return (
    <div className="space-y-6">
      {/* AI Tone */}
      <div className="rounded-lg border p-6 bg-white border-gray-200 dark:bg-gray-900/50 dark:border-gray-700/50">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">AI Communication Tone</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {toneOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setTone(option.value)}
              className={`p-4 rounded-md border transition-all text-left ${
                tone === option.value
                  ? 'bg-purple-50 border-purple-300 shadow-sm dark:bg-purple-600/20 dark:border-purple-500 dark:shadow-lg dark:shadow-purple-500/20'
                  : 'bg-white border-gray-200 hover:border-gray-300 dark:bg-gray-800/50 dark:border-gray-700/50 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className={`font-medium ${tone === option.value ? 'text-purple-700 dark:text-purple-400' : 'text-gray-800 dark:text-gray-300'}`}>
                    {option.label}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{option.desc}</p>
                </div>
                {tone === option.value && <Check className="text-purple-700 dark:text-purple-400" size={20} />}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Organizational Goals */}
      <div className="rounded-lg border p-6 bg-white border-gray-200 dark:bg-gray-900/50 dark:border-gray-700/50">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Organizational Goals</h3>
        <textarea
          value={goals}
          onChange={(e) => setGoals(e.target.value)}
          rows={4}
          placeholder="Define your workspace's primary goals and objectives..."
          className="w-full px-4 py-3 rounded-md transition-all resize-none bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/40 dark:bg-gray-800/50 dark:border-gray-700/50 dark:text-white dark:placeholder-gray-500"
        />
      </div>

      {/* Focus Areas */}
      <div className="rounded-lg border p-6 bg-white border-gray-200 dark:bg-gray-900/50 dark:border-gray-700/50">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Focus Areas</h3>
        <div className="flex flex-wrap gap-2 mb-3">
          {focusAreas.map((area, index) => (
            <span key={index} className="px-3 py-1.5 rounded-md border text-sm flex items-center gap-2 bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-600/20 dark:text-purple-400 dark:border-purple-500/30">
              {area}
              <button onClick={() => setFocusAreas(focusAreas.filter((_, i) => i !== index))} className="hover:text-purple-300">
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
        <input
          type="text"
          placeholder="Add focus area (press Enter)"
          onKeyPress={(e) => {
            const target = e.target as HTMLInputElement;
            if (e.key === 'Enter' && target.value) {
              setFocusAreas([...focusAreas, target.value]);
              target.value = '';
            }
          }}
          className="w-full px-4 py-3 rounded-md transition-all bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/40 dark:bg-gray-800/50 dark:border-gray-700/50 dark:text-white dark:placeholder-gray-500"
        />
      </div>

      <div className="flex justify-end">
        <button className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-700 text-white rounded-md hover:from-purple-500 hover:to-indigo-600 transition-all font-medium shadow-lg hover:shadow-purple-500/30 flex items-center gap-2">
          <Save size={18} />
          Save Preferences
        </button>
      </div>
    </div>
  );
}
