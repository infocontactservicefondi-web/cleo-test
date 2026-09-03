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

const clientNameInput = document.getElementById('clientName');
const clientSearchToggleBtn = document.getElementById('clientSearchToggleBtn');
const clientSearchDropdown = document.getElementById('clientSearchDropdown');

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

document.addEventListener('DOMContentLoaded', () => {
    initLicenseSystem();
    initTheme();
    initConnectionMonitor(); 
    initGlobalResetListener(); 
    initProtectedLogo(); 

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            checkAdminPassword();
            return false;
        });
    }
});

// ==========================================
// ASCOLTATORE RESET REMOTO GLOBALE
// ==========================================
function initGlobalResetListener() {
    db.ref('global_reset_signal').on('value', (snap) => {
        const serverSignal = snap.val();
        if (serverSignal) {
            const localSignalProcessed = localStorage.getItem('laundry_last_reset_processed');
            if (localSignalProcessed !== String(serverSignal)) {
                localStorage.setItem('laundry_last_reset_processed', String(serverSignal));
                localStorage.removeItem('laundry_device_activated');
                localStorage.removeItem('laundry_license_expiry');
                localStorage.removeItem('laundry_active_license');
                sessionStorage.clear();
                
                lockAppComplete();
                showToast("Dispositivo scollegato da remoto.", "error");
            }
        }
    });
}

// ==========================================
// PROTEZIONE LOGO
// ==========================================
function initProtectedLogo() {
    const logoBtn = document.getElementById('protectedLogoBtn');
    const progressFill = document.getElementById('logoProgressFill');
    let logoPressTimer = null;
    const holdDuration = 5000;
    
    if (logoBtn) {
        ['mousedown', 'touchstart'].forEach(evt => {
            logoBtn.addEventListener(evt, (e) => {
                e.preventDefault();
                let startTime = Date.now();
                if(progressFill) progressFill.style.height = '100%';
                
                logoPressTimer = setInterval(() => {
                    let elapsed = Date.now() - startTime;
                    if (elapsed >= holdDuration) {
                        clearInterval(logoPressTimer);
                        if(progressFill) progressFill.style.height = '0%';
                        showToast("Sblocco forzato attivato!", "success");
                        lockAppComplete(); 
                    }
                }, 100);
            });
        });

        ['mouseup', 'mouseleave', 'touchend'].forEach(evt => {
            logoBtn.addEventListener(evt, () => {
                if (logoPressTimer) clearInterval(logoPressTimer);
                if(progressFill) progressFill.style.height = '0%';
            });
        });
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
            sessionStorage.setItem('laundry_auth', 'true');
            unlockApp();
            return;
        } else {
            lockAppComplete();
        }
    }
}

function checkAdminPassword() {
    const passwordField = document.getElementById('passwordInput');
    const enteredPassword = passwordField ? passwordField.value.trim() : "";

    if (!enteredPassword) {
        showToast("Inserisci la password amministratore", "error");
        return;
    }

    if (enteredPassword === APP_PASSWORD || enteredPassword === "CLEO-MASTER") {
        let expirationTimestamp = Date.now() + (365 * 100 * 24 * 60 * 60 * 1000);
        localStorage.setItem('laundry_device_activated', 'true');
        localStorage.setItem('laundry_license_expiry', expirationTimestamp);
        sessionStorage.setItem('laundry_auth', 'true');
        unlockApp();
        showToast("Accesso eseguito con successo!", "success");
    } else {
        showToast("Password errata", "error");
        if (loginError) {
            loginError.textContent = "Password errata. Riprova.";
            loginError.classList.remove('hidden');
        }
    }
}

