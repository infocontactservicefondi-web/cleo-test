const firebaseConfig = {
    databaseURL: "https://lavanderiacleo-default-rtdb.europe-west1.firebasedatabase.app/"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

let clients = [];
let activeItems = [];
let historyItems = [];
let currentTab = 'active';
let currentStatPeriod = 'all';
let logoPressTimer = null;
let logoPressDuration = 0;
let logoProgressInterval = null;

const ADMIN_PASSWORD = "admin";

document.addEventListener('DOMContentLoaded', () => {
    checkActiveLicenseOnInit();
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('loginForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const pwd = document.getElementById('passwordInput').value;
        const errEl = document.getElementById('loginError');
        if (pwd === ADMIN_PASSWORD) {
            errEl.classList.add('hidden');
            unlockApp();
        } else {
            errEl.textContent = "Password errata!";
            errEl.classList.remove('hidden');
        }
    });

    document.getElementById('clientForm').addEventListener('submit', (e) => {
        e.preventDefault();
        saveClientFromForm();
    });

    document.getElementById('itemForm').addEventListener('submit', (e) => {
        e.preventDefault();
        saveItemFromForm();
    });

    // Ricerca globale
    const globalSearch = document.getElementById('globalSearch');
    const searchClearBtn = document.getElementById('searchClearBtn');
    globalSearch.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        if (val.length > 0) {
            searchClearBtn.classList.remove('hidden');
            performGlobalSearch(val);
        } else {
            searchClearBtn.classList.add('hidden');
            document.getElementById('globalSearchDropdown').classList.add('hidden');
        }
    });
    searchClearBtn.addEventListener('click', () => {
        globalSearch.value = '';
        searchClearBtn.classList.add('hidden');
        document.getElementById('globalSearchDropdown').classList.add('hidden');
    });

    // Input ricerca cliente in inserimento capo
    const assignSearch = document.getElementById('assignClientSearch');
    assignSearch.addEventListener('input', (e) => {
        filterClientDropdown(e.target.value, 'assignClientDropdown', 'selectedClientIdInput', 'assignClientSearch');
    });
    document.getElementById('assignClientToggleBtn').addEventListener('click', () => {
        filterClientDropdown('', 'assignClientDropdown', 'selectedClientIdInput', 'assignClientSearch', true);
    });

    // Input ricerca anagrafica cliente principale
    const clientNameInput = document.getElementById('clientName');
    clientNameInput.addEventListener('input', (e) => {
        filterClientDropdown(e.target.value, 'clientSearchDropdown', 'manageClientIdInput', 'clientName', false, true);
    });
    document.getElementById('clientSearchToggleBtn').addEventListener('click', () => {
        filterClientDropdown('', 'clientSearchDropdown', 'manageClientIdInput', 'clientName', true, true);
    });

    // Filtri tabelle
    document.getElementById('activeTableFilter').addEventListener('input', renderActiveItems);
    document.getElementById('managerClientSearchInput').addEventListener('input', renderManagerClientsTable);

    // Gestione Logo Lock / Reset
    const logoBtn = document.getElementById('protectedLogoBtn');
    logoBtn.addEventListener('mousedown', startLogoPress);
    logoBtn.addEventListener('touchstart', startLogoPress);
    logoBtn.addEventListener('mouseup', cancelLogoPress);
    logoBtn.addEventListener('mouseleave', cancelLogoPress);
    logoBtn.addEventListener('touchend', cancelLogoPress);
}

// GESTIONE LICENZA & STORAGE
function checkActiveLicenseOnInit() {
    const activeLic = localStorage.getItem('laundry_active_license');
    if (activeLic) {
        if (activeLic === 'TEST1MIN') {
            const expTime = parseInt(localStorage.getItem('laundry_license_expire') || '0', 10);
            if (Date.now() > expTime) {
                showExpiredModal("La licenza di prova di 1 minuto è scaduta.");
                return;
            }
        }
        document.getElementById('licenseBadge').textContent = "Attiva (" + activeLic + ")";
        document.getElementById('licenseBadge').className = "px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-900";
    }
}

