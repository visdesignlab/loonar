<template>
  <q-page padding>
    <div class="row justify-center">
      <div class="col-8">
        
        <q-banner v-if="authStore.currentUser !== 'admin'" class="bg-red-1 text-red-9 border-red-3 q-mb-md" style="border: 1px solid currentColor;">
          <template v-slot:avatar>
            <q-icon name="warning" />
          </template>
          You do not have administrative access to view this page.
        </q-banner>
        
        <div v-else-if="!sessionUnlocked">
           <q-card square class="bg-white" style="max-width: 400px; margin: 40px auto; border: 1px solid #e0e0e0; box-shadow: none;">
             <q-card-section>
               <div class="text-h6 q-mb-md text-weight-regular text-primary">Unlock Admin Workspace</div>
               <q-input outlined square v-model="adminPassword" type="password" label="Admin Password" dense @keyup.enter="loadData" />
               <q-btn class="q-mt-lg" outline color="primary" label="Verify Credentials" @click="loadData" full-width square />
               <div class="text-red q-mt-sm text-center" v-if="errorMessage"><small>{{ errorMessage }}</small></div>
             </q-card-section>
           </q-card>
        </div>

        <div v-else>
          <!-- Manage Users Panel -->
          <div class="row justify-between items-center q-mb-lg">
             <h5 class="q-my-none text-weight-regular text-primary">Admin Control Panel</h5>
             <div class="row items-center q-gutter-sm">
                 <div class="text-positive text-caption" v-if="successMessage">{{ successMessage }}</div>
                 <div class="text-negative text-caption" v-if="saveErrorMessage">{{ saveErrorMessage }}</div>
                 <q-btn outline color="primary" icon="save" label="Save All Changes" @click="saveChanges" :loading="saving" square />
             </div>
          </div>
          
          <q-card square class="q-mb-lg shadow-0" style="border: 1px solid #e0e0e0;">
            <q-card-section class="bg-grey-1" style="border-bottom: 1px solid #e0e0e0;">
              <div class="text-subtitle1 text-weight-medium text-dark">Manage Users & Permissions</div>
            </q-card-section>
            
            <q-card-section class="q-pa-lg">
              <!-- Add New User Top block -->
              <div class="bg-blue-grey-1 q-pa-md q-mb-xl" style="border: 1px solid #eceff1;">
                <div class="text-subtitle2 text-weight-medium q-mb-md text-primary text-uppercase" style="letter-spacing: 0.5px;">Create User</div>
                <div class="row q-col-gutter-md items-end">
                  <div class="col-5">
                    <q-input v-model="newUser.username" label="Username" dense outlined square bg-color="white" />
                  </div>
                  <div class="col-5">
                    <q-input v-model="newUser.password" label="Password" dense outlined square bg-color="white" />
                  </div>
                  <div class="col-2">
                    <q-btn outline class="full-width" color="primary" @click="addUser" icon="person_add" label="Add" square dense style="padding: 6px 0;" />
                  </div>
                </div>
              </div>

              <!-- Searchable Users section -->
              <div class="row items-center justify-between q-mb-md">
                <div class="text-subtitle2 text-weight-medium text-uppercase text-grey-8" style="letter-spacing: 0.5px;">Existing Accounts</div>
                <q-input v-model="searchUser" outlined square dense placeholder="Search..." clearable style="width: 250px" bg-color="grey-1">
                  <template v-slot:prepend><q-icon name="search" size="sm" /></template>
                </q-input>
              </div>

              <q-list bordered class="bg-white" style="border: 1px solid #e0e0e0;">
                 <q-item v-if="filteredUsers.length === 0">
                    <q-item-section class="text-grey text-center q-py-lg">No administrators found matching criteria.</q-item-section>
                 </q-item>
                 <q-expansion-item
                    v-for="user in filteredUsers"
                    :key="user"
                    icon="person_outline"
                    :label="user"
                    header-class="text-weight-medium text-dark"
                    expand-icon-class="text-grey-6"
                    style="border-bottom: 1px solid #f0f0f0;"
                  >
                    <q-card square class="shadow-0">
                        <q-card-section class="q-pt-sm bg-grey-1" style="border-top: 1px solid #f5f5f5;">
                           
                           <!-- Password Change / Delete Block -->
                           <div class="row items-center q-mb-lg justify-between bg-white q-pa-md" style="border: 1px solid #e0e0e0;">
                             <div class="row items-center q-gutter-md">
                                <div class="text-caption text-grey-8 text-uppercase" style="letter-spacing: 0.5px;">Set Password</div>
                                <q-input v-model="pendingUsers[user]" outlined square dense type="text" bg-color="white" style="min-width: 200px" />
                             </div>
                             <q-btn icon="delete_outline" label="Delete" color="negative" outline square dense size="sm" @click="deleteUser(user)" />
                           </div>
                           
                           <!-- Experiment Toggles block -->
                           <div class="q-mt-sm">
                             <div class="row justify-between items-center q-mb-sm">
                               <div class="text-caption text-grey-8 text-uppercase" style="letter-spacing: 0.5px;">Assigned Datasets</div>
                               <div class="q-gutter-sm">
                                 <q-btn size="sm" outline color="primary" label="Select All" @click="assignAll(user)" square />
                                 <q-btn size="sm" outline color="negative" label="Clear All" @click="revokeAll(user)" square />
                               </div>
                             </div>
                             
                             <div v-if="allExperimentsList.length === 0" class="text-grey-7 q-my-md text-italic">No datasets are currently indexed in the system.</div>
                             <div v-else class="row q-col-gutter-sm bg-white q-pa-sm" style="border: 1px solid #e0e0e0; max-height: 250px; overflow-y: auto;">
                               <div v-for="exp in allExperimentsList" :key="exp" class="col-12">
                                 <q-checkbox v-model="userPermissions[user]" :val="exp" :label="exp" color="primary" dense size="sm" />
                               </div>
                             </div>
                           </div>
                        </q-card-section>
                    </q-card>
                 </q-expansion-item>
              </q-list>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/stores/misc/authStore';
