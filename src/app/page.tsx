'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { DirectoryEntry, PackageItem } from '@/types/mailroom';
import { fetchDirectory } from '@/lib/directory';
import IntakeTab from '@/components/IntakeTab';
import DeliveryTab from '@/components/DeliveryTab';
import PackageLogTable from '@/components/PackageLogTable';

type AppView = 'intake' | 'delivery' | 'log';

export default function PackageTrackerApp() {
  const [activeView, setActiveView] = useState<AppView>('intake');
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [directory, setDirectory] = useState<DirectoryEntry[]>([]);

  async function refreshAll() {
    const [{ data: pkgData }, { data: delData }, dirData] = await Promise.all([
      supabase.from('packages').select('*').order('received_at', { ascending: false }),
      supabase.from('deliveries').select('id, signature_url, photo_url, photo_urls'),
      fetchDirectory(),
    ]);

    const deliveryById = new Map<
      string,
      {
        signature_url: string | null;
        photo_url: string | null;
        photo_urls: string[];
      }
    >();

    for (const del of delData || []) {
      if (del.id) {
        const delUrls =
          Array.isArray(del.photo_urls) && del.photo_urls.length > 0
            ? del.photo_urls
            : del.photo_url
            ? [del.photo_url]
            : [];

        deliveryById.set(del.id, {
          signature_url: del.signature_url ?? null,
          photo_url: delUrls[0] ?? del.photo_url ?? null,
          photo_urls: delUrls,
        });
      }
    }

    const loadedPackages: PackageItem[] = (pkgData || []).map((pkg: any) => {
      const linkedDelivery = pkg.delivery_id ? deliveryById.get(pkg.delivery_id) : undefined;

      const intakeUrls =
        Array.isArray(pkg.photo_urls) && pkg.photo_urls.length > 0
          ? pkg.photo_urls
          : pkg.photo_url
          ? [pkg.photo_url]
          : [];

      const deliveryUrls =
        Array.isArray(pkg.delivery_photo_urls) && pkg.delivery_photo_urls.length > 0
          ? pkg.delivery_photo_urls
          : linkedDelivery?.photo_urls?.length
          ? linkedDelivery.photo_urls
          : pkg.delivery_photo_url
          ? [pkg.delivery_photo_url]
          : linkedDelivery?.photo_url
          ? [linkedDelivery.photo_url]
          : [];

      return {
        ...pkg,
        photo_url: intakeUrls[0] ?? pkg.photo_url ?? null,
        photo_urls: intakeUrls,
        signature_url: pkg.signature_url || linkedDelivery?.signature_url || null,
        delivery_photo_url: deliveryUrls[0] ?? linkedDelivery?.photo_url ?? null,
        delivery_photo_urls: deliveryUrls,
      };
    });

    setPackages(loadedPackages);

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

  const pendingCount = packages.filter((p) => p.status === 'Pending').length;

  return (
    <div className="min-h-screen bg-slate-100 text-gray-900 pb-24">
      {/* Top AppSheet-style Header */}
      <header className="sticky top-0 z-20 bg-white border-b-2 border-slate-200 px-4 py-3.5 shadow-sm">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-blue-950 leading-tight">
              Mailroom Tracker
            </h1>
            <p className="text-sm font-bold text-slate-600">
              {pendingCount} pending on shelf
            </p>
          </div>

          {/* Top switcher for larger screens */}
          <div className="hidden sm:flex gap-2">
            <button
              type="button"
              onClick={() => setActiveView('intake')}
              className={`px-4 py-2 rounded-lg text-base font-extrabold transition-colors ${
                activeView === 'intake'
                  ? 'bg-blue-700 text-white'
                  : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
              }`}
            >
              Intake
            </button>
            <button
              type="button"
              onClick={() => setActiveView('delivery')}
              className={`px-4 py-2 rounded-lg text-base font-extrabold transition-colors ${
                activeView === 'delivery'
                  ? 'bg-green-700 text-white'
                  : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
              }`}
            >
              Delivery
            </button>
            <button
              type="button"
              onClick={() => setActiveView('log')}
              className={`px-4 py-2 rounded-lg text-base font-extrabold transition-colors ${
                activeView === 'log'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
              }`}
            >
              Log ({packages.length})
            </button>
          </div>
        </div>
      </header>

      {/* Main Scrollable View */}
      <main className="max-w-3xl mx-auto px-3 sm:px-4 pt-4">
        {activeView === 'intake' && (
          <IntakeTab directory={directory} onSaved={refreshAll} />
        )}

        {activeView === 'delivery' && (
          <DeliveryTab packages={packages} directory={directory} onSaved={refreshAll} />
        )}

        {activeView === 'log' && (
          <PackageLogTable packages={packages} />
        )}
      </main>

      {/* AppSheet-style Bottom Navigation Bar for iPhone */}
      <nav
        aria-label="App views"
        className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t-2 border-slate-300 grid grid-cols-3 shadow-lg"
      >
        <button
          type="button"
          onClick={() => {
            setActiveView('intake');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`py-3.5 text-center text-base font-extrabold border-r border-slate-200 ${
            activeView === 'intake'
              ? 'bg-blue-50 text-blue-800 border-t-4 border-t-blue-700'
              : 'text-slate-700'
          }`}
        >
          Intake
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveView('delivery');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`py-3.5 text-center text-base font-extrabold border-r border-slate-200 ${
            activeView === 'delivery'
              ? 'bg-green-50 text-green-800 border-t-4 border-t-green-700'
              : 'text-slate-700'
          }`}
        >
          Delivery
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveView('log');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`py-3.5 text-center text-base font-extrabold ${
            activeView === 'log'
              ? 'bg-slate-100 text-slate-950 border-t-4 border-t-slate-900'
              : 'text-slate-700'
          }`}
        >
          Log ({packages.length})
        </button>
      </nav>
    </div>
  );
}