function checkNumericLicense() {
    const code = document.getElementById('licensePhoneInput').value.trim().toUpperCase();
    if (!code) {
        showToast("Inserisci un codice valido!", "error");
        return;
    }
    if (code === 'TEST1MIN') {
        const expireTime = Date.now() + 60 * 1000; // 1 minuto
        localStorage.setItem('laundry_active_license', code);
        localStorage.setItem('laundry_license_expire', expireTime);
        showToast("Licenza TEST attivata per 1 minuto!");
        checkActiveLicenseOnInit();
        return;
    }
    // Simulazione licenza annuale numerica (es. 12 cifre)
    if (/^\d{8,16}$/.test(code)) {
        localStorage.setItem('laundry_active_license', code);
        localStorage.removeItem('laundry_license_expire');
        showToast("Licenza annuale attivata con successo!");
        checkActiveLicenseOnInit();
    } else {
        showToast("Codice licenza non riconosciuto.", "error");
    }
}

function unlockApp() {
    document.getElementById('loginScreen').classList.add('opacity-0');
    setTimeout(() => {
        document.getElementById('loginScreen').classList.add('hidden');
        const appContainer = document.getElementById('appContainer');
        appContainer.classList.remove('hidden');
        setTimeout(() => appContainer.classList.remove('opacity-0'), 50);
        loadFirebaseData();
    }, 500);
}

function lockApp() {
    const appContainer = document.getElementById('appContainer');
    appContainer.classList.add('opacity-0');
    setTimeout(() => {
        appContainer.classList.add('hidden');
        const loginScreen = document.getElementById('loginScreen');
        loginScreen.classList.remove('hidden');
        setTimeout(() => loginScreen.classList.remove('opacity-0'), 50);
        document.getElementById('passwordInput').value = '';
    }, 500);
}

function toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('laundry_theme', isDark ? 'dark' : 'light');
    document.getElementById('themeIcon').className = isDark ? "fa-solid fa-moon" : "fa-solid fa-sun";
}

// DATABASE FIREBASE SYNC
function loadFirebaseData() {
    db.ref('clients').on('value', snapshot => {
        clients = [];
        snapshot.forEach(child => clients.push({ id: child.key, ...child.val() }));
        renderActiveItems();
    });

    db.ref('activeItems').on('value', snapshot => {
        activeItems = [];
        snapshot.forEach(child => activeItems.push({ id: child.key, ...child.val() }));
        renderActiveItems();
    });

    db.ref('historyItems').on('value', snapshot => {
        historyItems = [];
        snapshot.forEach(child => historyItems.push({ id: child.key, ...child.val() }));
        renderHistory();
    });
}

// CLIENTS & ITEMS MANAGEMENT
function saveClientFromForm() {
    const name = document.getElementById('clientName').value.trim();
    const phone = document.getElementById('clientPhone').value.trim();
    const dob = document.getElementById('clientDob').value.trim();
    const address = document.getElementById('clientAddress').value.trim();
    const clientId = document.getElementById('manageClientIdInput').value;

    if (!name || !phone) {
        showToast("Nome e Telefono sono obbligatori!", "error");
        return;
    }

    const clientData = { name, phone, dob, address, updatedAt: Date.now() };

    if (clientId) {
        db.ref('clients/' + clientId).update(clientData, () => {
            showToast("Cliente aggiornato con successo!");
            resetClientForm();
        });
    } else {
        const newRef = db.ref('clients').push();
        newRef.set(clientData, () => {
            showToast("Nuovo cliente registrato!");
            document.getElementById('selectedClientIdInput').value = newRef.key;
            document.getElementById('assignClientSearch').value = name;
            resetClientForm();
        });
    }
}

function resetClientForm() {
    document.getElementById('clientForm').reset();
    document.getElementById('manageClientIdInput').value = '';
}

function saveItemFromForm() {
    const clientId = document.getElementById('selectedClientIdInput').value;
    const type = document.getElementById('itemType').value.trim();
    const cabinet = document.getElementById('itemCabinet').value.trim();
    const position = document.getElementById('itemPosition').value.trim();
    const price = parseFloat(document.getElementById('itemPrice').value) || 0;
    const notes = document.getElementById('itemNotes').value.trim();

    if (!clientId || !type || !cabinet || !position) {
        showToast("Compila tutti i campi obbligatori del capo!", "error");
        return;
    }

    const clientObj = clients.find(c => c.id === clientId);
    const itemData = {
        clientId,
        clientName: clientObj ? clientObj.name : 'Sconosciuto',
        clientPhone: clientObj ? clientObj.phone : '',
        type,
        cabinet,
        position,
        price,
        notes,
        status: 'In lavorazione',
        createdAt: Date.now()
    };

    db.ref('activeItems').push(itemData, () => {
        showToast("Capo inserito in armadio con successo!");
        document.getElementById('itemForm').reset();
        document.getElementById('selectedClientIdInput').value = '';
    });
}

