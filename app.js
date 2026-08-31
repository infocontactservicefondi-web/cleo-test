// ==========================================
// LAVANDERIA CLEO - APP LOGIC
// ==========================================

const firebaseConfig = {
    apiKey: "AIzaSyD-tuo-firebase-api-key-da-completare",
    authDomain: "lavanderia-d9c29.firebaseapp.com",
    databaseURL: "https://lavanderia-d9c29-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "lavanderia-d9c29",
    storageBucket: "lavanderia-d9c29.appspot.com",
    messagingSenderId: "1234567890",
    appId: "1:1234567890:web:abcdef"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.database();
db.goOnline();

const APP_PASSWORD = "BAUBAU06";

const loginScreen = document.getElementById('loginScreen');
const appContainer = document.getElementById('appContainer');
const loginForm = document.getElementById('loginForm');
const passwordInput = document.getElementById('passwordInput');
const loginError = document.getElementById('loginError');

const clientForm = document.getElementById('clientForm');
const itemForm = document.getElementById('itemForm');
const clientDobInput = document.getElementById('clientDob');

const assignClientSearch = document.getElementById('assignClientSearch');
const assignClientToggleBtn = document.getElementById('assignClientToggleBtn');
const selectedClientIdInput = document.getElementById('selectedClientIdInput');
const assignClientDropdown = document.getElementById('assignClientDropdown');

const globalSearch = document.getElementById('globalSearch');
const globalSearchDropdown = document.getElementById('globalSearchDropdown');
const searchClearBtn = document.getElementById('searchClearBtn');

const itemsTableBody = document.getElementById('itemsTableBody');
const noItemsMessage = document.getElementById('noItemsMessage');
const itemsCounterBadge = document.getElementById('itemsCounterBadge');
const activeTableFilter = document.getElementById('activeTableFilter');

let clientsData = {};
let itemsData = {};
let historyData = {};

let currentStatPeriod = 'all';
let licenseCheckInterval = null;
let hasShownTodayWarning = false;

document.addEventListener('DOMContentLoaded', () => {
    initLicenseSystem();
    initTheme();
    initConnectionMonitor(); 
    fixLoginPlaceholders();
    startLicenseCountdownMonitor(); 

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            checkAdminPassword();
        });
    }
});

function fixLoginPlaceholders() {
    const inputs = document.querySelectorAll('#loginScreen input');
    if (inputs.length > 0) {
        inputs[0].value = "";
        inputs[0].placeholder = "Inserisci codice licenza annuale o TEST1MIN...";
    }
}

// ==========================================
// SISTEMA LICENZA E LOGIN
// ==========================================
function initLicenseSystem() {
    const deviceActivated = localStorage.getItem('laundry_device_activated');
    const licenseExpiry = localStorage.getItem('laundry_license_expiry');

    if (deviceActivated === 'true' && licenseExpiry) {
        const now = Date.now();
        const expiryTime = parseInt(licenseExpiry, 10);

        if (now < expiryTime) {
            checkDaysBeforeExpiry(now, expiryTime);
            sessionStorage.setItem('laundry_auth', 'true');
            unlockApp();
            return;
        } else {
            lockAppComplete();
        }
    }
}

function startLicenseCountdownMonitor() {
    if (licenseCheckInterval) clearInterval(licenseCheckInterval);

    licenseCheckInterval = setInterval(() => {
        const licenseExpiry = localStorage.getItem('laundry_license_expiry');
        if (!licenseExpiry) return;

        const now = Date.now();
        const expiryTime = parseInt(licenseExpiry, 10);

        if (now >= expiryTime) {
            clearInterval(licenseCheckInterval);
            localStorage.removeItem('laundry_device_activated');
            localStorage.removeItem('laundry_license_expiry');
            localStorage.removeItem('laundry_active_license');
            sessionStorage.removeItem('laundry_auth');
            lockAppComplete();
            return;
        }

        if (!hasShownTodayWarning) {
            checkDaysBeforeExpiry(now, expiryTime);
        }
    }, 1000); 
}

