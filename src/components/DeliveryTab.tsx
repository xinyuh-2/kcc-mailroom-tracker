'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { DirectoryEntry, PackageItem } from '@/types/mailroom';
import { compressImage } from '@/lib/media';
import EmailLookupInput from './EmailLookupInput';
import SignaturePad from 'signature_pad';
import { saveToDirectory } from '@/lib/directory';

const POSITIONS = ['Student Assistant', 'Faculty', 'Staff', 'Administration', 'Vendor', 'Academics', 'Other'];
const MAX_DELIVERY_PHOTOS = 4;

interface Props {
  packages: PackageItem[];
  directory: DirectoryEntry[];
  onSaved: () => Promise<void> | void;
}

export default function DeliveryTab({ packages, directory, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [deliverySearch, setDeliverySearch] = useState('');
  const [deliveryRecipient, setDeliveryRecipient] = useState('');
  const [deliveryEmail, setDeliveryEmail] = useState('');
  const [deliveryPosition, setDeliveryPosition] = useState('Staff');
  const [deliveredBy, setDeliveredBy] = useState('');
  const [selectedPackageIds, setSelectedPackageIds] = useState<string[]>([]);

  const signaturePadRef = useRef<SignaturePad | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [deliveryPhotoFiles, setDeliveryPhotoFiles] = useState<File[]>([]);
  const [deliveryPhotoPreviews, setDeliveryPhotoPreviews] = useState<string[]>([]);
  const deliveryPhotoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    function resizeCanvas() {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const existingData = signaturePadRef.current?.toData();

      canvas.width = Math.floor(rect.width * ratio);
      canvas.height = Math.floor(rect.height * ratio);

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      }

      if (!signaturePadRef.current) {
        signaturePadRef.current = new SignaturePad(canvas, {
          penColor: 'rgb(15, 23, 42)',
          minWidth: 2,
          maxWidth: 4,
        });
      } else {
        signaturePadRef.current.clear();
        if (existingData && existingData.length > 0) {
          signaturePadRef.current.fromData(existingData);
        }
      }
    }

    const timer = setTimeout(resizeCanvas, 50);
    window.addEventListener('resize', resizeCanvas);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  function syncPhotoPreviews(files: File[]) {
    setDeliveryPhotoFiles(files);
    setDeliveryPhotoPreviews(files.map((file) => URL.createObjectURL(file)));
  }

  function handleDeliveryPhotosSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files || []);
    if (picked.length === 0) return;

    const merged = [...deliveryPhotoFiles, ...picked].slice(0, MAX_DELIVERY_PHOTOS);
    if (deliveryPhotoFiles.length + picked.length > MAX_DELIVERY_PHOTOS) {
      alert(`Up to ${MAX_DELIVERY_PHOTOS} delivery/damage photos are allowed per delivery.`);
    }

    syncPhotoPreviews(merged);
    if (deliveryPhotoInputRef.current) deliveryPhotoInputRef.current.value = '';
  }

  function removeDeliveryPhoto(indexToRemove: number) {
    const updated = deliveryPhotoFiles.filter((_, idx) => idx !== indexToRemove);
    syncPhotoPreviews(updated);
  }

  async function handleDeliveryCheckout(e: React.FormEvent) {
    e.preventDefault();
    if (selectedPackageIds.length === 0) {
      alert('Please select at least one package to deliver.');
      return;
    }
    if (signaturePadRef.current?.isEmpty()) {
      alert('Please provide a signature.');
      return;
    }

    setLoading(true);
    const signatureDataUrl = signaturePadRef.current?.toDataURL() ?? null;
    const deliveredIso = new Date().toISOString();

    const uploadedPhotoUrls: string[] = [];
    for (let i = 0; i < deliveryPhotoFiles.length; i++) {
      const file = deliveryPhotoFiles[i];
      const compressedBlob = await compressImage(file);
      const fileName = `delivery-${Date.now()}-${i + 1}-${Math.random().toString(36).substring(2, 7)}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('package-photos')
        .upload(fileName, compressedBlob, { contentType: 'image/jpeg' });

      if (uploadError) {
        alert('Delivery photo upload error: ' + uploadError.message);
        setLoading(false);
        return;
      }

      const { data: publicURLData } = supabase.storage
        .from('package-photos')
        .getPublicUrl(fileName);

      uploadedPhotoUrls.push(publicURLData.publicUrl);
    }

    const { data: deliveryData, error: deliveryError } = await supabase
      .from('deliveries')
      .insert([
        {
          recipient_name: deliveryRecipient,
          delivered_by: deliveredBy,
          signature_url: signatureDataUrl,
          photo_url: uploadedPhotoUrls[0] ?? null,
        },
      ])
      .select()
      .single();

    if (deliveryError) {
      alert('Error saving delivery: ' + deliveryError.message);
      setLoading(false);
      return;
    }

    setDeliveryPhotoFiles([]);
    setDeliveryPhotoPreviews([]);
    if (deliveryPhotoInputRef.current) deliveryPhotoInputRef.current.value = '';

    const { error: updateError } = await supabase
      .from('packages')
      .update({
        delivery_id: deliveryData.id,
        recipient_email: deliveryEmail,
        recipient_position: deliveryPosition,
        delivered_by: deliveredBy,
        delivered_at: deliveredIso,
        status: 'Delivered',
      })
      .in('id', selectedPackageIds);

    if (updateError) {
      alert('Error updating packages: ' + updateError.message);
      setLoading(false);
      return;
    }

    if (deliveryEmail.trim()) {
      const selectedList = packages.filter((p) => selectedPackageIds.includes(p.id));
      const originalRecipientName = selectedList[0]?.recipient_name || deliveryRecipient;

      await saveToDirectory({
        name: originalRecipientName,
        email: deliveryEmail,
        building: selectedList[0]?.building,
        room_number: selectedList[0]?.room_number,
        position: deliveryPosition,
      });

      const pickedUpPackages = selectedList.map((p) => ({
        tracking_number: p.tracking_number,
        carrier: `${p.carrier || ''} ${p.carrier_type ? `(${p.carrier_type})` : ''}`.trim(),
        building: p.building,
        room_number: p.room_number,
        notes: p.notes,
        photo_url: p.photo_url,
      }));

      try {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'delivery',
            recipient_email: deliveryEmail,
            recipient_name: originalRecipientName,
            signed_by: deliveryRecipient,
            recipient_position: deliveryPosition,
            timestamp: deliveredIso,
            packages: pickedUpPackages,
          }),
        });
      } catch (err) {
        console.error('Failed to send pickup confirmation email:', err);
      }
    }

    setLoading(false);
    alert(
      deliveryEmail.trim()
        ? 'Batch delivery saved and email confirmation sent!'
        : 'Batch delivery saved successfully!'
    );
    setSelectedPackageIds([]);
    setDeliveryRecipient('');
    setDeliveryEmail('');
    setDeliveryPosition('Staff');
    setDeliverySearch('');
    signaturePadRef.current?.clear();
    await onSaved();
  }

  const pendingPackages = packages.filter((p) => {
    if (p.status !== 'Pending') return false;
    const q = deliverySearch.toLowerCase();
    return (
      p.recipient_name?.toLowerCase().includes(q) ||
      p.tracking_number?.toLowerCase().includes(q) ||
      p.building?.toLowerCase().includes(q)
    );
  });

  return (
    <form onSubmit={handleDeliveryCheckout} className="space-y-6 bg-white p-7 rounded-xl shadow-lg border border-gray-200">
      <h2 className="text-xl font-extrabold text-gray-900 border-b pb-3">Batch Pickup &amp; Signature</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <EmailLookupInput
          directory={directory}
          onSelect={(person) => {
            if (!deliveryRecipient.trim()) setDeliveryRecipient(person.name);
            setDeliveryEmail(person.email);
            if (person.position) setDeliveryPosition(person.position);
          }}
        />

        <div>
          <label className="block text-base font-bold text-gray-900 mb-1.5">Delivered By (Staff) *</label>
          <input
            type="text"
            value={deliveredBy}
            onChange={(e) => setDeliveredBy(e.target.value)}
            required
            className="w-full p-3 text-base border-2 border-gray-400 rounded-lg font-semibold focus:border-blue-600 focus:outline-none"
            placeholder="Staff delivering package"
          />
        </div>
      </div>

      <div>
        <label className="block text-base font-bold text-gray-900 mb-1.5">
          Recipient Email (for automated receipt)
        </label>
        <input
          type="email"
          value={deliveryEmail}
          onChange={(e) => setDeliveryEmail(e.target.value)}
          className="w-full p-3 text-base border-2 border-gray-400 rounded-lg font-semibold focus:border-blue-600 focus:outline-none"
          placeholder="e.g. jdoe@hawaii.edu"
        />
      </div>

      <div>
        <label className="block text-base font-bold text-gray-900 mb-2">
          Select Pending Packages ({selectedPackageIds.length} selected):
        </label>
        <input
          type="text"
          value={deliverySearch}
          onChange={(e) => setDeliverySearch(e.target.value)}
          placeholder="Search by recipient, building, or tracking #..."
          className="mb-3 w-full p-3 text-base border-2 border-gray-400 rounded-lg font-semibold bg-gray-50 focus:outline-none"
        />
        <div className="max-h-64 overflow-y-auto border-2 border-gray-300 p-3.5 rounded-xl space-y-3 bg-gray-50/50">
          {pendingPackages.length === 0 ? (
            <p className="text-base font-semibold text-gray-600 text-center py-4">No matching pending packages on shelf.</p>
          ) : (
            pendingPackages.map((pkg) => (
              <label
                key={pkg.id}
                className="flex items-start space-x-3.5 cursor-pointer border-b border-gray-300 pb-3 last:border-b-0 hover:bg-gray-100/80 p-2 rounded-lg transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedPackageIds.includes(pkg.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedPackageIds([...selectedPackageIds, pkg.id]);
                      if (!deliveryRecipient) setDeliveryRecipient(pkg.recipient_name);
                      if (!deliveryEmail && pkg.recipient_email) setDeliveryEmail(pkg.recipient_email);
                    } else {
                      setSelectedPackageIds(selectedPackageIds.filter((id) => id !== pkg.id));
                    }
                  }}
                  className="mt-1 h-5 w-5 text-blue-700 rounded border-gray-400 focus:ring-blue-600"
                />
                <div className="text-base flex-1 font-semibold text-gray-900">
                  <div><strong className="text-lg text-blue-950">{pkg.recipient_name}</strong></div>
                  <div className="text-sm font-semibold text-gray-700 mt-0.5">
                    {pkg.building} {pkg.room_number ? `Rm ${pkg.room_number}` : ''} •{' '}
                    <span className="font-mono font-bold text-gray-900">{pkg.tracking_number}</span> ({pkg.carrier} {pkg.carrier_type ? `/ ${pkg.carrier_type}` : ''})
                  </div>
                  {pkg.notes && (
                    <div className="text-sm font-bold text-amber-800 mt-1">Note: {pkg.notes}</div>
                  )}
                </div>
                {pkg.photo_url && (
                  <a
                    href={pkg.photo_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-bold text-blue-700 underline self-center px-2 py-1 bg-blue-50 rounded"
                  >
                    Photo
                  </a>
                )}
              </label>
            ))
          )}
        </div>
      </div>

      <div>
        <label className="block text-base font-bold text-gray-900 mb-1.5">
          Delivery / Damage Photos (Optional, up to {MAX_DELIVERY_PHOTOS} — {deliveryPhotoFiles.length} added)
        </label>
        <input
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          ref={deliveryPhotoInputRef}
          onChange={handleDeliveryPhotosSelect}
          className="block w-full text-base font-semibold text-gray-800 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-green-100 file:text-green-900 hover:file:bg-green-200 cursor-pointer"
        />
        {deliveryPhotoPreviews.length > 0 && (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {deliveryPhotoPreviews.map((src, idx) => (
              <div key={src} className="relative rounded-lg border-2 border-gray-300 bg-gray-50 p-1.5 shadow-sm">
                <img
                  src={src}
                  alt={`Delivery photo ${idx + 1}`}
                  className="h-28 w-full rounded-md object-cover"
                />
                <div className="mt-1 flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-gray-700">Photo {idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeDeliveryPhoto(idx)}
                    className="text-xs font-bold text-red-700 hover:text-red-900 underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4 border-t-2 border-gray-300 pt-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-base font-bold text-gray-900 mb-1.5">
              Recipient Name (Picking up) *
            </label>
            <input
              type="text"
              value={deliveryRecipient}
              onChange={(e) => setDeliveryRecipient(e.target.value)}
              required
              className="w-full p-3 text-base border-2 border-gray-400 rounded-lg font-semibold bg-white focus:border-blue-600 focus:outline-none"
              placeholder="Person signing"
            />
          </div>

          <div>
            <label className="block text-base font-bold text-gray-900 mb-1.5">Position *</label>
            <select
              value={deliveryPosition}
              onChange={(e) => setDeliveryPosition(e.target.value)}
              className="w-full p-3 text-base border-2 border-gray-400 rounded-lg font-semibold bg-white focus:border-blue-600 focus:outline-none"
            >
              {POSITIONS.map((pos) => (
                <option key={pos} value={pos}>{pos}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-base font-bold text-gray-900 mb-1.5">
            Recipient Signature (One signature for all selected packages) *
          </label>
          <div className="border-2 border-gray-400 rounded-xl bg-gray-50 p-3 flex flex-col items-center shadow-inner">
            <div className="w-full h-64 bg-white border-2 border-dashed border-gray-500 rounded-lg overflow-hidden relative">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-6 bottom-12 border-b border-dashed border-gray-300"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-6 bottom-5 text-xs font-semibold text-gray-400 select-none"
              >
                Sign above line
              </span>
              <canvas
                ref={canvasRef}
                className="w-full h-full cursor-crosshair touch-none block relative z-10"
              />
            </div>
            <button
              type="button"
              onClick={() => signaturePadRef.current?.clear()}
              className="mt-2.5 text-sm font-bold text-red-700 hover:text-red-900 bg-red-50 px-3 py-1 rounded-md border border-red-200"
            >
              Clear Signature
            </button>
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-green-700 hover:bg-green-800 text-white p-3.5 rounded-xl font-bold text-lg shadow-md transition-all"
      >
        {loading ? 'Processing...' : 'Complete Batch Delivery & Send Receipt'}
      </button>
    </form>
  );
}