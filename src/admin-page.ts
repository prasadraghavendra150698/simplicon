import { getSupabase, requireSessionOrRedirect, isAdmin, isLeadAdmin, getUserProfile, getNotificationCount } from './supabase';
import { showToast } from './ui-utils';


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

  // Header Elements
  const adminUserName = document.getElementById('adminUserName')!;
  const adminRoleBadge = document.getElementById('adminRoleBadge')!;
  const adminSignOutBtn = document.getElementById('adminSignOutBtn')!;
  const adminNotifBadge = document.getElementById('adminNotifBadge')!;
  const usersMenuLink = document.getElementById('usersMenuLink')!;

  // Stats Elements
  const statsTotal = document.getElementById('statsTotal')!;
  const statsAssigned = document.getElementById('statsAssigned')!;
  const statsPending = document.getElementById('statsPending')!;
  const statsCompleted = document.getElementById('statsCompleted')!;

  // Detail View Elements
  const adminRequestDetail = document.getElementById('adminRequestDetail')!;
  const adminEmptyState = document.getElementById('adminEmptyState')!;
  const adminDetailReqNo = document.getElementById('adminDetailReqNo')!;
  const adminDetailClient = document.getElementById('adminDetailClient')!;
  const adminStatusSelect = document.getElementById('adminStatusSelect') as HTMLSelectElement;
  const saveAdminStatusBtn = document.getElementById('saveAdminStatusBtn')!;
  const adminDocsList = document.getElementById('adminDocsList')!;
  const adminMessagesList = document.getElementById('adminMessagesList')!;
  const adminMessageForm = document.getElementById('adminMessageForm') as HTMLFormElement;
  const adminMessageText = document.getElementById('adminMessageText') as HTMLTextAreaElement;
  const assignToSelect = document.getElementById('assignToSelect') as HTMLSelectElement;
  const assignBtn = document.getElementById('assignBtn')!;
  const assignmentCard = document.getElementById('assignmentCard')!;

  let activeSubmissionId: string | null = null;
  let allAdmins: { email: string }[] = [];

  // Init UI
  if (profile) {
    adminUserName.textContent = profile.full_name || profile.email;
    adminRoleBadge.textContent = profile.role.replace('_', ' ');
    if (lead) usersMenuLink.hidden = false;
  } else if (session.user) {
    adminUserName.textContent = session.user.email || 'Admin';
  }

  const updateNotifs = async () => {
    const count = await getNotificationCount();
    if (count > 0) {
      adminNotifBadge.textContent = String(count);
      adminNotifBadge.hidden = false;
    }
  };
  updateNotifs();

  const loadStats = async () => {
    const { data: rows } = await supabase.from('submissions').select('status, assigned_to');
    if (!rows) return;

    const myEmail = session.user.email?.toLowerCase();
    statsTotal.textContent = String(rows.length);
    statsAssigned.textContent = String(rows.filter((r: any) => r.assigned_to?.toLowerCase() === myEmail).length);
    statsPending.textContent = String(rows.filter((r: any) => ['Open', 'Pending'].includes(r.status)).length);
    statsCompleted.textContent = String(rows.filter((r: any) => r.status === 'Completed').length);
  };

  const loadAdmins = async () => {
    const { data } = await supabase.rpc('list_admins');
    allAdmins = data || [];
    allAdmins.forEach(a => {
      const opt = document.createElement('option');
      opt.value = a.email.toLowerCase();
      opt.textContent = a.email.toLowerCase();
      assignToSelect.appendChild(opt);
    });
  };

  const selectSubmission = async (id: string) => {
    activeSubmissionId = id;
    adminEmptyState.hidden = true;
    adminRequestDetail.hidden = false;
    assignmentCard.hidden = false;

    const { data: sub } = await supabase.from('submissions').select('*').eq('id', id).single();
    if (sub) {
      adminDetailReqNo.textContent = sub.request_no;
      adminDetailClient.textContent = `Client: ${sub.client_email}`;
      adminStatusSelect.value = sub.status;
      assignToSelect.value = sub.assigned_to?.toLowerCase() || '';

      // Re-enable assignment only for lead
      if (lead) {
        assignToSelect.disabled = false;
        (assignBtn as HTMLButtonElement).disabled = false;
      }

      // If closed, disable status edit unless lead
      adminStatusSelect.disabled = (sub.status === 'Closed' && !lead);
      (saveAdminStatusBtn as HTMLButtonElement).disabled = (sub.status === 'Closed' && !lead);

      loadDocsAndMessages(id);
    }
  };

  const loadDocsAndMessages = async (id: string) => {
    const [docs, msgs] = await Promise.all([
      supabase.from('submission_files').select('*').eq('submission_id', id),
      supabase.from('submission_messages').select('*').eq('submission_id', id).order('created_at', { ascending: true })
    ]);

    renderAdminDocs(docs.data || []);
    renderAdminMessages(msgs.data || []);
  };

  const renderAdminDocs = (files: any[]) => {
    adminDocsList.innerHTML = files.length ? '' : '<div class="portal-empty">No files uploaded.</div>';
    files.forEach(f => {
      const row = document.createElement('div');
      row.className = 'portal-doc-row';
      row.innerHTML = `
        <div class="portal-doc-left">
          <div class="portal-doc-title">${f.doc_key}</div>
          <div class="portal-doc-hint">${f.file_name} (${(f.size_bytes / 1024 / 1024).toFixed(2)} MB)</div>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="window.downloadFile('${f.storage_path}', '${f.file_name}')">Download</button>
      `;
      adminDocsList.appendChild(row);
    });
  };

  const renderAdminMessages = (msgs: any[]) => {
    adminMessagesList.innerHTML = msgs.length ? '' : '<div class="portal-empty">No activity yet.</div>';
    msgs.forEach(m => {
      const bubble = document.createElement('div');
      bubble.className = `comment-bubble comment-bubble--${m.sender}`;
      bubble.innerHTML = `
        <div class="comment-meta">${m.sender.toUpperCase()} • ${new Date(m.created_at).toLocaleString()}</div>
        <div class="comment-text">${m.message}</div>
      `;
      adminMessagesList.appendChild(bubble);
    });
    adminMessagesList.scrollTop = adminMessagesList.scrollHeight;
  };

  // Status Update
  saveAdminStatusBtn.onclick = async () => {
    if (!activeSubmissionId) return;
    const status = adminStatusSelect.value;
    const { error } = await supabase.from('submissions').update({ status }).eq('id', activeSubmissionId);
    if (error) alert(error.message);
    else {
      alert('Status updated');
      loadStats();
    }
  };

  // Message Send
  adminMessageForm.onsubmit = async (e) => {
    e.preventDefault();
    const text = adminMessageText.value.trim();
    if (!text || !activeSubmissionId) return;

    const { error } = await supabase.from('submission_messages').insert({
      submission_id: activeSubmissionId,
      sender: 'admin',
      message: text
    });

    if (!error) {
      adminMessageText.value = '';
      loadDocsAndMessages(activeSubmissionId);
    }
  };

  // Assignment
  assignBtn.onclick = async () => {
    if (!activeSubmissionId) return;
    const email = assignToSelect.value;
    const { error } = await supabase.rpc('assign_submission', {
      submission_id: activeSubmissionId,
      new_admin_email: email
    });

    if (error) alert(error.message);
    else {
      alert('Case reassigned');
      loadStats();
    }
  };

  // Sign out
  adminSignOutBtn.onclick = async () => {
    await supabase.auth.signOut();
    window.location.href = '/auth';
  };

  // Load access requests
  const loadAccessRequests = async () => {
    const { data } = await supabase.from('admin_access_requests').select('*').eq('status', 'pending');
    const list = document.getElementById('accessRequestsList')!;
    list.innerHTML = data?.length ? '' : '<div class="portal-empty">No pending approvals.</div>';
    data?.forEach((r: any) => {
      const item = document.createElement('div');
      item.className = 'portal-list-item';
      item.innerHTML = `
        <div class="portal-list-title">${r.email}</div>
        <div class="portal-admin-actions" style="margin-top: 0.5rem;">
          <button class="btn btn-primary btn-sm" onclick="window.approveReq('${r.id}')">Approve</button>
          <button class="btn btn-secondary btn-sm" onclick="window.denyReq('${r.id}')">Deny</button>
        </div>
      `;
      list.appendChild(item);
    });
  };

  (window as any).approveReq = async (id: string) => {
    const { error } = await supabase.rpc('approve_admin_access_request', { request_id: id });
    if (error) alert(error.message);
    else loadAccessRequests();
  };

  (window as any).denyReq = async (id: string) => {
    const { error } = await supabase.rpc('deny_admin_access_request', { request_id: id });
    if (error) alert(error.message);
    else loadAccessRequests();
  };

  (window as any).downloadFile = async (path: string, fileName: string) => {
    const { data, error } = await supabase.storage.from('documents').download(path);
    if (!error && data) {
      const url = window.URL.createObjectURL(data);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } else {
      showToast('Failed to download file', 'error');
    }
  };

  // Handle direct ID navigation if coming from list
  const params = new URLSearchParams(window.location.search);
  const subId = params.get('id');
  if (subId) selectSubmission(subId);

  loadStats();
  loadAdmins();
  loadAccessRequests();
}

init();
