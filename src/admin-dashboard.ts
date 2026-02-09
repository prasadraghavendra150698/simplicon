import { getSupabase, requireSessionOrRedirect, isAdmin, isLeadAdmin, getUserProfile, getNotificationCount } from './supabase';

async function init() {
    const session = await requireSessionOrRedirect('/admin');
    if (!session) return;

    const ok = await isAdmin();
    if (!ok) {
        window.location.href = '/portal';
        return;
    }

    const supabase = await getSupabase();
    const lead = await isLeadAdmin();
    const profile = await getUserProfile();

    // Elements
    const adminUserName = document.getElementById('adminUserName')!;
    const adminRoleBadge = document.getElementById('adminRoleBadge')!;
    const dashboardTitle = document.getElementById('dashboardTitle')!;
    const adminSignOutBtn = document.getElementById('adminSignOutBtn')!;
    const leadAdminMenu = document.getElementById('leadAdminMenu')!;
    const superAdminQueueCard = document.getElementById('superAdminQueueCard')!;
    const unassignedWorkList = document.getElementById('unassignedWorkList')!;
    const recentActivityList = document.getElementById('recentActivityList')!;

    // Stats
    const statsAssigned = document.getElementById('statsAssigned')!;
    const statsOpen = document.getElementById('statsOpen')!;
    const statsWIP = document.getElementById('statsWIP')!;
    const statsPending = document.getElementById('statsPending')!;
    const statsCompleted = document.getElementById('statsCompleted')!;

    // Role Formatting
    if (profile) {
        adminUserName.textContent = profile.full_name || profile.email;
        adminRoleBadge.textContent = profile.role.toUpperCase().replace('_', ' ');
        adminRoleBadge.style.background = profile.role === 'super_admin' ? '#ef4444' : '#0c4a6e';

        if (profile.role === 'super_admin') {
            dashboardTitle.textContent = 'Super Admin Command Center';
            leadAdminMenu.hidden = false;
            superAdminQueueCard.hidden = false;
        } else {
            dashboardTitle.textContent = 'Agent Dashboard';
        }
    } else if (session.user) {
        adminUserName.textContent = session.user.email || 'Admin';
    }

    // Set Notifications
    const updateNotifs = async () => {
        const count = await getNotificationCount();
        const badge = document.getElementById('adminNotifBadge')!;
        if (count > 0) {
            badge.textContent = count > 9 ? '9+' : String(count);
            badge.hidden = false;
        } else {
            badge.hidden = true;
        }
    };
    updateNotifs();

    // Load Stats
    const loadStats = async () => {
        const { data: rows } = await supabase.from('submissions').select('status, assigned_to');
        if (!rows) return;

        const myEmail = session.user.email?.toLowerCase();

        const statsTotal = document.getElementById('statsTotal');
        if (statsTotal) statsTotal.textContent = String(rows.length);

        statsAssigned.textContent = String(rows.filter((r: any) => r.assigned_to?.toLowerCase() === myEmail).length);
        statsOpen.textContent = String(rows.filter((r: any) => r.status === 'Open').length);
        statsWIP.textContent = String(rows.filter((r: any) => r.status === 'Work in Progress').length);
        statsPending.textContent = String(rows.filter((r: any) => r.status === 'Pending').length);
        statsCompleted.textContent = String(rows.filter((r: any) => r.status === 'Completed').length);
    };

    // Load Lists
    const loadLists = async () => {
        // Recent Activity (last 5 updated)
        const { data: recent } = await supabase
            .from('submissions')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(5);

        recentActivityList.innerHTML = '';
        if (recent && recent.length > 0) {
            recent.forEach((r: any) => {
                const item = document.createElement('div');
                item.className = 'portal-list-item';
                item.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div class="portal-list-title" style="font-family: monospace;">${r.request_no}</div>
              <div class="portal-list-meta">${r.client_email}</div>
            </div>
            <span class="portal-badge portal-badge--${r.status.toLowerCase().replace(/\s+/g, '')}">${r.status}</span>
          </div>
        `;
                item.onclick = () => window.location.href = `/admin-ticket?id=${r.id}`;
                recentActivityList.appendChild(item);
            });
        } else {
            recentActivityList.innerHTML = '<div class="portal-empty">No activity records.</div>';
        }

        // Unassigned (Master Queue)
        if (lead) {
            const { data: unassigned } = await supabase
                .from('submissions')
                .select('*')
                .is('assigned_to', null)
                .order('created_at', { ascending: true });

            unassignedWorkList.innerHTML = '';
            if (unassigned && unassigned.length > 0) {
                unassigned.forEach((r: any) => {
                    const item = document.createElement('div');
                    item.className = 'portal-list-item';
                    item.style.borderColor = '#fde68a';
                    item.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div class="portal-list-title" style="font-family: monospace;">${r.request_no}</div>
                <div class="portal-list-meta">${r.service_name} • ${r.client_email}</div>
              </div>
              <div class="btn btn-secondary btn-sm">Assign</div>
            </div>
          `;
                    item.onclick = () => window.location.href = `/admin-ticket?id=${r.id}`;
                    unassignedWorkList.appendChild(item);
                });
            } else {
                unassignedWorkList.innerHTML = '<div class="portal-empty">All cases are assigned!</div>';
            }
        }
    };

    adminSignOutBtn.onclick = async () => {
        await supabase.auth.signOut();
        window.location.href = '/auth';
    };

    // Reset System Logic
    const resetSystemBtn = document.getElementById('resetSystemBtn');
    if (resetSystemBtn) {
        resetSystemBtn.onclick = async () => {
            if (!confirm('EXTREMELY DANGEROUS: This will delete ALL requests, files, and comments forever. Are you sure you want to start from zero?')) return;

            const { error } = await supabase.rpc('danger_reset_all_data');
            if (error) {
                alert('Reset failed: ' + error.message);
            } else {
                alert('System successfully reset. All requests deleted and REQ# sequence reset to 1.');
                loadStats();
                loadLists();
            }
        };
    }

    loadStats();
    loadLists();
}

init();
