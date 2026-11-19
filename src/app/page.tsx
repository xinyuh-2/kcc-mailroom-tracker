'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import SignaturePad from 'signature_pad';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

const POSITIONS = ['Student Assisstant', 'Faculty', 'Staff', 'Administration', 'Vendor', 'Academics', 'Other'];
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

  // Responsive Canvas Resize for Signature Pad
  useEffect(() => {
    function resizeCanvas() {
      const canvas = canvasRef.current;
      if (!canvas || activeTab !== 'delivery') return;

      // Ratio to handle high-density screens cleanly
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const rect = canvas.getBoundingClientRect();
      
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      canvas.getContext('2d')?.scale(ratio, ratio);

      if (signaturePadRef.current) {
        signaturePadRef.current.clear(); // Clear on resize to prevent skewing
      } else {
        signaturePadRef.current = new SignaturePad(canvas, {
          penColor: 'rgb(15, 23, 42)',
          minWidth: 2,
          maxWidth: 4,
        });
      }
    }

    if (activeTab === 'delivery') {
      setTimeout(resizeCanvas, 50);
      window.addEventListener('resize', resizeCanvas);
    }

    if (activeTab !== 'intake' && isScanning) {
      stopScanner();
    }

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
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

      {activeTab === 'intake' && (
        <form onSubmit={handleIntake} className="space-y-5 bg-white p-7 rounded-xl shadow-lg border border-gray-200">
          <div className="flex justify-between items-center border-b pb-3">
            <h2 className="text-xl font-extrabold text-gray-900">Incoming Package Intake</h2>
            <span className="text-sm font-semibold text-gray-600 bg-gray-100 px-2.5 py-1 rounded">Auto-timestamped</span>
          </div>

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
                className="flex-1 p-3 text-base border-2 border-gray-400 rounded-lg font-semibold focus:border-blue-600 focus:outline-none"
                placeholder="Scan or type tracking #"
              />
              <button
                type="button"
                onClick={isScanning ? stopScanner : startScanner}
                className={`px-5 py-3 rounded-lg font-bold text-base text-white shadow ${
                  isScanning ? 'bg-red-700 hover:bg-red-800' : 'bg-gray-900 hover:bg-black'
                }`}
              >
                {isScanning ? 'Stop' : 'Scan Barcode'}
              </button>
            </div>
            {isScanning && (
              <div id="barcode-reader" className="mt-3 border-2 border-gray-400 rounded-lg overflow-hidden" />
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-base font-bold text-gray-900 mb-1.5">Recipient Name *</label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                required
                className="w-full p-3 text-base border-2 border-gray-400 rounded-lg font-semibold focus:border-blue-600 focus:outline-none"
                placeholder="e.g. John Doe"
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-base font-bold text-gray-900 mb-1.5">Carrier Company *</label>
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
              <label className="block text-base font-bold text-gray-900 mb-1.5">Carrier Type / Service *</label>
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
                  onChange={(e) => setCustomCarrierType(e.target.value)}
                  required
                  placeholder="Enter custom type..."
                  className="mt-2.5 w-full p-3 text-base border-2 border-blue-400 rounded-lg font-semibold bg-blue-50/50 focus:outline-none"
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-base font-bold text-gray-900 mb-1.5">Campus Building *</label>
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
              <label className="block text-base font-bold text-gray-900 mb-1.5">Room Number</label>
              <input
                type="text"
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                className="w-full p-3 text-base border-2 border-gray-400 rounded-lg font-semibold focus:border-blue-600 focus:outline-none"
                placeholder="e.g. 102 or 204B"
              />
            </div>
          </div>

          <div>
            <label className="block text-base font-bold text-gray-900 mb-1.5">Received By (Staff) *</label>
            <input
              type="text"
              value={receivedBy}
              onChange={(e) => setReceivedBy(e.target.value)}
              required
              className="w-full p-3 text-base border-2 border-gray-400 rounded-lg font-semibold focus:border-blue-600 focus:outline-none"
              placeholder="Your name or initials"
            />
          </div>

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

          <div>
            <label className="block text-base font-bold text-gray-900 mb-1.5">
              Package Photo (Optional)
            </label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoSelect}
              className="block w-full text-base font-semibold text-gray-800 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-blue-100 file:text-blue-900 hover:file:bg-blue-200 cursor-pointer"
            />
            {photoPreview && (
              <img
                src={photoPreview}
                alt="Package preview"
                className="mt-3 h-36 w-auto rounded-lg border-2 border-gray-400 object-cover shadow"
              />
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-700 hover:bg-blue-800 text-white p-3.5 rounded-xl font-bold text-lg shadow-md transition-all"
          >
            {loading ? 'Saving Package...' : 'Log Package'}
          </button>
        </form>
      )}

      {activeTab === 'delivery' && (
        <form onSubmit={handleDeliveryCheckout} className="space-y-6 bg-white p-7 rounded-xl shadow-lg border border-gray-200">
          <h2 className="text-xl font-extrabold text-gray-900 border-b pb-3">Batch Pickup &amp; Signature</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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
              <label className="block text-base font-bold text-gray-900 mb-1.5">
                Delivered By (Staff) *
              </label>
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
                      <div>
                        <strong className="text-lg text-blue-950">{pkg.recipient_name}</strong>
                      </div>
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
              Delivery / Drop-Off Photo (Optional)
            </label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              ref={deliveryPhotoInputRef}
              onChange={handleDeliveryPhotoSelect}
              className="block w-full text-base font-semibold text-gray-800 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-green-100 file:text-green-900 hover:file:bg-green-200 cursor-pointer"
            />
            {deliveryPhotoPreview && (
              <img
                src={deliveryPhotoPreview}
                alt="Delivery preview"
                className="mt-3 h-36 w-auto rounded-lg border-2 border-gray-400 object-cover shadow"
              />
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
                    <option key={pos} value={pos}>
                      {pos}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-base font-bold text-gray-900 mb-1.5">
                Recipient Signature (One signature for all selected packages) *
              </label>
              <div className="border-2 border-gray-400 rounded-xl bg-gray-50 p-3 flex flex-col items-center shadow-inner">
                {/* Fixed-height container with w-full ensures the canvas fits cleanly without clipping */}
                <div className="w-full h-48 bg-white border-2 border-dashed border-gray-500 rounded-lg overflow-hidden relative">
                  <canvas
                    ref={canvasRef}
                    className="w-full h-full cursor-crosshair touch-none block"
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
      )}

      {/* Full Package Log Table */}
      <div className="mt-8 bg-white p-7 rounded-xl shadow-lg border border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-xl font-extrabold text-gray-900">
            Logged Packages ({filteredHistory.length})
          </h2>
          <div className="flex gap-2.5">
            <input
              type="text"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="Search name, staff, building..."
              className="p-2.5 text-sm border-2 border-gray-400 rounded-lg font-semibold focus:outline-none"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="p-2.5 text-sm border-2 border-gray-400 rounded-lg font-semibold bg-white focus:outline-none"
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
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="font-semibold text-gray-800">
              {filteredHistory.map((p) => (
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
                    <div className="font-mono text-sm font-bold text-gray-900">{p.tracking_number}</div>
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}