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

    // controls which types of notifications are displayed
    const displayLevels: NotificationType[] = [
        'problem',
        'warning',
        // 'success', // uncommont these to rurn these back on.
        // 'info',
    ];

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
        if (!displayLevels.includes(type)) {
            return;
        }
        let copyProps = {};
        if (type === 'problem' || type === 'warning') {
            copyProps = {
                timeout: 0,
                actions: [
                    {
                        label: 'Copy Message',
                        color: type === 'warning' ? 'black' : 'white',
                        noDismiss: true,
                        handler: () => {
                            navigator.clipboard.writeText(message);
                        },
                    },
                    {
                        label: 'dismiss',
                        color: type === 'warning' ? 'black' : 'white',
                        handler: () => {
                            /* no action needed other than closing */
                        },
                    },
                ],
            };
        }
        $q.notify({
            ...typeToQNotify[type],
            textColor: type === 'warning' ? 'black' : 'white',
            message,
            ...copyProps,
        });
    }

    return {
        notify,
    };
});
