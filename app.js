// ==========================================
// LAVANDERIA CLEO - APP LOGIC (LOCKED LICENSE & ADMIN TOGGLE)
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
            const expiredModal = document.getElementById('licenseExpiredModal');
            if (expiredModal) expiredModal.classList.remove('hidden');
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
            
            const warningModal = document.getElementById('licenseWarningModal');
            if (warningModal) warningModal.classList.add('hidden');

            const expiredModal = document.getElementById('licenseExpiredModal');
            if (expiredModal) expiredModal.classList.remove('hidden');
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
        const warningText = document.getElementById('licenseWarningText');
        if (warningText) {
            if (diffDays === 1) {
                warningText.textContent = `⚠️ ATTENZIONE: La licenza scadrà domani! Rinnovala subito per evitare il blocco del gestionale.`;
            } else {
                warningText.textContent = `⚠️ La licenza di questo dispositivo scadrà tra ${diffDays} giorni. Contatta l'amministratore per il rinnovo.`;
            }
        }
        const warningModal = document.getElementById('licenseWarningModal');
        if (warningModal) {
            warningModal.classList.remove('hidden');
            hasShownTodayWarning = true;
        }
    }
}

window.closeWarningModal = function() {
    const warningModal = document.getElementById('licenseWarningModal');
    if (warningModal) warningModal.classList.add('hidden');
};

window.closeExpiredModalAndRelogin = function() {
    const expiredModal = document.getElementById('licenseExpiredModal');
    if (expiredModal) expiredModal.classList.add('hidden');
    lockAppComplete();
};

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
        showToast("TEST ATTIVO: Licenza di prova di 1 minuto avviata!", "success");
        return;
    }

    const alreadyUsedCode = localStorage.getItem('laundry_code_already_redeemed');
    if (alreadyUsedCode === enteredCode && enteredCode !== APP_PASSWORD && enteredCode !== "CLEO-MASTER") {
        showToast("Questo dispositivo ha già utilizzato questo codice. Non puoi riusarlo.", "error");
        return;
    }

    if (enteredCode === APP_PASSWORD || enteredCode === "CLEO-MASTER") {
        let expirationTimestamp = Date.now() + (365 * 100 * 24 * 60 * 60 * 1000);
        localStorage.setItem('laundry_device_activated', 'true');
        localStorage.setItem('laundry_license_expiry', expirationTimestamp);
        sessionStorage.setItem('laundry_auth', 'true');
        sessionStorage.setItem('laundry_logged_as_admin', 'true');
        hasShownTodayWarning = false;
        unlockApp();
        showToast("Accesso Master illimitato eseguito!", "success");
        return;
    }

    db.ref('used_licenses/' + enteredCode).once('value').then((usedSnap) => {
        if (usedSnap.exists() && enteredCode === "2580") {
            showToast("Questo codice 2580 è già stato utilizzato su un altro dispositivo!", "error");
            return;
        }

        db.ref('licenses').once('value')
            .then((snapshot) => {
                const licenses = snapshot.val();
                let matchedKey = null;

                if (licenses) {
                    for (let key in licenses) {
                        if (String(key) === String(enteredCode) || String(licenses[key]) === String(enteredCode)) {
                            matchedKey = key;
                            break;
                        }
                    }
                }

                if (enteredCode === "2580" || matchedKey) {
                    let expirationTimestamp = new Date("2027-08-07T00:00:00").getTime();
                    
                    db.ref('used_licenses/' + enteredCode).set(true);
                    if (matchedKey) {
                        db.ref('licenses').child(matchedKey).remove().catch(() => {});
                    }

                    localStorage.setItem('laundry_device_activated', 'true');
                    localStorage.setItem('laundry_active_license', enteredCode);
                    localStorage.setItem('laundry_code_already_redeemed', enteredCode);
                    localStorage.setItem('laundry_license_expiry', expirationTimestamp);
                    sessionStorage.setItem('laundry_auth', 'true');
                    sessionStorage.setItem('laundry_logged_as_admin', 'false');
                    hasShownTodayWarning = false;
                    
                    unlockApp();
                    startLicenseCountdownMonitor();
                    showToast("Licenza attivata con successo fino al 7 Agosto 2027!", "success");
                } else {
                    showToast("Codice licenza non valido o già utilizzato.", "error");
                }
            })
            .catch(() => {
                if (enteredCode === "2580") {
                    let expirationTimestamp = new Date("2027-08-07T00:00:00").getTime();
                    db.ref('used_licenses/' + enteredCode).set(true);
                    localStorage.setItem('laundry_device_activated', 'true');
                    localStorage.setItem('laundry_active_license', enteredCode);
                    localStorage.setItem('laundry_code_already_redeemed', enteredCode);
                    localStorage.setItem('laundry_license_expiry', expirationTimestamp);
                    hasShownTodayWarning = false;
                    sessionStorage.setItem('laundry_auth', 'true');
                    sessionStorage.setItem('laundry_logged_as_admin', 'false');
                    unlockApp();
                    showToast("Licenza attivata con successo!", "success");
                } else {
                    showToast("Errore di connessione e codice non riconosciuto offline.", "error");
                }
            });
    });
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
    const isLoggedAsAdmin = sessionStorage.getItem('laundry_logged_as_admin');
    
    if (isLoggedAsAdmin !== 'true') {
        showToast("Dispositivo con licenza attiva: impossibile uscire.", "error");
        return;
    }

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
    
    const inputs = document.querySelectorAll('#loginScreen input');
    inputs.forEach(input => input.value = '');
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
    
    const inputs = document.querySelectorAll('#loginScreen input');
    inputs.forEach(input => input.value = '');
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