function renderActiveItems() {
    const tbody = document.getElementById('itemsTableBody');
    const noMsg = document.getElementById('noItemsMessage');
    const filter = document.getElementById('activeTableFilter').value.toLowerCase();
    
    tbody.innerHTML = '';
    const filtered = activeItems.filter(item => 
        item.clientName.toLowerCase().includes(filter) ||
        item.type.toLowerCase().includes(filter) ||
        item.cabinet.toLowerCase().includes(filter) ||
        item.position.toLowerCase().includes(filter)
    );

    document.getElementById('itemsCounterBadge').textContent = `${activeItems.length} capi`;

    if (filtered.length === 0) {
        noMsg.classList.remove('hidden');
        noMsg.classList.add('flex');
        return;
    }
    noMsg.classList.remove('flex');
    noMsg.classList.add('hidden');

    filtered.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-darkCard/50 transition-colors";
        tr.innerHTML = `
            <td class="py-3 px-4 font-medium text-white">
                <div class="cursor-pointer hover:text-blue-400" onclick="openClientModal('${item.clientId}')">${item.clientName}</div>
                <div class="text-[10px] text-slate-400">${item.clientPhone || ''}</div>
            </td>
            <td class="py-3 px-4">
                <div class="font-bold text-white">${item.type}</div>
                <div class="text-[10px] text-emerald-400 font-semibold">€ ${item.price.toFixed(2)}</div>
            </td>
            <td class="py-3 px-4">
                <span class="px-2 py-0.5 bg-blue-950 text-blue-400 border border-blue-900 rounded-md text-[10px] font-bold">Arm. ${item.cabinet} - Pos. ${item.position}</span>
            </td>
            <td class="py-3 px-4">
                <span class="px-2 py-0.5 bg-amber-950 text-amber-400 border border-amber-900 rounded-md text-[10px] font-semibold">${item.status}</span>
            </td>
            <td class="py-3 px-4 text-right space-x-1">
                <button onclick="printReceipt('${item.id}')" class="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs cursor-pointer shadow-sm" title="Stampa Ricevuta"><i class="fa-solid fa-print"></i></button>
                <button onclick="completeItem('${item.id}')" class="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs cursor-pointer shadow-sm" title="Segna Ritirato"><i class="fa-solid fa-check"></i></button>
                <button onclick="deleteActiveItem('${item.id}')" class="px-2.5 py-1.5 bg-rose-950 hover:bg-rose-900 text-rose-400 rounded-lg text-xs cursor-pointer" title="Elimina"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function completeItem(id) {
    const item = activeItems.find(i => i.id === id);
    if (!item) return;

    const historyData = {
        ...item,
        completedAt: Date.now()
    };
    delete historyData.id;

    db.ref('historyItems').push(historyData, () => {
        db.ref('activeItems/' + id).remove(() => {
            showToast("Capo ritirato e spostato nello storico!");
        });
    });
}

function deleteActiveItem(id) {
    if (confirm("Vuoi davvero eliminare questo capo?")) {
        db.ref('activeItems/' + id).remove(() => {
            showToast("Capo eliminato.");
        });
    }
}

// STORICO E STATISTICHE
function setStatPeriod(period) {
    currentStatPeriod = period;
    ['day', 'month', 'year', 'all'].forEach(p => {
        const btn = document.getElementById('btnPeriod' + p.charAt(0).toUpperCase() + p.slice(1));
        if (p === period) {
            btn.className = "px-3.5 py-2 bg-blue-600 border border-blue-500 text-xs font-semibold rounded-xl text-white shadow-sm cursor-pointer";
        } else {
            btn.className = "px-3.5 py-2 bg-darkSurface border border-darkBorder text-xs font-semibold rounded-xl text-slate-300 hover:bg-zinc-850 cursor-pointer";
        }
    });
    renderHistory();
}

function clearCustomDateFilter() {
    document.getElementById('statsCustomStartDate').value = '';
    document.getElementById('statsCustomEndDate').value = '';
    renderHistory();
}

function renderHistory() {
    const tbody = document.getElementById('historyTableBody');
    tbody.innerHTML = '';

    const startInput = document.getElementById('statsCustomStartDate').value;
    const endInput = document.getElementById('statsCustomEndDate').value;

    let filtered = historyItems;

    if (startInput || endInput) {
        const startTime = startInput ? new Date(startInput).getTime() : 0;
        const endTime = endInput ? new Date(endInput).setHours(23,59,59,999) : Date.now();
        filtered = filtered.filter(item => item.completedAt >= startTime && item.completedAt <= endTime);
    } else if (currentStatPeriod !== 'all') {
        const now = new Date();
        filtered = filtered.filter(item => {
            const itemDate = new Date(item.completedAt);
            if (currentStatPeriod === 'day') {
                return itemDate.toDateString() === now.toDateString();
            } else if (currentStatPeriod === 'month') {
                return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
            } else if (currentStatPeriod === 'year') {
                return itemDate.getFullYear() === now.getFullYear();
            }
            return true;
        });
    }

    document.getElementById('historyCounter').textContent = `${filtered.length} elementi`;

    let totalRevenue = 0;
    const uniqueClientsSet = new Set();
    const typeCountMap = {};

    filtered.forEach(item => {
        totalRevenue += (item.price || 0);
        uniqueClientsSet.add(item.clientId);
        typeCountMap[item.type] = (typeCountMap[item.type] || 0) + 1;

        const dateStr = new Date(item.completedAt).toLocaleString('it-IT');
        const tr = document.createElement('tr');
        tr.className = "hover:bg-darkCard/50 transition-colors";
        tr.innerHTML = `
            <td class="py-3 px-4 text-slate-400 text-[11px]">${dateStr}</td>
            <td class="py-3 px-4 font-medium text-white">${item.clientName}</td>
            <td class="py-3 px-4 font-bold text-white">${item.type}</td>
            <td class="py-3 px-4 font-semibold text-emerald-400">€ ${(item.price || 0).toFixed(2)}</td>
            <td class="py-3 px-4 text-slate-400">Arm. ${item.cabinet} - Pos. ${item.position}</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('statTotalCount').textContent = filtered.length;
    document.getElementById('statTotalRevenue').textContent = `€ ${totalRevenue.toFixed(2)}`;
    document.getElementById('statUniqueClients').textContent = uniqueClientsSet.size;

    let topType = '-';
    let maxCount = 0;
    for (const [t, count] of Object.entries(typeCountMap)) {
        if (count > maxCount) {
            maxCount = count;
            topType = t;
        }
    }
    document.getElementById('statTopItemType').textContent = topType;
}

