
import { getSupabase, requireSessionOrRedirect, getUserProfile, getNotificationCount } from './supabase';
import { SERVICES, getServiceByKey } from './portal-services';
import { showToast, showModal } from './ui-utils';

interface SubmissionRow {
  id: string;
  request_no: string;
  user_id: string;
  client_email: string;
  client_full_name: string | null;
  client_phone: string | null;
  tax_year: string | null;
  notes: string | null;
  service_key: string;
  service_name: string;
  status: string;
  assigned_to: string | null;
  assigned_by: string | null;
  assigned_at: string | null;
  deadline_date: string | null;
  missing_docs: string[];
  required_docs: string[];
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

interface DocFile {
  id: string;
  doc_key: string;
  file_name: string;
  storage_path: string;
  uploaded_at: string;
}

interface MessageRow {
  id: string;
  sender: 'client' | 'admin';
  message: string;
  created_at: string;
}

async function init() {
  const session = await requireSessionOrRedirect('/portal');
  if (!session) return;

  const profile = await getUserProfile();

  if (profile && (profile.role === 'admin' || profile.role === 'super_admin')) {
    window.location.href = '/admin';
    return;
  }

  const supabase = await getSupabase();

  // Elements
  const portalUserName = document.getElementById('portalUserName')!;
  const submissionsList = document.getElementById('submissionsList')!;
  const requestDetailContent = document.getElementById('requestDetailContent')!;
  const emptyDetailState = document.getElementById('emptyDetailState')!;
  const showNewRequestBtn = document.getElementById('showNewRequestBtn')!;
  const newRequestModal = document.getElementById('newRequestModal')!;
  const cancelNewRequestBtn = document.getElementById('cancelNewRequestBtn')!;
  const newSubmissionForm = document.getElementById('newSubmissionForm') as HTMLFormElement;
  const serviceSelect = document.getElementById('serviceSelect') as HTMLSelectElement;
  const portalAdminLink = document.getElementById('portalAdminLink')!;
  const portalSignOutBtn = document.getElementById('portalSignOutBtn')!;
  const notifBadge = document.getElementById('notifBadge')!;

  const detailReqNo = document.getElementById('detailReqNo')!;
  const detailServiceName = document.getElementById('detailServiceName')!;
  const detailStatusBadge = document.getElementById('detailStatusBadge')!;
  const requestDetailCard = document.getElementById('requestDetailCard')!;
  const docsList = document.getElementById('docsList')!;
  const messageForm = document.getElementById('messageForm') as HTMLFormElement;
  const messagesList = document.getElementById('messagesList')!;
  const downloadAllBtn = document.getElementById('downloadAllBtn')!;
  const uploadProgress = document.getElementById('uploadProgress')!;
  const uploadProgressBar = document.getElementById('uploadProgressBar')!;

  let activeSubmission: SubmissionRow | null = null;
  let allSubmissions: SubmissionRow[] = [];

  // Set Profile
  if (profile) {
    portalUserName.textContent = profile.full_name || profile.email;
    const roleBadge = document.querySelector('.portal-role-badge');
    if (roleBadge) {
      roleBadge.textContent = profile.role.toUpperCase().replace('_', ' ');
      if (profile.role !== 'client') (roleBadge as HTMLElement).style.background = '#0c4a6e';
    }
    if (profile.role === 'admin' || profile.role === 'super_admin') {
      (portalAdminLink as HTMLElement).style.display = 'block';
    } else {
      (portalAdminLink as HTMLElement).style.display = 'none';
    }
  } else if (session.user) {
    portalUserName.textContent = session.user.email || 'User';
  }

  // Set Notifications
  const updateNotifs = async () => {
    const count = await getNotificationCount();
    if (count > 0) {
      notifBadge.textContent = count > 9 ? '9+' : String(count);
      notifBadge.hidden = false;
    } else {
      notifBadge.hidden = true;
    }
  };
  updateNotifs();

  // Populate Services
  SERVICES.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.key;
    opt.textContent = s.name;
    serviceSelect.appendChild(opt);
  });

  // Modal Logic
  const toggleNewRequest = (show: boolean) => {
    if (show) newRequestModal.classList.add('efiling-popup--visible');
    else newRequestModal.classList.remove('efiling-popup--visible');
  };

  showNewRequestBtn.onclick = () => toggleNewRequest(true);
  cancelNewRequestBtn.onclick = () => toggleNewRequest(false);
  document.getElementById('closeNewRequestModal')?.addEventListener('click', () => toggleNewRequest(false));
  newRequestModal.addEventListener('click', (e) => {
    if (e.target === newRequestModal) toggleNewRequest(false);
  });

  const loadSubmissions = async () => {
    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) return;
    allSubmissions = data || [];
    renderSubmissions();
  };

  const renderSubmissions = () => {
    submissionsList.innerHTML = allSubmissions.length
      ? ''
      : '<div class="portal-empty">No requests found. Start one today!</div>';

    allSubmissions.forEach(sub => {
      const item = document.createElement('div');
      item.className = `portal-list-item ${activeSubmission?.id === sub.id ? 'portal-list-item--active' : ''}`;
      item.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <div>
            <div class="portal-list-title" style="font-family: monospace;">${sub.request_no}</div>
            <div class="portal-list-meta">${sub.service_name}</div>
          </div>
          <span class="portal-badge portal-badge--${sub.status.toLowerCase().replace(/\s+/g, '')}">${sub.status}</span>
        </div>
      `;
      item.onclick = async () => {
        // If on mobile view, scroll to detail
        if (window.innerWidth < 968) {
          const detailSection = document.getElementById('requestDetailCard');
          if (detailSection) detailSection.scrollIntoView({ behavior: 'smooth' });
        }
        await selectSubmission(sub);
      };
      submissionsList.appendChild(item);
    });
  };

  // Mobile Back Logic
  const mobileBackBtn = document.createElement('button');
  mobileBackBtn.className = 'mobile-back-header btn btn-secondary';
  mobileBackBtn.innerHTML = '← Back to List';
  mobileBackBtn.style.display = 'none'; // Hidden by default
  document.body.appendChild(mobileBackBtn);

  mobileBackBtn.onclick = () => {
    const detailCard = document.getElementById('requestDetailCard');
    if (detailCard) {
      detailCard.classList.remove('mobile-detail-view');
      mobileBackBtn.style.display = 'none';
      document.body.style.overflow = ''; // Restore scroll
    }
  };

  const selectSubmission = async (sub: SubmissionRow) => {
    activeSubmission = sub;
    const items = document.querySelectorAll('.portal-list-item');
    items.forEach(i => i.classList.remove('portal-list-item--active'));
    renderSubmissions(); // Re-render to update active class

    if (emptyDetailState) emptyDetailState.hidden = true;
    if (requestDetailContent) requestDetailContent.hidden = false;

    // Populate Details
    detailReqNo.textContent = sub.request_no;
    detailServiceName.textContent = sub.service_name;
    detailStatusBadge.className = `portal-badge portal-badge--lg portal-badge--${sub.status.toLowerCase().replace(/\s+/g, '')}`;
    detailStatusBadge.textContent = sub.status;

    // Populate Info Grid
    const infoStatus = document.getElementById('infoStatus');
    const infoTaxYear = document.getElementById('infoTaxYear');
    const infoAssignee = document.getElementById('infoAssignee');
    const infoDeadline = document.getElementById('infoDeadline');

    if (infoStatus) infoStatus.textContent = sub.status;
    if (infoTaxYear) infoTaxYear.textContent = sub.tax_year || '—';
    if (infoAssignee) infoAssignee.textContent = sub.assigned_to || 'Seeking Consultant...';
    if (infoDeadline) infoDeadline.textContent = sub.deadline_date || '—';

    await loadDocsAndMessages();

    // Mobile View Toggle
    if (window.innerWidth < 968) {
      if (requestDetailCard) {
        requestDetailCard.classList.add('mobile-detail-view');
        mobileBackBtn.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // Lock background scroll
      }
    }

    // Subscribe to realtime messages for this submission
    subscribeToMessages(sub.id);
  };

  let msgSubscription: any = null;
  const subscribeToMessages = (submissionId: string) => {
    if (msgSubscription) supabase.removeChannel(msgSubscription);

    msgSubscription = supabase.channel(`messages:${submissionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'submission_messages', filter: `submission_id=eq.${submissionId}` },
        (payload: any) => {
          console.log('New message received!', payload);
          // Append new message to list
          const m = payload.new as MessageRow;
          const bubble = document.createElement('div');
          bubble.dataset.animate = "true"; // Add animation
          bubble.className = `comment-bubble comment-bubble--${m.sender} animate-in`;
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
          messagesList.appendChild(bubble);
          messagesList.scrollTop = messagesList.scrollHeight;

          // If it's from admin, show a toast
          if (m.sender === 'admin') {
            showToast('New message from Admin', 'info');
          }
        }
      )
      .subscribe();
  };

  // Global Realtime: Notifications & Submissions
  const initRealtime = () => {
    // 1. Notifications
    supabase.channel(`user-notifs:${session.user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${session.user.id}` },
        (payload: any) => {
          showToast('New Limit Notification: ' + payload.new.message, 'info');
          // Update badge if we were fetching count (we are not currently displaying dynamic count from DB, just static/local)
          const badge = document.getElementById('notifBadge');
          if (badge) {
            badge.hidden = false;
            badge.textContent = String(Number(badge.textContent || 0) + 1);
          }
        }
      )
      .subscribe();

    // 2. Submission Status Updates
    supabase.channel(`user-submissions:${session.user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'submissions', filter: `user_id=eq.${session.user.id}` },
        (payload: any) => {
          showToast(`Request ${payload.new.request_no} status updated: ${payload.new.status}`, 'info');
          // Refresh list to update status badge
          loadSubmissions();

          // If currently viewing this one, update the badge in detail view
          if (activeSubmission && activeSubmission.id === payload.new.id) {
            const badge = document.getElementById('detailStatusBadge') as HTMLElement;
            if (badge) {
              badge.className = `portal-badge portal-badge--${payload.new.status.toLowerCase().replace(/\s+/g, '')}`;
              badge.textContent = payload.new.status;
            }
            activeSubmission = payload.new as SubmissionRow;
          }
        }
      )
      .subscribe();
  };

  const loadDocsAndMessages = async () => {
    if (!activeSubmission) return;

    const [docsRes, msgsRes] = await Promise.all([
      supabase.from('submission_files').select('*').eq('submission_id', activeSubmission.id),
      supabase.from('submission_messages').select('*').eq('submission_id', activeSubmission.id).order('created_at', { ascending: true })
    ]);

    renderDocs(docsRes.data || []);
    renderMessages(msgsRes.data || []);
  };

  // Helper for button loading
  const setLoading = (btn: HTMLButtonElement, isLoading: boolean) => {
    btn.disabled = isLoading;
    const spinner = btn.querySelector('.btn-spinner');
    if (spinner) {
      if (isLoading) spinner.classList.add('btn-spinner--active');
      else spinner.classList.remove('btn-spinner--active');
    }
  };

  const renderDocs = (uploadedFiles: DocFile[]) => {
    const service = getServiceByKey(activeSubmission!.service_key)!;
    docsList.innerHTML = '';

    // Header for docs section
    const header = document.createElement('div');
    header.className = 'portal-docs-header';

    service.requiredDocs.forEach(def => {
      const file = uploadedFiles.find(f => f.doc_key === def.key);
      const ext = file ? file.file_name.split('.').pop()?.toUpperCase() || 'FILE' : '—';

      const row = document.createElement('div');
      row.className = 'portal-doc-row';
      row.innerHTML = `
        <div style="display: flex; align-items: center; gap: 1rem;">
          <div class="doc-icon">${ext}</div>
          <div>
            <div class="portal-doc-title" style="font-weight: 700; color: var(--text);">${def.label}</div>
            <div class="portal-doc-hint" style="font-size: 0.8rem; color: var(--text-muted);">${file ? file.file_name : 'No file uploaded'}</div>
          </div>
        </div>
        <div class="portal-doc-right" style="display: flex; gap: 0.5rem;">
          ${file ?
          `<button class="btn btn-secondary btn-sm" onclick="window.downloadFile('${file.storage_path}', '${file.file_name}')" style="padding: 0.4rem 0.8rem;">Download</button>
           <button class="btn btn-danger btn-sm" onclick="window.removeFile('${file.id}', '${file.storage_path}')" title="Remove" style="padding: 0.4rem 0.8rem;">&times;</button>` :
          `<div class="portal-doc-upload-btn btn btn-primary btn-sm" style="padding: 0.4rem 0.8rem;">
               Upload
               <input type="file" class="portal-doc-upload-input" onchange="window.handleUpload(event, '${def.key}')">
             </div>`
        }
        </div>
      `;
      docsList.appendChild(row);
    });

    // Add "Submit Documents" button if at least one file is uploaded
    if (uploadedFiles.length > 0) {
      const submitDiv = document.createElement('div');
      submitDiv.style.marginTop = '1.5rem';
      submitDiv.style.textAlign = 'right';
      submitDiv.innerHTML = `
            <button class="btn btn-primary" id="submitDocsBtn">
                <span class="btn-text">Submit Documents for Review</span>
                <span class="btn-spinner"></span>
            </button>
        `;
      docsList.appendChild(submitDiv);

      const submitBtn = submitDiv.querySelector('#submitDocsBtn') as HTMLButtonElement;
      submitBtn.onclick = () => {
        showModal(
          "Confirm Submission",
          "Are you sure you have uploaded all necessary documents? This will notify the admin to review your case.",
          async () => {
            setLoading(submitBtn, true);
            try {
              // Notify Admin
              await sendNotify(
                'info@simplicontax.com',
                `Documents Submitted: ${activeSubmission?.request_no}`,
                `Client ${session.user.email} has submitted documents for request ${activeSubmission?.request_no}.\n\nPlease review them in the admin panel.`
              );

              showToast('Documents submitted successfully. Admin notified.', 'success');
            } catch (e) {
              showToast('Failed to submit.', 'error');
            } finally {
              setLoading(submitBtn, false);
            }
          },
          "Yes, Submit Documents",
          "Cancel"
        );
      };
    }
  };

  // Remove File Logic
  (window as any).removeFile = async (fileId: string, storagePath: string) => {
    if (!confirm('Are you sure you want to remove this file?')) return;

    // Show some loading state? using toast for now
    showToast('Removing file...', 'info');

    try {
      // 1. Remove from Storage
      const { error: storageError } = await supabase.storage.from('documents').remove([storagePath]);
      if (storageError) console.error('Storage remove warning:', storageError); // sometimes file doesn't exist but db does

      // 2. Remove from DB
      const { error: dbError } = await supabase.from('submission_files').delete().eq('id', fileId);
      if (dbError) throw dbError;

      showToast('File removed', 'success');
      loadDocsAndMessages(); // Reload list
    } catch (err: any) {
      showToast('Failed to remove file: ' + err.message, 'error');
    }
  };

  const renderMessages = (msgs: MessageRow[]) => {
    messagesList.innerHTML = msgs.length ? '' : '<div class="portal-empty">The activity timeline is currently empty.</div>';
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
      messagesList.appendChild(bubble);
    });
    messagesList.scrollTop = messagesList.scrollHeight;
  };

  // Upload Logic
  (window as any).handleUpload = async (e: Event, docKey: string) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file || !activeSubmission) return;

    uploadProgress.hidden = false;
    (uploadProgressBar as HTMLElement).style.width = '10%';

    const path = `${session.user.id}/${activeSubmission.id}/${docKey}/${Date.now()}-${file.name}`;

    try {
      const { error: uploadError } = await supabase.storage.from('documents').upload(path, file);
      if (uploadError) throw uploadError;
      (uploadProgressBar as HTMLElement).style.width = '60%';

      const { error: dbError } = await supabase.from('submission_files').insert({
        submission_id: activeSubmission.id,
        doc_key: docKey,
        file_name: file.name,
        storage_path: path,
        mime_type: file.type,
        size_bytes: file.size
      });
      if (dbError) throw dbError;

      (uploadProgressBar as HTMLElement).style.width = '100%';
      setTimeout(() => {
        uploadProgress.hidden = true;
        loadDocsAndMessages();
        showToast('File uploaded successfully', 'success');
      }, 1000);
    } catch (err: any) {
      showToast('Upload failed: ' + err.message, 'error');
      uploadProgress.hidden = true;
    }
  };

  // Download Logic
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

  downloadAllBtn.onclick = async () => {
    if (!activeSubmission) return;
    const { data } = await supabase.from('submission_files').select('*').eq('submission_id', activeSubmission.id);
    if (!data || data.length === 0) return showToast('No files to download', 'info');

    for (const file of data) {
      await (window as any).downloadFile(file.storage_path, file.file_name);
      await new Promise(r => setTimeout(r, 500));
    }
  };

  // New Submission
  newSubmissionForm.onsubmit = async (e) => {
    e.preventDefault();
    const serviceKey = serviceSelect.value;
    if (!serviceKey) return;

    const service = getServiceByKey(serviceKey)!;
    const serviceId = serviceSelect.value;
    const taxYear = (document.getElementById('taxYear') as HTMLSelectElement).value;
    const deadline = (document.getElementById('deadlineDate') as HTMLInputElement).value;
    const fullName = (document.getElementById('clientFullName') as HTMLInputElement).value;

    // Combine Country Code + Phone
    const countryCode = (document.getElementById('countryCode') as HTMLSelectElement).value;
    const phoneInput = (document.getElementById('clientPhone') as HTMLInputElement).value;
    const phone = countryCode && phoneInput ? `${countryCode}-${phoneInput}` : phoneInput;

    const notes = (document.getElementById('requestNotes') as HTMLTextAreaElement).value;

    if (!serviceId || !fullName || !phoneInput || !countryCode) {
      return showToast('Please fill in all required fields.', 'error');
    }

    const btn = document.getElementById('createSubmissionBtn') as HTMLButtonElement;
    setLoading(btn, true);

    const { data, error } = await supabase
      .from('submissions')
      .insert({
        user_id: session.user.id,
        client_email: session.user.email,
        client_full_name: fullName,
        client_phone: phone,
        tax_year: taxYear,
        notes: notes,
        service_key: serviceKey,
        service_name: service.name,
        required_docs: service.requiredDocs.map(d => d.key),
        status: 'Open',
        deadline_date: deadline || null
      })
      .select()
      .single();

    if (error) {
      showToast('Failed to create request: ' + error.message, 'error');
    } else {
      showToast('Request created successfully', 'success');
      newRequestModal.classList.remove('efiling-popup--visible');
      await loadSubmissions();
      if (data) selectSubmission(data);

      sendNotify(
        session.user.email || '',
        `Request Received: ${data.request_no}`,
        `Dear ${fullName || 'Client'},\n\nWe have received your new request (${data.request_no}) for ${service.name}.\n\nA member of our team has been notified and will review your details shortly.\n\nYou can track the status and upload documents via the portal.`
      );

      sendNotify(
        'info@simplicontax.com',
        `New Request: ${data.request_no}`,
        `A new request has been created by ${session.user.email}.\n\nService: ${service.name}\nRequest No: ${data.request_no}\n\nPlease log in to the admin panel to review and assign this case.`
      );
    }

    setLoading(btn, false);
  };

  async function sendNotify(to: string, subject: string, body: string) {
    try {
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, body })
      });
    } catch (e) {
      console.error('Notify failed', e);
    }
  }

  // Messages
  messageForm.onsubmit = async (e) => {
    e.preventDefault();
    const text = (document.getElementById('messageText') as HTMLTextAreaElement).value.trim();
    if (!text || !activeSubmission) return;

    const { error } = await supabase.from('submission_messages').insert({
      submission_id: activeSubmission.id,
      sender: 'client',
      message: text
    });

    if (!error) {
      (document.getElementById('messageText') as HTMLTextAreaElement).value = '';
      showToast('Message sent', 'success');
      sendNotify(
        'info@simplicontax.com',
        `New Comment: ${activeSubmission.request_no}`,
        `Client ${activeSubmission.client_email} commented on request ${activeSubmission.request_no}:\n\n"${text}"`
      );
      loadDocsAndMessages();
    } else {
      showToast('Failed to send message', 'error');
    }
  };

  portalSignOutBtn.onclick = async () => {
    await supabase.auth.signOut();
    window.location.href = '/auth';
  };

  // Update Password Logic
  const updatePasswordModal = document.getElementById('updatePasswordModal');
  const updatePasswordForm = document.getElementById('updatePasswordForm');
  const closeUpdatePasswordModal = document.getElementById('closeUpdatePasswordModal');

  if (updatePasswordModal && updatePasswordForm) {
    const toggleUpdatePassword = (show: boolean) => {
      if (show) updatePasswordModal.classList.add('efiling-popup--visible');
      else updatePasswordModal.classList.remove('efiling-popup--visible');
    };

    closeUpdatePasswordModal?.addEventListener('click', () => toggleUpdatePassword(false));

    // Auto-open if ?reset=true
    const params = new URLSearchParams(window.location.search);
    if (params.get('reset') === 'true') {
      toggleUpdatePassword(true);
      // Clean URL
      window.history.replaceState({}, '', '/portal');
    }

    updatePasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const p1 = (document.getElementById('newPassword') as HTMLInputElement).value;
      const p2 = (document.getElementById('confirmNewPassword') as HTMLInputElement).value;
      const btn = document.getElementById('updatePasswordBtn') as HTMLButtonElement;

      if (p1.length < 8) return showToast('Password must be at least 8 characters', 'error');
      if (p1 !== p2) return showToast('Passwords do not match', 'error');

      btn.disabled = true;
      const originalText = btn.innerHTML;
      btn.innerHTML = '<span class="btn-spinner btn-spinner--active"></span> Updating...';

      try {
        const { error } = await supabase.auth.updateUser({ password: p1 });
        if (error) throw error;

        showToast('Password updated successfully', 'success');
        toggleUpdatePassword(false);
      } catch (err: any) {
        showToast(err.message || 'Failed to update password', 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    });
  }

  initRealtime();
  loadSubmissions();
}

init();
