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
    setupForms();
    setupDropdowns();

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            checkAdminPassword();
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
            let clientPhoneVal = "";
            let isDemoVal = false;

            if (licenses) {
                for (let key in licenses) {
                    if (String(key) === String(enteredCode) || (typeof licenses[key] === 'object' && String(licenses[key].code) === String(enteredCode))) {
                        matchedKey = key;
                        let obj = typeof licenses[key] === 'object' ? licenses[key] : { expiry: licenses[key] };
                        customExpiryVal = obj.expiry;
                        if (obj.clientName) clientNameVal = obj.clientName;
                        if (obj.phone) clientPhoneVal = obj.phone;
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
                    phone: clientPhoneVal,
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

function setupForms() {
    if (clientForm) {
        clientForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const clientId = document.getElementById('manageClientIdInput').value || ('client_' + Date.now());
            const name = document.getElementById('clientName').value.trim();
            const phone = document.getElementById('clientPhone').value.trim();
            const email = document.getElementById('clientEmail') ? document.getElementById('clientEmail').value.trim() : '';
            const dob = document.getElementById('clientDob').value.trim();
            const address = document.getElementById('clientAddress').value.trim();
            const notes = document.getElementById('clientNotes') ? document.getElementById('clientNotes').value.trim() : '';

            if (!name || !phone) {
                showToast("Nome e Telefono obbligatori!", "error");
                return;
            }

            const clientObj = { name, phone, email, dob, address, notes, updatedAt: Date.now() };
            clientsData[clientId] = clientObj;
            localStorage.setItem('laundry_clients', JSON.stringify(clientsData));
            db.ref('clients/' + clientId).set(clientObj);

            showToast("Cliente salvato con successo!", "success");
            clientForm.reset();
            document.getElementById('manageClientIdInput').value = '';
        });
    }

    if (itemForm) {
        itemForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const clientId = document.getElementById('selectedClientIdInput').value;
            const type = document.getElementById('itemType').value.trim();
            const cabinet = document.getElementById('itemCabinet').value.trim();
            const position = document.getElementById('itemPosition').value.trim();
            const price = parseFloat(document.getElementById('itemPrice').value) || 0;
            const notes = document.getElementById('itemNotes').value.trim();

            if (!clientId) {
                showToast("Seleziona prima un cliente valido!", "error");
                return;
            }

            const itemId = 'item_' + Date.now();
            const itemObj = { clientId, type, cabinet, position, price, notes, timestamp: Date.now() };

            itemsData[itemId] = itemObj;
            localStorage.setItem('laundry_items', JSON.stringify(itemsData));
            db.ref('items/' + itemId).set(itemObj);

            showToast("Capo registrato!", "success");
            itemForm.reset();
            document.getElementById('assignClientSearch').value = '';
            document.getElementById('selectedClientIdInput').value = '';
        });
    }
}

