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

  async function fetchPackages() {
    const { data } = await supabase
      .from('packages')
      .select('*')
      .order('received_at', { ascending: false });
    if (data) setPackages(data);
  }

  async function refreshAll() {
    await Promise.all([fetchPackages(), fetchDirectory().then(setDirectory)]);
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