function checkDaysBeforeExpiry(now, expiryTime) {
    const diffMs = expiryTime - now;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays >= 1 && diffDays <= 5) {
        hasShownTodayWarning = true;
    }
}

function checkAdminPassword() {
    const inputs = document.querySelectorAll('#loginScreen input');
    let enteredPassword = "";

    if (inputs.length > 1) {
        enteredPassword = inputs[1].value.trim();
    } else if (passwordInput) {
        enteredPassword = passwordInput.value.trim();
    }

    if (!enteredPassword) {
        showToast("Inserisci la password amministratore", "error");
        return;
    }

    if (enteredPassword === APP_PASSWORD || enteredPassword === "CLEO-MASTER") {
        sessionStorage.setItem('laundry_auth', 'true');
        sessionStorage.setItem('laundry_logged_as_admin', 'true');
        unlockApp();
        showToast("Accesso amministratore eseguito", "success");
    } else {
        showToast("Password amministratore errata", "error");
        if (loginError) {
            loginError.textContent = "Password errata. Riprova.";
            loginError.classList.remove('hidden');
        }
    }
}

function checkNumericLicense() {
    const inputs = document.querySelectorAll('#loginScreen input');
    let enteredCode = "";

    if (inputs.length > 0) {
        enteredCode = inputs[0].value.trim();
    }

    if (!enteredCode) {
        showToast("Inserisci il codice numerico della licenza", "error");
        return;
    }

    if (enteredCode.toUpperCase() === "TEST1MIN") {
        let expirationTimestamp = Date.now() + (60 * 1000); 
        localStorage.setItem('laundry_device_activated', 'true');
        localStorage.setItem('laundry_license_expiry', expirationTimestamp);
        sessionStorage.setItem('laundry_auth', 'true');
        sessionStorage.setItem('laundry_logged_as_admin', 'false');
        hasShownTodayWarning = false;
        unlockApp();
        startLicenseCountdownMonitor();
        showToast("TEST ATTIVO: Licenza di prova avviata!", "success");
        return;
    }

    if (enteredCode === APP_PASSWORD || enteredCode === "CLEO-MASTER" || enteredCode === "2580") {
        let expirationTimestamp = new Date("2027-08-07T00:00:00").getTime();
        localStorage.setItem('laundry_device_activated', 'true');
        localStorage.setItem('laundry_license_expiry', expirationTimestamp);
        sessionStorage.setItem('laundry_auth', 'true');
        sessionStorage.setItem('laundry_logged_as_admin', 'true');
        hasShownTodayWarning = false;
        unlockApp();
        showToast("Licenza attivata con successo!", "success");
        return;
    }

    showToast("Codice licenza non valido.", "error");
}

function initConnectionMonitor() {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');

    db.ref('.info/connected').on('value', (snap) => {
        if (snap.val() === true) {
            if (statusDot) statusDot.className = "w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]";
            if (statusText) { statusText.textContent = "Online"; statusText.className = "text-emerald-400"; }
        } else {
            if (statusDot) statusDot.className = "w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping";
            if (statusText) { statusText.textContent = "Offline (Locale)"; statusText.className = "text-rose-400"; }
        }
    });
}

window.toggleTheme = function() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('laundry_theme', isDark ? 'dark' : 'light');
    updateThemeUI(isDark);
};

function initTheme() {
    const savedTheme = localStorage.getItem('laundry_theme');
    const isDark = savedTheme ? savedTheme === 'dark' : true; 
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    updateThemeUI(isDark);
}

function updateThemeUI(isDark) {
    const icon = document.getElementById('themeIcon');
    if (icon) icon.className = isDark ? "fa-solid fa-moon" : "fa-solid fa-sun";
}

if (clientDobInput) {
    clientDobInput.addEventListener('input', (e) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 2) val = val.substring(0, 2) + '/' + val.substring(2);
        if (val.length > 5) val = val.substring(0, 5) + '/' + val.substring(5, 9);
        e.target.value = val;
    });
}