import { useConfigStore } from '@/stores/misc/configStore';

const authStore = useAuthStore();
const configStore = useConfigStore();

const adminPassword = ref('');
const sessionUnlocked = ref(false);

const pendingUsers = ref<Record<string, string>>({});
const userPermissions = ref<Record<string, string[]>>({}); // username -> list of exp filenames
const allExperimentsList = ref<string[]>([]); // list of all filenames

const newUser = ref({ username: '', password: '' });
const saving = ref(false);
const errorMessage = ref('');
const saveErrorMessage = ref('');
const successMessage = ref('');
const searchUser = ref('');

const filteredUsers = computed(() => {
    const query = searchUser.value.toLowerCase();
    return Object.keys(pendingUsers.value).filter(u => u !== 'admin' && u.toLowerCase().includes(query));
});

onMounted(() => {
    if (authStore.currentUser === 'admin' && authStore.currentPassword) {
        adminPassword.value = authStore.currentPassword;
        loadData();
    }
});

async function loadData() {
    errorMessage.value = '';
    try {
        const response = await fetch(`${configStore.apiUrl}/admin/data/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: adminPassword.value })
        });
        if (response.ok) {
            const data = await response.json();
            pendingUsers.value = data.users;
            
            // Map experiments into convenient format for users
            const aa_index = data.aa_index;
            const exps = aa_index.experiments || [];
            allExperimentsList.value = [];
            userPermissions.value = {};
            
            // Initialize empty arrays for all users (including new ones)
            for (const user in pendingUsers.value) {
                if (user !== 'admin') {
                    userPermissions.value[user] = [];
                }
            }

            for (const exp of exps) {
                let filename = '';
                let expUsers: string[] = [];
                if (typeof exp === 'string') {
                    filename = exp;
                } else {
                    filename = exp.filename;
                    expUsers = exp.users || [];
                }
                allExperimentsList.value.push(filename);
                for (const u of expUsers) {
                    if (!userPermissions.value[u]) {
                        userPermissions.value[u] = [];
                    }
                    userPermissions.value[u].push(filename);
                }
            }
            
            sessionUnlocked.value = true;
        } else {
            errorMessage.value = 'Incorrect Admin Password';
        }
    } catch (e) {
        errorMessage.value = 'Network error fetching admin data.';
        console.error(e);
    }
}

function addUser() {
    if (newUser.value.username && newUser.value.password) {
        if (pendingUsers.value[newUser.value.username]) {
            alert('User already exists!');
            return;
        }
        pendingUsers.value[newUser.value.username] = newUser.value.password;
        userPermissions.value[newUser.value.username] = [];
        newUser.value = { username: '', password: '' };
    }
}

function deleteUser(username: string) {
    delete pendingUsers.value[username];
    delete userPermissions.value[username];
}

function assignAll(username: string) {
    userPermissions.value[username] = [...allExperimentsList.value];
}

function revokeAll(username: string) {
    userPermissions.value[username] = [];
}

async function saveChanges() {
    saving.value = true;
    saveErrorMessage.value = '';
    successMessage.value = '';
    
    // Transform back to exp -> users mapping
    const pendingPermissions: Record<string, string[]> = {};
    for (const exp of allExperimentsList.value) {
        pendingPermissions[exp] = [];
    }
    
    for (const user in userPermissions.value) {
        for (const exp of userPermissions.value[user]) {
            if (pendingPermissions[exp]) {
                pendingPermissions[exp].push(user);
            }
        }
    }

    try {
        const response = await fetch(`${configStore.apiUrl}/admin/update/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                username: 'admin', 
                password: adminPassword.value,
                users: pendingUsers.value,
                permissions: pendingPermissions
            })
        });
        
        if (response.ok) {
            successMessage.value = 'Successfully saved all changes!';
            authStore.fetchUsers();
        } else {
            saveErrorMessage.value = 'Failed to save changes. Ensure server is running.';
        }
    } catch (e) {
        saveErrorMessage.value = 'Network error during save.';
        console.error(e);
    } finally {
        saving.value = false;
        setTimeout(() => successMessage.value = '', 5000);
    }
}
</script>
