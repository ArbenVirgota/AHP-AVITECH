// lib/assets.ts

const API_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || '';

export interface SystemAssets {
  platform_logo?: string;
  admin_signature?: string;
  co_admin_signature?: string;
  [key: string]: string | undefined;
}

/**
 * Mengambil aset resmi sistem (Logo, TTD Admin, TTD Co-Admin) dari Google Sheets
 */
export async function fetchSystemAssets(): Promise<SystemAssets> {
  try {
    const res = await fetch(`${API_URL}?action=get_system_assets&_t=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
    });
    const json = await res.json();
    if (json && json.success && json.data) {
      return json.data;
    }
    return {};
  } catch (error) {
    console.warn('Gagal memuat aset sistem dari Google Sheets:', error);
    return {};
  }
}

/**
 * Menyimpan atau memperbarui aset sistem secara batch ke sheet system_assets
 */
export async function updateSystemAssets(assets: SystemAssets): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'save_system_assets',
        assets: assets,
      }),
    });
    return await res.json();
  } catch (error: any) {
    return { success: false, message: error.message || 'Koneksi ke server gagal.' };
  }
}