// ==========================================
// AURALAUNDRY PRO - LOGICA DEFINITIVA
// ==========================================

// Configurazione Firebase (Sostituisci con le credenziali del tuo database)
const firebaseConfig = {
    apiKey: "IL_TUO_API_KEY",
    authDomain: "IL_TUO_AUTH_DOMAIN",
    databaseURL: "IL_TUO_DATABASE_URL",
    projectId: "IL_TUO_PROJECT_ID",
    storageBucket: "IL_TUO_STORAGE_BUCKET",
    messagingSenderId: "IL_TUO_MESSAGING_SENDER_ID",
    appId: "IL_TUO_APP_ID"
};

// Inizializzazione Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Password operatore per l'accesso protetto
const APP_PASSWORD = "admin"; // Modificala a piacimento

// Riferimenti DOM
const loginScreen = document.getElementById('loginScreen');
const appContainer = document.getElementById('appContainer');
const loginForm = document.getElementById('loginForm');
const passwordInput = document.getElementById('passwordInput');
const loginError = document.getElementById('loginError');

const clientForm = document.getElementById('clientForm');
const itemForm = document.getElementById('itemForm');
const itemClientSelect = document.getElementById('itemClientSelect');
const itemsTableBody = document.getElementById('itemsTableBody');
const noItemsMessage = document.getElementById('noItemsMessage');
const itemsCounterBadge = document.getElementById('itemsCounterBadge');
const globalSearch = document.getElementById('globalSearch');
const searchClearBtn = document.getElementById('searchClearBtn');

let clientsData = {};
let itemsData = {};

// Gestione Sessione Login
document.addEventListener('DOMContentLoaded', () => {
    const sessionAuth = sessionStorage.getItem('laundry_auth');
    if (sessionAuth === 'true') {
        unlockApp();
    }
});

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (passwordInput.value === APP_PASSWORD) {
        sessionStorage.setItem('laundry_auth', 'true');
        unlockApp();
        showToast("Accesso eseguito con successo", "success");
    } else {
        loginError.classList.remove('hidden');
        passwordInput.classList.add('border-rose-500');
    }
});

function unlockApp() {
    loginScreen.classList.add('hidden');
    appContainer.classList.remove('hidden');
    initApp();
}

function lockApp() {
    sessionStorage.removeItem('laundry_auth');
    location.reload();
}

function initApp() {
    loadClients();
    loadItems();
}

// 1. Registrazione Nuovo Cliente (I clienti vengono salvati in modo permanente e NON si cancellano)
clientForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('clientName').value.trim();
    const phone = document.getElementById('clientPhone').value.trim();

    if (!name || !phone) return;

    const newClientRef = db.ref('clients').push();
    newClientRef.set({ name, phone }, (error) => {
        if (!error) {
            clientForm.reset();
            showToast(`Cliente "${name}" registrato correttamente!`, "success");
        } else {
            showToast("Errore durante il salvataggio cliente.", "error");
        }
    });
});

// Sincronizzazione in tempo reale dei Clienti
function loadClients() {
    db.ref('clients').on('value', (snapshot) => {
        clientsData = snapshot.val() || {};
        updateClientSelect();
    });
}

function updateClientSelect() {
    const currentSelected = itemClientSelect.value;
    itemClientSelect.innerHTML = '<option value="">-- Scegli cliente --</option>';
    
    const sortedClients = Object.entries(clientsData).sort((a, b) => a[1].name.localeCompare(b[1].name));

    for (let [id, client] of sortedClients) {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = `${client.name} — Tel: ${client.phone}`;
        itemClientSelect.appendChild(option);
    }
    
    // Ripristina la selezione precedente se ancora valida
    if (currentSelected && clientsData[currentSelected]) {
        itemClientSelect.value = currentSelected;
    }
}

// 2. Assegnazione Capo negli Armadi
itemForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const clientId = itemClientSelect.value;
    const type = document.getElementById('itemType').value.trim();
    const cabinet = document.getElementById('itemCabinet').value.trim();
    const position = document.getElementById('itemPosition').value.trim();
    const status = document.getElementById('itemStatus').value;

    if (!clientId || !clientsData[clientId]) {
        showToast("Seleziona un cliente valido dall'elenco.", "error");
        return;
    }

    const newItemRef = db.ref('items').push();
    newItemRef.set({
        clientId,
        type,
        cabinet,
        position,
        status,
        timestamp: Date.now()
    }, (error) => {
        if (!error) {
            itemForm.reset();
            showToast(`Capo (${type}) assegnato all'Armadio ${cabinet}`, "success");
        } else {
            showToast("Errore durante l'assegnazione.", "error");
        }
    });
});

// Sincronizzazione in tempo reale dei Capi
function loadItems(filterText = "") {
    db.ref('items').on('value', (snapshot) => {
        itemsData = snapshot.val() || {};
        renderItems(filterText);
    });
}

