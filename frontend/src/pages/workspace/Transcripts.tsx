import React from 'react';
import Layout from '../../components/Layout';
import { FileText } from 'lucide-react';

const Transcripts: React.FC = () => {
  return (
    <Layout>
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="text-center space-y-6 max-w-2xl">
          {/* Icon */}
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-purple-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
            <FileText className="w-10 h-10 text-white" />
          </div>
          
          {/* Banner */}
          <div className="bg-white dark:bg-slate-800 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-2xl p-12">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
              Transcripts Coming Soon
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              This feature will be implemented to display and manage all meeting transcripts in one place.
            </p>
          </div>
          
          {/* Info */}
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Stay tuned for updates
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Transcripts;

