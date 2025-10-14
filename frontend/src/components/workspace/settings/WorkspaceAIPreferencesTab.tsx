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
      <div className="bg-gray-900/50 backdrop-blur-sm rounded-lg border border-gray-700/50 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">AI Communication Tone</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {toneOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setTone(option.value)}
              className={`p-4 rounded-md border transition-all text-left ${
                tone === option.value
                  ? 'bg-purple-600/20 border-purple-500 shadow-lg shadow-purple-500/20'
                  : 'bg-gray-800/50 border-gray-700/50 hover:border-gray-600'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className={`font-medium ${tone === option.value ? 'text-purple-400' : 'text-gray-300'}`}>
                    {option.label}
                  </p>
                  <p className="text-sm text-gray-400 mt-1">{option.desc}</p>
                </div>
                {tone === option.value && <Check className="text-purple-400" size={20} />}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Organizational Goals */}
      <div className="bg-gray-900/50 backdrop-blur-sm rounded-lg border border-gray-700/50 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Organizational Goals</h3>
        <textarea
          value={goals}
          onChange={(e) => setGoals(e.target.value)}
          rows={4}
          placeholder="Define your workspace's primary goals and objectives..."
          className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all resize-none"
        />
      </div>

      {/* Focus Areas */}
      <div className="bg-gray-900/50 backdrop-blur-sm rounded-lg border border-gray-700/50 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Focus Areas</h3>
        <div className="flex flex-wrap gap-2 mb-3">
          {focusAreas.map((area, index) => (
            <span key={index} className="px-3 py-1.5 bg-purple-600/20 text-purple-400 rounded-md border border-purple-500/30 text-sm flex items-center gap-2">
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
          className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
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