if (clientForm) {
    clientForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('clientName').value.trim();
        const phone = document.getElementById('clientPhone').value.trim();
        const dob = document.getElementById('clientDob').value.trim();
        const address = document.getElementById('clientAddress').value.trim();

        if (!name || !phone) return;

        const clientId = 'cli_' + Date.now();
        const newClient = { name, phone, dob, address };

        clientsData[clientId] = newClient;
        localStorage.setItem('laundry_clients', JSON.stringify(clientsData));
        db.ref('clients').child(clientId).set(newClient).catch(() => {});

        clientForm.reset();
        showToast(`Cliente "${name}" registrato!`, "success");
        renderItems();
        const managerModal = document.getElementById('clientManagerModal');
        if (managerModal && !managerModal.classList.contains('hidden')) {
            renderClientManagerTable();
        }
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
        const managerModal = document.getElementById('clientManagerModal');
        if (managerModal && !managerModal.classList.contains('hidden')) {
            renderClientManagerTable();
        }
        renderItems();
    });
}

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

function renderAssignClientDropdown(filter = "") {
    if (!assignClientDropdown || !selectedClientIdInput) return;
    assignClientDropdown.innerHTML = "";
    const lowerFilter = filter.toLowerCase();
    const sorted = Object.entries(clientsData).sort((a, b) => a[1].name.localeCompare(b[1].name));
    let matches = 0;

    const tableHeader = document.createElement('div');
    tableHeader.className = "grid grid-cols-3 px-4 py-2.5 text-[11px] font-bold text-slate-400 uppercase bg-darkSurface border-b border-darkBorder sticky top-0 shadow-sm";
    tableHeader.innerHTML = `<span>Cliente (Nome)</span><span>Telefono</span><span>Indirizzo</span>`;
    assignClientDropdown.appendChild(tableHeader);

    const rowsContainer = document.createElement('div');
    rowsContainer.className = "divide-y divide-darkBorder/50";

    for (let [id, client] of sorted) {
        const str = `${client.name} ${client.phone} ${client.address || ''}`.toLowerCase();
        if (filter && !str.includes(lowerFilter)) continue;

        matches++;
        const rowDiv = document.createElement('div');
        rowDiv.className = "grid grid-cols-3 px-4 py-2.5 hover:bg-blue-600/10 cursor-pointer text-xs items-center";
        rowDiv.innerHTML = `
            <span class="font-bold text-white truncate pr-2">${client.name}</span>
            <span class="text-slate-400 truncate pr-2">${client.phone}</span>
            <span class="text-slate-400 truncate">${client.address || 'N/D'}</span>
        `;
        rowDiv.addEventListener('click', () => {
            assignClientSearch.value = `${client.name} (${client.phone})`;
            selectedClientIdInput.value = id;
            assignClientDropdown.classList.add('hidden');
        });
        rowsContainer.appendChild(rowDiv);
    }

    if (matches === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = "p-6 text-center text-xs text-slate-400 italic";
        emptyDiv.textContent = "Nessun cliente trovato in anagrafica.";
        rowsContainer.appendChild(emptyDiv);
    }

    assignClientDropdown.appendChild(rowsContainer);
    assignClientDropdown.classList.remove('hidden');
}

