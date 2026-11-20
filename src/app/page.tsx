'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { DirectoryEntry, PackageItem } from '@/types/mailroom';
import { fetchDirectory } from '@/lib/directory';
import IntakeTab from '@/components/IntakeTab';
import DeliveryTab from '@/components/DeliveryTab';
import PackageLogTable from '@/components/PackageLogTable';

export default function PackageTrackerApp() {
  const [activeTab, setActiveTab] = useState<'intake' | 'delivery'>('intake');
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [directory, setDirectory] = useState<DirectoryEntry[]>([]);

  async function refreshAll() {
    const [{ data: pkgData }, dirData] = await Promise.all([
      supabase.from('packages').select('*').order('received_at', { ascending: false }),
      fetchDirectory(),
    ]);

    const loadedPackages = pkgData || [];
    setPackages(loadedPackages);

    // Merge saved directory with unique emails from past packages
    const byEmail = new Map<string, DirectoryEntry>();
    for (const entry of dirData) {
      byEmail.set(entry.email.toLowerCase(), entry);
    }
    for (const pkg of loadedPackages) {
      const email = pkg.recipient_email?.trim().toLowerCase();
      if (email && !byEmail.has(email) && pkg.recipient_name) {
        byEmail.set(email, {
          id: pkg.id,
          name: pkg.recipient_name,
          email,
          building: pkg.building,
          room_number: pkg.room_number,
          position: pkg.recipient_position,
        });
      }
    }

    setDirectory(Array.from(byEmail.values()));
  }

  useEffect(() => {
    refreshAll();
  }, []);

  return (
    <main className="max-w-4xl mx-auto p-4 font-sans pb-20 text-gray-900 font-medium">
      <h1 className="text-3xl font-extrabold mb-6 text-center text-blue-900 tracking-wide">
        Mailroom Package Tracker
      </h1>

      <div className="flex border-b-2 border-gray-300 mb-6 font-bold text-base">
        <button
          className={`flex-1 py-3 text-center transition-colors ${
            activeTab === 'intake'
              ? 'border-b-4 border-blue-700 text-blue-800 bg-blue-50/50'
              : 'text-gray-600 hover:text-gray-900'
          }`}
          onClick={() => setActiveTab('intake')}
        >
          1. Log New Package
        </button>
        <button
          className={`flex-1 py-3 text-center transition-colors ${
            activeTab === 'delivery'
              ? 'border-b-4 border-blue-700 text-blue-800 bg-blue-50/50'
              : 'text-gray-600 hover:text-gray-900'
          }`}
          onClick={() => setActiveTab('delivery')}
        >
          2. Batch Delivery &amp; Sign
        </button>
      </div>

      {activeTab === 'intake' ? (
        <IntakeTab directory={directory} onSaved={refreshAll} />
      ) : (
        <DeliveryTab packages={packages} directory={directory} onSaved={refreshAll} />
      )}

      <PackageLogTable packages={packages} />
    </main>
  );
}