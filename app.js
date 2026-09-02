// Configurazione Firebase Database Realtime
const firebaseConfig = {
    databaseURL: "https://TUO-PROJECT-ID.firebaseio.com" // Sostituisci con la tua URL Firebase Realtime Database
};

// Inizializza Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

// Variabili di Stato Globali
let clients = {};
let items = {};
let historyData = {};
let activeLicenseKey = localStorage.getItem('laundry_active_license') || null;
let licenseListenerRef = null;
let currentStatPeriod = 'all';

// Inizializzazione Applicazione
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    checkInitialLicenseState();
});

// -------------------------------------------------------------
// GESTIONE LICENZA IN TEMPO REALE (REAL-TIME LISTENER)
// -------------------------------------------------------------

function checkInitialLicenseState() {
    if (activeLicenseKey) {
        updateLicenseBadge('attiva', 'Attiva');
        listenToLicenseChanges(activeLicenseKey);
    } else {
        updateLicenseBadge('attesa', 'In attesa');
    }
}

function checkNumericLicense() {
    const input = document.getElementById('licensePhoneInput').value.trim().toUpperCase();
    if (!input) {
        showToast("Inserisci un codice licenza valido!");
        return;
    }

    db.ref('licenses/' + input).once('value').then(snapshot => {
        const licenseData = snapshot.val();
        if (!licenseData) {
            showToast("Codice licenza non trovato!");
            return;
        }

        const now = Date.now();
        if (licenseData.active === false || (licenseData.expiresAt && now > licenseData.expiresAt)) {
            showToast("Codice licenza scaduto o disattivato!");
            return;
        }

        // Salva licenza e attiva ascoltatore in tempo reale
        activeLicenseKey = input;
        localStorage.setItem('laundry_active_license', activeLicenseKey);
        updateLicenseBadge('attiva', 'Attiva');
        showToast("Licenza attivata con successo!");

        listenToLicenseChanges(activeLicenseKey);
    }).catch(err => {
        console.error("Errore verifica licenza:", err);
        showToast("Errore di connessione con il server.");
    });
}

function listenToLicenseChanges(licenseCode) {
    if (!licenseCode) return;

    // Rimuovi ascoltatore precedente se attivo
    if (licenseListenerRef) {
        licenseListenerRef.off();
    }

    licenseListenerRef = db.ref('licenses/' + licenseCode);

    // ASCOLTATORE IN TEMPO REALE
    licenseListenerRef.on('value', (snapshot) => {
        const data = snapshot.val();

        // Se la licenza è stata ELIMINATA dalla Dashboard Firebase
        if (!data) {
            forceImmediateLogout("La tua licenza è stata eliminata dal pannello di controllo.");
            return;
        }

        // Se la licenza è stata DISATTIVATA o è SCADUTA
        const now = Date.now();
        if (data.active === false || (data.expiresAt && now > data.expiresAt)) {
            forceImmediateLogout("La tua licenza non è più attiva o è scaduta.");
            return;
        }

        // Avviso scadenza imminente (es. entro 3 giorni)
        if (data.expiresAt && (data.expiresAt - now < 3 * 24 * 60 * 60 * 1000)) {
            const daysLeft = Math.ceil((data.expiresAt - now) / (1000 * 60 * 60 * 24));
            showLicenseWarning(`Attenzione: La licenza scadrà tra ${daysLeft} giorn${daysLeft === 1 ? 'o' : 'i'}.`);
        }
    });
}

function forceImmediateLogout(reason) {
    // Scollega l'ascoltatore Firebase
    if (licenseListenerRef) {
        licenseListenerRef.off();
        licenseListenerRef = null;
    }

    // Rimuovi la chiave di licenza locale
    activeLicenseKey = null;
    localStorage.removeItem('laundry_active_license');

    // Sconnetti subito l'interfaccia principale
    document.getElementById('appContainer').classList.add('hidden');
    document.getElementById('appContainer').classList.remove('opacity-100');

    // Aggiorna badge e mostra schermo login
    updateLicenseBadge('attesa', 'In attesa');
    document.getElementById('loginScreen').classList.remove('hidden');

    // Mostra il modale di blocco
    const expiredModal = document.getElementById('licenseExpiredModal');
    const msgElement = document.getElementById('licenseExpiredMessage');
    if (msgElement) msgElement.textContent = reason;
    if (expiredModal) expiredModal.classList.remove('hidden');

    showToast(reason);
}

