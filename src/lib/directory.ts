import { supabase } from '@/lib/supabase';
import { DirectoryEntry } from '@/types/mailroom';

export async function fetchDirectory(): Promise<DirectoryEntry[]> {
  const { data } = await supabase
    .from('recipient_directory')
    .select('*')
    .order('name', { ascending: true });
  return data || [];
}

export async function saveToDirectory(entry: {
  name: string;
  email: string;
  building?: string | null;
  room_number?: string | null;
  position?: string | null;
}) {
  const cleanEmail = entry.email.trim().toLowerCase();
  const cleanName = entry.name.trim();
  if (!cleanEmail || !cleanName) return;

  await supabase.from('recipient_directory').upsert(
    [
      {
        name: cleanName,
        email: cleanEmail,
        building: entry.building || null,
        room_number: entry.room_number || null,
        position: entry.position || null,
        updated_at: new Date().toISOString(),
      },
    ],
    { onConflict: 'email' }
  );
}