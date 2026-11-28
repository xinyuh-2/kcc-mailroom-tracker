
'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { DirectoryEntry } from '@/types/mailroom';
import { compressImage } from '@/lib/media';
import EmailLookupInput from './EmailLookupInput';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { saveToDirectory } from '@/lib/directory';

const CARRIERS = [
  'Amazon',
  'USPS',
  'UPS',
  'FedEx',
  'DHL',
  'OnTrac/Lasership',
  'Internal Campus',
  'Other',
];

const CARRIERS_TYPES = [
  'Ground',
  'First class',
  'Priority Mail',
  'Express',
  'Media Mail',
  'Next Day Air',
  'SurePost',
  'Home Delivery',
  'Freight',
  'International and domestic priority shipping',
  'Direct deliveries via Amazon drivers',
  'Ground Advantage',
  'Regional commerce carriers',
  'Internal Campus',
  'Other',
];

const CAMPUS_BUILDINGS = [
  'Iliahi',
  'Ilima',
  'Kalia',
  'Koa',
  'Kopiko',
  'Lama Library',
  'Maile',
  'Mamane',
  'Manono',
  'Mokihana',
  'Naio',
  'Ohelo',
  'Ohia',
  'Olapa',
  'Olopua',
  'Olona',
  'Kauila',
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
  const [recipient, setRecipient] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [building, setBuilding] = useState('Iliahi');
  const [roomNumber, setRoomNumber] = useState('');
  const [receivedBy, setReceivedBy] = useState('');

  const [carrier, setCarrier] = useState('Amazon');
  const [customCarrier, setCustomCarrier] = useState('');
  const [carrierType, setCarrierType] = useState('Ground');
  const [customCarrierType, setCustomCarrierType] = useState('');
  const [notes, setNotes] = useState('');

  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const [isScanning, setIsScanning] = useState(false);
  const [isStartingScanner, setIsStartingScanner] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scannerStartRef = useRef<Promise<unknown> | null>(null);

  useEffect(() => {
    return () => {
      if (scannerTimerRef.current) {
        clearTimeout(scannerTimerRef.current);
      }

      const scanner = scannerRef.current;
      const starting = scannerStartRef.current;
      scannerRef.current = null;

      if (scanner) {
        void (async () => {
          try {
            await starting?.catch(() => {});
            if (scanner.isScanning) {
              await scanner.stop();
            }
            scanner.clear();
          } catch (err) {
            console.error('Scanner cleanup error:', err);
          }
        })();
      }
    };
  }, []);

  // BARCODE SCANNER
  async function startScanner() {
    if (isScanning || isStartingScanner) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      alert(
        'Camera access is unavailable. Please use HTTPS or localhost.'
      );
      return;
    }

    setIsScanning(true);
    setIsStartingScanner(true);

    scannerTimerRef.current = setTimeout(async () => {
      scannerTimerRef.current = null;
      let scanner: Html5Qrcode | null = null;

      try {
        const html5QrCode = new Html5Qrcode('barcode-reader', {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_93,
            Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.DATA_MATRIX,
            Html5QrcodeSupportedFormats.PDF_417,
            Html5QrcodeSupportedFormats.CODABAR,
            Html5QrcodeSupportedFormats.AZTEC,
            Html5QrcodeSupportedFormats.MAXICODE,
          ],
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true,
          },
          verbose: false,
        });

        scanner = html5QrCode;
        scannerRef.current = html5QrCode;

        let hasScanned = false;

        const starting = html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            disableFlip: false,
          },
          (decodedText) => {
            if (
              hasScanned ||
              scannerRef.current !== html5QrCode
            ) return;

            hasScanned = true;
            setTrackingNum(decodedText.trim());

            try {
              if (typeof navigator.vibrate === 'function') {
                navigator.vibrate(100);
              }
            } catch {}

            void stopScanner();
          },
          () => {}
        );

        scannerStartRef.current = starting;
        await starting;

        if (scannerRef.current === html5QrCode) {
          setIsStartingScanner(false);
        }

      } catch (err) {
        console.error('Barcode scanner error:', err);

        if (scanner && scannerRef.current !== scanner) {
          return;
        }

        if (scanner) {
          try {
            if (scanner.isScanning) {
              await scanner.stop();
            }
            scanner.clear();
          } catch (cleanupError) {
            console.error('Scanner cleanup error:', cleanupError);
          }
        }

        scannerRef.current = null;
        scannerStartRef.current = null;
        setIsScanning(false);
        setIsStartingScanner(false);

        alert('Barcode scanner error: ' + String(err));
      }
    }, 100);
  }

  async function stopScanner() {
    if (scannerTimerRef.current) {
      clearTimeout(scannerTimerRef.current);
      scannerTimerRef.current = null;
    }

    const scanner = scannerRef.current;
    const starting = scannerStartRef.current;

    setIsStartingScanner(true);

    try {
      await starting?.catch(() => {});

      if (scanner) {
        if (scanner.isScanning) {
          await scanner.stop();
        }

        scanner.clear();
      }
    } catch (err) {
      console.error('Error stopping scanner:', err);
    } finally {
      scannerRef.current = null;
      scannerStartRef.current = null;
      setIsScanning(false);
      setIsStartingScanner(false);
    }
  }

  // PACKAGE PHOTOS
  function syncPhotoPreviews(files: File[]) {
    setPhotoFiles(files);
    setPhotoPreviews(
      files.map((file) => URL.createObjectURL(file))
    );
  }

  function handlePhotoSelect(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const picked = Array.from(e.target.files || []);
    if (picked.length === 0) return;

    const merged = [...photoFiles, ...picked].slice(
      0,
      MAX_INTAKE_PHOTOS
    );

    if (photoFiles.length + picked.length > MAX_INTAKE_PHOTOS) {
      alert(
        `Up to ${MAX_INTAKE_PHOTOS} intake photos are allowed per package.`
      );
    }

    syncPhotoPreviews(merged);

    if (photoInputRef.current) {
      photoInputRef.current.value = '';
    }
  }

  function removePhoto(indexToRemove: number) {
    const updated = photoFiles.filter(
      (_, idx) => idx !== indexToRemove
    );

    syncPhotoPreviews(updated);
  }

  // SAVE INCOMING PACKAGE
  async function handleIntake(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const uploadedPhotoUrls: string[] = [];

    for (let i = 0; i < photoFiles.length; i++) {
      const file = photoFiles[i];
      const compressedBlob = await compressImage(file);

      const fileName = `${Date.now()}-${i + 1}-${Math.random()
        .toString(36)
        .substring(2, 7)}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('package-photos')
        .upload(fileName, compressedBlob, {
          contentType: 'image/jpeg',
        });

      if (uploadError) {
        alert('Photo upload error: ' + uploadError.message);
        setLoading(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('package-photos')
        .getPublicUrl(fileName);

      uploadedPhotoUrls.push(publicUrlData.publicUrl);
    }

    const primaryPhotoUrl = uploadedPhotoUrls[0] ?? null;

    const finalCarrier =
      carrier === 'Other'
        ? customCarrier.trim() || 'Other'
        : carrier;

    const finalCarrierType =
      carrierType === 'Other'
        ? customCarrierType.trim() || 'Other'
        : carrierType;

    const nowIso = new Date().toISOString();

    const { error } = await supabase.from('packages').insert([
      {
        tracking_number: trackingNum,
        recipient_name: recipient,
        recipient_email: recipientEmail,
        building,
        room_number: roomNumber,
        received_by: receivedBy,
        picked_up_by: null,
        carrier: finalCarrier,
        carrier_type: finalCarrierType,
        notes,
        photo_url: primaryPhotoUrl,
        photo_urls: uploadedPhotoUrls,
        received_at: nowIso,
        status: 'Pending',
      },
    ]);

    if (error) {
      alert('Error saving package: ' + error.message);
      setLoading(false);
      return;
    }

    if (recipientEmail.trim()) {
      await saveToDirectory({
        name: recipient,
        email: recipientEmail,
        building,
        room_number: roomNumber,
      });

      try {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'intake',
            recipient_email: recipientEmail,
            recipient_name: recipient,
            timestamp: nowIso,
            packages: [
              {
                tracking_number: trackingNum,
                carrier: `${finalCarrier} (${finalCarrierType})`,
                building,
                room_number: roomNumber,
                notes,
                photo_url: primaryPhotoUrl,
              },
            ],
          }),
        });
      } catch (err) {
        console.error('Failed to send intake email:', err);
      }
    }

    setLoading(false);
    setTrackingNum('');
    setRecipient('');
    setRecipientEmail('');
    setRoomNumber('');
    setCustomCarrier('');
    setCustomCarrierType('');
    setNotes('');
    setPhotoFiles([]);
    setPhotoPreviews([]);

    if (photoInputRef.current) {
      photoInputRef.current.value = '';
    }

    await onSaved();
    alert('Package logged successfully!');
  }

  return (
    <form
      onSubmit={handleIntake}
      className="space-y-5 bg-white p-7 rounded-xl shadow-lg border border-gray-200"
    >
      <div className="flex justify-between items-center border-b pb-3">
        <h2 className="text-xl font-extrabold text-gray-900">
          Incoming Package Intake
        </h2>

        <span className="text-sm font-semibold text-gray-600 bg-gray-100 px-2.5 py-1 rounded">
          Auto-timestamped
        </span>
      </div>

      {/* TRACKING NUMBER AND BARCODE SCANNER */}
      <div>
        <label className="block text-base font-bold text-gray-900 mb-1.5">
          Tracking Number / Barcode *
        </label>

        <div className="flex gap-2.5">
          <input
            type="text"
            value={trackingNum}
            onChange={(e) => setTrackingNum(e.target.value)}
            required
            className="flex-1 min-w-0 p-3 text-base border-2 border-gray-400 rounded-lg font-semibold focus:border-blue-600 focus:outline-none"
            placeholder="Scan or type tracking #"
          />

          <button
            type="button"
            disabled={isStartingScanner}
            onClick={isScanning ? stopScanner : startScanner}
            className={`px-5 py-3 rounded-lg font-bold text-base text-white shadow disabled:opacity-60 ${
              isScanning
                ? 'bg-red-700 hover:bg-red-800'
                : 'bg-gray-900 hover:bg-black'
            }`}
          >
            {isStartingScanner
              ? 'Please wait...'
              : isScanning
                ? 'Stop'
                : 'Scan Barcode'}
          </button>
        </div>

        {isScanning && (
          <div className="mt-3 space-y-3">
            <div className="bg-gray-900 rounded-xl overflow-hidden border-2 border-gray-700">
              <div id="barcode-reader" className="w-full" />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
              <p className="text-sm font-bold text-blue-900">
                {isStartingScanner
                  ? 'Starting or stopping camera...'
                  : 'Scanning for barcode...'}
              </p>

              <p className="text-xs text-blue-700 mt-1">
                Position the entire tracking barcode inside the
                camera. Try horizontal, vertical, or angled
                positions.
              </p>

              <p className="text-xs text-blue-700 mt-1">
                Keep the barcode in focus and avoid glare.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* RECIPIENT INFORMATION */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="block text-base font-bold text-gray-900 mb-1.5">
            Recipient Name
          </label>

          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            required
            className="w-full p-3 text-base border-2 border-gray-400 rounded-lg font-semibold focus:border-blue-600 focus:outline-none"
            placeholder="e.g. John Doe"
          />
        </div>

        <EmailLookupInput
          directory={directory}
          onSelect={(person) => {
            if (!recipient.trim()) {
              setRecipient(person.name);
            }

            setRecipientEmail(person.email);

            if (person.building) {
              setBuilding(person.building);
            }

            if (person.room_number && !roomNumber.trim()) {
              setRoomNumber(person.room_number);
            }
          }}
        />
      </div>

      <div>
        <label className="block text-base font-bold text-gray-900 mb-1.5">
          Recipient Email
        </label>

        <input
          type="email"
          value={recipientEmail}
          onChange={(e) => setRecipientEmail(e.target.value)}
          className="w-full p-3 text-base border-2 border-gray-400 rounded-lg font-semibold focus:border-blue-600 focus:outline-none"
          placeholder="e.g. jdoe@hawaii.edu (auto-saves for future lookups)"
        />
      </div>

      {/* CARRIER INFORMATION */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="block text-base font-bold text-gray-900 mb-1.5">
            Carrier Company *
          </label>

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

          {carrier === 'Other' && (
            <input
              type="text"
              value={customCarrier}
              onChange={(e) => setCustomCarrier(e.target.value)}
              required
              placeholder="Enter custom carrier..."
              className="mt-2.5 w-full p-3 text-base border-2 border-blue-400 rounded-lg font-semibold bg-blue-50/50 focus:outline-none"
            />
          )}
        </div>

        <div>
          <label className="block text-base font-bold text-gray-900 mb-1.5">
            Carrier Type / Service *
          </label>

          <select
            value={carrierType}
            onChange={(e) => setCarrierType(e.target.value)}
            className="w-full p-3 text-base border-2 border-gray-400 rounded-lg font-semibold bg-white focus:border-blue-600 focus:outline-none"
          >
            {CARRIERS_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          {carrierType === 'Other' && (
            <input
              type="text"
              value={customCarrierType}
              onChange={(e) =>
                setCustomCarrierType(e.target.value)
              }
              required
              placeholder="Enter custom type..."
              className="mt-2.5 w-full p-3 text-base border-2 border-blue-400 rounded-lg font-semibold bg-blue-50/50 focus:outline-none"
            />
          )}
        </div>
      </div>

      {/* CAMPUS BUILDING AND ROOM */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="block text-base font-bold text-gray-900 mb-1.5">
            Campus Building *
          </label>

          <select
            value={building}
            onChange={(e) => setBuilding(e.target.value)}
            className="w-full p-3 text-base border-2 border-gray-400 rounded-lg font-semibold bg-white focus:border-blue-600 focus:outline-none"
          >
            {CAMPUS_BUILDINGS.map((bldg) => (
              <option key={bldg} value={bldg}>
                {bldg}
              </option>
            ))}
          </select>
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
            placeholder="e.g. 102 or 204B"
          />
        </div>
      </div>

      {/* RECEIVING STAFF */}
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
          placeholder="Your name or initials"
        />
      </div>

      {/* PACKAGE NOTES */}
      <div>
        <label className="block text-base font-bold text-gray-900 mb-1.5">
          Additional Comments / Notes
        </label>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full p-3 text-base border-2 border-gray-400 rounded-lg font-semibold focus:border-blue-600 focus:outline-none"
          placeholder="e.g. Fragile, oversized box, perishable..."
        />
      </div>

      {/* PACKAGE PHOTOS */}
      <div>
        <label className="block text-base font-bold text-gray-900 mb-1.5">
          Package Photos (Optional, up to {MAX_INTAKE_PHOTOS} —{' '}
          {photoFiles.length} added)
        </label>

        <input
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          ref={photoInputRef}
          onChange={handlePhotoSelect}
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
                  alt={`Package preview ${idx + 1}`}
                  className="h-28 w-full rounded-md object-cover"
                />

                <div className="mt-1 flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-gray-700">
                    Photo {idx + 1}
                  </span>

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

      {/* SUBMIT PACKAGE */}
      <button
        type="submit"
        disabled={loading || isScanning || isStartingScanner}
        className="w-full bg-blue-700 hover:bg-blue-800 text-white p-3.5 rounded-xl font-bold text-lg shadow-md transition-all disabled:opacity-60"
      >
        {loading ? 'Saving Package...' : 'Log Package'}
      </button>
    </form>
  );
}
