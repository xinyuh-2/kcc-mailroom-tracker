'use client';
import { useState } from 'react';
import { DirectoryEntry } from '@/types/mailroom';

interface Props {
  directory: DirectoryEntry[];
  label?: string;
  placeholder?: string;
  onSelect: (person: DirectoryEntry) => void;
}

export default function EmailLookupInput({
  directory,
  label = 'Search Saved Email by Name',
  placeholder = 'Type name to look up email...',
  onSelect,
}: Props) {
  const [query, setQuery] = useState('');

  const matches = query.trim()
    ? directory
        .filter(
          (person) =>
            person.name?.toLowerCase().includes(query.toLowerCase()) ||
            person.email?.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 5)
    : [];

  return (
    <div>
      <label className="block text-base font-bold text-gray-900 mb-1.5">{label}</label>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full p-3 text-base border-2 border-gray-300 rounded-lg font-semibold bg-gray-50 focus:border-blue-600 focus:outline-none"
        placeholder={placeholder}
      />
      {matches.length > 0 && (
        <div className="mt-1.5 border-2 border-gray-300 rounded-lg bg-white divide-y shadow-sm">
          {matches.map((person) => (
            <button
              key={person.id}
              type="button"
              onClick={() => {
                onSelect(person);
                setQuery('');
              }}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 flex justify-between items-center text-sm font-semibold"
            >
              <span className="font-bold text-gray-900">{person.name}</span>
              <span className="text-blue-700 font-bold">{person.email}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}