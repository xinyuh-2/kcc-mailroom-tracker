'use client';
import { useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { DirectoryEntry } from '@/types/mailroom';
import { compressImage } from '@/lib/media';
import EmailLookupInput from './EmailLookupInput';
import { saveToDirectory } from '@/lib/directory';

const CARRIERS = ['Amazon', 'UPS', 'FedEx', 'USPS', 'DHL', 'Other'];
const MAX_INTAKE_PHOTOS = 4;

interface Props {
  directory: DirectoryEntry[];
  onSaved: () => Promise<void> | void;
}

export default function IntakeTab({ directory, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientPosition, setRecipientPosition] = useState('Staff');
  const [building, setBuilding] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [receivedBy, setReceivedBy] = useState('');
  const [carrier, setCarrier] = useState('Amazon');
  const [carrierType, setCarrierType] = useState('');
  const [notes, setNotes] = useState('');

  const [intakePhotoFiles, setIntakePhotoFiles] = useState<File[]>([]);
  const [intakePhotoPreviews, setIntakePhotoPreviews] = useState<string[]>([]);
  const intakePhotoInputRef = useRef<HTMLInputElement | null>(null);

  function syncPhotoPreviews(files: File[]) {
    setIntakePhotoFiles(files);
    setIntakePhotoPreviews(files.map((file) => URL.createObjectURL(file)));
  }

  function handleIntakePhotosSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files || []);
    if (picked.length === 0) return;

    const merged = [...intakePhotoFiles, ...picked].slice(0, MAX_INTAKE_PHOTOS);
    if (intakePhotoFiles.length + picked.length > MAX_INTAKE_PHOTOS) {
      alert(`Up to ${MAX_INTAKE_PHOTOS} intake/damage photos are allowed per package.`);
    }

    syncPhotoPreviews(merged);
    if (intakePhotoInputRef.current) intakePhotoInputRef.current.value = '';
  }

  function removeIntakePhoto(indexToRemove: number) {
    const updated = intakePhotoFiles.filter((_, idx) => idx !== indexToRemove);
    syncPhotoPreviews(updated);
  }

  async function handleIntakeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const uploadedPhotoUrls: string[] = [];
    for (let i = 0; i < intakePhotoFiles.length; i++) {
      const file = intakePhotoFiles[i];
      const compressedBlob = await compressImage(file);
      const fileName = `intake-${Date.now()}-${i + 1}-${Math.random().toString(36).substring(2, 7)}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('package-photos')
        .upload(fileName, compressedBlob, { contentType: 'image/jpeg' });

      if (uploadError) {
        alert('Intake photo upload error: ' + uploadError.message);
        setLoading(false);
        return;
      }

      const { data: publicURLData } = supabase.storage
        .from('package-photos')
        .getPublicUrl(fileName);

      uploadedPhotoUrls.push(publicURLData.publicUrl);
    }

    const receivedIso = new Date().toISOString();

    const { error: insertError } = await supabase.from('packages').insert([
      {
        tracking_number: trackingNumber.trim(),
        recipient_name: recipientName.trim(),
        recipient_email: recipientEmail.trim() || null,
        recipient_position: recipientPosition,
        building: building.trim(),
        room_number: roomNumber.trim() || null,
        received_by: receivedBy.trim() || null,
        carrier,
        carrier_type: carrierType.trim() || null,
        notes: notes.trim() || null,
        photo_url: uploadedPhotoUrls[0] ?? null,
        received_at: receivedIso,
        status: 'Pending',
      },
    ]);

    if (insertError) {
      alert('Error saving package: ' + insertError.message);
      setLoading(false);
      return;
    }

    if (recipientEmail.trim()) {
      await saveToDirectory({
        name: recipientName.trim(),
        email: recipientEmail.trim(),
        building: building.trim(),
        room_number: roomNumber.trim(),
        position: recipientPosition,
      });
    }

    setTrackingNumber('');
    setRecipientName('');
    setRecipientEmail('');
    setBuilding('');
    setRoomNumber('');
    setCarrierType('');
    setNotes('');
    setIntakePhotoFiles([]);
    setIntakePhotoPreviews([]);
    if (intakePhotoInputRef.current) intakePhotoInputRef.current.value = '';

    setLoading(false);
    alert('Package logged into intake!');
    await onSaved();
  }

  return (
    <form
      onSubmit={handleIntakeSubmit}
      className="space-y-5 bg-white p-6 sm:p-7 rounded-xl shadow-lg border border-gray-200"
    >
      <h2 className="text-xl font-extrabold text-gray-900 border-b pb-3">Package Intake</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <EmailLookupInput
          directory={directory}
          onSelect={(person) => {
            if (!recipientName.trim()) setRecipientName(person.name);
            setRecipientEmail(person.email);
            if (person.building) setBuilding(person.building);
            if (person.room_number) setRoomNumber(person.room_number);
            if (person.position) setRecipientPosition(person.position);
          }}
        />

        <div>
          <label className="block text-base font-bold text-gray-900 mb-1.5">Received By (Staff)</label>
          <input
            type="text"
            value={receivedBy}
            onChange={(e) => setReceivedBy(e.target.value)}
            className="w-full p-3 text-base border-2 border-gray-400 rounded-lg font-semibold focus:border-blue-600 focus:outline-none"
            placeholder="Staff logging package"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-base font-bold text-gray-900 mb-1.5">Recipient Name *</label>
          <input
            type="text"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            required
            className="w-full p-3 text-base border-2 border-gray-400 rounded-lg font-semibold focus:border-blue-600 focus:outline-none"
            placeholder="Recipient full name"
          />
        </div>

        <div>
          <label className="block text-base font-bold text-gray-900 mb-1.5">Recipient Email</label>
          <input
            type="email"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            className="w-full p-3 text-base border-2 border-gray-400 rounded-lg font-semibold focus:border-blue-600 focus:outline-none"
            placeholder="e.g. jdoe@hawaii.edu"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-base font-bold text-gray-900 mb-1.5">Tracking # *</label>
          <input
            type="text"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            required
            className="w-full p-3 text-base border-2 border-gray-400 rounded-lg font-mono font-semibold focus:border-blue-600 focus:outline-none"
            placeholder="1Z999AA10123456784"
          />
        </div>

        <div>
          <label className="block text-base font-bold text-gray-900 mb-1.5">Carrier *</label>
          <select
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            className="w-full p-3 text-base border-2 border-gray-400 rounded-lg font-semibold bg-white focus:border-blue-600 focus:outline-none"
          >
            {CARRIERS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-base font-bold text-gray-900 mb-1.5">Service / Type</label>
          <input
            type="text"
            value={carrierType}
            onChange={(e) => setCarrierType(e.target.value)}
            className="w-full p-3 text-base border-2 border-gray-400 rounded-lg font-semibold focus:border-blue-600 focus:outline-none"
            placeholder="e.g. Ground, Express"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-base font-bold text-gray-900 mb-1.5">Building *</label>
          <input
            type="text"
            value={building}
            onChange={(e) => setBuilding(e.target.value)}
            required
            className="w-full p-3 text-base border-2 border-gray-400 rounded-lg font-semibold focus:border-blue-600 focus:outline-none"
            placeholder="Building name or code"
          />
        </div>

        <div>
          <label className="block text-base font-bold text-gray-900 mb-1.5">Room #</label>
          <input
            type="text"
            value={roomNumber}
            onChange={(e) => setRoomNumber(e.target.value)}
            className="w-full p-3 text-base border-2 border-gray-400 rounded-lg font-semibold focus:border-blue-600 focus:outline-none"
            placeholder="Optional room number"
          />
        </div>
      </div>

      <div>
        <label className="block text-base font-bold text-gray-900 mb-1.5">
          Package / Damage Photos (Optional, up to {MAX_INTAKE_PHOTOS} — {intakePhotoFiles.length} added)
        </label>
        <input
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          ref={intakePhotoInputRef}
          onChange={handleIntakePhotosSelect}
          className="block w-full text-base font-semibold text-gray-800 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-blue-100 file:text-blue-900 hover:file:bg-blue-200 cursor-pointer"
        />
        {intakePhotoPreviews.length > 0 && (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {intakePhotoPreviews.map((src, idx) => (
              <div
                key={src}
                className="relative rounded-lg border-2 border-gray-300 bg-gray-50 p-1.5 shadow-sm"
              >
                <img
                  src={src}
                  alt={`Intake photo ${idx + 1}`}
                  className="h-28 w-full rounded-md object-cover"
                />
                <div className="mt-1 flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-gray-700">Photo {idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeIntakePhoto(idx)}
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

      <div>
        <label className="block text-base font-bold text-gray-900 mb-1.5">Notes / Condition</label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full p-3 text-base border-2 border-gray-400 rounded-lg font-semibold focus:border-blue-600 focus:outline-none"
          placeholder="Optional damage notes or special instructions"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-700 hover:bg-blue-800 text-white p-3.5 rounded-xl font-bold text-lg shadow-md transition-all"
      >
        {loading ? 'Saving...' : 'Log Package Intake'}
      </button>
    </form>
  );
}