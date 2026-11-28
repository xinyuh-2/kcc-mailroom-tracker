'use client';
import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { supabase } from '@/lib/supabase';
import { DirectoryEntry } from '@/types/mailroom';
import { compressImage } from '@/lib/media';
import { saveToDirectory } from '@/lib/directory';

const POSITIONS = [
  'Student Assistant',
  'Faculty',
  'Staff',
  'Administration',
  'Vendor',
  'Academics',
  'Other',
];
const MAX_INTAKE_PHOTOS = 4;

interface Props {
  directory: DirectoryEntry[];
  onSaved: () => Promise<void> | void;
}

export default function IntakeTab({ directory, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [trackingNum, setTrackingNum] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientPosition, setRecipientPosition] = useState('');
  const [building, setBuilding] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [carrier, setCarrier] = useState('');
  const [carrierType, setCarrierType] = useState('');
  const [receivedBy, setReceivedBy] = useState('');
  const [notes, setNotes] = useState('');

  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState(
    'Point camera at barcode (horizontal or sideways)'
  );
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRotatingScanRef = useRef(false);
  const isStoppingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (scanTimerRef.current) clearInterval(scanTimerRef.current);
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        try {
          scannerRef.current.clear();
        } catch {}
      }
    };
  }, []);

  function syncPhotoPreviews(files: File[]) {
    setPhotoFiles(files);
    setPhotoPreviews(files.map((file) => URL.createObjectURL(file)));
  }

  function handlePhotosSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files || []);
    if (picked.length === 0) return;

    const merged = [...photoFiles, ...picked].slice(0, MAX_INTAKE_PHOTOS);
    if (photoFiles.length + picked.length > MAX_INTAKE_PHOTOS) {
      alert(`Up to ${MAX_INTAKE_PHOTOS} intake photos are allowed per package.`);
    }

    syncPhotoPreviews(merged);
    if (photoInputRef.current) photoInputRef.current.value = '';
  }

  function removePhoto(indexToRemove: number) {
    const updated = photoFiles.filter((_, idx) => idx !== indexToRemove);
    syncPhotoPreviews(updated);
  }

  async function scanRotatedAngle(video: HTMLVideoElement, degrees: number): Promise<string | null> {
    if (!video.videoWidth || !video.videoHeight) return null;

    const canvas = document.createElement('canvas');
    const swapDimensions = degrees === 90 || degrees === 270;
    canvas.width = swapDimensions ? video.videoHeight : video.videoWidth;
    canvas.height = swapDimensions ? video.videoWidth : video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((degrees * Math.PI) / 180);
    ctx.drawImage(video, -video.videoWidth / 2, -video.videoHeight / 2);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85)
    );
    if (!blob) return null;

    const tempId = 'rotated-barcode-probe';
    let host = document.getElementById(tempId);
    if (!host) {
      host = document.createElement('div');
      host.id = tempId;
      host.style.display = 'none';
      document.body.appendChild(host);
    }

    const probeScanner = new Html5Qrcode(tempId, {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.ITF,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODABAR,
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.DATA_MATRIX,
      ],
      verbose: false,
    });

    try {
      const file = new File([blob], `scan-${degrees}.jpg`, { type: 'image/jpeg' });
      return await probeScanner.scanFile(file, false);
    } catch {
      return null;
    } finally {
      try {
        probeScanner.clear();
      } catch {}
    }
  }

  async function tryRotatedFrameScan(manual = false) {
    if (isRotatingScanRef.current || isStoppingRef.current) return;
    const readerEl = document.getElementById('barcode-reader');
    const video = readerEl?.querySelector('video') as HTMLVideoElement | null;
    if (!video || video.readyState < 2) {
      if (manual) setScanStatus('Camera not ready yet—hold steady and try again.');
      return;
    }

    isRotatingScanRef.current = true;
    if (manual) setScanStatus('Checking rotated barcode angles (90° / 270°)...');

    try {
      for (const angle of [90, 270]) {
        if (isStoppingRef.current) break;
        const decoded = await scanRotatedAngle(video, angle);
        if (decoded) {
          setTrackingNum(decoded);
          await stopScanner();
          return;
        }
      }
      if (manual) {
        setScanStatus('No barcode detected—move closer or adjust lighting.');
      }
    } finally {
      isRotatingScanRef.current = false;
    }
  }

  async function startScanner() {
    if (isScanning) {
      await stopScanner();
      return;
    }

    isStoppingRef.current = false;
    setIsScanning(true);
    setScanStatus('Starting camera...');

    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode('barcode-reader', {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODABAR,
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.DATA_MATRIX,
          ],
          verbose: false,
        });
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 15,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const size = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.8);
              return { width: Math.max(size, 180), height: Math.max(size, 180) };
            },
          },
          async (decodedText) => {
            setTrackingNum(decodedText);
            await stopScanner();
          },
          () => {}
        );

        setScanStatus('Scanning horizontal & sideways barcodes...');

        scanTimerRef.current = setInterval(() => {
          tryRotatedFrameScan(false);
        }, 1200);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unable to access camera.';
        alert(`Camera error: ${msg}. Make sure camera permission is allowed and HTTPS is active.`);
        setIsScanning(false);
      }
    }, 100);
  }

  async function stopScanner() {
    isStoppingRef.current = true;
    if (scanTimerRef.current) {
      clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {}
      try {
        scannerRef.current.clear();
      } catch {}
      scannerRef.current = null;
    }
    setIsScanning(false);
  }

  async function handleIntakeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!trackingNum.trim() || !building.trim() || !carrier.trim() || !receivedBy.trim()) {
      alert('Please fill in tracking number, building, carrier, and received by.');
      return;
    }

    setLoading(true);
    const uploadedPhotoUrls: string[] = [];

    for (let i = 0; i < photoFiles.length; i++) {
      const file = photoFiles[i];
      const compressedBlob = await compressImage(file);
      const fileName = `intake-${Date.now()}-${i + 1}-${Math.random().toString(36).substring(2, 7)}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('package-photos')
        .upload(fileName, compressedBlob, { contentType: 'image/jpeg' });

      if (uploadError) {
        alert('Photo upload error: ' + uploadError.message);
        setLoading(false);
        return;
      }

      const { data: publicURLData } = supabase.storage
        .from('package-photos')
        .getPublicUrl(fileName);

      uploadedPhotoUrls.push(publicURLData.publicUrl);
    }

    const { error: insertError } = await supabase.from('packages').insert([
      {
        tracking_number: trackingNum.trim(),
        recipient_name: recipientName.trim() || 'Unspecified Recipient',
        recipient_email: recipientEmail.trim() || null,
        recipient_position: recipientPosition || null,
        building: building.trim(),
        room_number: roomNumber.trim() || null,
        carrier: carrier.trim(),
        carrier_type: carrierType.trim() || null,
        received_by: receivedBy.trim(),
        received_at: new Date().toISOString(),
        notes: notes.trim() || null,
        photo_url: uploadedPhotoUrls[0] ?? null,
        photo_urls: uploadedPhotoUrls,
        status: 'Pending',
      },
    ]);

    if (insertError) {
      alert('Error saving package: ' + insertError.message);
      setLoading(false);
      return;
    }

    if (recipientEmail.trim() && recipientName.trim()) {
      await saveToDirectory({
        name: recipientName.trim(),
        email: recipientEmail.trim(),
        building: building.trim(),
        room_number: roomNumber.trim() || undefined,
        position: recipientPosition || undefined,
      });
    }

    setLoading(false);
    alert('Package logged successfully!');
    setTrackingNum('');
    setRecipientName('');
    setRecipientEmail('');
    setRecipientPosition('');
    setBuilding('');
    setRoomNumber('');
    setCarrier('');
    setCarrierType('');
    setNotes('');
    setPhotoFiles([]);
    setPhotoPreviews([]);
    if (photoInputRef.current) photoInputRef.current.value = '';
    await onSaved();
  }

  return (
    <form
      onSubmit={handleIntakeSubmit}
      className="space-y-6 bg-white p-7 rounded-xl shadow-lg border border-gray-200"
    >
      <h2 className="text-xl font-extrabold text-gray-900 border-b pb-3">
        Package Intake
      </h2>

      <div>
        <label className="block text-base font-bold text-gray-900 mb-1.5">
          Tracking Number *
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={trackingNum}
            onChange={(e) => setTrackingNum(e.target.value)}
            required
            className="flex-1 p-3 text-base border-2 border-gray-400 rounded-lg font-mono font-bold focus:border-blue-600 focus:outline-none"
            placeholder="Scan or enter tracking number"
          />
          <button
            type="button"
            onClick={startScanner}
            className="px-4 py-3 rounded-lg font-bold text-sm bg-blue-700 hover:bg-blue-800 text-white shadow"
          >
            {isScanning ? 'Stop Camera' : 'Scan Barcode'}
          </button>
        </div>

        {isScanning && (
          <div className="mt-3 space-y-2">
            <div
              id="barcode-reader"
              className="border-2 border-gray-400 rounded-lg overflow-hidden"
            />
            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-gray-700 bg-gray-100 px-3 py-2 rounded-lg">
              <span>{scanStatus}</span>
              <button
                type="button"
                onClick={() => tryRotatedFrameScan(true)}
                className="shrink-0 text-blue-700 font-bold underline hover:text-blue-900"
              >
                Scan Sideways Now
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="block text-base font-bold text-gray-900 mb-1.5">
            Recipient Name
          </label>
          <input
            type="text"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            className="w-full p-3 text-base border-2 border-gray-400 rounded-lg font-semibold focus:border-blue-600 focus:outline-none"
            placeholder="Recipient full name"
          />
        </div>

        <div>
          <label className="block text-base font-bold text-gray-900 mb-1.5">
            Position
          </label>
          <select
            value={recipientPosition}
            onChange={(e) => setRecipientPosition(e.target.value)}
            className="w-full p-3 text-base border-2 border-gray-400 rounded-lg font-semibold bg-white focus:border-blue-600 focus:outline-none"
          >
            <option value="">Select position</option>
            {POSITIONS.map((pos) => (
              <option key={pos} value={pos}>
                {pos}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div>
          <label className="block text-base font-bold text-gray-900 mb-1.5">
            Recipient Email
          </label>
          <input
            type="email"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            list="intake-directory-emails"
            className="w-full p-3 text-base border-2 border-gray-400 rounded-lg font-semibold focus:border-blue-600 focus:outline-none"
            placeholder="name@hawaii.edu"
          />
          <datalist id="intake-directory-emails">
            {directory.map((entry) => (
              <option key={entry.email} value={entry.email}>
                {entry.name}
              </option>
            ))}
          </datalist>
        </div>

        <div>
          <label className="block text-base font-bold text-gray-900 mb-1.5">
            Building *
          </label>
          <input
            type="text"
            value={building}
            onChange={(e) => setBuilding(e.target.value)}
            required
            className="w-full p-3 text-base border-2 border-gray-400 rounded-lg font-semibold focus:border-blue-600 focus:outline-none"
            placeholder="Building name"
          />
        </div>

        <div>
          <label className="block text-base font-bold text-gray-900 mb-1.5">
            Room Number
          </label>
          <input
            type="text"
            value={roomNumber}
            onChange={(e) => setRoomNumber(e.target.value)}
            className="w-full p-3 text-base border-2 border-gray-400 rounded-lg font-semibold focus:border-blue-600 focus:outline-none"
            placeholder="e.g. 101"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div>
          <label className="block text-base font-bold text-gray-900 mb-1.5">
            Carrier *
          </label>
          <input
            type="text"
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            required
            className="w-full p-3 text-base border-2 border-gray-400 rounded-lg font-semibold focus:border-blue-600 focus:outline-none"
            placeholder="UPS, FedEx, USPS, Amazon"
          />
        </div>

        <div>
          <label className="block text-base font-bold text-gray-900 mb-1.5">
            Carrier Type
          </label>
          <input
            type="text"
            value={carrierType}
            onChange={(e) => setCarrierType(e.target.value)}
            className="w-full p-3 text-base border-2 border-gray-400 rounded-lg font-semibold focus:border-blue-600 focus:outline-none"
            placeholder="Box, Envelope, Tube"
          />
        </div>

        <div>
          <label className="block text-base font-bold text-gray-900 mb-1.5">
            Received By (Staff) *
          </label>
          <input
            type="text"
            value={receivedBy}
            onChange={(e) => setReceivedBy(e.target.value)}
            required
            className="w-full p-3 text-base border-2 border-gray-400 rounded-lg font-semibold focus:border-blue-600 focus:outline-none"
            placeholder="Staff member"
          />
        </div>
      </div>

      <div>
        <label className="block text-base font-bold text-gray-900 mb-1.5">
          Intake Photos (Up to {MAX_INTAKE_PHOTOS} — {photoFiles.length} added)
        </label>
        <input
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          ref={photoInputRef}
          onChange={handlePhotosSelect}
          className="block w-full text-base font-semibold text-gray-800 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-blue-100 file:text-blue-900 hover:file:bg-blue-200 cursor-pointer"
        />
        {photoPreviews.length > 0 && (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {photoPreviews.map((src, idx) => (
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
                    onClick={() => removePhoto(idx)}
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
        <label className="block text-base font-bold text-gray-900 mb-1.5">
          Notes
        </label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full p-3 text-base border-2 border-gray-400 rounded-lg font-semibold focus:border-blue-600 focus:outline-none"
          placeholder="Optional intake notes..."
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