if (assignClientSearch) {
    assignClientSearch.addEventListener('focus', () => renderAssignClientDropdown(assignClientSearch.value.trim()));
    assignClientSearch.addEventListener('input', (e) => {
        selectedClientIdInput.value = "";
        renderAssignClientDropdown(e.target.value.trim());
    });
}

if (assignClientToggleBtn) {
    assignClientToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (assignClientDropdown.classList.contains('hidden')) {
            renderAssignClientDropdown("");
            assignClientSearch.focus();
        } else {
            assignClientDropdown.classList.add('hidden');
        }
    });
}

if (itemForm) {
    itemForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const clientId = selectedClientIdInput.value;
        const type = document.getElementById('itemType').value.trim();
        const cabinet = document.getElementById('itemCabinet').value.trim();
        const position = document.getElementById('itemPosition').value.trim();
        const price = parseFloat(document.getElementById('itemPrice').value) || 0;
        const notes = document.getElementById('itemNotes') ? document.getElementById('itemNotes').value.trim() : "";
        const status = "Pronto per il ritiro";

        if (!clientId || !clientsData[clientId]) {
            showToast("Seleziona un cliente valido", "error");
            return;
        }

        const itemId = 'item_' + Date.now();
        const newItem = { clientId, type, cabinet, position, price, notes, status, timestamp: Date.now() };

        itemsData[itemId] = newItem;
        localStorage.setItem('laundry_items', JSON.stringify(itemsData));
        db.ref('items').child(itemId).set(newItem).catch(() => {});

        itemForm.reset();
        if(assignClientSearch) assignClientSearch.value = "";
        if(selectedClientIdInput) selectedClientIdInput.value = "";
        showToast(`Capo (${type}) registrato in armadio ${cabinet}`, "success");
        renderItems();
    });
}

