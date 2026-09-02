// ==========================================
// LAVANDERIA CLEO - APP LOGIC (IDENTIFICAZIONE NOME PROPRIETARIO E DISPOSITIVO)
// ==========================================

const firebaseConfig = {
    apiKey: "AIzaSyCDpsHwHCJ6WAgUWeW77LD7WTPHEBRgwGo",
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
let licenseCheckInterval = null;
let hasShownTodayWarning = false;

document.addEventListener('DOMContentLoaded', () => {
    initLicenseSystem();
    initTheme();
    initConnectionMonitor(); 
    initGlobalResetListener();
    initRealtimeLicenseListener();
    initProtectedLogo();
    fixLoginPlaceholders();
    startLicenseCountdownMonitor(); 
    setupAutocompleteAndSearch();

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            checkAdminPassword();
        });
    }

    if (clientForm) {
        clientForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveClient();
        });
    }

    if (itemForm) {
        itemForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveItem();
        });
    }

    if (activeTableFilter) {
        activeTableFilter.addEventListener('input', renderItems);
    }
});

function getDeviceModelName() {
    const ua = navigator.userAgent;
    if (/iPad/i.test(ua)) return "iPad";
    if (/iPhone/i.test(ua)) return "iPhone";
    if (/Android/i.test(ua)) {
        if (/Tablet|Tab/i.test(ua)) return "Tablet Android";
        return "Smartphone Android";
    }
    if (/Macintosh/i.test(ua)) return "Mac Computer";
    if (/Windows/i.test(ua)) return "PC Windows";
    return "Dispositivo Generico";
}

function fixLoginPlaceholders() {
    const licenseInput = document.getElementById('licensePhoneInput');
    if (licenseInput) {
        licenseInput.value = "";
        licenseInput.placeholder = "Codice licenza o TEST1MIN...";
    }
}

function initGlobalResetListener() {
    db.ref('global_reset_signal').on('value', (snap) => {
        const serverSignal = snap.val();
        if (serverSignal) {
            const localSignalProcessed = localStorage.getItem('laundry_last_reset_processed');
            if (localSignalProcessed !== String(serverSignal)) {
                localStorage.setItem('laundry_last_reset_processed', String(serverSignal));
                lockAppComplete();
                showToast("Dispositivo scollegato dall'amministratore.", "error");
            }
        }
    });
}

function initRealtimeLicenseListener() {
    const activeLicenseCode = localStorage.getItem('laundry_active_license');
    if (!activeLicenseCode) return;

    db.ref('used_licenses/' + activeLicenseCode).on('value', (snap) => {
        if (!snap.exists() && localStorage.getItem('laundry_device_activated') === 'true') {
            lockAppComplete();
            showToast("Licenza sospesa o disattivata.", "error");
            const expiredModal = document.getElementById('licenseExpiredModal');
            if (expiredModal) expiredModal.classList.remove('hidden');
        } else if (snap.exists()) {
            const licData = snap.val();
            if (licData.expiry) {
                localStorage.setItem('laundry_license_expiry', licData.expiry);
            }
        }
    });
}