function unlockApp() {
    if(loginScreen) {
        loginScreen.style.opacity = '0';
        setTimeout(() => loginScreen.classList.add('hidden'), 400);
    }
    if(appContainer) {
        appContainer.classList.remove('hidden');
        setTimeout(() => appContainer.style.opacity = '1', 50);
    }
    initApp();
}

window.lockApp = function() {
    sessionStorage.removeItem('laundry_auth');
    sessionStorage.removeItem('laundry_logged_as_admin');
    
    if(appContainer) {
        appContainer.style.opacity = '0';
        setTimeout(() => appContainer.classList.add('hidden'), 400);
    }
    if(loginScreen) {
        loginScreen.classList.remove('hidden');
        setTimeout(() => loginScreen.style.opacity = '1', 50);
    }
};

function lockAppComplete() {
    if (licenseCheckInterval) clearInterval(licenseCheckInterval);
    sessionStorage.removeItem('laundry_auth');
    sessionStorage.removeItem('laundry_logged_as_admin');
    localStorage.removeItem('laundry_device_activated');
    localStorage.removeItem('laundry_license_expiry');
    
    if(appContainer) {
        appContainer.style.opacity = '0';
        setTimeout(() => appContainer.classList.add('hidden'), 400);
    }
    if(loginScreen) {
        loginScreen.classList.remove('hidden');
        setTimeout(() => loginScreen.style.opacity = '1', 50);
    }
}

function initApp() {
    loadClients();
    loadItems();
    loadHistory();
}

window.switchTab = function(tab) {
    const viewActive = document.getElementById('viewActive');
    const viewStats = document.getElementById('viewStats');
    const navTabActive = document.getElementById('navTabActive');
    const navTabStats = document.getElementById('navTabStats');

    if (tab === 'active') {
        if(viewStats) viewStats.classList.add('hidden');
        if(viewActive) viewActive.classList.remove('hidden');
        if(navTabActive) navTabActive.className = "px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white shadow-sm cursor-pointer active:scale-95";
        if(navTabStats) navTabStats.className = "px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-darkSurface/50 cursor-pointer active:scale-95";
    } else {
        if(viewActive) viewActive.classList.add('hidden');
        if(viewStats) viewStats.classList.remove('hidden');
        if(navTabStats) navTabStats.className = "px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white shadow-sm cursor-pointer active:scale-95";
        if(navTabActive) navTabActive.className = "px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-darkSurface/50 cursor-pointer active:scale-95";
        renderHistory();
    }
};

// ==========================================
// REGISTRAZIONE CLIENTE
// ==========================================
if (clientForm) {
    clientForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('clientName').value.trim();
        const phone = document.getElementById('clientPhone').value.trim();
        const dob = document.getElementById('clientDob') ? document.getElementById('clientDob').value.trim() : "";
        const address = document.getElementById('clientAddress') ? document.getElementById('clientAddress').value.trim() : "";

        if (!name || !phone) return;

        const clientId = 'cli_' + Date.now();
        const newClient = { name, phone, dob, address };

        clientsData[clientId] = newClient;
        localStorage.setItem('laundry_clients', JSON.stringify(clientsData));
        db.ref('clients').child(clientId).set(newClient).catch(() => {});

        clientForm.reset();
        showToast(`Cliente "${name}" salvato!`, "success");
        
        // Assegna automaticamente al form capo
        selectAssignClient(clientId, name, phone);
        
        renderItems();
    });
}

function loadClients() {
    const local = localStorage.getItem('laundry_clients');
    if (local) clientsData = JSON.parse(local);

    db.ref('clients').on('value', (snapshot) => {
        const val = snapshot.val();
        if (val) {
            clientsData = val;
            localStorage.setItem('laundry_clients', JSON.stringify(val));
        }
        renderItems();
    });
}