function setupDropdowns() {
    const globalSearch = document.getElementById('globalSearch');
    const globalDropdown = document.getElementById('globalSearchDropdown');
    const searchClearBtn = document.getElementById('searchClearBtn');

    if (globalSearch) {
        globalSearch.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            if (searchClearBtn) searchClearBtn.classList.toggle('hidden', !query);
            if (!query) {
                if (globalDropdown) globalDropdown.classList.add('hidden');
                return;
            }

            let results = [];
            for (let id in clientsData) {
                const c = clientsData[id];
                if (c.name.toLowerCase().includes(query) || c.phone.includes(query) || (c.email && c.email.toLowerCase().includes(query))) {
                    results.push(`<div onclick="selectGlobalClient('${id}')" class="p-3 hover:bg-darkCard cursor-pointer flex justify-between items-center text-xs">
                        <div><strong class="text-white block">${c.name}</strong><span class="text-slate-400">${c.phone} ${c.email ? '&bull; ' + c.email : ''}</span></div>
                        <span class="text-[10px] bg-blue-950 text-blue-400 px-2 py-0.5 rounded">Cliente</span>
                    </div>`);
                }
            }

            for (let id in itemsData) {
                const it = itemsData[id];
                const c = clientsData[it.clientId] || { name: 'Sconosciuto' };
                if (it.type.toLowerCase().includes(query) || it.cabinet.toLowerCase().includes(query)) {
                    results.push(`<div class="p-3 hover:bg-darkCard text-xs flex justify-between items-center">
                        <div><strong class="text-white block">${it.type} (Armadio: ${it.cabinet})</strong><span class="text-slate-400">Cliente: ${c.name}</span></div>
                        <span class="text-[10px] bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded">Capo Attivo</span>
                    </div>`);
                }
            }

            if (globalDropdown) {
                globalDropdown.innerHTML = results.length ? results.join('') : '<div class="p-3 text-xs text-slate-400">Nessun risultato trovato</div>';
                globalDropdown.classList.remove('hidden');
            }
        });

        if (searchClearBtn) {
            searchClearBtn.addEventListener('click', () => {
                globalSearch.value = '';
                searchClearBtn.classList.add('hidden');
                if (globalDropdown) globalDropdown.classList.add('hidden');
            });
        }
    }

    setupClientSearchDropdown('clientName', 'clientSearchDropdown', 'clientSearchToggleBtn', (id) => {
        const c = clientsData[id];
        if (c) {
            document.getElementById('manageClientIdInput').value = id;
            document.getElementById('clientName').value = c.name;
            document.getElementById('clientPhone').value = c.phone;
            if (document.getElementById('clientEmail')) document.getElementById('clientEmail').value = c.email || '';
            document.getElementById('clientDob').value = c.dob || '';
            document.getElementById('clientAddress').value = c.address || '';
            if (document.getElementById('clientNotes')) document.getElementById('clientNotes').value = c.notes || '';
        }
    });

    setupClientSearchDropdown('assignClientSearch', 'assignClientDropdown', 'assignClientToggleBtn', (id) => {
        const c = clientsData[id];
        if (c) {
            document.getElementById('selectedClientIdInput').value = id;
            document.getElementById('assignClientSearch').value = `${c.name} (${c.phone})`;
        }
    });
}

function setupClientSearchDropdown(inputId, dropdownId, toggleBtnId, onSelect) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);
    const toggleBtn = document.getElementById(toggleBtnId);

    function renderDropdown(filter = '') {
        let html = '';
        const q = filter.toLowerCase().trim();
        for (let id in clientsData) {
            const c = clientsData[id];
            if (!q || c.name.toLowerCase().includes(q) || c.phone.includes(q) || (c.email && c.email.toLowerCase().includes(q))) {
                html += `<div data-id="${id}" class="p-2.5 hover:bg-darkCard cursor-pointer text-xs border-b border-darkBorder/40">
                    <strong class="text-white block">${c.name}</strong>
                    <span class="text-slate-400">${c.phone} ${c.email ? '&bull; ' + c.email : ''}</span>
                </div>`;
            }
        }
        dropdown.innerHTML = html || '<div class="p-3 text-xs text-slate-400">Nessun cliente trovato</div>';
        
        dropdown.querySelectorAll('[data-id]').forEach(el => {
            el.addEventListener('click', () => {
                onSelect(el.getAttribute('data-id'));
                dropdown.classList.add('hidden');
            });
        });
    }

    if (input) {
        input.addEventListener('input', (e) => {
            renderDropdown(e.target.value);
            dropdown.classList.remove('hidden');
        });
        input.addEventListener('focus', () => {
            renderDropdown(input.value);
            dropdown.classList.remove('hidden');
        });
    }

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            if (dropdown.classList.contains('hidden')) {
                renderDropdown('');
                dropdown.classList.remove('hidden');
            } else {
                dropdown.classList.add('hidden');
            }
        });
    }
}

window.selectGlobalClient = function(id) {
    const dropdown = document.getElementById('globalSearchDropdown');
    if (dropdown) dropdown.classList.add('hidden');
    openClientManagerModal();
};

window.openClientManagerModal = function() {
    const modal = document.getElementById('clientManagerModal');
    if (modal) {
        modal.classList.remove('hidden');
        renderClientManagerList();
    }
};