// DROPDOWN CLIENTI UTILITY
function filterClientDropdown(query, dropdownId, hiddenInputId, searchInputId, forceAll = false, isManager = false) {
    const dropdown = document.getElementById(dropdownId);
    dropdown.innerHTML = '';
    
    const matching = clients.filter(c => 
        forceAll || c.name.toLowerCase().includes(query.toLowerCase()) || (c.phone && c.phone.includes(query))
    );

    if (matching.length === 0) {
        dropdown.classList.add('hidden');
        return;
    }

    dropdown.classList.remove('hidden');
    matching.forEach(c => {
        const div = document.createElement('div');
        div.className = "p-3 hover:bg-darkCard cursor-pointer flex justify-between items-center text-xs";
        div.innerHTML = `<div><div class="font-bold text-white">${c.name}</div><div class="text-[10px] text-slate-400">${c.phone || ''}</div></div>`;
        div.onclick = () => {
            document.getElementById(searchInputId).value = c.name;
            document.getElementById(hiddenInputId).value = c.id;
            if (isManager) {
                document.getElementById('clientPhone').value = c.phone || '';
                document.getElementById('clientDob').value = c.dob || '';
                document.getElementById('clientAddress').value = c.address || '';
            }
            dropdown.classList.add('hidden');
        };
        dropdown.appendChild(div);
    });
}