// ==========================================
// RICERCA CLIENTE DINAMICA (SEZIONE 2)
// ==========================================
function renderAssignClientDropdown(query = "") {
    if (!assignClientDropdown) return;
    assignClientDropdown.innerHTML = "";

    const cleanQuery = query.toLowerCase().trim();
    const clientsList = Object.entries(clientsData);

    if (clientsList.length === 0) {
        assignClientDropdown.innerHTML = `<div class="p-3 text-xs text-slate-400 italic">Nessun cliente in anagrafica.</div>`;
        assignClientDropdown.classList.remove('hidden');
        return;
    }

    let count = 0;
    const container = document.createElement('div');
    container.className = "max-h-60 overflow-y-auto divide-y divide-darkBorder/40 bg-darkSurface rounded-xl border border-darkBorder shadow-2xl";

    for (let [id, client] of clientsList) {
        const name = client.name || "";
        const phone = client.phone || "";
        const address = client.address || "";
        const dob = client.dob || "";
        
        const fullText = `${name} ${phone} ${address} ${dob}`.toLowerCase();

        if (cleanQuery && !fullText.includes(cleanQuery)) continue;

        count++;
        const item = document.createElement('div');
        item.className = "p-3 hover:bg-blue-600/30 cursor-pointer flex justify-between items-center text-xs transition-colors";
        item.innerHTML = `
            <div>
                <strong class="text-white block font-bold">${name}</strong>
                <span class="text-slate-400 text-[11px]">${address || 'Nessun indirizzo'} ${dob ? '• ' + dob : ''}</span>
            </div>
            <span class="text-blue-400 font-mono font-bold">${phone}</span>
        `;

        item.onmousedown = (e) => {
            e.preventDefault();
            selectAssignClient(id, name, phone);
        };

        container.appendChild(item);
    }

    if (count === 0) {
        assignClientDropdown.innerHTML = `<div class="p-3 text-xs text-slate-400 italic">Nessun risultato trovato.</div>`;
    } else {
        assignClientDropdown.appendChild(container);
    }

    assignClientDropdown.classList.remove('hidden');
}

function selectAssignClient(id, name, phone) {
    if (assignClientSearch) assignClientSearch.value = `${name} (${phone})`;
    if (selectedClientIdInput) selectedClientIdInput.value = id;
    if (assignClientDropdown) assignClientDropdown.classList.add('hidden');
}

if (assignClientSearch) {
    assignClientSearch.addEventListener('input', (e) => {
        if (selectedClientIdInput) selectedClientIdInput.value = "";
        renderAssignClientDropdown(e.target.value);
    });

    assignClientSearch.addEventListener('focus', () => {
        renderAssignClientDropdown(assignClientSearch.value);
    });
}

if (assignClientToggleBtn) {
    assignClientToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (assignClientDropdown && assignClientDropdown.classList.contains('hidden')) {
            renderAssignClientDropdown(assignClientSearch ? assignClientSearch.value : "");
            if (assignClientSearch) assignClientSearch.focus();
        } else if (assignClientDropdown) {
            assignClientDropdown.classList.add('hidden');
        }
    });
}

document.addEventListener('click', (e) => {
    if (assignClientSearch && assignClientDropdown && 
        !assignClientSearch.contains(e.target) && 
        !assignClientDropdown.contains(e.target) && 
        assignClientToggleBtn && !assignClientToggleBtn.contains(e.target)) {
        assignClientDropdown.classList.add('hidden');
    }
});

// ==========================================
// FUNZIONI DI STAMPA RAWBT
// ==========================================
function sendToRawBT(text) {
    try {
        const intentUrl = "intent:#Intent;scheme=rawbt;package=ru.a404m.rawbtprinter;S.text=" + encodeURIComponent(text) + ";end;";
        window.location.href = intentUrl;
    } catch (e) {
        try {
            const b64 = btoa(unescape(encodeURIComponent(text)));
            window.location.href = "rawbt:base64," + b64;
        } catch(err) {
            showToast("Errore invio dati alla stampante", "error");
        }
    }
}