function checkNumericLicense(e) {
    if (e && e.preventDefault) e.preventDefault();
    
    const licenseInput = document.getElementById('licensePhoneInput');
    let enteredCode = licenseInput ? licenseInput.value.trim() : "";

    if (!enteredCode) {
        showToast("Inserisci il codice di licenza", "error");
        return;
    }

    if (enteredCode === APP_PASSWORD || enteredCode === "CLEO-MASTER") {
        let expirationTimestamp = Date.now() + (365 * 100 * 24 * 60 * 60 * 1000);
        localStorage.setItem('laundry_device_activated', 'true');
        localStorage.setItem('laundry_license_expiry', expirationTimestamp);
        sessionStorage.setItem('laundry_auth', 'true');
        unlockApp();
        showToast("Accesso Master eseguito!", "success");
        return;
    }

    db.ref('licenses/' + enteredCode).once('value').then((snapshot) => {
        const licenseData = snapshot.val();
        let expirationTimestamp = null;

        if (licenseData) {
            if (typeof licenseData === 'object' && licenseData.expiry) {
                expirationTimestamp = licenseData.expiry;
            } else if (typeof licenseData === 'number') {
                expirationTimestamp = licenseData;
            }
        }

        if (!expirationTimestamp) {
            showToast("Codice licenza non valido o scaduto.", "error");
            return;
        }

        localStorage.setItem('laundry_device_activated', 'true');
        localStorage.setItem('laundry_active_license', enteredCode);
        localStorage.setItem('laundry_license_expiry', expirationTimestamp);
        sessionStorage.setItem('laundry_auth', 'true');
        
        unlockApp();
        const expiryDateFormatted = new Date(expirationTimestamp).toLocaleDateString('it-IT');
        showToast(`Licenza attivata con successo fino al ${expiryDateFormatted}!`, "success");
    }).catch(() => {
        showToast("Errore durante la verifica della licenza.", "error");
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
            if (statusText) { statusText.textContent = "Offline"; statusText.className = "text-rose-400"; }
        }
    });
}

// ==========================================
// TEMA
// ==========================================
window.toggleTheme = function() {
    const htmlEl = document.documentElement;
    const isCurrentlyDark = htmlEl.classList.contains('dark');
    
    if (isCurrentlyDark) {
        htmlEl.classList.remove('dark');
        localStorage.setItem('laundry_theme', 'light');
        updateThemeUI(false);
    } else {
        htmlEl.classList.add('dark');
        localStorage.setItem('laundry_theme', 'dark');
        updateThemeUI(true);
    }
};

function initTheme() {
    const savedTheme = localStorage.getItem('laundry_theme');
    const htmlEl = document.documentElement;
    
    if (savedTheme === 'light') {
        htmlEl.classList.remove('dark');
        updateThemeUI(false);
    } else {
        htmlEl.classList.add('dark');
        localStorage.setItem('laundry_theme', 'dark');
        updateThemeUI(true);
    }
}

function updateThemeUI(isDark) {
    const icon = document.getElementById('themeIcon');
    if (icon) {
        icon.className = isDark ? "fa-solid fa-moon" : "fa-solid fa-sun";
    }
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

function lockAppComplete() {
    sessionStorage.clear();
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

// ==========================================
// GESTIONE CLIENTE E CAPI
// ==========================================
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

function loadHistory() {
    const local = localStorage.getItem('laundry_history');
    if (local) historyData = JSON.parse(local);

    db.ref('history').on('value', (snapshot) => {
        const val = snapshot.val();
        if (val) {
            historyData = val;
            localStorage.setItem('laundry_history', JSON.stringify(val));
        }
        renderHistory();
    });
}

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
        db.ref('clients').child(clientId).set(newClient);

        clientForm.reset();
        showToast(`Cliente "${name}" registrato!`, "success");
        renderItems();
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

        if (!clientId || !clientsData[clientId]) {
            showToast("Seleziona un cliente valido", "error");
            return;
        }

        const itemId = 'item_' + Date.now();
        const newItem = { clientId, type, cabinet, position, price, notes, status: "In lavorazione", timestamp: Date.now() };

        itemsData[itemId] = newItem;
        localStorage.setItem('laundry_items', JSON.stringify(itemsData));
        db.ref('items').child(itemId).set(newItem);

        itemForm.reset();
        if(assignClientSearch) assignClientSearch.value = "";
        if(selectedClientIdInput) selectedClientIdInput.value = "";
        showToast(`Capo inserito con successo`, "success");
        renderItems();
    });
}

