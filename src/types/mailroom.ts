export interface PackageItem {
  id: string;
  tracking_number: string;
  recipient_name: string;
  recipient_email?: string | null;
  recipient_position?: string | null;
  building: string;
  room_number?: string | null;
  received_by?: string | null;
  delivered_by?: string | null;
  carrier: string;
  carrier_type?: string | null;
  notes?: string | null;
  photo_url?: string | null;
  delivery_photo_url?: string | null;
  signature_url?: string | null;
  delivery_id?: string | null;
  received_at?: string | null;
  delivered_at?: string | null;
  status: 'Pending' | 'Delivered';
}

export interface DirectoryEntry {
  id: string;
  name: string;
  email: string;
  building?: string | null;
  room_number?: string | null;
  position?: string | null;
}