// 1. STAMPA ETICHETTA SOLO CLIENTE
window.printClientOnlyLabel = function() {
    const clientId = selectedClientIdInput ? selectedClientIdInput.value : "";
    
    if (!clientId || !clientsData[clientId]) {
        showToast("Seleziona prima un cliente dalla ricerca!", "error");
        return;
    }

    const client = clientsData[clientId];

    let printText = "";
    printText += "================================\n";
    printText += "        ETICHETTA CLIENTE        \n";
    printText += "================================\n";
    printText += "NOME: " + client.name + "\n";
    printText += "TEL:  " + client.phone + "\n";
    if (client.dob) printText += "DATA NASCITA: " + client.dob + "\n";
    if (client.address) printText += "INDIRIZZO: " + client.address + "\n";
    printText += "================================\n\n\n\n";

    sendToRawBT(printText);
    showToast("Etichetta Cliente inviata alla stampante!", "success");
};

// 2. STAMPA RICEVUTA COMPLETA CAPO
window.printItemLabel = function() {
    const clientId = selectedClientIdInput ? selectedClientIdInput.value : "";
    const type = document.getElementById('itemType') ? document.getElementById('itemType').value.trim() : "";
    const cabinet = document.getElementById('itemCabinet') ? document.getElementById('itemCabinet').value.trim() : "";
    const position = document.getElementById('itemPosition') ? document.getElementById('itemPosition').value.trim() : "";
    const price = document.getElementById('itemPrice') ? document.getElementById('itemPrice').value : "0";
    const notes = document.getElementById('itemNotes') ? document.getElementById('itemNotes').value.trim() : "";

    if (!clientId || !clientsData[clientId]) {
        showToast("Seleziona prima un cliente valido", "error");
        return;
    }
    if (!type || !cabinet || !position) {
        showToast("Inserisci Tipo Capo, Armadio e Posizione", "error");
        return;
    }

    const client = clientsData[clientId];
    const dateStr = new Date().toLocaleDateString('it-IT') + ' ' + new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

    let printText = "";
    printText += "================================\n";
    printText += "        LAVANDERIA CLEO         \n";
    printText += "================================\n";
    printText += "Data: " + dateStr + "\n";
    printText += "Cliente: " + client.name + "\n";
    printText += "Tel:     " + client.phone + "\n";
    printText += "--------------------------------\n";
    printText += "TIPO CAPO: " + type + "\n";
    printText += "ARMADIO:   " + cabinet + "\n";
    printText += "POSIZIONE: " + position + "\n";
    printText += "PREZZO:    € " + parseFloat(price || 0).toFixed(2) + "\n";
    if (notes) {
        printText += "NOTE:      " + notes + "\n";
    }
    printText += "================================\n\n\n\n";

    sendToRawBT(printText);
    showToast("Ricevuta capo inviata alla stampante!", "success");
};

// ==========================================
// SALVATAGGIO CAPO
// ==========================================
if (itemForm) {
    itemForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const clientId = selectedClientIdInput ? selectedClientIdInput.value : "";
        const type = document.getElementById('itemType').value.trim();
        const cabinet = document.getElementById('itemCabinet').value.trim();
        const position = document.getElementById('itemPosition').value.trim();
        const price = parseFloat(document.getElementById('itemPrice').value) || 0;
        const notes = document.getElementById('itemNotes') ? document.getElementById('itemNotes').value.trim() : "";

        if (!clientId || !clientsData[clientId]) {
            showToast("Seleziona prima un cliente valido dalla ricerca", "error");
            return;
        }

        const itemId = 'item_' + Date.now();
        const newItem = { clientId, type, cabinet, position, price, notes, status: "In lavorazione", timestamp: Date.now() };

        itemsData[itemId] = newItem;
        localStorage.setItem('laundry_items', JSON.stringify(itemsData));
        db.ref('items').child(itemId).set(newItem).catch(() => {});

        // Stampa automatica scontrino al salvataggio
        printItemLabel();

        itemForm.reset();
        if(assignClientSearch) assignClientSearch.value = "";
        if(selectedClientIdInput) selectedClientIdInput.value = "";
        showToast(`Capo (${type}) registrato in armadio!`, "success");
        renderItems();
    });
}