function updateLicenseBadge(status, text) {
    const badge = document.getElementById('licenseBadge');
    if (!badge) return;

    badge.textContent = text;
    if (status === 'attiva') {
        badge.className = "px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-900";
    } else {
        badge.className = "px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-400 border border-amber-900";
    }
}

// -------------------------------------------------------------
// LOGIN E AUTENTICAZIONE UTENTE
// -------------------------------------------------------------

document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!activeLicenseKey) {
        showToast("Devi prima attivare una licenza valida per questo dispositivo!");
        return;
    }

    const pass = document.getElementById('passwordInput').value.trim();
    // Verifica password amministratore (Personalizza la password qui)
    if (pass === 'admin' || pass === '1234') {
        document.getElementById('loginScreen').classList.add('hidden');
        const app = document.getElementById('appContainer');
        app.classList.remove('hidden');
        setTimeout(() => app.classList.add('opacity-100'), 50);

        initRealtimeDatabase();
    } else {
        const errorMsg = document.getElementById('loginError');
        errorMsg.textContent = "Password non corretta!";
        errorMsg.classList.remove('hidden');
    }
});

function lockApp() {
    document.getElementById('appContainer').classList.add('hidden');
    document.getElementById('appContainer').classList.remove('opacity-100');
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('passwordInput').value = '';
}

function closeExpiredModalAndRelogin() {
    document.getElementById('licenseExpiredModal').classList.add('hidden');
    lockApp();
}

function closeWarningModal() {
    document.getElementById('licenseWarningModal').classList.add('hidden');
}

function showLicenseWarning(text) {
    const warnModal = document.getElementById('licenseWarningModal');
    const warnText = document.getElementById('licenseWarningText');
    if (warnModal && warnText) {
        warnText.textContent = text;
        warnModal.classList.remove('hidden');
    }
}

// -------------------------------------------------------------
// INIZIALIZZAZIONE E SINCRONIZZAZIONE DATI
// -------------------------------------------------------------

function initRealtimeDatabase() {
    // Sincronizzazione Clienti
    db.ref('clients').on('value', snapshot => {
        clients = snapshot.val() || {};
        renderActiveItems();
    });

    // Sincronizzazione Capi Attivi
    db.ref('items').on('value', snapshot => {
        items = snapshot.val() || {};
        renderActiveItems();
    });

    // Sincronizzazione Storico
    db.ref('history').on('value', snapshot => {
        historyData = snapshot.val() || {};
        renderHistory();
    });
}

// -------------------------------------------------------------
// INTERFACCIA E TAB
// -------------------------------------------------------------

function switchTab(tab) {
    const activeView = document.getElementById('viewActive');
    const statsView = document.getElementById('viewStats');
    const btnActive = document.getElementById('navTabActive');
    const btnStats = document.getElementById('navTabStats');

    if (tab === 'active') {
        activeView.classList.remove('hidden');
        statsView.classList.add('hidden');
        btnActive.className = "px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white shadow-sm cursor-pointer";
        btnStats.className = "px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-darkSurface/50 cursor-pointer";
    } else {
        activeView.classList.add('hidden');
        statsView.classList.remove('hidden');
        btnStats.className = "px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white shadow-sm cursor-pointer";
        btnActive.className = "px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-darkSurface/50 cursor-pointer";
        renderHistory();
    }
}

function toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('laundry_theme', isDark ? 'dark' : 'light');
    document.getElementById('themeIcon').className = isDark ? "fa-solid fa-moon" : "fa-solid fa-sun";
}

// -------------------------------------------------------------
// UTILITIES ED EVENTI INTERFACCIA
// -------------------------------------------------------------

function setupEventListeners() {
    // Filtro rapido per tabella attivi
    const activeFilter = document.getElementById('activeTableFilter');
    if (activeFilter) {
        activeFilter.addEventListener('input', () => renderActiveItems());
    }

    // Ricerca globale
    const globalSearch = document.getElementById('globalSearch');
    if (globalSearch) {
        globalSearch.addEventListener('input', (e) => handleGlobalSearch(e.target.value.trim()));
    }
}

