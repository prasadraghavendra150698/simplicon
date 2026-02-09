
export function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
    // Remove existing toasts
    const existing = document.querySelectorAll('.toast-notification');
    existing.forEach(e => e.remove());

    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.innerHTML = `
        <div class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</div>
        <div class="toast-message">${message}</div>
    `;

    document.body.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add('toast-visible');
    });

    setTimeout(() => {
        toast.classList.remove('toast-visible');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

export function showModal(
    title: string,
    message: string,
    onConfirm?: () => void,
    confirmText: string = 'OK',
    cancelText: string = 'Cancel'
) {
    // Create modal DOM
    const overlay = document.createElement('div');
    overlay.className = 'efiling-popup-overlay efiling-popup--visible';
    overlay.style.zIndex = '100000'; // Ensure on top

    const popup = document.createElement('div');
    popup.className = 'efiling-popup';

    // Inject Styles if needed dynamically or rely on CSS
    const buttonsHtml = onConfirm
        ? `<button class="btn btn-secondary btn-cancel" style="margin-right: 1rem;">${cancelText}</button>
           <button class="btn btn-primary btn-confirm">${confirmText}</button>`
        : `<button class="btn btn-primary btn-confirm" style="min-width: 100px;">${confirmText}</button>`;

    popup.innerHTML = `
        <button class="efiling-popup-close">×</button>
        <h3 class="efiling-popup-title">${title}</h3>
        <p class="efiling-popup-message">${message}</p>
        <div class="portal-admin-actions" style="margin-top: 2rem; display: flex; justify-content: flex-end;">
            ${buttonsHtml}
        </div>
    `;

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // Animation entry
    requestAnimationFrame(() => {
        popup.style.transform = 'scale(0.95) translateY(10px)';
        requestAnimationFrame(() => {
            popup.style.transform = 'scale(1) translateY(0)';
        });
    });

    const close = () => {
        overlay.classList.remove('efiling-popup--visible');
        setTimeout(() => overlay.remove(), 300);
    };

    const closeBtn = popup.querySelector('.efiling-popup-close');
    if (closeBtn) closeBtn.addEventListener('click', close);

    const checkConfirm = popup.querySelector('.btn-confirm');
    if (checkConfirm) {
        checkConfirm.addEventListener('click', () => {
            if (onConfirm) onConfirm();
            close();
        });
    }

    if (onConfirm) {
        const checkCancel = popup.querySelector('.btn-cancel');
        if (checkCancel) checkCancel.addEventListener('click', close);
    }

    // Auto focus confirm button for accessibility
    (checkConfirm as HTMLElement)?.focus();

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
    });
}