// ==========================================
// RENDER TABELLA ATTIVI & STORICO
// ==========================================
function loadItems() {
    const local = localStorage.getItem('laundry_items');
    if (local) itemsData = JSON.parse(local);

    db.ref('items').on('value', (snapshot) => {
        const val = snapshot.val();
        if (val) {
            itemsData = val;
            localStorage.setItem('laundry_items', JSON.stringify(val));
        }
        renderItems();
    });
}

if (activeTableFilter) {
    activeTableFilter.addEventListener('input', () => renderItems());
}

function renderItems() {
    if(!itemsTableBody) return;
    itemsTableBody.innerHTML = "";
    let count = 0, visibleCount = 0;
    const filterVal = activeTableFilter ? activeTableFilter.value.toLowerCase().trim() : "";
    const sorted = Object.entries(itemsData).sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));

    for (let [id, item] of sorted) {
        count++;
        const client = clientsData[item.clientId] || { name: "Non trovato", phone: "N/D" };
        const rowStr = `${client.name} ${client.phone} ${item.type} ${item.cabinet} ${item.position}`.toLowerCase();
        if (filterVal && !rowStr.includes(filterVal)) continue;

        visibleCount++;
        const tr = document.createElement('tr');
        tr.className = "hover:bg-darkCard transition-colors";
        tr.innerHTML = `
            <td class="py-4 px-4">
                <span class="font-semibold text-white cursor-pointer hover:underline" onclick="openClientModal('${item.clientId}')">${client.name}</span>
                <div class="text-xs text-slate-400">${client.phone}</div>
            </td>
            <td class="py-4 px-4">
                <span class="font-medium text-slate-200">${item.type}</span>
                ${item.notes ? `<div class="text-[11px] text-amber-300/90 italic mt-0.5"><i class="fa-solid fa-circle-exclamation mr-1"></i>${item.notes}</div>` : ''}
                <div class="text-xs font-semibold text-emerald-400">€ ${(item.price || 0).toFixed(2)}</div>
            </td>
            <td class="py-4 px-4 text-xs font-semibold text-slate-300">Armadio ${item.cabinet} &bull; Pos. ${item.position}</td>
            <td class="py-4 px-4"><span class="px-3 py-1 rounded-full text-xs font-semibold bg-amber-950 text-amber-400 border border-amber-900">In lavorazione</span></td>
            <td class="py-4 px-4 text-right">
                <button onclick="confirmAndReturn('${id}', '${(item.type || '').replace(/'/g, "\\'")}')" class="px-3 py-1.5 bg-rose-950 hover:bg-rose-900 active:scale-95 text-rose-300 rounded-xl text-xs font-semibold cursor-pointer shadow-sm">Segna Ritirato</button>
            </td>
        `;
        itemsTableBody.appendChild(tr);
    }
    if(itemsCounterBadge) itemsCounterBadge.textContent = `${count} capi attivi`;
    if(noItemsMessage) {
        noItemsMessage.classList.toggle('hidden', visibleCount > 0);
        noItemsMessage.classList.toggle('flex', visibleCount === 0);
    }
}

window.confirmAndReturn = function(id, typeName) {
    if (confirm(`Confermi il ritiro del capo "${typeName}"?`)) markAsReturned(id);
};

window.markAsReturned = function(id) {
    const item = itemsData[id];
    if (!item) return;
    const historyId = 'hist_' + Date.now();
    const historyItem = { ...item, returnedAt: Date.now() };

    historyData[historyId] = historyItem;
    localStorage.setItem('laundry_history', JSON.stringify(historyData));
    delete itemsData[id];
    localStorage.setItem('laundry_items', JSON.stringify(itemsData));

    db.ref('history').child(historyId).set(historyItem);
    db.ref('items').child(id).remove();
    renderItems();
    showToast("Capo archiviato", "success");
};

