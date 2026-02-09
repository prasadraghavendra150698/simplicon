
import { getSupabase, requireSessionOrRedirect, isLeadAdmin, getUserProfile } from './supabase';
import { initNotifications } from './notifications';

interface Profile {
    id: string;
    email: string;
    full_name: string;
    role: 'client' | 'admin' | 'super_admin';
    created_at: string;
}

async function init() {
    const session = await requireSessionOrRedirect('/admin-members');
    if (!session) return;

    const lead = await isLeadAdmin();
    const profile = await getUserProfile();

    // Redirect if not authorized (Lead Admin only)
    if (!lead) {
        window.location.href = '/admin';
        return;
    }

    const supabase = await getSupabase();

    // Init Notifications
    initNotifications();

    // Elements
    const adminUserName = document.getElementById('adminUserName');
    const adminRoleBadge = document.getElementById('adminRoleBadge');
    const adminSignOutBtn = document.getElementById('adminSignOutBtn');

    const clientsTab = document.getElementById('clientsTab');
    const internalTab = document.getElementById('internalTab');
    const clientsPanel = document.getElementById('clientsPanel');
    const internalPanel = document.getElementById('internalPanel');
    const clientsList = document.getElementById('clientsList');
    const internalList = document.getElementById('internalList');
    const searchInput = document.getElementById('membersSearch') as HTMLInputElement;

    if (profile && adminUserName && adminRoleBadge) {
        adminUserName.textContent = profile.full_name || profile.email;
        adminRoleBadge.textContent = profile.role.toUpperCase().replace('_', ' ');
        if (profile.role === 'super_admin') {
            adminRoleBadge.style.background = '#ef4444';
        }
    }

    if (adminSignOutBtn) {
        adminSignOutBtn.addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.href = '/auth';
        });
    }

    // Tabs Logic
    const setTab = (mode: 'clients' | 'internal') => {
        if (!clientsTab || !internalTab || !clientsPanel || !internalPanel) return;
        if (mode === 'clients') {
            clientsTab.classList.add('auth-tab--active');
            internalTab.classList.remove('auth-tab--active');
            clientsPanel.hidden = false;
            internalPanel.hidden = true;
        } else {
            internalTab.classList.add('auth-tab--active');
            clientsTab.classList.remove('auth-tab--active');
            internalPanel.hidden = false;
            clientsPanel.hidden = true;
        }
    };

    clientsTab?.addEventListener('click', () => setTab('clients'));
    internalTab?.addEventListener('click', () => setTab('internal'));

    // Data Loading
    let allProfiles: Profile[] = [];

    const loadMembers = async () => {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Members load error:', error);
            if (clientsList) clientsList.innerHTML = `<div class="portal-empty">Failed to load members: ${error.message}</div>`;
            return;
        }

        allProfiles = (data || []) as Profile[];
        render();
    };

    const render = () => {
        if (!clientsList || !internalList) return;

        const search = searchInput.value.toLowerCase().trim();

        const filtered = allProfiles.filter(p => {
            if (!search) return true;
            return (p.email?.toLowerCase().includes(search) || p.full_name?.toLowerCase().includes(search));
        });

        const clients = filtered.filter(p => p.role === 'client');
        const internal = filtered.filter(p => p.role === 'admin' || p.role === 'super_admin');

        // Render Clients
        clientsList.innerHTML = '';
        if (clients.length === 0) {
            clientsList.innerHTML = '<div class="portal-empty">No clients found.</div>';
        } else {
            clients.forEach(p => matchRow(p, clientsList));
        }

        // Render Internal
        internalList.innerHTML = '';
        if (internal.length === 0) {
            internalList.innerHTML = '<div class="portal-empty">No internal members found.</div>';
        } else {
            internal.forEach(p => matchRow(p, internalList));
        }
    };

    const matchRow = (p: Profile, container: HTMLElement) => {
        const div = document.createElement('div');
        div.className = 'portal-list-item';
        div.style.cursor = 'default';

        const isSuper = p.role === 'super_admin';
        const isMe = p.email === profile?.email;

        div.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <div>
                <div class="portal-list-title">
                    ${p.full_name || 'No Name'} 
                    <span style="font-weight:400; color:var(--text-muted); font-size:0.9em;">(${p.email})</span>
                    ${isSuper ? '<span class="portal-badge portal-badge--workinprogress" style="font-size:0.6rem; margin-left:0.5rem">SUPER ADMIN</span>' : ''}
                </div>
                <div class="portal-list-meta">Joined: ${new Date(p.created_at).toLocaleDateString()}</div>
            </div>
            <div style="display: flex; gap: 0.5rem;">
                ${!isSuper && !isMe ? `<button class="btn btn-secondary btn-sm btn-delete-user" data-id="${p.id}" data-email="${p.email}" style="color: #dc2626; border-color: #dc2626;">Delete</button>` : ''}
                ${isMe ? '<span class="portal-badge">YOU</span>' : ''}
            </div>
        </div>
    `;
        container.appendChild(div);
    };

    // Event Delegation for Delete
    const handleDelete = async (uid: string, email: string) => {
        if (!confirm(`Are you sure you want to PERMANENTLY DELETE user ${email}? This cannot be undone.`)) return;

        // Using simple loading state
        const { error } = await supabase.rpc('delete_user_account', { target_user_id: uid });

        if (error) {
            alert('Data deletion failed: ' + error.message);
        } else {
            alert('User deleted successfully.');
            loadMembers();
        }
    };

    document.addEventListener('click', (e) => {
        const target = (e.target as HTMLElement).closest('.btn-delete-user');
        if (target) {
            const uid = (target as HTMLElement).getAttribute('data-id');
            const email = (target as HTMLElement).getAttribute('data-email');
            if (uid && email) handleDelete(uid, email);
        }
    });

    searchInput.addEventListener('input', render);

    loadMembers();
}

init();