// Renderizzatore Tabella con Ricerca Globale Istantanea
function renderItems(filter = "") {
    itemsTableBody.innerHTML = "";
    let count = 0;
    const lowerFilter = filter.toLowerCase();

    const sortedItems = Object.entries(itemsData).sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));

    for (let [id, item] of sortedItems) {
        const client = clientsData[item.clientId] || { name: "Cliente non trovato", phone: "N/D" };
        
        const clientNameStr = (client.name || "").toLowerCase();
        const clientPhoneStr = (client.phone || "").toLowerCase();
        const itemTypeStr = (item.type || "").toLowerCase();
        const cabinetStr = (item.cabinet || "").toLowerCase();
        const positionStr = (item.position || "").toLowerCase();

        // Filtro globale
        if (
            filter && 
            !clientNameStr.includes(lowerFilter) && 
            !clientPhoneStr.includes(lowerFilter) && 
            !itemTypeStr.includes(lowerFilter) && 
            !cabinetStr.includes(lowerFilter) && 
            !positionStr.includes(lowerFilter)
        ) {
            continue;
        }

        count++;
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50/80 transition duration-150 group";

        const isPronto = item.status === 'Pronto';
        const statusBadgeClass = isPronto 
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' 
            : 'bg-amber-50 text-amber-700 border border-amber-200/60';
        
        const statusIcon = isPronto ? 'fa-circle-check text-emerald-500' : 'fa-clock text-amber-500';

        tr.innerHTML = `
            <td class="py-4 px-4">
                <div class="font-semibold text-slate-900">${client.name}</div>
                <div class="text-xs text-slate-400 font-medium"><i class="fa-solid fa-phone mr-1"></i>${client.phone}</div>
            </td>
            <td class="py-4 px-4">
                <span class="font-medium text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg text-xs">${item.type}</span>
            </td>
            <td class="py-4 px-4">
                <div class="flex items-center gap-1.5 font-semibold text-slate-700 text-xs">
                    <span class="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-md">Armadio ${item.cabinet}</span>
                    <span class="text-slate-400">›</span>
                    <span class="px-2 py-1 bg-slate-100 text-slate-700 rounded-md">Pos. ${item.position}</span>
                </div>
            </td>
            <td class="py-4 px-4">
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${statusBadgeClass}">
                    <i class="fa-solid ${statusIcon} text-[10px]"></i>
                    ${item.status}
                </span>
            </td>
            <td class="py-4 px-4 text-right">
                <button onclick="markAsReturned('${id}', '${client.name.replace(/'/g, "\\'")}', '${item.type.replace(/'/g, "\\'")}')" 
                    class="px-3.5 py-2 bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white rounded-xl text-xs font-semibold transition duration-200 shadow-xs flex items-center gap-1.5 ml-auto cursor-pointer">
                    <i class="fa-solid fa-check-double text-[11px]"></i>
                    <span>Segna Ritirato</span>
                </button>
            </td>
        `;
        itemsTableBody.appendChild(tr);
    }

    itemsCounterBadge.textContent = `${count} ${count === 1 ? 'capo attivo' : 'capi attivi'}`;

    if (count === 0) {
        noItemsMessage.classList.remove('hidden');
        noItemsMessage.classList.add('flex');
    } else {
        noItemsMessage.classList.add('hidden');
        noItemsMessage.classList.remove('flex');
    }
}

// 3. Bottone Ritirato: Rimuove unicamente il CAPO dal database (Il cliente resta regolarmente salvato)
window.markAsReturned = function(id, clientName, itemType) {
    if (confirm(`Confermi il ritiro per ${clientName} (${itemType})?\nLa posizione nell'armadio verrà liberata.`)) {
        db.ref('items').child(id).remove().then(() => {
            showToast(`Capo ritirato e posizione liberata!`, "success");
        }).catch((error) => {
            showToast("Errore durante l'operazione.", "error");
        });
    }
};

// Gestione Ricerca
globalSearch.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    renderItems(val);
    if (val.length > 0) {
        searchClearBtn.classList.remove('hidden');
    } else {
        searchClearBtn.classList.add('hidden');
    }
});

searchClearBtn.addEventListener('click', () => {
    globalSearch.value = "";
    searchClearBtn.classList.add('hidden');
    renderItems("");
    globalSearch.focus();
});

// Sistema Notifiche Visive (Toast)
function showToast(message, type = "success") {
    const toast = document.getElementById('toastNotification');
    const toastMessage = document.getElementById('toastMessage');
    const toastIcon = document.getElementById('toastIcon');

    toastMessage.textContent = message;
    if (type === "success") {
        toastIcon.className = "fa-solid fa-circle-check text-emerald-400";
    } else {
        toastIcon.className = "fa-solid fa-triangle-exclamation text-rose-400";
    }

    toast.classList.remove('translate-y-20', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');

    setTimeout(() => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('translate-y-20', 'opacity-0');
    }, 3500);
}