import { useState } from 'react';
import { Upload, Save } from 'lucide-react';

export default function WorkspaceGeneralTab() {
  const [workspaceName, setWorkspaceName] = useState('Product Team Alpha');
  const [description, setDescription] = useState('Main workspace for product development and team collaboration');
  const [logoPreview, setLogoPreview] = useState<string | ArrayBuffer | null>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setLogoPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    console.log('Saving general settings:', { workspaceName, description, logo: logoPreview });
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-900/50 backdrop-blur-sm rounded-lg border border-gray-700/50 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Workspace Information</h3>
        
        <div className="space-y-5">
          {/* Logo Upload */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">
              Workspace Logo
            </label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-md bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-dashed border-purple-500/30 flex items-center justify-center overflow-hidden hover:border-purple-500/60 transition-all duration-300">
                {logoPreview ? (
                  typeof logoPreview === 'string' ? (
                    <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <Upload className="text-gray-600" size={28} />
                  )
                ) : (
                  <Upload className="text-gray-600" size={28} />
                )}
              </div>
              <label className="cursor-pointer">
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                <div className="px-5 py-2.5 bg-gray-800/50 text-gray-200 rounded-md hover:bg-gray-700/50 transition-all border border-gray-600/50 text-sm font-medium">
                  {logoPreview ? 'Change Logo' : 'Upload Logo'}
                </div>
              </label>
            </div>
          </div>

          {/* Workspace Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2 uppercase tracking-wider">
              Workspace Name
            </label>
            <input
              type="text"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2 uppercase tracking-wider">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all resize-none"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-700 text-white rounded-md hover:from-purple-500 hover:to-indigo-600 transition-all font-medium shadow-lg hover:shadow-purple-500/30 flex items-center gap-2"
        >
          <Save size={18} />
          Save Changes
        </button>
      </div>
    </div>
  );
}
