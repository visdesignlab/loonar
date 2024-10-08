import { defineStore } from 'pinia';
import { type QNotifyCreateOptions, useQuasar } from 'quasar';

type NotificationType = 'problem' | 'warning' | 'success' | 'info';

interface Notification {
    type: NotificationType;
    message: string;
}

interface QNotification {
    color: string;
    icon: string;
    position: QNotifyCreateOptions['position'];
}

export const useNotificationStore = defineStore('notificationStore', () => {
    const $q = useQuasar();

    const typeToQNotify: Record<NotificationType, QNotification> = {
        problem: {
            color: 'negative',
            icon: 'mdi-alert-box',
            position: 'top',
        },
        warning: {
            color: 'warning',
            icon: 'mdi-alert',
            position: 'top',
        },
        success: {
            color: 'positive',
            icon: 'mdi-check-circle',
            position: 'top',
        },
        info: {
            color: 'info',
            icon: 'mdi-information-outline',
            position: 'top',
        },
    };

    function notify({ message, type }: Notification) {
        $q.notify({
            ...typeToQNotify[type],
            message,
        });
    }

    return {
        notify,
    };
});