window.closeClientManagerModal = function() {
    const modal = document.getElementById('clientManagerModal');
    if (modal) modal.classList.add('hidden');
};

window.renderClientManagerList = function() {
    const container = document.getElementById('clientManagerList');
    const searchVal = (document.getElementById('clientManagerSearch')?.value || '').toLowerCase().trim();
    if (!container) return;

    let html = '';
    for (let id in clientsData) {
        const c = clientsData[id];
        if (searchVal && !c.name.toLowerCase().includes(searchVal) && !c.phone.includes(searchVal) && !(c.email && c.email.toLowerCase().includes(searchVal))) continue;

        html += `<div class="bg-darkCard p-3 rounded-xl border border-darkBorder flex justify-between items-center text-xs">
            <div>
                <strong class="text-white block text-sm">${c.name}</strong>
                <span class="text-slate-400 block">${c.phone} ${c.email ? '&bull; ' + c.email : ''}</span>
                ${c.notes ? `<p class="text-[11px] text-amber-400 mt-1"><i class="fa-solid fa-note-sticky mr-1"></i>${c.notes}</p>` : ''}
            </div>
            <div class="flex gap-2">
                <button onclick="editClient('${id}')" class="px-2.5 py-1 bg-blue-900/40 text-blue-400 hover:bg-blue-900/60 rounded-lg"><i class="fa-solid fa-pen"></i> Modifica</button>
                <button onclick="deleteClient('${id}')" class="px-2.5 py-1 bg-rose-900/40 text-rose-400 hover:bg-rose-900/60 rounded-lg"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>`;
    }

    container.innerHTML = html || '<div class="text-slate-400 text-xs py-4 text-center">Nessun cliente presente</div>';
};

window.editClient = function(id) {
    const c = clientsData[id];
    if (c) {
        closeClientManagerModal();
        switchTab('active');
        document.getElementById('manageClientIdInput').value = id;
        document.getElementById('clientName').value = c.name;
        document.getElementById('clientPhone').value = c.phone;
        if (document.getElementById('clientEmail')) document.getElementById('clientEmail').value = c.email || '';
        document.getElementById('clientDob').value = c.dob || '';
        document.getElementById('clientAddress').value = c.address || '';
        if (document.getElementById('clientNotes')) document.getElementById('clientNotes').value = c.notes || '';
    }
};

window.deleteClient = function(id) {
    if (confirm("Eliminare definitivamente questo cliente?")) {
        delete clientsData[id];
        localStorage.setItem('laundry_clients', JSON.stringify(clientsData));
        db.ref('clients/' + id).remove();
        renderClientManagerList();
        showToast("Cliente eliminato", "success");
    }
};

window.printClientReceiptLabel = function() {
    const name = document.getElementById('clientName').value;
    const phone = document.getElementById('clientPhone').value;
    if (!name || !phone) {
        showToast("Seleziona o inserisci prima un cliente!", "error");
        return;
    }
    const win = window.open('', '', 'width=300,height=200');
    win.document.write(`<html><body style="font-family:sans-serif;padding:10px;text-align:center;">
        <h3 style="margin:0;">LAVANDERIA CLEO</h3>
        <p style="font-size:14px;margin:5px 0;"><strong>${name}</strong></p>
        <p style="font-size:12px;margin:0;">Tel: ${phone}</p>
        <script>window.print();window.close();<\/script>
    </body></html>`);
};

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

window.setStatPeriod = function(period) {
    currentStatPeriod = period;
    ['btnPeriodDay', 'btnPeriodMonth', 'btnPeriodYear', 'btnPeriodAll'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.className = "px-3.5 py-2 bg-darkSurface border border-darkBorder text-xs font-semibold rounded-xl text-slate-300 hover:bg-zinc-850 cursor-pointer";
    });
    const activeBtn = document.getElementById('btnPeriod' + period.charAt(0).toUpperCase() + period.slice(1));
    if (activeBtn) activeBtn.className = "px-3.5 py-2 bg-blue-600 border border-blue-500 text-xs font-semibold rounded-xl text-white shadow-sm cursor-pointer";
    renderHistory();
};

