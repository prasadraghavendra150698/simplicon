import { getSupabase, requireSessionOrRedirect, isLeadAdmin, getUserProfile } from './supabase';

async function init() {
    const session = await requireSessionOrRedirect('/admin-access');
    if (!session) return;

    const lead = await isLeadAdmin();
    if (!lead) {
        window.location.href = '/admin';
        return;
    }

    const supabase = await getSupabase();
    const profile = await getUserProfile();

    // Header
    const adminUserName = document.getElementById('adminUserName')!;
    const adminRoleBadge = document.getElementById('adminRoleBadge')!;
    const adminSignOutBtn = document.getElementById('adminSignOutBtn')!;
    const accessRequestsList = document.getElementById('accessRequestsList')!;

    if (profile) {
        adminUserName.textContent = profile.full_name || profile.email;
        adminRoleBadge.textContent = profile.role.toUpperCase().replace('_', ' ');
    }

    adminSignOutBtn.onclick = async () => {
        await supabase.auth.signOut();
        window.location.href = '/auth';
    };

    const activeAdminsList = document.getElementById('activeAdminsList')!;

    const loadAdmins = async () => {
        const { data, error } = await supabase.rpc('list_admins');
        if (error) {
            activeAdminsList.innerHTML = `<div class="auth-note auth-note--error">${error.message}</div>`;
            return;
        }

        activeAdminsList.innerHTML = '';
        if (data && data.length > 0) {
            data.forEach((a: any) => {
                const isSelf = a.email.toLowerCase() === session.user.email?.toLowerCase();
                const isSuper = a.email.toLowerCase() === 'info@simplicontax.com';

                const item = document.createElement('div');
                item.className = 'portal-list-item';
                item.style.cursor = 'default';
                item.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div class="portal-list-title">${a.email} ${a.is_lead ? '<span class="portal-badge portal-badge--workinprogress" style="font-size: 0.6rem; margin-left: 0.5rem;">LEAD</span>' : ''}</div>
              <div class="portal-list-meta">Added on ${new Date(a.created_at).toLocaleDateString()}</div>
            </div>
            <div style="display: flex; gap: 0.5rem;">
              ${!isSuper && !isSelf ? `<button class="btn btn-secondary btn-sm" style="color: #dc2626; border-color: #dc2626;" onclick="window.revokeAdmin('${a.email}')">Revoke Access</button>` : ''}
              ${isSelf ? '<span class="text-muted small">You (Active)</span>' : ''}
              ${isSuper && !isSelf ? '<span class="text-muted small">System Owner</span>' : ''}
            </div>
          </div>
        `;
                activeAdminsList.appendChild(item);
            });
        } else {
            activeAdminsList.innerHTML = '<div class="portal-empty">No active administrators found.</div>';
        }
    };

    (window as any).revokeAdmin = async (email: string) => {
        if (!confirm(`Are you sure you want to revoke administrative access for ${email}? They will be reverted to a standard client account.`)) return;

        const { error } = await supabase.rpc('revoke_admin_access', { admin_email: email });
        if (error) alert(error.message);
        else {
            alert('Access revoked successfully');
            loadAdmins();
        }
    };

    const loadRequests = async () => {
        const { data, error } = await supabase
            .from('admin_access_requests')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) {
            accessRequestsList.innerHTML = `<div class="auth-note auth-note--error">${error.message}</div>`;
            return;
        }

        accessRequestsList.innerHTML = '';
        if (data && data.length > 0) {
            data.forEach((r: any) => {
                const item = document.createElement('div');
                item.className = 'portal-list-item';
                item.style.cursor = 'default';
                item.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div class="portal-list-title">${r.email}</div>
              <div class="portal-list-meta">Requested on ${new Date(r.created_at).toLocaleDateString()}</div>
            </div>
            <div style="display: flex; gap: 0.5rem;">
              <button class="btn btn-primary btn-sm" onclick="window.approveReq('${r.id}')">Approve</button>
              <button class="btn btn-secondary btn-sm" onclick="window.denyReq('${r.id}')">Deny</button>
            </div>
          </div>
        `;
                accessRequestsList.appendChild(item);
            });
        } else {
            accessRequestsList.innerHTML = '<div class="portal-empty">No pending access requests.</div>';
        }
    };

    (window as any).approveReq = async (id: string) => {
        const { error } = await supabase.rpc('approve_admin_access_request', { request_id: id });
        if (error) alert(error.message);
        else {
            alert('Access approved successfully');
            loadRequests();
            loadAdmins();
        }
    };

    (window as any).denyReq = async (id: string) => {
        const { error } = await supabase.rpc('deny_admin_access_request', { request_id: id });
        if (error) alert(error.message);
        else {
            alert('Access request denied');
            loadRequests();
        }
    };

    loadRequests();
    loadAdmins();
}

init();