window.printItemLabel = function() {
    const clientId = selectedClientIdInput.value;
    const type = document.getElementById('itemType').value.trim();
    const cabinet = document.getElementById('itemCabinet').value.trim();
    const position = document.getElementById('itemPosition').value.trim();
    const price = document.getElementById('itemPrice').value;
    const notes = document.getElementById('itemNotes') ? document.getElementById('itemNotes').value.trim() : "";

    if (!clientId || !clientsData[clientId]) {
        showToast("Seleziona prima un cliente", "error");
        return;
    }
    if (!type || !cabinet || !position) {
        showToast("Compila tipo capo, armadio e posizione", "error");
        return;
    }

    const client = clientsData[clientId];
    const dateStr = new Date().toLocaleDateString('it-IT') + ' ' + new Date().toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'});

    const generateSingleReceipt = (copyType) => {
        let block = "";
        block += "\x1B\x40\x1B\x61\x01\x1B\x21\x10LAVANDERIA CLEO\n\x1B\x21\x08[COPIA " + copyType + "]\n" + dateStr + "\n\x1B\x21\x00--------------------------------\n\x1B\x61\x00Cliente: " + client.name + "\nTel: " + client.phone + "\nCapo:    " + type + "\n";
        if (notes) block += `Note:    ${notes}\n`;
        block += "--------------------------------\n\x1B\x61\x01\x1B\x21\x30ARM: " + cabinet + "\nPOS: " + position + "\n\x1B\x21\x00--------------------------------\n\x1B\x61\x02\x1B\x21\x10Prezzo: EUR " + parseFloat(price || 0).toFixed(2) + "\n\x1B\x21\x00\x1B\x61\x01\n* Conservare per il ritiro *\n\n\n";
        return block;
    };

    let printText = generateSingleReceipt("ATTIVITA") + "\x1D\x56\x41\x03" + generateSingleReceipt("CLIENTE") + "\x1D\x56\x41\x03";
    try {
        const base64Data = btoa(unescape(encodeURIComponent(printText)));
        window.location.href = `rawbt:base64,${base64Data}`;
        showToast("Ricevute inviate in stampa!", "success");
    } catch (err) {
        showToast("Errore di stampa.", "error");
    }
};

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
        tr.className = "hover:bg-darkCard";
        tr.innerHTML = `
            <td class="py-4 px-4">
                <span class="font-semibold text-white cursor-pointer hover:underline" onclick="openClientModal('${item.clientId}')">${client.name}</span>
                <div class="text-xs text-slate-400">${client.phone}</div>
            </td>
            <td class="py-4 px-4">
                <span class="font-medium text-slate-200">${item.type}</span>
                ${item.notes ? `<div class="text-[11px] text-amber-300/90 italic mt-0.5"><i class="fa-solid fa-circle-exclamation mr-1"></i>${item.notes}</div>` : ''}
                <div class="text-xs font-semibold text-emerald-400">€ ${item.price.toFixed(2)}</div>
            </td>
            <td class="py-4 px-4 text-xs font-semibold text-slate-300">Armadio ${item.cabinet} &bull; Pos. ${item.position}</td>
            <td class="py-4 px-4"><span class="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-900">Pronto per il ritiro</span></td>
            <td class="py-4 px-4 text-right">
                <button onclick="confirmAndReturn('${id}', '${item.type.replace(/'/g, "\\'")}')" class="px-3 py-1.5 bg-rose-950 hover:bg-rose-900 active:scale-95 text-rose-300 rounded-xl text-xs font-semibold cursor-pointer shadow-sm">Segna Ritirato</button>
            </td>
        `;
        itemsTableBody.appendChild(tr);
    }
    if(itemsCounterBadge) itemsCounterBadge.textContent = `${count} capi pronti`;
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

