import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useConfigStore } from './configStore';

export const useAuthStore = defineStore('authStore', () => {
    const isInitialized = ref(false);
    const currentUser = ref<string | null>(null);
    const currentPassword = ref<string | null>(null);
    const users = ref<string[]>([]);

    async function fetchUsers() {
        const configStore = useConfigStore();
        if (!configStore.apiUrl) return;

        try {
            const response = await fetch(`${configStore.apiUrl}/users/`);
            if (response.ok) {
                const data = await response.json();
                if (data.users && Array.isArray(data.users)) {
                    users.value = data.users.filter((u: string) => u !== 'admin');
                }
            }
        } catch (e) {
            console.error('Failed to fetch users', e);
        } finally {
            isInitialized.value = true;
        }
    }

    async function initLogins() {
        if (isInitialized.value) return;
        await fetchUsers();
    }

    async function login(username: string, pass: string): Promise<boolean> {
        const configStore = useConfigStore();
        try {
            const response = await fetch(`${configStore.apiUrl}/login/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password: pass })
            });
            if (response.ok) {
                currentUser.value = username;
                currentPassword.value = pass;
                return true;
            }
        } catch (e) {
            console.error('Login error', e);
        }
        return false;
    }

    function logout() {
        currentUser.value = null;
        currentPassword.value = null;
    }

    return {
        isInitialized,
        currentUser,
        currentPassword,
        users,
        initLogins,
        fetchUsers,
        login,
        logout
    };
});