// ==========================================
// MODALI E SCHEDE
// ==========================================
window.openClientManagerModal = function() {
    renderClientManagerTable();
    const m = document.getElementById('clientManagerModal');
    if(m) m.classList.remove('hidden');
};

window.closeClientManagerModal = function() {
    const m = document.getElementById('clientManagerModal');
    if(m) m.classList.add('hidden');
};

const managerClientSearchInput = document.getElementById('managerClientSearchInput');
if (managerClientSearchInput) {
    managerClientSearchInput.addEventListener('input', () => {
        renderClientManagerTable(managerClientSearchInput.value.trim());
    });
}

function renderClientManagerTable(filter = "") {
    const tbody = document.getElementById('managerClientsTableBody');
    if(!tbody) return;
    tbody.innerHTML = "";
    const lowerFilter = filter.toLowerCase();
    const sorted = Object.entries(clientsData).sort((a, b) => a[1].name.localeCompare(b[1].name));

    for (let [id, client] of sorted) {
        const str = `${client.name} ${client.phone} ${client.address || ''}`.toLowerCase();
        if (filter && !str.includes(lowerFilter)) continue;

        const tr = document.createElement('tr');
        tr.className = "hover:bg-darkCard cursor-pointer";
        tr.innerHTML = `
            <td class="py-3 px-4 font-bold text-white" onclick="closeClientManagerModal(); openClientModal('${id}')">${client.name}</td>
            <td class="py-3 px-4 text-slate-400" onclick="closeClientManagerModal(); openClientModal('${id}')">${client.phone}</td>
            <td class="py-3 px-4 text-slate-400" onclick="closeClientManagerModal(); openClientModal('${id}')">${client.address || 'N/D'} &bull; ${client.dob || ''}</td>
            <td class="py-3 px-4 text-right">
                <button onclick="event.stopPropagation(); deleteClient('${id}', '${client.name.replace(/'/g, "\\'")}')" 
                    class="px-2.5 py-1.5 bg-rose-950/60 hover:bg-rose-900 active:scale-95 text-rose-400 rounded-lg font-semibold cursor-pointer">
                    <i class="fa-solid fa-trash-can mr-1"></i> Elimina
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    }
}

window.deleteClient = function(id, name) {
    if (confirm(`Sei sicuro di voler eliminare permanentemente il cliente "${name}"?`)) {
        delete clientsData[id];
        localStorage.setItem('laundry_clients', JSON.stringify(clientsData));
        db.ref('clients').child(id).remove();
        showToast(`Cliente ${name} eliminato`, "success");
        if (managerClientSearchInput) renderClientManagerTable(managerClientSearchInput.value.trim());
        renderItems();
    }
};

window.openClientModal = function(clientId) {
    const client = clientsData[clientId];
    if (!client) return;

    document.getElementById('modalClientName').textContent = client.name;
    document.getElementById('modalClientDetails').textContent = `Tel: ${client.phone} | Nascita: ${client.dob || 'N/D'} | Indirizzo: ${client.address || 'N/D'}`;

    let totalItems = 0, totalSpent = 0;
    const activeList = document.getElementById('modalClientActiveItemsList');
    activeList.innerHTML = "";
    let activeCount = 0;
    for (let [id, item] of Object.entries(itemsData)) {
        if (item.clientId === clientId) {
            activeCount++; totalItems++; totalSpent += (item.price || 0);
            const div = document.createElement('div');
            div.className = "p-3 bg-darkCard rounded-xl border border-darkBorder flex justify-between items-center text-xs";
            div.innerHTML = `<span class="font-bold text-slate-200">${item.type} (Armadio ${item.cabinet})</span><span class="text-emerald-400 font-semibold">€ ${(item.price || 0).toFixed(2)}</span>`;
            activeList.appendChild(div);
        }
    }
    if (activeCount === 0) activeList.innerHTML = `<p class="text-xs text-slate-400 italic">Nessun capo attivo.</p>`;

    const historyList = document.getElementById('modalClientHistoryList');
    historyList.innerHTML = "";
    let histCount = 0;
    for (let [id, item] of Object.entries(historyData)) {
        if (item.clientId === clientId) {
            histCount++; totalItems++; totalSpent += (item.price || 0);
            const dateStr = new Date(item.returnedAt).toLocaleDateString('it-IT');
            const div = document.createElement('div');
            div.className = "p-3 bg-darkCard rounded-xl border border-darkBorder flex justify-between items-center text-xs";
            div.innerHTML = `<span class="text-slate-400">${dateStr} &bull; <strong class="text-slate-200">${item.type}</strong></span><span class="text-emerald-400 font-semibold">€ ${(item.price || 0).toFixed(2)}</span>`;
            historyList.appendChild(div);
        }
    }
    if (histCount === 0) historyList.innerHTML = `<p class="text-xs text-slate-400 italic">Nessun capo nello storico.</p>`;

    document.getElementById('modalClientTotalItems').textContent = totalItems;
    document.getElementById('modalClientTotalSpent').textContent = `€ ${totalSpent.toFixed(2)}`;
    document.getElementById('clientModal').classList.remove('hidden');
};

window.closeClientModal = function() {
    document.getElementById('clientModal').classList.add('hidden');
};

function loadHistory() {
    const local = localStorage.getItem('laundry_history');
    if (local) historyData = JSON.parse(local);

    db.ref('history').on('value', (snapshot) => {
        const val = snapshot.val();
        if (val) {
            historyData = val;
            localStorage.setItem('laundry_history', JSON.stringify(val));
        }
        const statsView = document.getElementById('viewStats');
        if (statsView && !statsView.classList.contains('hidden')) renderHistory();
    });
}

function renderHistory() {
    const historyTableBody = document.getElementById('historyTableBody');
    if(!historyTableBody) return;
    historyTableBody.innerHTML = "";
    let count = 0, totalRevenue = 0;
    let uniqueClients = new Set(), typeCounts = {};

    const sorted = Object.entries(historyData).sort((a, b) => (b[1].returnedAt || 0) - (a[1].returnedAt || 0));

    for (let [id, item] of sorted) {
        const retDate = new Date(item.returnedAt || Date.now());

        count++;
        totalRevenue += (item.price || 0);
        uniqueClients.add(item.clientId);
        const tLower = (item.type || "Altro").toLowerCase();
        typeCounts[tLower] = (typeCounts[tLower] || 0) + 1;

        const client = clientsData[item.clientId] || { name: "Non trovato" };
        const tr = document.createElement('tr');
        tr.className = "hover:bg-darkCard text-sm";
        tr.innerHTML = `<td class="py-3 px-4 text-xs text-slate-400">${retDate.toLocaleDateString('it-IT')}</td><td class="py-3 px-4 font-semibold text-white">${client.name}</td><td class="py-3 px-4">${item.type}</td><td class="py-3 px-4 font-semibold text-emerald-400">€ ${(item.price || 0).toFixed(2)}</td><td class="py-3 px-4 text-xs text-slate-400">Armadio ${item.cabinet}</td>`;
        historyTableBody.appendChild(tr);
    }

    document.getElementById('statTotalCount').textContent = count;
    document.getElementById('statTotalRevenue').textContent = `€ ${totalRevenue.toFixed(2)}`;
    document.getElementById('statUniqueClients').textContent = uniqueClients.size;
    document.getElementById('historyCounter').textContent = `${count} elementi`;

    let topType = "-", maxC = 0;
    for (let [t, c] of Object.entries(typeCounts)) {
        if (c > maxC) { maxC = c; topType = t.charAt(0).toUpperCase() + t.slice(1); }
    }
    document.getElementById('statTopItemType').textContent = topType;
}

function showToast(message, type = "success") {
    const toast = document.getElementById('toastNotification');
    const toastMsg = document.getElementById('toastMessage');
    if(!toast || !toastMsg) return;
    toastMsg.textContent = message;
    toast.classList.remove('translate-y-20', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
    setTimeout(() => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('translate-y-20', 'opacity-0');
    }, 3500);
}