// GLOBAL SEARCH
function performGlobalSearch(query) {
    const dropdown = document.getElementById('globalSearchDropdown');
    dropdown.innerHTML = '';
    dropdown.classList.remove('hidden');

    const matchedClients = clients.filter(c => c.name.toLowerCase().includes(query.toLowerCase()) || (c.phone && c.phone.includes(query)));
    const matchedActive = activeItems.filter(i => i.type.toLowerCase().includes(query.toLowerCase()) || i.cabinet.toLowerCase().includes(query.toLowerCase()));

    if (matchedClients.length === 0 && matchedActive.length === 0) {
        dropdown.innerHTML = '<div class="p-4 text-center text-xs text-slate-400">Nessun risultato trovato.</div>';
        return;
    }

    if (matchedClients.length > 0) {
        const header = document.createElement('div');
        header.className = "px-4 py-2 text-[10px] font-bold uppercase text-blue-400 bg-darkCard";
        header.textContent = "Clienti Trovati";
        dropdown.appendChild(header);

        matchedClients.forEach(c => {
            const div = document.createElement('div');
            div.className = "p-3 hover:bg-darkCard cursor-pointer flex justify-between items-center text-xs";
            div.innerHTML = `<div><div class="font-bold text-white">${c.name}</div><div class="text-[10px] text-slate-400">Tel: ${c.phone || '-'}</div></div>`;
            div.onclick = () => {
                openClientModal(c.id);
                dropdown.classList.add('hidden');
                document.getElementById('globalSearch').value = '';
                document.getElementById('searchClearBtn').classList.add('hidden');
            };
            dropdown.appendChild(div);
        });
    }

    if (matchedActive.length > 0) {
        const header = document.createElement('div');
        header.className = "px-4 py-2 text-[10px] font-bold uppercase text-emerald-400 bg-darkCard";
        header.textContent = "Capi Attivi";
        dropdown.appendChild(header);

        matchedActive.forEach(i => {
            const div = document.createElement('div');
            div.className = "p-3 hover:bg-darkCard cursor-pointer flex justify-between items-center text-xs";
            div.innerHTML = `<div><div class="font-bold text-white">${i.type} (${i.clientName})</div><div class="text-[10px] text-slate-400">Armadio: ${i.cabinet} - Pos: ${i.position}</div></div>`;
            div.onclick = () => {
                switchTab('active');
                dropdown.classList.add('hidden');
                document.getElementById('globalSearch').value = '';
                document.getElementById('searchClearBtn').classList.add('hidden');
            };
            dropdown.appendChild(div);
        });
    }
}

// MODALI DETTAGLIO & CLIENT MANAGER
function openClientModal(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    document.getElementById('modalClientName').textContent = client.name;
    document.getElementById('modalClientDetails').textContent = `Tel: ${client.phone || '-'} | Indirizzo: ${client.address || '-'}`;

    const clientActive = activeItems.filter(i => i.clientId === clientId);
    const clientHistory = historyItems.filter(i => i.clientId === clientId);

    let totalSpent = 0;
    clientHistory.forEach(h => totalSpent += (h.price || 0));

    document.getElementById('modalClientTotalItems').textContent = clientActive.length + clientHistory.length;
    document.getElementById('modalClientTotalSpent').textContent = `€ ${totalSpent.toFixed(2)}`;

    const activeList = document.getElementById('modalClientActiveItemsList');
    activeList.innerHTML = clientActive.length ? '' : '<div class="text-xs text-slate-400">Nessun capo attivo.</div>';
    clientActive.forEach(i => {
        const div = document.createElement('div');
        div.className = "bg-darkCard p-2.5 rounded-xl border border-darkBorder text-xs flex justify-between items-center";
        div.innerHTML = `<div><span class="font-bold text-white">${i.type}</span> <span class="text-[10px] text-blue-400">(Arm. ${i.cabinet} - Pos. ${i.position})</span></div><span class="font-semibold text-emerald-400">€ ${i.price.toFixed(2)}</span>`;
        activeList.appendChild(div);
    });

    const historyList = document.getElementById('modalClientHistoryList');
    historyList.innerHTML = clientHistory.length ? '' : '<div class="text-xs text-slate-400">Nessuno storico capi.</div>';
    clientHistory.forEach(h => {
        const div = document.createElement('div');
        div.className = "bg-darkCard p-2.5 rounded-xl border border-darkBorder text-xs flex justify-between items-center";
        div.innerHTML = `<div><span class="font-bold text-white">${h.type}</span> <span class="text-[10px] text-slate-400">${new Date(h.completedAt).toLocaleDateString('it-IT')}</span></div><span class="font-semibold text-emerald-400">€ ${h.price.toFixed(2)}</span>`;
        historyList.appendChild(div);
    });

    document.getElementById('clientModal').classList.remove('hidden');
}

