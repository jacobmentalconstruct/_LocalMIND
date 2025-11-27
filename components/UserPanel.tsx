// components/UserPanel.tsx
import React from 'react';
import { UserIcon } from './icons';

interface UserPanelProps {
  name: string;
  description: string;
}

const UserPanel: React.FC<UserPanelProps> = ({ name, description }) => {
  return (
    <div className="h-full bg-gray-900 flex flex-col">
      <div className="px-3 py-2 border-b border-gray-800 bg-gray-900/80 flex items-center gap-2">
        <UserIcon className="w-4 h-4 text-emerald-400" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
          User Profile
        </span>
      </div>
      <div className="px-3 py-2 text-xs text-gray-300 space-y-1 overflow-hidden">
        <div className="font-semibold truncate">{name}</div>
        <p className="text-[11px] text-gray-400 leading-snug line-clamp-3">
          {description}
        </p>
      </div>
    </div>
  );
};

export default UserPanel;
