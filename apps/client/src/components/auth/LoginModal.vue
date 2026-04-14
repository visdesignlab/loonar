<template>
  <q-dialog v-model="isOpen">
    <q-card square class="bg-white" style="min-width: 400px; border: 1px solid #e0e0e0; box-shadow: none;">
      <!-- Title -->
      <q-card-section class="bg-grey-1" style="border-bottom: 1px solid #e0e0e0; padding: 16px 20px;">
        <div class="row justify-between items-center">
            <div class="text-h6 row items-center text-dark" style="font-weight: 500;">
              <q-icon name="account_circle" size="md" class="q-mr-sm text-primary" />
              {{ authStore.currentUser ? 'Account Details' : (isAdminLogin ? 'Administrator Login' : 'Login') }}
            </div>
            <q-btn v-if="!authStore.currentUser" flat icon="admin_panel_settings" color="primary" dense square @click="toggleAdminLogin">
               <q-tooltip class="bg-primary" :offset="[10, 10]">Toggle Admin Login</q-tooltip>
            </q-btn>
        </div>
      </q-card-section>

      <!-- If Logged In -->
      <q-card-section v-if="authStore.currentUser" class="q-pt-lg">
        <div class="q-mb-lg text-center" style="min-height: 80px;">
          <q-avatar size="64px" color="primary" text-color="white" class="q-mb-sm">
            {{ authStore.currentUser.charAt(0).toUpperCase() }}
          </q-avatar>
          <div class="text-subtitle1">You are currently logged in as <strong class="text-primary">{{ authStore.currentUser }}</strong></div>
        </div>
        <q-btn color="negative" outline label="Sign Out" @click="handleLogout" full-width square />
      </q-card-section>

      <!-- If Not Logged In -->
      <q-card-section v-else class="q-pt-md">
        <!-- Error alert -->
        <q-banner v-if="errorMsg" class="bg-red-2 text-red-9 q-mb-md rounded-borders" dense>
          <template v-slot:avatar>
            <q-icon name="error" color="red-9" />
          </template>
          {{ errorMsg }}
        </q-banner>

        <!-- User List / Search -->
        <div class="q-mb-md" v-if="!isAdminLogin">
          <div class="text-subtitle2 q-mb-sm text-grey-8 row justify-between items-center">
            <span style="font-weight: 500;">Select User</span>
          </div>
          <q-input v-model="searchQuery" outlined square dense placeholder="Search users..." clearable class="q-mb-sm bg-grey-1">
            <template v-slot:prepend>
              <q-icon name="search" />
            </template>
          </q-input>
          
          <q-list bordered square class="bg-white" style="max-height: 180px; overflow-y: auto; border: 1px solid #e0e0e0;">
            <q-item 
              v-for="user in filteredUsers" 
              :key="user" 
              clickable 
              v-ripple
              dense
              @click="selectUser(user)" 
              :active="selectedUser === user"
              active-class="bg-blue-1 text-primary text-weight-medium"
              style="min-height: 40px; padding: 0 16px;"
            >
              <q-item-section avatar>
                <q-icon name="person_outline" size="sm" :color="selectedUser === user ? 'primary' : 'grey-7'" />
              </q-item-section>
              <q-item-section>{{ user }}</q-item-section>
            </q-item>
            <q-item v-if="filteredUsers.length === 0" dense>
              <q-item-section class="text-grey text-center q-py-sm">No users found</q-item-section>
            </q-item>
          </q-list>
        </div>

        <q-form @submit="handleLogin" class="q-mt-md">
          <q-input 
            v-if="!isAdminLogin"
            v-model="usernameInput" 
            outlined 
            square
            dense 
            label="Selected Username" 
            class="q-mb-sm bg-grey-1 text-grey-8" 
            readonly
          />
          <q-input 
            v-model="passwordInput" 
            outlined 
            square
            dense 
            type="password" 
            label="Password" 
            class="q-mb-lg" 
            @keyup.enter="handleLogin"
            autofocus
            bg-color="white"
          />
          
          <div class="row justify-end q-gutter-sm">
            <q-btn outline label="Cancel" color="primary" v-close-popup square dense style="padding: 0 16px;" />
            <q-btn type="submit" label="Sign In" color="primary" outline square dense style="padding: 0 16px;" />
          </div>
        </q-form>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue';
import { useAuthStore } from '@/stores/misc/authStore';

const props = defineProps<{
    modelValue: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void;
}>();

const isOpen = computed({
    get: () => props.modelValue,
    set: (val) => emit('update:modelValue', val)
});

const authStore = useAuthStore();

const errorMsg = ref('');
const searchQuery = ref('');
const selectedUser = ref('');
const usernameInput = ref('');
const passwordInput = ref('');
const isAdminLogin = ref(false);

// Computed user list
const allUsers = computed(() => {
    return authStore.users || [];
});

const filteredUsers = computed(() => {
    const list = allUsers.value;
    if (!searchQuery.value) return list;
    return list.filter(u => u.toLowerCase().includes(searchQuery.value.toLowerCase()));
});

function selectUser(user: string) {
    selectedUser.value = user;
    usernameInput.value = user;
    passwordInput.value = '';
    errorMsg.value = '';
}

function toggleAdminLogin() {
    isAdminLogin.value = !isAdminLogin.value;
    if (isAdminLogin.value) {
        usernameInput.value = 'admin';
        selectedUser.value = '';
    } else if (allUsers.value.length > 0) {
        selectUser(allUsers.value[0]);
    }
    passwordInput.value = '';
    errorMsg.value = '';
}

async function handleLogin() {
    if (!usernameInput.value || !passwordInput.value) {
        errorMsg.value = 'Please select a user and enter a password.';
        return;
    }
    errorMsg.value = '';
    const success = await authStore.login(usernameInput.value, passwordInput.value);
    if (success) {
        isOpen.value = false;
        errorMsg.value = '';
    } else {
        errorMsg.value = 'Invalid username or password.';
    }
}

function handleLogout() {
    authStore.logout();
    isOpen.value = false;
}

watch(isOpen, (newVal) => {
    if (newVal) {
        errorMsg.value = '';
        passwordInput.value = '';
        if (!authStore.currentUser && !selectedUser.value && allUsers.value.length > 0) {
            isAdminLogin.value = false;
            selectUser(allUsers.value[0]);
        }
    }
});

onMounted(() => {
    authStore.initLogins();
});

</script>
