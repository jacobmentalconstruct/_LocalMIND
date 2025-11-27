// components/UserPanel.tsx
import React, { useState, useEffect } from 'react';
import { UserIcon, PencilIcon, SaveIcon, XIcon } from './icons';

interface UserPanelProps {
  name: string;
  description: string;
onSave: (name: string, description: string) => void;
}

  const UserPanel: React.FC<UserPanelProps> = ({ name, description, onSave }) => {
    const [isEditing, setIsEditing] = useState(false);
      const [tempName, setTempName] = useState(name);
        const [tempDesc, setTempDesc] = useState(description);
        
          // Sync local state if props change externally
        useEffect(() => {
      if (!isEditing) {
      setTempName(name);
        setTempDesc(description);
        }
          }, [name, description, isEditing]);
        
      const handleSave = () => {
    onSave(tempName, tempDesc);
  setIsEditing(false);
};

const handleCancel = () => {
setTempName(name);
setTempDesc(description);
setIsEditing(false);
};

return (
<div className="h-full bg-gray-900 flex flex-col group">
<div className="px-3 py-2 border-b border-gray-800 bg-gray-900/80 flex items-center justify-between">
<div className="flex items-center gap-2">
<UserIcon className="w-4 h-4 text-emerald-400" />
<span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
Identity
</span>
</div>
{!isEditing && (
<button
onClick={() => setIsEditing(true)}
className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-500 hover:text-emerald-400"
title="Edit Identity"
>
<PencilIcon className="w-3.5 h-3.5" />
</button>
)}
</div>

<div className="flex-1 p-3 overflow-hidden">
{isEditing ? (
<div className="flex flex-col gap-2 h-full">
<input
value={tempName}
onChange={(e) => setTempName(e.target.value)}
className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:border-emerald-500 outline-none"
placeholder="User Name"
/>
<textarea
value={tempDesc}
onChange={(e) => setTempDesc(e.target.value)}
className="h-24 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-[11px] text-gray-300 focus:border-emerald-500 outline-none resize-none"
placeholder="Short description..."
/>
<div className="flex justify-end gap-2 pt-1">
<button onClick={handleCancel} className="text-gray-400 hover:text-white">
<XIcon className="w-4 h-4" />
</button>
<button onClick={handleSave} className="text-emerald-400 hover:text-emerald-300">
<SaveIcon className="w-4 h-4" />
</button>
</div>
</div>
) : (
<div className="space-y-1 h-full overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-700">
<div className="font-semibold text-xs text-gray-200 truncate">{name}</div>
<p className="text-[11px] text-gray-400 leading-snug whitespace-pre-wrap">
{description}
</p>
</div>
)}
</div>
</div>
);
};

export default UserPanel;