function renderHistory() {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    let totalRevenue = 0, count = 0;
    let typeCounts = {}, uniqueClients = new Set();
    const now = new Date();

    const sorted = Object.entries(historyData).sort((a, b) => (b[1].returnedAt || 0) - (a[1].returnedAt || 0));

    for (let [id, item] of sorted) {
        const itemDate = new Date(item.returnedAt || 0);

        if (currentStatPeriod === 'day' && itemDate.toDateString() !== now.toDateString()) continue;
        if (currentStatPeriod === 'month' && (itemDate.getMonth() !== now.getMonth() || itemDate.getFullYear() !== now.getFullYear())) continue;
        if (currentStatPeriod === 'year' && itemDate.getFullYear() !== now.getFullYear()) continue;

        count++;
        totalRevenue += (item.price || 0);
        if (item.type) typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;
        if (item.clientId) uniqueClients.add(item.clientId);

        const client = clientsData[item.clientId] || { name: 'Sconosciuto' };
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-darkCard';
        tr.innerHTML = `
            <td class="py-3 px-4 text-slate-300">${itemDate.toLocaleDateString('it-IT')} ${itemDate.toLocaleTimeString('it-IT', {hour:'2-digit', minute:'2-digit'})}</td>
            <td class="py-3 px-4 font-semibold text-white">${client.name}</td>
            <td class="py-3 px-4 text-slate-200">${item.type}</td>
            <td class="py-3 px-4 text-emerald-400 font-semibold">€ ${(item.price || 0).toFixed(2)}</td>
            <td class="py-3 px-4 text-slate-400">Armadio ${item.cabinet || 'N/D'}</td>
        `;
        tbody.appendChild(tr);
    }

    document.getElementById('statTotalCount').textContent = count;
    document.getElementById('statTotalRevenue').textContent = '€ ' + totalRevenue.toFixed(2);
    document.getElementById('statUniqueClients').textContent = uniqueClients.size;
    
    let topType = '-';
    let max = 0;
    for (let t in typeCounts) {
        if (typeCounts[t] > max) { max = typeCounts[t]; topType = t; }
    }
    document.getElementById('statTopItemType').textContent = topType;
    document.getElementById('historyCounter').textContent = `${count} elementi`;
}

window.exportBackup = function() {
    let csvContent = "data:text/csv;charset=utf-8,Data,Cliente,Capo,Prezzo,Armadio\n";
    for (let id in historyData) {
        const item = historyData[id];
        const client = clientsData[item.clientId] || { name: 'N/D' };
        const d = new Date(item.returnedAt || 0).toLocaleDateString('it-IT');
        csvContent += `"${d}","${client.name}","${item.type}","${item.price}","${item.cabinet}"\n`;
    }
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `storico_lavanderia_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
                <span class="font-semibold text-white cursor-pointer hover:underline">${client.name}</span>
                <div class="text-xs text-slate-400">${client.phone} ${client.email ? '&bull; ' + client.email : ''}</div>
                ${client.notes ? `<div class="text-[10px] text-amber-400 mt-0.5"><i class="fa-solid fa-note-sticky mr-1"></i>${client.notes}</div>` : ''}
            </td>
            <td class="py-4 px-4">
                <span class="font-medium text-slate-200">${item.type}</span>
                <div class="text-xs font-semibold text-emerald-400">€ ${item.price.toFixed(2)}</div>
            </td>
            <td class="py-4 px-4 text-xs font-semibold text-slate-300">Armadio ${item.cabinet} &bull; Pos. ${item.position}</td>
            <td class="py-4 px-4"><span class="px-3 py-1 rounded-full text-xs font-semibold bg-amber-950 text-amber-400 border border-amber-900">In lavorazione</span></td>
            <td class="py-4 px-4 text-right">
                <button onclick="confirmAndReturn('${id}', '${item.type.replace(/'/g, "\\'")}')" class="px-3 py-1.5 bg-rose-950 hover:bg-rose-900 active:scale-95 text-rose-300 rounded-xl text-xs font-semibold cursor-pointer shadow-sm">Segna Ritirato</button>
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