if (globalSearch) {
    globalSearch.addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase().trim();
        if(!globalSearchDropdown || !searchClearBtn) return;
        globalSearchDropdown.innerHTML = "";
        searchClearBtn.classList.toggle('hidden', !val);

        if (!val) {
            globalSearchDropdown.classList.add('hidden');
            return;
        }

        let resultsFound = 0;
        for (let [clientId, client] of Object.entries(clientsData)) {
            let clientActiveItems = [];
            for (let [itemId, item] of Object.entries(itemsData)) {
                if (item.clientId === clientId) clientActiveItems.push(item);
            }

            const matchClient = `${client.name} ${client.phone} ${client.address || ''}`.toLowerCase().includes(val);
            const matchItem = clientActiveItems.some(i => i.type.toLowerCase().includes(val) || i.cabinet.toLowerCase().includes(val));

            if (matchClient || matchItem) {
                resultsFound++;
                const div = document.createElement('div');
                div.className = "p-4 hover:bg-darkCard cursor-default";
                let itemsHtml = clientActiveItems.length > 0 ? `<div class="mt-2.5 space-y-1.5 border-t border-darkBorder pt-2">` : `<div class="mt-2 text-xs text-slate-400 italic">Nessun capo attivo.</div>`;
                clientActiveItems.forEach(item => {
                    itemsHtml += `<div class="flex items-center justify-between text-xs bg-darkBg p-2 rounded-lg border border-darkBorder"><div><span class="font-bold text-white">${item.type}</span> <span class="text-slate-400 ml-1">&bull; Armadio: <strong class="text-blue-400">${item.cabinet}</strong></span></div><span class="font-bold text-emerald-400">€ ${item.price.toFixed(2)}</span></div>`;
                });
                if(clientActiveItems.length > 0) itemsHtml += `</div>`;

                div.innerHTML = `<div class="flex justify-between items-start"><div><div class="font-bold text-white text-sm">${client.name}</div><div class="text-xs text-slate-400 mt-0.5">Tel: ${client.phone}</div></div><button type="button" onclick="openClientModal('${clientId}'); globalSearchDropdown.classList.add('hidden'); globalSearch.value='';" class="text-xs bg-blue-950 hover:bg-blue-900 text-blue-400 px-3 py-1.5 rounded-lg font-semibold cursor-pointer">Scheda</button></div>${itemsHtml}`;
                globalSearchDropdown.appendChild(div);
            }
        }
        globalSearchDropdown.classList.toggle('hidden', resultsFound === 0);
    });
}

if (searchClearBtn) {
    searchClearBtn.addEventListener('click', () => {
        if(globalSearch) globalSearch.value = "";
        if(globalSearchDropdown) globalSearchDropdown.classList.add('hidden');
        searchClearBtn.classList.add('hidden');
    });
}

document.addEventListener('click', (e) => {
    if (globalSearch && globalSearchDropdown && !globalSearch.contains(e.target) && !globalSearchDropdown.contains(e.target)) globalSearchDropdown.classList.add('hidden');
    if (assignClientSearch && assignClientDropdown && assignClientToggleBtn && !assignClientSearch.contains(e.target) && !assignClientDropdown.contains(e.target) && !assignClientToggleBtn.contains(e.target)) assignClientDropdown.classList.add('hidden');
});

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

window.setStatPeriod = function(period) {
    currentStatPeriod = period;
    document.getElementById('statsCustomStartDate').value = "";
    document.getElementById('statsCustomEndDate').value = "";

    ['Day', 'Month', 'Year', 'All'].forEach(p => {
        const btn = document.getElementById(`btnPeriod${p}`);
        if(btn) btn.className = "px-3.5 py-2 bg-darkSurface border border-darkBorder text-xs font-semibold rounded-xl text-slate-300 hover:bg-zinc-850 cursor-pointer active:scale-95";
    });
    
    const activeBtn = document.getElementById(`btnPeriod${period.charAt(0).toUpperCase() + period.slice(1)}`);
    if(activeBtn) activeBtn.className = "px-3.5 py-2 bg-blue-600 border border-blue-500 text-xs font-semibold rounded-xl text-white shadow-sm cursor-pointer active:scale-95";

    renderHistory();
};

window.clearCustomDateFilter = function() {
    document.getElementById('statsCustomStartDate').value = "";
    document.getElementById('statsCustomEndDate').value = "";
    renderHistory();
};

window.resetAllStatistics = function() {
    if (confirm("Vuoi azzerare tutte le statistiche?")) {
        historyData = {};
        localStorage.removeItem('laundry_history');
        db.ref('history').remove();
        showToast("Statistiche azzerate", "success");
        renderHistory();
    }
};

