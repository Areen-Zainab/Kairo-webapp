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
      <div className="rounded-lg border p-6 bg-white border-gray-200 dark:bg-gray-900/50 dark:border-gray-700/50">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Workspace Information</h3>
        
        <div className="space-y-5">
          {/* Logo Upload */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">
              Workspace Logo
            </label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-md bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 border-2 border-dashed border-purple-300 dark:border-purple-500/30 flex items-center justify-center overflow-hidden hover:border-purple-400 dark:hover:border-purple-500/60 transition-all duration-300">
                {logoPreview ? (
                  typeof logoPreview === 'string' ? (
                    <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <Upload className="text-gray-500 dark:text-gray-600" size={28} />
                  )
                ) : (
                  <Upload className="text-gray-500 dark:text-gray-600" size={28} />
                )}
              </div>
              <label className="cursor-pointer">
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                <div className="px-5 py-2.5 rounded-md transition-all border text-sm font-medium bg-white border-gray-300 text-gray-900 hover:bg-gray-100 dark:bg-gray-800/50 dark:border-gray-600/50 dark:text-gray-200 dark:hover:bg-gray-700/50">
                  {logoPreview ? 'Change Logo' : 'Upload Logo'}
                </div>
              </label>
            </div>
          </div>

          {/* Workspace Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">
              Workspace Name
            </label>
            <input
              type="text"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              className="w-full px-4 py-3 rounded-md transition-all bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/40 dark:bg-gray-800/50 dark:border-gray-700/50 dark:text-white"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 rounded-md transition-all resize-none bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/40 dark:bg-gray-800/50 dark:border-gray-700/50 dark:text-white dark:placeholder-gray-500"
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
