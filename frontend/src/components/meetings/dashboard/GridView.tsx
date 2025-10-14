import React from 'react';
import type { Meeting } from './types';
import MeetingCard from './MeetingCard';

interface GridViewProps { meetings: Meeting[] }

const GridView: React.FC<GridViewProps> = ({ meetings }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {meetings.map(m => (
        <MeetingCard key={m.id} meeting={m} />
      ))}
    </div>
  );
};

export default GridView;


