import React from 'react';

export default function MessageContextMenu({
  x,
  y,
  onCopyEncrypted,
  onCopyLink,
  onForward,
  onDelete,
  onSelect,
  onClose,
}: {
  x: number;
  y: number;
  onCopyEncrypted: () => void;
  onCopyLink: () => void;
  onForward: () => void;
  onDelete: () => void;
  onSelect: () => void;
  onClose: () => void;
}) {
  return (
    <div
      style={{ left: x, top: y }}
      className="absolute z-50 bg-card border border-border rounded shadow-md p-2"
      onMouseLeave={onClose}
    >
      <button className="block px-3 py-1 text-sm w-full text-left hover:bg-gray-700" onClick={() => { onCopyEncrypted(); onClose(); }}>Copy (encrypted)</button>
      <button className="block px-3 py-1 text-sm w-full text-left hover:bg-gray-700" onClick={() => { onCopyLink(); onClose(); }}>Copy message link</button>
      <button className="block px-3 py-1 text-sm w-full text-left hover:bg-gray-700" onClick={() => { onForward(); onClose(); }}>Forward</button>
      <button className="block px-3 py-1 text-sm w-full text-left hover:bg-gray-700" onClick={() => { onSelect(); onClose(); }}>Select</button>
      <button className="block px-3 py-1 text-sm w-full text-left text-red-400 hover:bg-gray-700" onClick={() => { onDelete(); onClose(); }}>Delete</button>
    </div>
  );
}
