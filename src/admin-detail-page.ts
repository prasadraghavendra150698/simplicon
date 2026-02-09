
import { getSupabase, requireSessionOrRedirect, isAdmin, isLeadAdmin, getUserProfile } from './supabase';
import { showToast, showModal } from './ui-utils';

async function init() {
    const session = await requireSessionOrRedirect('/admin-ticket');
    if (!session) return;

    const ok = await isAdmin();
    if (!ok) {
        window.location.href = '/portal';
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const ticketId = params.get('id');
    if (!ticketId) {
        window.location.href = '/admin';
        return;
    }

    const supabase = await getSupabase();
    const lead = await isLeadAdmin();
    const profile = await getUserProfile();

    // Elements
    const ticketNoHeader = document.getElementById('ticketNoHeader')!;
    const ticketServiceName = document.getElementById('ticketServiceName')!;
    const ticketStatusBadge = document.getElementById('ticketStatusBadge')!;
    const ticketClientEmail = document.getElementById('ticketClientEmail')!;
    const ticketCreatedDate = document.getElementById('ticketCreatedDate')!;
    const ticketAssignee = document.getElementById('ticketAssignee')!;
    const ticketAssigneeSide = document.getElementById('ticketAssigneeSide')!;
    const ticketDeadline = document.getElementById('ticketDeadline')!;
    const ticketClientFullName = document.getElementById('ticketClientFullName')!;
    const ticketTaxYear = document.getElementById('ticketTaxYear')!;
    const ticketClientPhone = document.getElementById('ticketClientPhone')!;
    const clientMailLink = document.getElementById('clientMailLink') as HTMLAnchorElement;
    const clientPhoneLink = document.getElementById('clientPhoneLink') as HTMLAnchorElement;
    const ticketNotes = document.getElementById('ticketNotes')!;

    const ticketDocsList = document.getElementById('ticketDocsList')!;
    const ticketMessagesList = document.getElementById('ticketMessagesList')!;
    const ticketMessageForm = document.getElementById('ticketMessageForm') as HTMLFormElement;
    const ticketMessageText = document.getElementById('ticketMessageText') as HTMLTextAreaElement;

    const statusSelect = document.getElementById('statusSelect') as HTMLSelectElement;
    const updateStatusBtn = document.getElementById('updateStatusBtn')!;

    const assignmentToolsCard = document.getElementById('assignmentToolsCard')!;
    const assigneeSelect = document.getElementById('assigneeSelect') as HTMLSelectElement;
    const reassignBtn = document.getElementById('reassignBtn')!;

    // Profile Header
    if (profile) {
        (document.getElementById('adminUserName') as HTMLElement).textContent = profile.full_name || profile.email;
        (document.getElementById('adminRoleBadge') as HTMLElement).textContent = profile.role.toUpperCase().replace('_', ' ');
        if (lead) {
            const leadAdminMenu = document.getElementById('leadAdminMenu');
            if (leadAdminMenu) leadAdminMenu.hidden = false;
        }
    }

    // Load Ticket Data
    const loadTicket = async () => {
        const { data: ticket, error } = await supabase
            .from('submissions')
            .select('*')
            .eq('id', ticketId)
            .single();

        if (error || !ticket) {
            showToast('Ticket not found', 'error');
            setTimeout(() => window.location.href = '/admin', 2000);
            return;
        }

        ticketNoHeader.textContent = ticket.request_no;
        ticketServiceName.textContent = ticket.service_name;
        ticketStatusBadge.textContent = ticket.status;
        ticketStatusBadge.className = `portal-badge portal-badge--${ticket.status.toLowerCase().replace(/\s+/g, '')}`;
        ticketClientEmail.textContent = ticket.client_email;
        ticketClientFullName.textContent = ticket.client_full_name || '—';
        ticketCreatedDate.textContent = new Date(ticket.created_at).toLocaleDateString();
        ticketAssignee.textContent = ticket.assigned_to || 'Unassigned';
        ticketAssigneeSide.textContent = ticket.assigned_to || 'Unassigned';
        ticketDeadline.textContent = ticket.deadline_date || '—';
        ticketTaxYear.textContent = ticket.tax_year || '—';
        ticketClientPhone.textContent = ticket.client_phone || '—';
        ticketNotes.textContent = ticket.notes || 'No notes provided.';

        if (clientMailLink) clientMailLink.href = `mailto:${ticket.client_email}`;
        if (clientPhoneLink && ticket.client_phone) clientPhoneLink.href = `tel:${ticket.client_phone}`;
        else if (clientPhoneLink) clientPhoneLink.style.display = 'none';

        statusSelect.value = ticket.status;
        assigneeSelect.value = ticket.assigned_to?.toLowerCase() || '';

        // Constraints
        if (ticket.status === 'Closed' && !lead) {
            statusSelect.disabled = true;
            (updateStatusBtn as HTMLButtonElement).disabled = true;
        }

        if (lead) {
            assignmentToolsCard.hidden = false;
        }

        loadDocsAndMessages();
    };

    const loadDocsAndMessages = async () => {
        const [docs, msgs] = await Promise.all([
            supabase.from('submission_files').select('*').eq('submission_id', ticketId),
            supabase.from('submission_messages').select('*').eq('submission_id', ticketId).order('created_at', { ascending: true })
        ]);

        renderDocs(docs.data || []);
        renderMessages(msgs.data || []);
    };

    const renderDocs = (files: any[]) => {
        ticketDocsList.innerHTML = files.length ? '' : '<div class="portal-empty">No documents found. Our consultants will upload shared files here.</div>';
        files.forEach(f => {
            const ext = f.file_name.split('.').pop()?.toUpperCase() || 'FILE';
            const row = document.createElement('div');
            row.className = 'portal-doc-row';
            row.innerHTML = `
        <div style="display: flex; align-items: center; gap: 1rem;">
          <div class="doc-icon">${ext}</div>
          <div>
            <div class="portal-doc-title" style="font-weight: 700; color: var(--text);">${f.doc_key.replace('_', ' ')}</div>
            <div class="portal-doc-hint" style="font-size: 0.8rem; color: var(--text-muted);">${f.file_name} (${(f.size_bytes / 1024 / 1024).toFixed(2)} MB)</div>
          </div>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="window.downloadFile('${f.storage_path}', '${f.file_name}')">Download</button>
      `;
            ticketDocsList.appendChild(row);
        });
    };

    const renderMessages = (msgs: any[]) => {
        ticketMessagesList.innerHTML = msgs.length ? '' : '<div class="portal-empty">The activity timeline is currently empty.</div>';
        msgs.forEach(m => {
            const bubble = document.createElement('div');
            bubble.className = `comment-bubble comment-bubble--${m.sender}`;
            const dateStr = new Date(m.created_at).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            bubble.innerHTML = `
        <div class="comment-meta">
            <span>${m.sender === 'admin' ? 'Consultant' : 'Client'}</span>
            <span>${dateStr}</span>
        </div>
        <div class="comment-text">${m.message}</div>
      `;
            ticketMessagesList.appendChild(bubble);
        });
        ticketMessagesList.scrollTop = ticketMessagesList.scrollHeight;
    };

    async function sendNotify(to: string, subject: string, body: string) {
        try {
            await fetch('/api/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to, subject, body })
            });
        } catch (e) {
            console.error('Email notify failed', e);
        }
    }

    // Actions
    updateStatusBtn.onclick = async () => {
        const status = statusSelect.value;
        const reqNo = ticketNoHeader.textContent;
        const clientEmail = ticketClientEmail.textContent;

        const { error } = await supabase.from('submissions').update({ status }).eq('id', ticketId);
        if (error) showToast(error.message, 'error');
        else {
            showToast('Status updated successfully', 'success');
            if (clientEmail) {
                // Update email text to be more professional
                sendNotify(
                    clientEmail,
                    `Status Update: Ticket ${reqNo}`,
                    `Your ticket ${reqNo} status has been updated to: ${status}.\n\nPlease log in to the portal to view the details.`
                );
            }
            loadTicket();
        }
    };

    ticketMessageForm.onsubmit = async (e) => {
        e.preventDefault();
        const text = ticketMessageText.value.trim();
        if (!text) return;
        const reqNo = ticketNoHeader.textContent;
        const clientEmail = ticketClientEmail.textContent;

        const { error } = await supabase.from('submission_messages').insert({
            submission_id: ticketId,
            sender: 'admin',
            message: text
        });

        if (!error) {
            ticketMessageText.value = '';
            showToast('Comment posted successfully', 'success');
            if (clientEmail) {
                // Professional Email content
                sendNotify(
                    clientEmail,
                    `New Message: Ticket ${reqNo}`,
                    `Dear Client,\n\nWe have posted a new comment on your request #${reqNo}.\n\nMessage:\n"${text}"\n\nPlease log in to your portal to review the full details and provide a response if necessary.`
                );
            }
            loadDocsAndMessages();
        } else {
            showToast('Failed to post comment', 'error');
        }
    };

    // Upload Logic (Admin Side)
    const adminFileUpload = document.getElementById('adminFileUpload') as HTMLInputElement;
    adminFileUpload.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;

        const progress = document.getElementById('adminUploadProgress')!;
        const fill = document.getElementById('adminUploadFill')!;
        progress.hidden = false;
        fill.style.width = '20%';

        const path = `admin-shared/${ticketId}/${Date.now()}-${file.name}`;

        try {
            const { error: uploadError } = await supabase.storage.from('documents').upload(path, file);
            if (uploadError) throw uploadError;
            fill.style.width = '60%';

            const { error: dbError } = await supabase.from('submission_files').insert({
                submission_id: ticketId,
                doc_key: 'ADMIN_UPLOAD',
                file_name: file.name,
                storage_path: path,
                mime_type: file.type,
                size_bytes: file.size
            });
            if (dbError) throw dbError;

            fill.style.width = '100%';
            setTimeout(() => {
                progress.hidden = true;
                loadDocsAndMessages();
                showToast('File uploaded successfully', 'success');
            }, 800);
        } catch (err: any) {
            showToast('Failed: ' + err.message, 'error');
            progress.hidden = true;
        }
    };

    // Download All
    document.getElementById('downloadAllBtn')!.onclick = async () => {
        const { data } = await supabase.from('submission_files').select('*').eq('submission_id', ticketId);
        if (!data?.length) return showToast('Nothing to download', 'info');

        for (const f of data) {
            await (window as any).downloadFile(f.storage_path, f.file_name);
            await new Promise(r => setTimeout(r, 600));
        }
    };

    (window as any).downloadFile = async (path: string, fileName: string) => {
        const { data, error } = await supabase.storage.from('documents').download(path);
        if (!error && data) {
            const blob = data;
            const url = window.URL.createObjectURL(blob);
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

    const loadAdmins = async () => {
        const { data } = await supabase.rpc('list_admins');
        if (data) {
            assigneeSelect.innerHTML = '<option value="">Select Admin</option>';
            data.forEach((a: any) => {
                const opt = document.createElement('option');
                opt.value = a.email.toLowerCase();
                opt.textContent = a.email.toLowerCase();
                assigneeSelect.appendChild(opt);
            });
        }
    };

    reassignBtn.onclick = async () => {
        const email = assigneeSelect.value;
        if (!email) return;

        showModal('Confirm Reassignment', `Are you sure you want to reassign this case to ${email}?`, async () => {
            const { error } = await supabase.rpc('assign_submission', {
                submission_id: ticketId,
                new_admin_email: email
            });
            if (error) showToast(error.message, 'error');
            else {
                showToast('Case reassigned successfully', 'success');
                loadTicket();
            }
        });
    };

    (document.getElementById('adminSignOutBtn') as HTMLElement).onclick = async () => {
        await supabase.auth.signOut();
        window.location.href = '/auth';
    };

    loadTicket();
    if (lead) loadAdmins();
}

init();
