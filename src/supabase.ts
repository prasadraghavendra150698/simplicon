type SupabaseClient = any;

let supabasePromise: Promise<SupabaseClient> | null = null;

function getEnv(name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'): string {
  const raw = (import.meta as any).env?.[name] as string | undefined;
  const value = raw?.trim().replace(/^['"]|['"]$/g, '');
  if (!value) throw new Error(`Missing env var: ${name}`);
  if (value.trim() === 'REPLACE_ME') throw new Error(`Env var ${name} is still set to REPLACE_ME`);
  return value;
}

function assertValidUrl(raw: string, varName: string): void {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error('URL must start with http(s)://');
    }
  } catch {
    throw new Error(`Invalid ${varName}. Set it to your Supabase Project URL (e.g. https://xxxx.supabase.co).`);
  }
}

export async function getSupabase(): Promise<SupabaseClient> {
  if (supabasePromise) return supabasePromise;

  supabasePromise = (async () => {
    const supabaseUrl = getEnv('VITE_SUPABASE_URL');
    const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');
    assertValidUrl(supabaseUrl, 'VITE_SUPABASE_URL');

    const moduleUrl: string =
      'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/+esm';
    const mod: any = await import(/* @vite-ignore */ moduleUrl);
    const createClient: any = mod?.createClient;
    if (typeof createClient !== 'function') {
      throw new Error('Failed to load Supabase client');
    }

    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  })();

  return supabasePromise;
}

export async function requireSessionOrRedirect(nextPath: string): Promise<any> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const session = data?.session;
  if (!session) {
    const next = encodeURIComponent(nextPath);
    window.location.href = `/auth?next=${next}`;
    return null;
  }
  return session;
}

export async function isAdmin(): Promise<boolean> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc('is_admin');
  if (error) return false;
  return Boolean(data);
}

export async function isLeadAdmin(): Promise<boolean> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc('is_lead_admin');
  if (error) return false;
  return Boolean(data);
}

export async function getUserProfile(): Promise<{ full_name: string; role: string; email: string } | null> {
  const supabase = await getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('full_name, role, email')
    .eq('id', session.user.id)
    .single();

  if (error) return null;
  return data;
}

export async function getNotificationCount(): Promise<number> {
  const supabase = await getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return 0;

  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', session.user.id)
    .eq('is_read', false);

  if (error) return 0;
  return count ?? 0;
}
