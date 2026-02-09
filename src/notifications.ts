
import { getSupabase } from './supabase';

export function initNotifications(): void {
    const bellBtn = document.getElementById('navNotificationsBtn');
    const overlay = document.getElementById('notificationOverlay');
    const closeBtn = document.getElementById('notificationClose');
    const badge = document.getElementById('navNotificationsBadge');
    const list = document.getElementById('notificationList');
    const markReadBtn = document.getElementById('markReadBtn');

    if (!bellBtn || !overlay || !closeBtn || !list) return;

    // Toggle Popup
    function togglePopup(show: boolean) {
        if (show) {
            overlay?.classList.add('efiling-popup--visible');
            document.body.style.overflow = 'hidden';
            if (unreadCount > 0) markAllRead(); // distinct from "Mark all as read" button? Maybe just fetching fresh is enough
        } else {
            overlay?.classList.remove('efiling-popup--visible');
            document.body.style.overflow = '';
        }
    }

    bellBtn.addEventListener('click', () => togglePopup(true));
    closeBtn.addEventListener('click', () => togglePopup(false));

    // Close on outside click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) togglePopup(false);
    });

    let unreadCount = 0;
    let notifications: any[] = [];

    async function fetchNotifications() {
        const supabase = await getSupabase();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(20);

        if (data) {
            notifications = data;
            unreadCount = notifications.filter(n => !n.is_read).length;
            updateBadge();
            renderNotifications();
        }
    }

    function updateBadge() {
        if (!badge) return;
        if (unreadCount > 0) {
            badge.textContent = String(unreadCount);
            badge.hidden = false;
        } else {
            badge.hidden = true;
        }
    }

    function timeAgo(dateStr: string) {
        const date = new Date(dateStr);
        const now = new Date();
        const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (seconds < 60) return 'Just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }

    function renderNotifications() {
        if (!list) return;
        list.innerHTML = '';

        if (notifications.length === 0) {
            list.innerHTML = '<div class="portal-empty">No notifications</div>';
            return;
        }

        notifications.forEach(n => {
            const item = document.createElement('div');
            item.className = `portal-list-item ${!n.is_read ? 'notification-unread' : ''}`;
            item.style.borderLeft = !n.is_read ? '3px solid var(--primary)' : '1px solid var(--border)';
            item.innerHTML = `
            <div style="font-weight:700; font-size: 0.95rem; display: flex; justify-content: space-between;">
                <span>${n.title}</span>
                ${!n.is_read ? '<span style="width: 8px; height: 8px; background: red; border-radius: 50%; display: inline-block;"></span>' : ''}
            </div>
            <div style="font-size: 0.85rem; color: var(--text-muted); margin: 0.2rem 0;">${n.content || ''}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); text-align: right;">${timeAgo(n.created_at)}</div>
        `;
            item.onclick = async () => {
                // If linked to a submission, go there
                // Also mark as read
                if (!n.is_read) {
                    await markAsRead(n.id);
                }
                if (n.submission_id) {
                    // Check if we are admin or client to determine redirect URL?
                    // Currently assuming standard routes: /portal or /admin-ticket
                    // But this script runs on both.
                    // Simple heuristic: if window.location.href includes 'admin', go to admin-ticket
                    if (window.location.href.includes('admin')) {
                        window.location.href = `/admin-ticket?id=${n.submission_id}`;
                    } else {
                        // Client portal uses SPA-like logic mostly but query param select supported?
                        // Actually portal.html doesn't support ?id= param selection yet fully (it does in my recent update to select active).
                        // But portal logic needs to handle it.
                        // For now, let's just reload or redirect.
                        window.location.href = `/portal?id=${n.submission_id}`;
                    }
                }
            };
            list.appendChild(item);
        });
    }

    async function markAsRead(id: string) {
        const supabase = await getSupabase();
        await supabase.from('notifications').update({ is_read: true }).eq('id', id);
        // Local update
        const n = notifications.find(x => x.id === id);
        if (n && !n.is_read) {
            n.is_read = true;
            unreadCount--;
            updateBadge();
            renderNotifications();
        }
    }

    async function markAllRead() {
        const supabase = await getSupabase();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id);
        notifications.forEach(n => n.is_read = true);
        unreadCount = 0;
        updateBadge();
        renderNotifications();
    }

    markReadBtn?.addEventListener('click', markAllRead);

    // Realtime Subscription
    async function subscribe() {
        const supabase = await getSupabase();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        supabase.channel(`my-notifications:${user.id}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
                (payload: any) => {
                    // Add new notification to top
                    notifications.unshift(payload.new);
                    unreadCount++;
                    updateBadge();
                    renderNotifications();

                    // Also show a toast?
                    // showToast(payload.new.title, 'info'); // Need to import showToast
                }
            )
            .subscribe();
    }

    // Init
    fetchNotifications();
    subscribe();
}