function renderHistory() {
    const historyTableBody = document.getElementById('historyTableBody');
    if(!historyTableBody) return;
    historyTableBody.innerHTML = "";
    let count = 0, totalRevenue = 0;
    let uniqueClients = new Set(), typeCounts = {};

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentMonth = now.getMonth(), currentYear = now.getFullYear();

    const customStartEl = document.getElementById('statsCustomStartDate');
    const customEndEl = document.getElementById('statsCustomEndDate');
    let customStart = customStartEl && customStartEl.value ? new Date(customStartEl.value + "T00:00:00") : null;
    let customEnd = customEndEl && customEndEl.value ? new Date(customEndEl.value + "T23:59:59") : null;

    const sorted = Object.entries(historyData).sort((a, b) => (b[1].returnedAt || 0) - (a[1].returnedAt || 0));

    for (let [id, item] of sorted) {
        const retDate = new Date(item.returnedAt || Date.now());
        const retDateStr = retDate.toISOString().split('T')[0];

        if (customStart || customEnd) {
            if (customStart && retDate < customStart) continue;
            if (customEnd && retDate > customEnd) continue;
        } else {
            if (currentStatPeriod === 'day' && retDateStr !== todayStr) continue;
            if (currentStatPeriod === 'month' && (retDate.getMonth() !== currentMonth || retDate.getFullYear() !== currentYear)) continue;
            if (currentStatPeriod === 'year' && retDate.getFullYear() !== currentYear) continue;
        }

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

window.exportBackup = function() {
    const generationDate = new Date().toLocaleDateString('it-IT');
    const startDateInput = document.getElementById('statsCustomStartDate');
    const endDateInput = document.getElementById('statsCustomEndDate');
    const startDate = startDateInput && startDateInput.value ? new Date(startDateInput.value) : null;
    const endDate = endDateInput && endDateInput.value ? new Date(endDateInput.value) : null;
    if (endDate) endDate.setHours(23, 59, 59, 999);

    let totalItemsCount = 0, grandTotalRevenue = 0, typeCounts = {}, filteredHistory = [];
    const sortedHistory = Object.entries(historyData).sort((a, b) => (b[1].returnedAt || 0) - (a[1].returnedAt || 0));

    for (let [id, item] of sortedHistory) {
        const retDate = new Date(item.returnedAt || Date.now());
        if (startDate && retDate < startDate) continue;
        if (endDate && retDate > endDate) continue;

        filteredHistory.push({ id, item, retDate });
        totalItemsCount++;
        grandTotalRevenue += (item.price || 0);
        const tLower = (item.type || "Altro").trim().toLowerCase();
        typeCounts[tLower] = (typeCounts[tLower] || 0) + 1;
    }

    let topProduct = "Nessuno", maxCount = 0;
    for (let [t, c] of Object.entries(typeCounts)) {
        if (c > maxCount) { maxCount = c; topProduct = t.charAt(0).toUpperCase() + t.slice(1); }
    }

    let csvContent = "\uFEFF";
    csvContent += `"LAVANDERIA CLEO - REPORT";;;;;;\n"Data generazione:";"${generationDate}";;;;;\n`;
    csvContent += `"=== STATISTICHE ===";;;;;;\n"Totale Capi:";"${totalItemsCount}";;;;;\n"Incasso:";"€ ${grandTotalRevenue.toFixed(2).replace('.', ',')}";;;;;\n\n`;
    
    csvContent += `"=== STORICO ===";;;;;;\n"Data Ritiro";"Cliente";"Tel";"Capo";"Prezzo";"Armadio";"Posizione"\n`;
    for (let entry of filteredHistory) {
        const item = entry.item;
        const retDateStr = entry.retDate.toLocaleDateString('it-IT');
        const client = clientsData[item.clientId] || { name: "Non trovato", phone: "N/D" };
        csvContent += `"${retDateStr}";"${client.name}";"${client.phone}";"${item.type}";"${(item.price || 0).toFixed(2).replace('.', ',')}";"${item.cabinet}";"${item.position}"\n`;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Report_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Report esportato!", "success");
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