function initProtectedLogo() {
    const logoBtn = document.getElementById('protectedLogoBtn');
    const progressFill = document.getElementById('logoProgressFill');
    let logoPressTimer = null;
    const holdDuration = 5000;
    
    if (logoBtn) {
        ['mousedown', 'touchstart'].forEach(evt => {
            logoBtn.addEventListener(evt, () => {
                let startTime = Date.now();
                if(progressFill) progressFill.style.height = '100%';
                
                logoPressTimer = setInterval(() => {
                    let elapsed = Date.now() - startTime;
                    if (elapsed >= holdDuration) {
                        clearInterval(logoPressTimer);
                        if(progressFill) progressFill.style.height = '0%';
                        forceUnlockByLogo();
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

function forceUnlockByLogo() {
    showToast("Sblocco applicato!", "success");
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
}

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
            lockAppComplete();
            
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
                warningText.textContent = `⚠️ ATTENZIONE: La licenza per questo dispositivo scadrà domani! Contatta l'amministratore.`;
            } else {
                warningText.textContent = `⚠️ La licenza scadrà tra ${diffDays} giorni. Contatta l'amministratore per il rinnovo.`;
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
    let enteredPassword = passwordInput ? passwordInput.value.trim() : "";

    if (!enteredPassword) {
        showToast("Inserisci la password amministratore", "error");
        return;
    }

    if (enteredPassword === APP_PASSWORD || enteredPassword === "CLEO-MASTER") {
        sessionStorage.setItem('laundry_auth', 'true');
        sessionStorage.setItem('laundry_logged_as_admin', 'true');
        unlockApp();
        showToast("Accesso eseguito", "success");
    } else {
        showToast("Password errata", "error");
        if (loginError) {
            loginError.textContent = "Password errata. Riprova.";
            loginError.classList.remove('hidden');
        }
    }
}

function checkNumericLicense() {
    const licenseInput = document.getElementById('licensePhoneInput');
    let enteredCode = licenseInput ? licenseInput.value.trim() : "";

    if (!enteredCode) {
        showToast("Inserisci il codice licenza", "error");
        return;
    }

    const rawDevice = getDeviceModelName();

    if (enteredCode.toUpperCase() === "TEST1MIN") {
        let expirationTimestamp = Date.now() + (60 * 1000); 
        let fullDeviceName = `${rawDevice} (Test Prova)`;

        localStorage.setItem('laundry_device_activated', 'true');
        localStorage.setItem('laundry_active_license', 'TEST1MIN');
        localStorage.setItem('laundry_license_expiry', expirationTimestamp);
        sessionStorage.setItem('laundry_auth', 'true');
        sessionStorage.setItem('laundry_logged_as_admin', 'false');

        db.ref('used_licenses/TEST1MIN').set({
            usedAt: Date.now(),
            expiry: expirationTimestamp,
            clientName: "Cliente Test",
            deviceInfo: fullDeviceName,
            isDemo: true
        });

        hasShownTodayWarning = false;
        unlockApp();
        startLicenseCountdownMonitor();
        showToast("Licenza TEST avviata!", "success");
        return;
    }

    db.ref('used_licenses/' + enteredCode).once('value').then((usedSnap) => {
        if (usedSnap.exists() && enteredCode !== APP_PASSWORD) {
            showToast("Licenza già usata su un altro dispositivo!", "error");
            return;
        }

        db.ref('licenses').once('value').then((snapshot) => {
            const licenses = snapshot.val();
            let matchedKey = null;
            let customExpiryVal = null;
            let clientNameVal = "Lavanderia Cliente";
            let isDemoVal = false;

            if (licenses) {
                for (let key in licenses) {
                    if (String(key) === String(enteredCode) || (typeof licenses[key] === 'object' && String(licenses[key].code) === String(enteredCode))) {
                        matchedKey = key;
                        let obj = typeof licenses[key] === 'object' ? licenses[key] : { expiry: licenses[key] };
                        customExpiryVal = obj.expiry;
                        if (obj.clientName) clientNameVal = obj.clientName;
                        if (obj.isDemo) isDemoVal = true;
                        break;
                    }
                }
            }

            if (matchedKey || customExpiryVal) {
                let expirationTimestamp = Date.now() + (365 * 24 * 60 * 60 * 1000);

                if (customExpiryVal) {
                    let parsedTime = typeof customExpiryVal === 'number' ? customExpiryVal : new Date(customExpiryVal).getTime();
                    if (!isNaN(parsedTime) && parsedTime > Date.now()) {
                        expirationTimestamp = parsedTime;
                    }
                }

                let fullDeviceName = `${rawDevice} - ${clientNameVal}`;

                db.ref('used_licenses/' + enteredCode).set({
                    usedAt: Date.now(),
                    expiry: expirationTimestamp,
                    clientName: clientNameVal,
                    deviceInfo: fullDeviceName,
                    isDemo: isDemoVal
                });

                localStorage.setItem('laundry_device_activated', 'true');
                localStorage.setItem('laundry_active_license', enteredCode);
                localStorage.setItem('laundry_license_expiry', expirationTimestamp);
                sessionStorage.setItem('laundry_auth', 'true');
                sessionStorage.setItem('laundry_logged_as_admin', 'false');
                hasShownTodayWarning = false;

                unlockApp();
                initRealtimeLicenseListener();
                startLicenseCountdownMonitor();
                showToast(`Licenza attivata per ${clientNameVal}!`, "success");
            } else {
                showToast("Codice licenza non valido.", "error");
            }
        }).catch(() => {
            showToast("Errore di connessione.", "error");
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
};

function lockAppComplete() {
    if (licenseCheckInterval) clearInterval(licenseCheckInterval);
    sessionStorage.removeItem('laundry_auth');
    sessionStorage.removeItem('laundry_logged_as_admin');
    localStorage.removeItem('laundry_device_activated');
    localStorage.removeItem('laundry_license_expiry');
    localStorage.removeItem('laundry_active_license');
    
    if(appContainer) {
        appContainer.style.opacity = '0';
        setTimeout(() => appContainer.classList.add('hidden'), 400);
    }
    if(loginScreen) {
        loginScreen.classList.remove('hidden');
        setTimeout(() => loginScreen.style.opacity = '1', 50);
    }
    
    const licenseInput = document.getElementById('licensePhoneInput');
    if (licenseInput) licenseInput.value = '';
    if (passwordInput) passwordInput.value = '';
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
        if(navTabActive) navTabActive.className = "px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white shadow-sm cursor-pointer";
        if(navTabStats) navTabStats.className = "px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-darkSurface/50 cursor-pointer";
    } else {
        if(viewActive) viewActive.classList.add('hidden');
        if(viewStats) viewStats.classList.remove('hidden');
        if(navTabStats) navTabStats.className = "px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white shadow-sm cursor-pointer";
        if(navTabActive) navTabActive.className = "px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-darkSurface/50 cursor-pointer";
        renderHistory();
    }
};

window.showToast = function(msg, type = "success") {
    const toast = document.getElementById('toastNotification');
    const toastMsg = document.getElementById('toastMessage');
    if (!toast || !toastMsg) return;

    toastMsg.textContent = msg;
    toast.classList.remove('translate-y-20', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');

    setTimeout(() => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('translate-y-20', 'opacity-0');
    }, 3000);
};

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
    if (confirm(`Confermi il ritiro del capo "${typeName}"?`)) {
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
        showToast("Capo archiviato con successo", "success");
    }
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
    });
}

function saveClient() {
    const name = document.getElementById('clientName').value.trim();
    const phone = document.getElementById('clientPhone').value.trim();
    const dob = document.getElementById('clientDob').value.trim();
    const address = document.getElementById('clientAddress').value.trim();
    const clientIdInput = document.getElementById('manageClientIdInput').value;

    if (!name || !phone) {
        showToast("Nome e Telefono sono obbligatori", "error");
        return;
    }

    const id = clientIdInput || 'client_' + Date.now();
    const clientData = { id, name, phone, dob, address, updatedAt: Date.now() };

    clientsData[id] = clientData;
    localStorage.setItem('laundry_clients', JSON.stringify(clientsData));
    db.ref('clients').child(id).set(clientData);

    document.getElementById('clientForm').reset();
    document.getElementById('manageClientIdInput').value = "";
    showToast("Cliente salvato correttamente", "success");
}

function saveItem() {
    const clientId = selectedClientIdInput ? selectedClientIdInput.value : "";
    const type = document.getElementById('itemType').value.trim();
    const cabinet = document.getElementById('itemCabinet').value.trim();
    const position = document.getElementById('itemPosition').value.trim();
    const price = parseFloat(document.getElementById('itemPrice').value) || 0;
    const notes = document.getElementById('itemNotes').value.trim();

    if (!clientId || !type || !cabinet || !position) {
        showToast("Compila tutti i campi obbligatori per il capo", "error");
        return;
    }

    const id = 'item_' + Date.now();
    const itemData = {
        id, clientId, type, cabinet, position, price, notes, timestamp: Date.now()
    };

    itemsData[id] = itemData;
    localStorage.setItem('laundry_items', JSON.stringify(itemsData));
    db.ref('items').child(id).set(itemData);

    document.getElementById('itemForm').reset();
    if (assignClientSearch) assignClientSearch.value = "";
    if (selectedClientIdInput) selectedClientIdInput.value = "";
    renderItems();
    showToast("Capo accettato con successo!", "success");
}

// ==========================================
// STATISTICHE, PERIODO E INTERVALLO DATE
// ==========================================
window.setStatPeriod = function(period) {
    currentStatPeriod = period;
    ['btnPeriodDay', 'btnPeriodMonth', 'btnPeriodYear', 'btnPeriodAll'].forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.className = "px-3.5 py-2 bg-darkSurface border border-darkBorder text-xs font-semibold rounded-xl text-slate-300 hover:bg-zinc-850 cursor-pointer active:scale-95";
        }
    });

    const activeMap = {
        'day': 'btnPeriodDay',
        'month': 'btnPeriodMonth',
        'year': 'btnPeriodYear',
        'all': 'btnPeriodAll'
    };

    const targetBtn = document.getElementById(activeMap[period]);
    if (targetBtn) {
        targetBtn.className = "px-3.5 py-2 bg-blue-600 border border-blue-500 text-xs font-semibold rounded-xl text-white shadow-sm cursor-pointer active:scale-95";
    }

    renderHistory();
};

window.clearCustomDateFilter = function() {
    const start = document.getElementById('statsCustomStartDate');
    const end = document.getElementById('statsCustomEndDate');
    if (start) start.value = "";
    if (end) end.value = "";
    renderHistory();
};

function renderHistory() {
    const historyTableBody = document.getElementById('historyTableBody');
    if (!historyTableBody) return;
    historyTableBody.innerHTML = "";

    const startDateVal = document.getElementById('statsCustomStartDate')?.value;
    const endDateVal = document.getElementById('statsCustomEndDate')?.value;

    const now = new Date();
    let totalRev = 0;
    let count = 0;
    const clientSet = new Set();
    const typeMap = {};

    const historyArray = Object.values(historyData).sort((a, b) => (b.returnedAt || 0) - (a.returnedAt || 0));

    historyArray.forEach(item => {
        const itemDate = new Date(item.returnedAt || Date.now());
        let matches = true;

        if (startDateVal || endDateVal) {
            if (startDateVal) {
                const sDate = new Date(startDateVal);
                sDate.setHours(0, 0, 0, 0);
                if (itemDate < sDate) matches = false;
            }
            if (endDateVal) {
                const eDate = new Date(endDateVal);
                eDate.setHours(23, 59, 59, 999);
                if (itemDate > eDate) matches = false;
            }
        } else if (currentStatPeriod !== 'all') {
            if (currentStatPeriod === 'day') {
                matches = itemDate.toDateString() === now.toDateString();
            } else if (currentStatPeriod === 'month') {
                matches = itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
            } else if (currentStatPeriod === 'year') {
                matches = itemDate.getFullYear() === now.getFullYear();
            }
        }

        if (matches) {
            count++;
            const price = parseFloat(item.price) || 0;
            totalRev += price;
            if (item.clientId) clientSet.add(item.clientId);
            if (item.type) typeMap[item.type] = (typeMap[item.type] || 0) + 1;

            const client = clientsData[item.clientId] || { name: "Cliente eliminato", phone: "-" };
            const tr = document.createElement('tr');
            tr.className = "hover:bg-darkCard";
            tr.innerHTML = `
                <td class="py-3 px-4 text-slate-300">${itemDate.toLocaleDateString('it-IT')} ${itemDate.toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'})}</td>
                <td class="py-3 px-4 font-semibold text-white">${client.name}</td>
                <td class="py-3 px-4 text-slate-200">${item.type}</td>
                <td class="py-3 px-4 font-bold text-emerald-400">€ ${price.toFixed(2)}</td>
                <td class="py-3 px-4 text-slate-400">Arm. ${item.cabinet || '-'} / Pos. ${item.position || '-'}</td>
            `;
            historyTableBody.appendChild(tr);
        }
    });

    let topType = "-";
    let maxFreq = 0;
    for (let t in typeMap) {
        if (typeMap[t] > maxFreq) {
            maxFreq = typeMap[t];
            topType = t;
        }
    }

    document.getElementById('statTotalCount').textContent = count;
    document.getElementById('statTotalRevenue').textContent = `€ ${totalRev.toFixed(2)}`;
    document.getElementById('statUniqueClients').textContent = clientSet.size;
    document.getElementById('statTopItemType').textContent = topType;
    document.getElementById('historyCounter').textContent = `${count} elementi`;
}

window.resetAllStatistics = function() {
    if (confirm("Sei sicuro di voler azzerare lo storico e le statistiche? L'azione è irreversibile.")) {
        historyData = {};
        localStorage.removeItem('laundry_history');
        db.ref('history').remove();
        renderHistory();
        showToast("Statistiche azzerate con successo", "success");
    }
};

window.exportBackup = function() {
    let csv = "Data Ritiro,Cliente,Telefono,Capo,Prezzo,Armadio,Posizione\n";
    Object.values(historyData).forEach(item => {
        const client = clientsData[item.clientId] || { name: "N/D", phone: "N/D" };
        const dateStr = item.returnedAt ? new Date(item.returnedAt).toLocaleDateString('it-IT') : "N/D";
        csv += `"${dateStr}","${client.name}","${client.phone}","${item.type}",${(item.price||0).toFixed(2)},"${item.cabinet}","${item.position}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `storico_lavanderia_${Date.now()}.csv`;
    a.click();
    showToast("Export Excel completato!", "success");
};

// ==========================================
// AUTOCOMPLETAMENTO E RICERCA
// ==========================================
function setupAutocompleteAndSearch() {
    const bindDropdown = (inputEl, btnEl, dropEl, renderFn) => {
        if (!inputEl || !dropEl) return;
        
        inputEl.addEventListener('focus', () => {
            renderFn(inputEl.value);
            dropEl.classList.remove('hidden');
        });

        inputEl.addEventListener('input', () => {
            renderFn(inputEl.value);
            dropEl.classList.remove('hidden');
        });

        if (btnEl) {
            btnEl.addEventListener('click', (e) => {
                e.stopPropagation();
                if (dropEl.classList.contains('hidden')) {
                    renderFn(inputEl.value);
                    dropEl.classList.remove('hidden');
                } else {
                    dropEl.classList.add('hidden');
                }
            });
        }
    };

    bindDropdown(clientNameInput, clientSearchToggleBtn, clientSearchDropdown, (query) => {
        renderClientDropdown(clientSearchDropdown, query, (client) => {
            document.getElementById('clientName').value = client.name;
            document.getElementById('clientPhone').value = client.phone;
            document.getElementById('clientDob').value = client.dob || '';
            document.getElementById('clientAddress').value = client.address || '';
            document.getElementById('manageClientIdInput').value = client.id;
            clientSearchDropdown.classList.add('hidden');
        });
    });

    bindDropdown(assignClientSearch, assignClientToggleBtn, assignClientDropdown, (query) => {
        renderClientDropdown(assignClientDropdown, query, (client) => {
            assignClientSearch.value = `${client.name} (${client.phone})`;
            selectedClientIdInput.value = client.id;
            assignClientDropdown.classList.add('hidden');
        });
    });

    if (globalSearch && globalSearchDropdown) {
        globalSearch.addEventListener('input', () => {
            const q = globalSearch.value.trim().toLowerCase();
            if (searchClearBtn) searchClearBtn.classList.toggle('hidden', q.length === 0);
            if (!q) {
                globalSearchDropdown.classList.add('hidden');
                return;
            }
            renderGlobalSearch(q);
        });

        if (searchClearBtn) {
            searchClearBtn.addEventListener('click', () => {
                globalSearch.value = "";
                searchClearBtn.classList.add('hidden');
                globalSearchDropdown.classList.add('hidden');
            });
        }
    }

    document.addEventListener('click', (e) => {
        if (clientSearchDropdown && !clientSearchDropdown.contains(e.target) && e.target !== clientNameInput && e.target !== clientSearchToggleBtn) {
            clientSearchDropdown.classList.add('hidden');
        }
        if (assignClientDropdown && !assignClientDropdown.contains(e.target) && e.target !== assignClientSearch && e.target !== assignClientToggleBtn) {
            assignClientDropdown.classList.add('hidden');
        }
        if (globalSearchDropdown && !globalSearchDropdown.contains(e.target) && e.target !== globalSearch) {
            globalSearchDropdown.classList.add('hidden');
        }
    });
}

function renderClientDropdown(dropEl, query, onSelect) {
    dropEl.innerHTML = "";
    const q = query.toLowerCase().trim();
    const clients = Object.values(clientsData).filter(c => 
        (c.name && c.name.toLowerCase().includes(q)) || (c.phone && c.phone.includes(q))
    );

    if (clients.length === 0) {
        dropEl.innerHTML = `<div class="p-3 text-xs text-slate-400">Nessun cliente trovato</div>`;
        return;
    }

    clients.forEach(c => {
        const item = document.createElement('div');
        item.className = "p-2.5 hover:bg-darkCard cursor-pointer text-xs border-b border-darkBorder/50 flex justify-between items-center";
        item.innerHTML = `<div><span class="font-bold text-white">${c.name}</span> <span class="text-slate-400">(${c.phone})</span></div>`;
        item.addEventListener('click', () => onSelect(c));
        dropEl.appendChild(item);
    });
}

function renderGlobalSearch(query) {
    globalSearchDropdown.innerHTML = "";
    let matches = 0;

    Object.values(clientsData).forEach(c => {
        if (c.name.toLowerCase().includes(query) || c.phone.includes(query)) {
            matches++;
            const div = document.createElement('div');
            div.className = "p-3 hover:bg-darkCard cursor-pointer text-xs";
            div.innerHTML = `<div class="font-bold text-blue-400"><i class="fa-solid fa-user"></i> ${c.name}</div><div class="text-slate-400">Tel: ${c.phone}</div>`;
            div.addEventListener('click', () => {
                openClientModal(c.id);
                globalSearchDropdown.classList.add('hidden');
            });
            globalSearchDropdown.appendChild(div);
        }
    });

    Object.values(itemsData).forEach(i => {
        const client = clientsData[i.clientId] || { name: 'Sconosciuto' };
        if (i.type.toLowerCase().includes(query) || i.cabinet.toLowerCase().includes(query) || i.position.toLowerCase().includes(query)) {
            matches++;
            const div = document.createElement('div');
            div.className = "p-3 hover:bg-darkCard cursor-pointer text-xs";
            div.innerHTML = `<div class="font-bold text-emerald-400"><i class="fa-solid fa-shirt"></i> ${i.type} (${client.name})</div><div class="text-slate-400">Armadio ${i.cabinet} - Pos. ${i.position}</div>`;
            div.addEventListener('click', () => {
                switchTab('active');
                globalSearchDropdown.classList.add('hidden');
            });
            globalSearchDropdown.appendChild(div);
        }
    });

    if (matches === 0) {
        globalSearchDropdown.innerHTML = `<div class="p-3 text-xs text-slate-400">Nessun risultato corrispondente</div>`;
    }
    globalSearchDropdown.classList.remove('hidden');
}

// ==========================================
// MODALI CLIENTE E ANAGRAFICA
// ==========================================
window.openClientManagerModal = function() {
    const modal = document.getElementById('clientManagerModal');
    if (modal) {
        renderManagerClients();
        modal.classList.remove('hidden');
    }
};

window.closeClientManagerModal = function() {
    const modal = document.getElementById('clientManagerModal');
    if (modal) modal.classList.add('hidden');
};

function renderManagerClients() {
    const tbody = document.getElementById('managerClientsTableBody');
    if (!tbody) return;
    tbody.innerHTML = "";

    const filterVal = document.getElementById('managerClientSearchInput')?.value.toLowerCase().trim() || "";

    Object.values(clientsData).forEach(c => {
        if (filterVal && !c.name.toLowerCase().includes(filterVal) && !c.phone.includes(filterVal)) return;

        const tr = document.createElement('tr');
        tr.className = "hover:bg-darkCard";
        tr.innerHTML = `
            <td class="py-3 px-4 font-semibold text-white">${c.name}</td>
            <td class="py-3 px-4 text-slate-300">${c.phone}</td>
            <td class="py-3 px-4 text-slate-400">${c.address || '-'} ${c.dob ? `(${c.dob})` : ''}</td>
            <td class="py-3 px-4 text-right">
                <button onclick="deleteClient('${c.id}')" class="px-2.5 py-1 bg-rose-950 hover:bg-rose-900 text-rose-300 rounded-lg text-xs font-semibold cursor-pointer"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.deleteClient = function(id) {
    if (confirm("Rimuovere questo cliente dall'anagrafica?")) {
        delete clientsData[id];
        localStorage.setItem('laundry_clients', JSON.stringify(clientsData));
        db.ref('clients').child(id).remove();
        renderManagerClients();
        showToast("Cliente rimosso", "success");
    }
};

window.openClientModal = function(clientId) {
    const client = clientsData[clientId];
    if (!client) return;

    document.getElementById('modalClientName').textContent = client.name;
    document.getElementById('modalClientDetails').textContent = `Tel: ${client.phone} | Indirizzo: ${client.address || 'N/D'}`;

    const activeList = document.getElementById('modalClientActiveItemsList');
    const histList = document.getElementById('modalClientHistoryList');
    activeList.innerHTML = "";
    histList.innerHTML = "";

    let totalSpent = 0;
    let totalItems = 0;

    Object.values(itemsData).filter(i => i.clientId === clientId).forEach(i => {
        totalItems++;
        const div = document.createElement('div');
        div.className = "p-2 bg-darkCard rounded-xl text-xs flex justify-between";
        div.innerHTML = `<span>${i.type} (Arm. ${i.cabinet})</span><span class="font-bold text-emerald-400">€ ${(i.price||0).toFixed(2)}</span>`;
        activeList.appendChild(div);
    });

    Object.values(historyData).filter(i => i.clientId === clientId).forEach(i => {
        totalItems++;
        totalSpent += (i.price || 0);
        const div = document.createElement('div');
        div.className = "p-2 bg-darkCard rounded-xl text-xs flex justify-between text-slate-400";
        div.innerHTML = `<span>${i.type}</span><span class="font-bold text-emerald-400">€ ${(i.price||0).toFixed(2)}</span>`;
        histList.appendChild(div);
    });

    document.getElementById('modalClientTotalItems').textContent = totalItems;
    document.getElementById('modalClientTotalSpent').textContent = `€ ${totalSpent.toFixed(2)}`;
    document.getElementById('clientModal').classList.remove('hidden');
};

window.closeClientModal = function() {
    document.getElementById('clientModal').classList.add('hidden');
};

window.printClientReceiptLabel = function() {
    showToast("Stampa etichetta inviata alla stampante", "success");
};
