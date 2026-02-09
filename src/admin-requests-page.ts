import { getSupabase, isAdmin, isLeadAdmin, getUserProfile, requireSessionOrRedirect } from './supabase';

type SubmissionOverview = {
  id: string;
  request_no: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
  status: string;
  client_email: string | null;
  client_full_name: string | null;
  tax_year: string | null;
  assigned_to: string | null;
  deadline_date: string | null;
  service_name: string;
};

function setNote(el: HTMLElement, message: string, isError = false): void {
  el.hidden = false;
  el.textContent = message;
  el.classList.toggle('auth-note--error', isError);
}

function clearNote(el: HTMLElement): void {
  el.hidden = true;
  el.textContent = '';
  el.classList.remove('auth-note--error');
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
}

function getQueryParam(name: string): string {
  try {
    const url = new URL(window.location.href);
    return url.searchParams.get(name) ?? '';
  } catch {
    return '';
  }
}

function matchesSearch(row: SubmissionOverview, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return (
    (row.request_no ?? '').toLowerCase().includes(needle) ||
    (row.client_email ?? '').toLowerCase().includes(needle) ||
    (row.client_full_name ?? '').toLowerCase().includes(needle) ||
    (row.tax_year ?? '').toLowerCase().includes(needle) ||
    (row.assigned_to ?? '').toLowerCase().includes(needle) ||
    (row.service_name ?? '').toLowerCase().includes(needle) ||
    (row.status ?? '').toLowerCase().includes(needle)
  );
}

async function init(): Promise<void> {
  const note = document.getElementById('adminRequestsNote') as HTMLElement | null;
  const adminUserName = document.getElementById('adminUserName') as HTMLElement | null;
  const adminRoleBadge = document.getElementById('adminRoleBadge') as HTMLElement | null;
  const adminSignOutBtn = document.getElementById('adminSignOutBtn') as HTMLButtonElement | null;
  const leadAdminMenu = document.getElementById('leadAdminMenu') as HTMLElement | null;
  const filterSelect = document.getElementById('requestsFilter') as HTMLSelectElement | null;
  const searchInput = document.getElementById('requestsSearch') as HTMLInputElement | null;
  const tbody = document.getElementById('requestsTbody') as HTMLTableSectionElement | null;

  if (!note || !adminUserName || !adminRoleBadge || !adminSignOutBtn || !filterSelect || !searchInput || !tbody) return;
  clearNote(note);

  const session = await requireSessionOrRedirect('/admin-requests');
  if (!session) return;

  const supabase = await getSupabase();
  const lead = await isLeadAdmin();
  const profile = await getUserProfile();

  const ok = await isAdmin();
  if (!ok) {
    setNote(note, 'Access denied. This page is for admins only.', true);
    setTimeout(() => {
      window.location.href = '/portal';
    }, 1200);
    return;
  }

  // Populate Header
  if (profile) {
    adminUserName.textContent = profile.full_name || profile.email;
    adminRoleBadge.textContent = profile.role.toUpperCase().replace('_', ' ');
    if (lead && leadAdminMenu) leadAdminMenu.hidden = false;
  } else if (session.user) {
    adminUserName.textContent = session.user.email || 'Admin';
  }

  adminSignOutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = '/auth';
  });

  const initialFilter = getQueryParam('filter');
  if (initialFilter) filterSelect.value = initialFilter;
  if (initialFilter === 'inbox') {
    localStorage.setItem('admin_inbox_last_seen', new Date().toISOString());
  }

  const { data, error } = await supabase
    .from('submissions')
    .select(
      'id, request_no, created_at, updated_at, updated_by, status, client_email, client_full_name, tax_year, assigned_to, deadline_date, service_name'
    )
    .order('updated_at', { ascending: false });
  if (error) throw error;

  const allSubmissions = (data ?? []) as SubmissionOverview[];

  const apply = () => {
    const filter = filterSelect.value;
    const search = searchInput.value.toLowerCase();
    const myEmail = (session.user?.email ?? '').toLowerCase();

    const filtered = allSubmissions.filter((r) => {
      if (!matchesSearch(r, search)) return false;

      if (filter === 'all') return true;
      if (filter === 'assigned') return (r.assigned_to ?? '').toLowerCase() === myEmail;
      return r.status === filter;
    });

    tbody.innerHTML = '';
    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="portal-empty">No results matching your filters.</td></tr>';
      return;
    }

    for (const r of filtered) {
      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      tr.onclick = () => { window.location.href = `/admin-ticket?id=${r.id}`; };
      tr.innerHTML = `
        <td class="portal-req-mono">${r.request_no ?? '—'}</td>
        <td>${formatDate(r.created_at)}</td>
        <td>${formatDate(r.updated_at)}</td>
        <td>${r.updated_by || '—'}</td>
        <td><span class="portal-badge portal-badge--${r.status.toLowerCase().replace(/\s+/g, '')}">${r.status}</span></td>
        <td>
          <div style="font-weight: 600;">${r.client_email ?? '—'}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted);">${r.service_name}</div>
        </td>
        <td>${r.assigned_to ?? '—'}</td>
        <td>${r.deadline_date ?? '—'}</td>
        <td><a class="btn btn-secondary btn-sm" href="/admin-ticket?id=${r.id}">Open Case</a></td>
      `;
      tbody.appendChild(tr);
    }
  };

  // Handle URL Filter (e.g. ?filter=Open)
  const params = new URLSearchParams(window.location.search);
  const urlFilter = params.get('filter');
  if (urlFilter) {
    if (urlFilter === 'assigned') filterSelect.value = 'assigned';
    else {
      // Find if it's a valid status
      const options = Array.from(filterSelect.options).map(o => o.value);
      if (options.includes(urlFilter)) {
        filterSelect.value = urlFilter;
      }
    }
  }

  filterSelect.addEventListener('change', apply);
  searchInput.addEventListener('input', apply);
  apply();
}

async function safeInit(): Promise<void> {
  const note = document.getElementById('adminRequestsNote') as HTMLElement | null;
  try {
    await init();
  } catch (err: any) {
    if (!note) return;
    const msg = err?.message ? String(err.message) : 'Could not load requests.';
    setNote(note, msg, true);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void safeInit());
} else {
  void safeInit();
}