function closeClientModal() {
    document.getElementById('clientModal').classList.add('hidden');
}

function openClientManagerModal() {
    renderManagerClientsTable();
    document.getElementById('clientManagerModal').classList.remove('hidden');
}

function closeClientManagerModal() {
    document.getElementById('clientManagerModal').classList.add('hidden');
}

function renderManagerClientsTable() {
    const tbody = document.getElementById('managerClientsTableBody');
    tbody.innerHTML = '';
    const filter = document.getElementById('managerClientSearchInput').value.toLowerCase();

    const filtered = clients.filter(c => c.name.toLowerCase().includes(filter) || (c.phone && c.phone.includes(filter)));

    filtered.forEach(c => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-darkCard/50 transition-colors";
        tr.innerHTML = `
            <td class="py-3 px-4 font-bold text-white">${c.name}</td>
            <td class="py-3 px-4 text-slate-300">${c.phone || '-'}</td>
            <td class="py-3 px-4 text-slate-400 text-[11px]">${c.address || '-'} (${c.dob || '-'})</td>
            <td class="py-3 px-4 text-right space-x-1">
                <button onclick="openClientModal('${c.id}'); closeClientManagerModal();" class="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs cursor-pointer" title="Dettagli"><i class="fa-solid fa-eye"></i></button>
                <button onclick="deleteClient('${c.id}')" class="px-2.5 py-1.5 bg-rose-950 hover:bg-rose-900 text-rose-400 rounded-lg text-xs cursor-pointer" title="Elimina"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function deleteClient(id) {
    if (confirm("Vuoi davvero eliminare questo cliente?")) {
        db.ref('clients/' + id).remove(() => {
            showToast("Cliente eliminato.");
            renderManagerClientsTable();
        });
    }
}

// TAB NAVIGATION
function switchTab(tab) {
    currentTab = tab;
    const btnActive = document.getElementById('navTabActive');
    const btnStats = document.getElementById('navTabStats');
    const viewActive = document.getElementById('viewActive');
    const viewStats = document.getElementById('viewStats');

    if (tab === 'active') {
        btnActive.className = "px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white shadow-sm cursor-pointer";
        btnStats.className = "px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-darkSurface/50 cursor-pointer";
        viewActive.classList.remove('hidden');
        viewStats.classList.add('hidden');
    } else {
        btnStats.className = "px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white shadow-sm cursor-pointer";
        btnActive.className = "px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-darkSurface/50 cursor-pointer";
        viewStats.classList.remove('hidden');
        viewActive.classList.add('hidden');
        renderHistory();
    }
}

// PRINT / EXPORT UTILITIES
function printReceipt(itemId) {
    const item = activeItems.find(i => i.id === itemId);
    if (!item) return;

    const w = window.open('', '_blank', 'width=400,height=600');
    w.document.write(`
        <html>
        <head><title>Ricevuta Deposito</title></head>
        <body style="font-family: monospace; padding: 20px; font-size: 14px; color: #000;">
            <h2 style="text-align:center; margin-bottom:5px;">LAVANDERIA CLEO</h2>
            <p style="text-align:center; font-size:11px; margin-top:0;">Ricevuta di Deposito Capo</p>
            <hr>
            <p><b>Data:</b> ${new Date(item.createdAt).toLocaleString('it-IT')}</p>
            <p><b>Cliente:</b> ${item.clientName}</p>
            <p><b>Telefono:</b> ${item.clientPhone || '-'}</p>
            <hr>
            <p><b>Capo:</b> ${item.type}</p>
            <p><b>Armadio:</b> ${item.cabinet} - Pos: ${item.position}</p>
            <p><b>Prezzo:</b> € ${item.price.toFixed(2)}</p>
            ${item.notes ? `<p><b>Note:</b> ${item.notes}</p>` : ''}
            <hr>
            <p style="text-align:center; font-size:11px; margin-top:20px;">Conservare la ricevuta per il ritiro.<br>Grazie per aver scelto i nostri servizi!</p>
            <script>window.print(); setTimeout(() => window.close(), 500);<\/script>
        </body>
        </html>
    `);
    w.document.close();
}

function printClientReceiptLabel() {
    const name = document.getElementById('clientName').value.trim();
    const phone = document.getElementById('clientPhone').value.trim();
    if (!name || !phone) {
        showToast("Inserisci nome e telefono per stampare l'etichetta cliente!", "error");
        return;
    }
    const w = window.open('', '_blank', 'width=400,height=400');
    w.document.write(`
        <html>
        <head><title>Etichetta Cliente</title></head>
        <body style="font-family: monospace; padding: 20px; font-size: 14px; color: #000;">
            <h3 style="text-align:center; margin-bottom:5px;">LAVANDERIA CLEO</h3>
            <p style="text-align:center; font-size:11px; margin-top:0;">Scheda Cliente</p>
            <hr>
            <p><b>Cliente:</b> ${name}</p>
            <p><b>Telefono:</b> ${phone}</p>
            <p><b>Registrazione:</b> ${new Date().toLocaleDateString('it-IT')}</p>
            <hr>
            <script>window.print(); setTimeout(() => window.close(), 500);<\/script>
        </body>
        </html>
    `);
    w.document.close();
}

function exportBackup() {
    let csv = "Data Ritiro,Cliente,Telefono,Tipo Capo,Prezzo,Armadio,Posizione\n";
    historyItems.forEach(i => {
        const dateStr = new Date(i.completedAt).toLocaleString('it-IT');
        csv += `"${dateStr}","${i.clientName}","${i.clientPhone || ''}","${i.type}",${i.price || 0},"${i.cabinet}","${i.position}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lavanderia_cleo_storico_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    showToast("Storico esportato con successo in CSV!");
}

function resetAllStatistics() {
    if (confirm("ATTENZIONE: Vuoi azzerare tutto lo storico dei capi ritirati? L'operazione è irreversibile.")) {
        db.ref('historyItems').remove(() => {
            showToast("Storico azzerato.");
        });
    }
}

// LOGO LONG PRESS (RESET LICENZA / HARD RESET)
function startLogoPress(e) {
    e.preventDefault();
    logoPressDuration = 0;
    const fill = document.getElementById('logoProgressFill');
    fill.style.height = '0%';

    logoPressInterval = setInterval(() => {
        logoPressDuration += 100;
        const pct = Math.min((logoPressDuration / 5000) * 100, 100);
        fill.style.height = pct + '%';

        if (logoPressDuration >= 5000) {
            clearInterval(logoPressInterval);
            if (confirm("Vuoi rimuovere la licenza attiva su questo dispositivo?")) {
                localStorage.removeItem('laundry_active_license');
                localStorage.removeItem('laundry_license_expire');
                showToast("Licenza rimossa. Riavvio...");
                setTimeout(() => location.reload(), 1000);
            }
        }
    }, 100);
}

function cancelLogoPress() {
    if (logoPressInterval) {
        clearInterval(logoPressInterval);
        logoPressInterval = null;
        document.getElementById('logoProgressFill').style.height = '0%';
    }
}

// MODALI DI AVVISO E TOAST
function showWarningModal(text) {
    document.getElementById('licenseWarningText').textContent = text;
    document.getElementById('licenseWarningModal').classList.remove('hidden');
}
function closeWarningModal() {
    document.getElementById('licenseWarningModal').classList.add('hidden');
}

function showExpiredModal(text) {
    document.getElementById('expiredModalText').textContent = text;
    document.getElementById('licenseExpiredModal').classList.remove('hidden');
}
function closeExpiredModalAndRelogin() {
    localStorage.removeItem('laundry_active_license');
    localStorage.removeItem('laundry_license_expire');
    location.reload();
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toastNotification');
    document.getElementById('toastMessage').textContent = message;
    toast.classList.remove('translate-y-20', 'opacity-0');
    setTimeout(() => {
        toast.classList.add('translate-y-20', 'opacity-0');
    }, 3000);
}
