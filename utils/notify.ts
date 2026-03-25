export type NotifyType = 'error' | 'success' | 'info';

export const notify = (message: string, type: NotifyType = 'error') => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('app-notify', {
      detail: { message, type },
    })
  );
};
