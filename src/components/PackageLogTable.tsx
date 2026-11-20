'use client';
import { useState } from 'react';
import { PackageItem } from '@/types/mailroom';
import { formatDateTime } from '@/lib/media';

interface Props {
  packages: PackageItem[];
}

export default function PackageLogTable({ packages }: Props) {
  const [historySearch, setHistorySearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'Delivered'>('All');
  const [selectedSignature, setSelectedSignature] = useState<{
    url: string;
    recipientName: string;
    deliveredAt?: string | null;
    deliveredBy?: string | null;
  } | null>(null);

  const filteredHistory = packages.filter((p) => {
    const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
    const q = historySearch.toLowerCase();
    const matchesQuery =
      p.recipient_name?.toLowerCase().includes(q) ||
      p.recipient_email?.toLowerCase().includes(q) ||
      p.tracking_number?.toLowerCase().includes(q) ||
      p.building?.toLowerCase().includes(q) ||
      p.received_by?.toLowerCase().includes(q) ||
      p.delivered_by?.toLowerCase().includes(q);
    return matchesStatus && matchesQuery;
  });

  function getSignatureUrl(pkg: PackageItem): string | null {
    const record = pkg as PackageItem & Record<string, unknown>;
    const raw =
      record.signature_url ??
      record.recipient_signature ??
      record.signature ??
      record.signature_data;

    if (typeof raw !== 'string') return null;

    const trimmed = raw.trim();
    if (!trimmed) return null;

    const match = trimmed.match(/^data:image\/[a-zA-Z0-9+.-]+;base64,(.+)$/);
    if (match) {
      return match[1].trim().length > 0 ? trimmed : null;
    }

    if (trimmed.startsWith('data:image/') || trimmed.startsWith('http')) {
      return trimmed;
    }

    return `data:image/png;base64,${trimmed}`;
  }

  return (
    <div className="mt-8 bg-white p-7 rounded-xl shadow-lg border border-gray-200">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h2 className="text-xl font-extrabold text-gray-900">
          Logged Packages ({filteredHistory.length})
        </h2>
        <div className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
            placeholder="Search name, staff, building..."
            className="p-2.5 text-base border-2 border-gray-400 rounded-lg font-semibold focus:outline-none"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'All' | 'Pending' | 'Delivered')}
            className="p-2.5 text-base border-2 border-gray-400 rounded-lg font-semibold bg-white focus:outline-none"
          >
            <option value="All">All</option>
            <option value="Pending">Pending</option>
            <option value="Delivered">Delivered</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-base text-left border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-300 bg-gray-100 text-gray-900 font-extrabold">
              <th className="p-3">Recipient</th>
              <th className="p-3">Location</th>
              <th className="p-3">Tracking</th>
              <th className="p-3">Received</th>
              <th className="p-3">Delivered</th>
              <th className="p-3">Photo</th>
              <th className="p-3">Signature</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody className="font-semibold text-gray-800">
            {filteredHistory.map((p) => {
              const signatureUrl = getSignatureUrl(p);

              return (
                <tr key={p.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="p-3">
                    <div className="font-bold text-gray-900">{p.recipient_name}</div>
                    <div className="text-sm font-semibold text-gray-600">
                      {p.recipient_position} {p.recipient_email ? `• ${p.recipient_email}` : ''}
                    </div>
                  </td>
                  <td className="p-3 text-sm font-semibold">
                    {p.building} {p.room_number ? `Rm ${p.room_number}` : ''}
                  </td>
                  <td className="p-3">
                    <div className="font-mono text-sm font-bold text-gray-900">
                      {p.tracking_number}
                    </div>
                    <div className="text-sm font-semibold text-gray-600">
                      {p.carrier} {p.carrier_type ? `(${p.carrier_type})` : ''}
                    </div>
                    {p.notes && (
                      <div className="text-sm font-bold text-amber-800 mt-0.5">Note: {p.notes}</div>
                    )}
                  </td>
                  <td className="p-3 text-sm font-semibold text-gray-700">
                    <div>{formatDateTime(p.received_at)}</div>
                    {p.received_by && (
                      <div className="text-gray-500 font-bold">By: {p.received_by}</div>
                    )}
                  </td>
                  <td className="p-3 text-sm font-semibold text-gray-700">
                    {p.status === 'Delivered' ? (
                      <>
                        <div>{formatDateTime(p.delivered_at)}</div>
                        {p.delivered_by && (
                          <div className="text-gray-500 font-bold">By: {p.delivered_by}</div>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="p-3 text-sm">
                    {p.photo_url ? (
                      <a
                        href={p.photo_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-700 font-bold underline"
                      >
                        View
                      </a>
                    ) : (
                      <span className="text-gray-400 font-semibold">None</span>
                    )}
                  </td>
                  <td className="p-3 text-sm">
                    {signatureUrl ? (
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedSignature({
                            url: signatureUrl,
                            recipientName: p.recipient_name || 'Recipient',
                            deliveredAt: p.delivered_at,
                            deliveredBy: p.delivered_by,
                          })
                        }
                        className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-blue-800 font-bold border border-slate-300"
                      >
                        <img
                          src={signatureUrl}
                          alt={`Signature for ${p.recipient_name}`}
                          className="h-6 w-14 object-contain bg-white rounded border border-slate-200 px-0.5"
                        />
                        <span>View</span>
                      </button>
                    ) : (
                      <span className="text-gray-400 font-semibold">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-3 py-1 text-xs rounded-full font-extrabold uppercase tracking-wider ${
                        p.status === 'Pending'
                          ? 'bg-amber-200 text-amber-900'
                          : 'bg-green-200 text-green-900'
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Signature Preview Modal */}
      {selectedSignature && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setSelectedSignature(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border-2 border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-xl font-extrabold text-gray-900">
                  Delivery Signature
                </h3>
                <p className="text-base font-bold text-gray-700">
                  {selectedSignature.recipientName}
                </p>
                {selectedSignature.deliveredAt && (
                  <p className="text-sm font-semibold text-gray-500 mt-0.5">
                    Delivered: {formatDateTime(selectedSignature.deliveredAt)}
                    {selectedSignature.deliveredBy ? ` • By: ${selectedSignature.deliveredBy}` : ''}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedSignature(null)}
                className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-base font-extrabold text-gray-800"
              >
                Close
              </button>
            </div>

            <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl p-4 flex items-center justify-center min-h-48">
              <img
                src={selectedSignature.url}
                alt={`Signature for ${selectedSignature.recipientName}`}
                className="max-h-56 w-auto object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}