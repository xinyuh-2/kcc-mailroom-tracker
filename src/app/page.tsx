'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import SignaturePad from 'signature_pad';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

const POSITIONS = ['Student', 'Faculty', 'Staff', 'Administration', 'Vendor', 'Academics', 'Other'];
const CARRIERS = ['Amazon', 'USPS', 'UPS', 'FedEx', 'DHL', 'OnTrac/Lasership', 'Internal Campus', 'Other'];
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
  'Olona',
  'Kauila',
  'Other',
];

export default function PackageTrackerApp() {
  const [activeTab, setActiveTab] = useState<'intake' | 'delivery'>('intake');
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Intake Form State
  const [trackingNum, setTrackingNum] = useState('');
  const [recipient, setRecipient] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [building, setBuilding] = useState('Iliahi');
  const [roomNumber, setRoomNumber] = useState('');
  const [receivedBy, setReceivedBy] = useState('');

  // Carrier & Service Type States
  const [carrier, setCarrier] = useState('Amazon');
  const [customCarrier, setCustomCarrier] = useState('');
  const [carrierType, setCarrierType] = useState('Ground');
  const [customCarrierType, setCustomCarrierType] = useState('');
  const [notes, setNotes] = useState('');
  
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  
  // Barcode Scanner State 
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Search & Filter State
  const [deliverySearch, setDeliverySearch] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'Delivered'>('All');

  // Delivery Checkout State
  const [deliveryRecipient, setDeliveryRecipient] = useState('');
  const [deliveryEmail, setDeliveryEmail] = useState('');
  const [deliveryPosition, setDeliveryPosition] = useState('Staff');
  const [deliveredBy, setDeliveredBy] = useState('');
  const [selectedPackageIds, setSelectedPackageIds] = useState<string[]>([]);
  
  const signaturePadRef = useRef<SignaturePad | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const [deliveryPhotoFile, setDeliveryPhotoFile] = useState<File | null>(null);
  const [deliveryPhotoPreview, setDeliveryPhotoPreview] = useState<string | null>(null);
  const deliveryPhotoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetchPackages();
  }, []);

  useEffect(() => {
    if (canvasRef.current && activeTab === 'delivery') {
      signaturePadRef.current = new SignaturePad(canvasRef.current);
    }
    if (activeTab !== 'intake' && isScanning) {
      stopScanner();
    }
  }, [activeTab]);

  async function fetchPackages() {
    const { data } = await supabase
      .from('packages')
      .select('*')
      .order('received_at', { ascending: false });
    if (data) setPackages(data);
  }

  async function startScanner() {
    setIsScanning(true);
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode('barcode-reader', {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true,
          },
          verbose: false,
        });
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 20,
            qrbox: (viewfinderWidth, viewfinderHeight) => ({
              width: Math.floor(viewfinderWidth * 0.9),
              height: Math.floor(viewfinderHeight * 0.35),
            }),
            videoConstraints: {
              facingMode: 'environment',
              width: { min: 1280, ideal: 1920 },
              height: { min: 720, ideal: 1080 },
              advanced: [{ focusMode: 'continuous' } as any],
            },
          },
          (decodedText) => {
            setTrackingNum(decodedText);
            stopScanner();
          },
          () => {}
        );
      } catch {
        alert('Camera permission denied or unavailable. Make sure you are using HTTPS.');
        setIsScanning(false);
      }
    }, 100);
  }

  async function stopScanner() {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {}
      scannerRef.current = null;
    }
    setIsScanning(false);
  }

  function compressImage(file: File): Promise<Blob> {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxWidth = 1000;
        const scale = Math.min(1, maxWidth / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.7);
      };
    });
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function handleDeliveryPhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setDeliveryPhotoFile(file);
    setDeliveryPhotoPreview(URL.createObjectURL(file));
  }

  async function handleIntake(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    let uploadedPhotoUrl: string | null = null;

    if (photoFile) {
      const compressedBlob = await compressImage(photoFile);
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('package-photos')
        .upload(fileName, compressedBlob, { contentType: 'image/jpeg' });

      if (uploadError) {
        alert('Photo upload error: ' + uploadError.message);
        setLoading(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('package-photos')
        .getPublicUrl(fileName);
      uploadedPhotoUrl = publicUrlData.publicUrl;
    }

    const finalCarrier = carrier === 'Other' ? customCarrier.trim() || 'Other' : carrier;
    const finalCarrierType = carrierType === 'Other' ? customCarrierType.trim() || 'Other' : carrierType;
    const nowIso = new Date().toISOString();

    const { error } = await supabase.from('packages').insert([
      {
        tracking_number: trackingNum,
        recipient_name: recipient,
        recipient_email: recipientEmail,
        building,
        room_number: roomNumber,
        received_by: receivedBy,
        carrier: finalCarrier,
        carrier_type: finalCarrierType,
        notes,
        photo_url: uploadedPhotoUrl,
        received_at: nowIso,
        status: 'Pending',
      },
    ]);

    if (error) {
      alert('Error saving package: ' + error.message);
      setLoading(false);
      return;
    }

    // Email #1: Arrival Notification
    if (recipientEmail.trim()) {
      try {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
                photo_url: uploadedPhotoUrl,
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
    setPhotoFile(null);
    setPhotoPreview(null);
    fetchPackages();
    alert('Package logged successfully!');
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
    const signatureDataUrl = signaturePadRef.current?.toDataURL();
    const deliveredIso = new Date().toISOString();
    
    let deliveryPhotoURL: string | null = null;

    if (deliveryPhotoFile) {
      const compressedBlob = await compressImage(deliveryPhotoFile);
      const fileName = `delivery-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.jpg`;
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
      deliveryPhotoURL = publicURLData.publicUrl; 
    }

    const { data: deliveryData, error: deliveryError } = await supabase
      .from('deliveries')
      .insert([
        {
          recipient_name: deliveryRecipient,
          delivered_by: deliveredBy,
          signature_url: signatureDataUrl,
          photo_url: deliveryPhotoURL, 
        },
      ])
      .select()
      .single();

    if (deliveryError) {
      alert('Error saving delivery: ' + deliveryError.message);
      setLoading(false);
      return;
    }

    setDeliveryPhotoFile(null); 
    setDeliveryPhotoPreview(null); 
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

    // Email #2: Delivery Confirmation
    if (deliveryEmail.trim()) {
      const selectedList = packages.filter((p) => selectedPackageIds.includes(p.id));
      const originalRecipientName = selectedList[0]?.recipient_name || deliveryRecipient;

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
    fetchPackages();
  }

  function formatDateTime(isoString?: string) {
    if (!isoString) return '—';
    return new Date(isoString).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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

  return (
    <main className="max-w-4xl mx-auto p-4 font-sans pb-20">
      <h1 className="text-2xl font-bold mb-4 text-center">Mailroom Package Tracker</h1>

      <div className="flex border-b mb-6">
        <button
          className={`flex-1 py-2 font-semibold ${
            activeTab === 'intake'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500'
          }`}
          onClick={() => setActiveTab('intake')}
        >
          1. Log New Package
        </button>
        <button
          className={`flex-1 py-2 font-semibold ${
            activeTab === 'delivery'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500'
          }`}
          onClick={() => setActiveTab('delivery')}
        >
          2. Batch Delivery &amp; Sign
        </button>
      </div>

      {activeTab === 'intake' && (
        <form onSubmit={handleIntake} className="space-y-4 bg-white p-6 rounded-lg shadow">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Incoming Package Intake</h2>
            <span className="text-xs text-gray-500">Auto-timestamped</span>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Tracking Number / Barcode *
            </label>
            <div className="flex gap-2 mt-1">
              <input
                type="text"
                value={trackingNum}
                onChange={(e) => setTrackingNum(e.target.value)}
                required
                className="flex-1 p-2 border rounded"
                placeholder="Scan or type tracking #"
              />
              <button
                type="button"
                onClick={isScanning ? stopScanner : startScanner}
                className={`px-3 py-2 rounded font-semibold text-sm text-white ${
                  isScanning ? 'bg-red-600' : 'bg-gray-800'
                }`}
              >
                {isScanning ? 'Stop' : 'Scan Barcode'}
              </button>
            </div>
            {isScanning && (
              <div id="barcode-reader" className="mt-3 border rounded overflow-hidden" />
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Recipient Name *</label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                required
                className="mt-1 w-full p-2 border rounded"
                placeholder="e.g. John Doe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Recipient Email</label>
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                className="mt-1 w-full p-2 border rounded"
                placeholder="e.g. jdoe@hawaii.edu"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Carrier Company *</label>
              <select
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                className="mt-1 w-full p-2 border rounded bg-white"
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
                  placeholder="Enter custom carrier (e.g. OnTrac)"
                  className="mt-2 w-full p-2 border rounded bg-blue-50/40"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Carrier Type / Service *</label>
              <select
                value={carrierType}
                onChange={(e) => setCarrierType(e.target.value)}
                className="mt-1 w-full p-2 border rounded bg-white"
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
                  onChange={(e) => setCustomCarrierType(e.target.value)}
                  required
                  placeholder="Enter custom type..."
                  className="mt-2 w-full p-2 border rounded bg-blue-50/40"
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Campus Building *</label>
              <select
                value={building}
                onChange={(e) => setBuilding(e.target.value)}
                className="mt-1 w-full p-2 border rounded bg-white"
              >
                {CAMPUS_BUILDINGS.map((bldg) => (
                  <option key={bldg} value={bldg}>
                    {bldg}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Room Number</label>
              <input
                type="text"
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                className="mt-1 w-full p-2 border rounded"
                placeholder="e.g. 102 or 204B"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Received By (Staff) *</label>
            <input
              type="text"
              value={receivedBy}
              onChange={(e) => setReceivedBy(e.target.value)}
              required
              className="mt-1 w-full p-2 border rounded"
              placeholder="Your name or initials"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Additional Comments / Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full p-2 border rounded"
              placeholder="e.g. Fragile, oversized box, perishable..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Package Photo (Optional)
            </label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoSelect}
              className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700"
            />
            {photoPreview && (
              <img
                src={photoPreview}
                alt="Package preview"
                className="mt-2 h-32 w-auto rounded border object-cover"
              />
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white p-2.5 rounded font-semibold"
          >
            {loading ? 'Saving Package...' : 'Log Package'}
          </button>
        </form>
      )}

      {activeTab === 'delivery' && (
        <form onSubmit={handleDeliveryCheckout} className="space-y-6 bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold">Batch Pickup &amp; Signature</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Recipient Name (Picking up) *
              </label>
              <input
                type="text"
                value={deliveryRecipient}
                onChange={(e) => setDeliveryRecipient(e.target.value)}
                required
                className="mt-1 w-full p-2 border rounded"
                placeholder="Person signing"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Position *</label>
              <select
                value={deliveryPosition}
                onChange={(e) => setDeliveryPosition(e.target.value)}
                className="mt-1 w-full p-2 border rounded bg-white"
              >
                {POSITIONS.map((pos) => (
                  <option key={pos} value={pos}>
                    {pos}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Recipient Email (for automated receipt)
              </label>
              <input
                type="email"
                value={deliveryEmail}
                onChange={(e) => setDeliveryEmail(e.target.value)}
                className="mt-1 w-full p-2 border rounded"
                placeholder="e.g. jdoe@hawaii.edu"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Delivered By (Staff) *
              </label>
              <input
                type="text"
                value={deliveredBy}
                onChange={(e) => setDeliveredBy(e.target.value)}
                required
                className="mt-1 w-full p-2 border rounded"
                placeholder="Staff delivering package"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Pending Packages ({selectedPackageIds.length} selected):
            </label>
            <input
              type="text"
              value={deliverySearch}
              onChange={(e) => setDeliverySearch(e.target.value)}
              placeholder="Search by recipient, building, or tracking #..."
              className="mb-2 w-full p-2 text-sm border rounded bg-gray-50"
            />
            <div className="max-h-60 overflow-y-auto border p-3 rounded space-y-2.5">
              {pendingPackages.length === 0 ? (
                <p className="text-sm text-gray-500">No matching pending packages on shelf.</p>
              ) : (
                pendingPackages.map((pkg) => (
                  <label
                    key={pkg.id}
                    className="flex items-start space-x-3 cursor-pointer border-b pb-2 last:border-b-0"
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
                      className="mt-1 h-4 w-4 text-blue-600 rounded"
                    />
                    <div className="text-sm flex-1">
                      <div>
                        <strong>{pkg.recipient_name}</strong>
                      </div>
                      <div className="text-xs text-gray-600 mt-0.5">
                        {pkg.building} {pkg.room_number ? `Rm ${pkg.room_number}` : ''} •{' '}
                        <span className="font-mono">{pkg.tracking_number}</span> ({pkg.carrier} {pkg.carrier_type ? `/ ${pkg.carrier_type}` : ''})
                      </div>
                      {pkg.notes && (
                        <div className="text-xs text-amber-700 mt-0.5">Note: {pkg.notes}</div>
                      )}
                    </div>
                    {pkg.photo_url && (
                      <a
                        href={pkg.photo_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-600 underline"
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Delivery / Drop-Off Photo (Optional)
            </label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              ref={deliveryPhotoInputRef}
              onChange={handleDeliveryPhotoSelect}
              className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700"
            />
            {deliveryPhotoPreview && (
              <img
                src={deliveryPhotoPreview}
                alt="Delivery preview"
                className="mt-2 h-32 w-auto rounded border object-cover"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Recipient Signature (One signature for all selected packages)
            </label>
            <div className="border border-gray-300 rounded bg-gray-50 p-2 flex flex-col items-center">
              <canvas
                ref={canvasRef}
                width={450}
                height={200}
                className="w-full border bg-white rounded cursor-crosshair touch-none"
              />
              <button
                type="button"
                onClick={() => signaturePadRef.current?.clear()}
                className="mt-2 text-xs text-red-600 font-semibold"
              >
                Clear Signature
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white p-2.5 rounded font-semibold"
          >
            {loading ? 'Processing...' : 'Complete Batch Delivery & Send Receipt'}
          </button>
        </form>
      )}

      {/* Full Package Log Table */}
      <div className="mt-8 bg-white p-6 rounded-lg shadow">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          <h2 className="text-lg font-semibold">
            Logged Packages ({filteredHistory.length})
          </h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="Search name, staff, building..."
              className="p-1.5 text-sm border rounded"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="p-1.5 text-sm border rounded bg-white"
            >
              <option value="All">All</option>
              <option value="Pending">Pending</option>
              <option value="Delivered">Delivered</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="p-2">Recipient</th>
                <th className="p-2">Location</th>
                <th className="p-2">Tracking</th>
                <th className="p-2">Received</th>
                <th className="p-2">Delivered</th>
                <th className="p-2">Photo</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.map((p) => (
                <tr key={p.id} className="border-b">
                  <td className="p-2">
                    <div className="font-medium">{p.recipient_name}</div>
                    <div className="text-xs text-gray-500">
                      {p.recipient_position} {p.recipient_email ? `• ${p.recipient_email}` : ''}
                    </div>
                  </td>
                  <td className="p-2 text-xs">
                    {p.building} {p.room_number ? `Rm ${p.room_number}` : ''}
                  </td>
                  <td className="p-2">
                    <div className="font-mono text-xs">{p.tracking_number}</div>
                    <div className="text-xs text-gray-500">
                      {p.carrier} {p.carrier_type ? `(${p.carrier_type})` : ''}
                    </div>
                    {p.notes && (
                      <div className="text-xs text-amber-700 mt-0.5">Note: {p.notes}</div>
                    )}
                  </td>
                  <td className="p-2 text-xs text-gray-600">
                    <div>{formatDateTime(p.received_at)}</div>
                    {p.received_by && (
                      <div className="text-gray-400">By: {p.received_by}</div>
                    )}
                  </td>
                  <td className="p-2 text-xs text-gray-600">
                    {p.status === 'Delivered' ? (
                      <>
                        <div>{formatDateTime(p.delivered_at)}</div>
                        {p.delivered_by && (
                          <div className="text-gray-400">By: {p.delivered_by}</div>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="p-2 text-xs">
                    {p.photo_url ? (
                      <a
                        href={p.photo_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 underline"
                      >
                        View
                      </a>
                    ) : (
                      <span className="text-gray-400">None</span>
                    )}
                  </td>
                  <td className="p-2">
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full font-semibold ${
                        p.status === 'Pending'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}