function renderItems() {
    if(!itemsTableBody) return;
    itemsTableBody.innerHTML = "";
    let count = 0;
    const sorted = Object.entries(itemsData).sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));

    for (let [id, item] of sorted) {
        count++;
        const client = clientsData[item.clientId] || { name: "Non trovato", phone: "N/D" };
        const tr = document.createElement('tr');
        tr.className = "hover:bg-darkCard";
        tr.innerHTML = `
            <td class="py-4 px-4 font-semibold text-white">${client.name}<div class="text-xs text-slate-400">${client.phone}</div></td>
            <td class="py-4 px-4"><span class="font-medium text-slate-200">${item.type}</span><div class="text-xs font-semibold text-emerald-400">€ ${item.price.toFixed(2)}</div></td>
            <td class="py-4 px-4 text-xs font-semibold text-slate-300">Armadio ${item.cabinet} &bull; Pos. ${item.position}</td>
            <td class="py-4 px-4"><span class="px-3 py-1 rounded-full text-xs font-semibold bg-amber-950 text-amber-400 border border-amber-900">In lavorazione</span></td>
            <td class="py-4 px-4 text-right">
                <button onclick="markAsReturned('${id}')" class="px-3 py-1.5 bg-rose-950 hover:bg-rose-900 text-rose-300 rounded-xl text-xs font-semibold cursor-pointer">Segna Ritirato</button>
            </td>
        `;
        itemsTableBody.appendChild(tr);
    }
    if(itemsCounterBadge) itemsCounterBadge.textContent = `${count} capi attivi`;
}

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
    showToast("Capo ritirato", "success");
};

// ==========================================
// STATISTICHE CON DATE CORRETTE
// ==========================================
window.setStatPeriod = function(period) {
    currentStatPeriod = period;
    renderHistory();
};

function renderHistory() {
    const historyTableBody = document.getElementById('historyTableBody');
    if(!historyTableBody) return;
    historyTableBody.innerHTML = "";
    let count = 0, totalRevenue = 0;
    let uniqueClients = new Set();

    const now = new Date();
    const todayStr = now.toLocaleDateString('it-IT');
    const currentMonth = now.getMonth(), currentYear = now.getFullYear();

    const sorted = Object.entries(historyData).sort((a, b) => (b[1].returnedAt || 0) - (a[1].returnedAt || 0));

    for (let [id, item] of sorted) {
        const retDate = new Date(item.returnedAt || Date.now());
        const retDateStr = retDate.toLocaleDateString('it-IT');

        if (currentStatPeriod === 'day' && retDateStr !== todayStr) continue;
        if (currentStatPeriod === 'month' && (retDate.getMonth() !== currentMonth || retDate.getFullYear() !== currentYear)) continue;

        count++;
        totalRevenue += (item.price || 0);
        uniqueClients.add(item.clientId);

        const client = clientsData[item.clientId] || { name: "Non trovato" };
        const tr = document.createElement('tr');
        tr.className = "hover:bg-darkCard text-sm";
        tr.innerHTML = `<td class="py-3 px-4 text-xs text-slate-400">${retDateStr}</td><td class="py-3 px-4 font-semibold text-white">${client.name}</td><td class="py-3 px-4">${item.type}</td><td class="py-3 px-4 font-semibold text-emerald-400">€ ${(item.price || 0).toFixed(2)}</td><td class="py-3 px-4 text-xs text-slate-400">Armadio ${item.cabinet}</td>`;
        historyTableBody.appendChild(tr);
    }

    document.getElementById('statTotalCount').textContent = count;
    document.getElementById('statTotalRevenue').textContent = `€ ${totalRevenue.toFixed(2)}`;
    document.getElementById('statUniqueClients').textContent = uniqueClients.size;
}

function showToast(message, type = "success") {
    alert(message);
}