function showToast(message) {
    const toast = document.getElementById('toastNotification');
    const toastMsg = document.getElementById('toastMessage');
    if (!toast || !toastMsg) return;

    toastMsg.textContent = message;
    toast.classList.remove('translate-y-20', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');

    setTimeout(() => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('translate-y-20', 'opacity-0');
    }, 3000);
}

// -------------------------------------------------------------
// RENDER TABELLE & STATISTICHE
// -------------------------------------------------------------

function renderActiveItems() {
    const tbody = document.getElementById('itemsTableBody');
    const filterText = (document.getElementById('activeTableFilter')?.value || '').toLowerCase();
    const noItemsMsg = document.getElementById('noItemsMessage');
    const counterBadge = document.getElementById('itemsCounterBadge');

    if (!tbody) return;
    tbody.innerHTML = '';

    const keys = Object.keys(items);
    let count = 0;

    keys.forEach(key => {
        const item = items[key];
        const client = clients[item.clientId] || { name: 'Sconosciuto', phone: '-' };

        const searchable = `${client.name} ${client.phone} ${item.type} ${item.cabinet} ${item.position}`.toLowerCase();
        if (filterText && !searchable.includes(filterText)) return;

        count++;
        const tr = document.createElement('tr');
        tr.className = "hover:bg-darkCard/50 border-b border-darkBorder/40 transition-colors";
        tr.innerHTML = `
            <td class="py-3 px-4 font-semibold text-white">${client.name}<br><span class="text-[10px] text-slate-400 font-normal">${client.phone}</span></td>
            <td class="py-3 px-4">${item.type} <span class="text-emerald-400 font-bold ml-1">€${parseFloat(item.price || 0).toFixed(2)}</span></td>
            <td class="py-3 px-4"><span class="px-2 py-0.5 bg-darkCard border border-darkBorder rounded text-[11px] font-mono">${item.cabinet} / ${item.position}</span></td>
            <td class="py-3 px-4"><span class="px-2 py-0.5 bg-blue-950 text-blue-400 border border-blue-900 rounded-full text-[10px] font-bold">In Lavorazione</span></td>
            <td class="py-3 px-4 text-right">
                <button onclick="checkoutItem('${key}')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-sm">
                    <i class="fa-solid fa-check mr-1"></i> Ritiro
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (counterBadge) counterBadge.textContent = `${count} capi`;
    if (noItemsMsg) {
        if (count === 0) noItemsMsg.classList.remove('hidden');
        else noItemsMsg.classList.add('hidden');
    }
}

function checkoutItem(itemId) {
    const item = items[itemId];
    if (!item) return;

    const historyRef = db.ref('history').push();
    const historyEntry = {
        ...item,
        completedAt: Date.now(),
        clientName: clients[item.clientId]?.name || 'Sconosciuto'
    };

    historyRef.set(historyEntry).then(() => {
        return db.ref('items/' + itemId).remove();
    }).then(() => {
        showToast("Capo segnato come ritirato!");
    }).catch(err => {
        console.error("Errore ritiro capo:", err);
        showToast("Errore durante la registrazione del ritiro.");
    });
}

function renderHistory() {
    const tbody = document.getElementById('historyTableBody');
    const historyCounter = document.getElementById('historyCounter');

    if (!tbody) return;
    tbody.innerHTML = '';

    const historyKeys = Object.keys(historyData);
    let totalRev = 0;
    let uniqueClientsSet = new Set();
    let typeCountMap = {};

    historyKeys.forEach(key => {
        const h = historyData[key];
        totalRev += parseFloat(h.price || 0);
        if (h.clientId) uniqueClientsSet.add(h.clientId);
        if (h.type) typeCountMap[h.type] = (typeCountMap[h.type] || 0) + 1;

        const dateStr = h.completedAt ? new Date(h.completedAt).toLocaleDateString('it-IT') : '-';

        const tr = document.createElement('tr');
        tr.className = "hover:bg-darkCard/50 border-b border-darkBorder/40 transition-colors";
        tr.innerHTML = `
            <td class="py-3 px-4 font-mono text-slate-300">${dateStr}</td>
            <td class="py-3 px-4 font-semibold text-white">${h.clientName || 'Cliente'}</td>
            <td class="py-3 px-4">${h.type}</td>
            <td class="py-3 px-4 font-bold text-emerald-400">€${parseFloat(h.price || 0).toFixed(2)}</td>
            <td class="py-3 px-4 font-mono text-slate-400">${h.cabinet || '-'}</td>
        `;
        tbody.appendChild(tr);
    });

    // Statistiche rapide
    document.getElementById('statTotalCount').textContent = historyKeys.length;
    document.getElementById('statTotalRevenue').textContent = `€ ${totalRev.toFixed(2)}`;
    document.getElementById('statUniqueClients').textContent = uniqueClientsSet.size;

    let topType = '-';
    let maxFreq = 0;
    Object.keys(typeCountMap).forEach(t => {
        if (typeCountMap[t] > maxFreq) {
            maxFreq = typeCountMap[t];
            topType = t;
        }
    });
    document.getElementById('statTopItemType').textContent = topType;

    if (historyCounter) historyCounter.textContent = `${historyKeys.length} elementi`;
}

// -------------------------------------------------------------
// GESTIONE MODALI E RICERCA GLOBALE
// -------------------------------------------------------------

function openClientManagerModal() {
    document.getElementById('clientManagerModal').classList.remove('hidden');
    renderManagerClients();
}

function closeClientManagerModal() {
    document.getElementById('clientManagerModal').classList.add('hidden');
}

function renderManagerClients() {
    const tbody = document.getElementById('managerClientsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    Object.keys(clients).forEach(key => {
        const c = clients[key];
        const tr = document.createElement('tr');
        tr.className = "hover:bg-darkCard/50 border-b border-darkBorder/40";
        tr.innerHTML = `
            <td class="py-3 px-4 font-semibold text-white">${c.name}</td>
            <td class="py-3 px-4">${c.phone}</td>
            <td class="py-3 px-4 text-slate-400">${c.address || '-'} (${c.dob || '-'})</td>
            <td class="py-3 px-4 text-right">
                <button onclick="deleteClient('${key}')" class="p-1.5 bg-rose-950/60 hover:bg-rose-900 text-rose-400 rounded-lg text-xs cursor-pointer">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function deleteClient(clientId) {
    if (confirm("Sei sicuro di voler eliminare questo cliente dall'anagrafica?")) {
        db.ref('clients/' + clientId).remove().then(() => {
            showToast("Cliente eliminato!");
            renderManagerClients();
        });
    }
}

function handleGlobalSearch(query) {
    const dropdown = document.getElementById('globalSearchDropdown');
    const clearBtn = document.getElementById('searchClearBtn');

    if (!query) {
        dropdown.classList.add('hidden');
        clearBtn.classList.add('hidden');
        return;
    }

    clearBtn.classList.remove('hidden');
    dropdown.innerHTML = '';

    let matches = 0;
    Object.keys(items).forEach(key => {
        const item = items[key];
        const client = clients[item.clientId] || { name: 'Sconosciuto', phone: '' };
        const searchable = `${client.name} ${client.phone} ${item.type} ${item.cabinet}`.toLowerCase();

        if (searchable.includes(query.toLowerCase())) {
            matches++;
            const div = document.createElement('div');
            div.className = "p-3 hover:bg-darkCard cursor-pointer flex justify-between items-center";
            div.innerHTML = `
                <div>
                    <div class="text-xs font-bold text-white">${client.name} - <span class="text-blue-400">${item.type}</span></div>
                    <div class="text-[10px] text-slate-400">Armadio: ${item.cabinet} / Pos: ${item.position}</div>
                </div>
                <span class="text-xs font-bold text-emerald-400">€${parseFloat(item.price || 0).toFixed(2)}</span>
            `;
            dropdown.appendChild(div);
        }
    });

    if (matches > 0) dropdown.classList.remove('hidden');
    else dropdown.classList.add('hidden');
}
