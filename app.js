// ==========================================
// LAVANDERIA CLEO - APP LOGIC (REALTIME SYNC & DEMO WARNINGS)
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

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            checkAdminPassword();
        });
    }
});

function fixLoginPlaceholders() {
    const licenseInput = document.getElementById('licensePhoneInput');
    if (licenseInput) {
        licenseInput.value = "";
        licenseInput.placeholder = "Inserisci codice licenza...";
    }
}

// Rilevamento preciso del dispositivo (senza numeri progressivi)
function getDeviceInfoString() {
    const ua = navigator.userAgent;
    let deviceName = "Notebook / PC Generico";
    
    if (/iPhone/i.test(ua)) {
        deviceName = "iPhone";
    } else if (/iPad/i.test(ua)) {
        deviceName = "iPad";
    } else if (/Samsung/i.test(ua) || /SM-/i.test(ua)) {
        if (/SM-T/i.test(ua) || /Tab/i.test(ua)) {
            deviceName = "Samsung Tablet";
        } else {
            deviceName = "Samsung Smartphone";
        }
    } else if (/Xiaomi|Redmi|POCO/i.test(ua)) {
        deviceName = "Xiaomi / Redmi";
    } else if (/Huawei|Honor/i.test(ua)) {
        deviceName = "Huawei / Honor";
    } else if (/OPPO/i.test(ua)) {
        deviceName = "Oppo";
    } else if (/Vivo/i.test(ua)) {
        deviceName = "Vivo";
    } else if (/Realme/i.test(ua)) {
        deviceName = "Realme";
    } else if (/OnePlus/i.test(ua)) {
        deviceName = "OnePlus";
    } else if (/Moto/i.test(ua)) {
        deviceName = "Motorola";
    } else if (/Tablet/i.test(ua) || /Android.*Tab/i.test(ua)) {
        deviceName = "Tablet Android";
    } else if (/Mobile/i.test(ua)) {
        deviceName = "Smartphone Generico";
    }

    let os = "Desktop";
    if (ua.indexOf("Win") !== -1) os = "Windows";
    else if (ua.indexOf("Mac") !== -1) os = "macOS";
    else if (ua.indexOf("Linux") !== -1) os = "Linux";
    else if (ua.indexOf("Android") !== -1) os = "Android";
    else if (ua.indexOf("like Mac") !== -1) os = "iOS";

    return `${deviceName} (${os})`;
}

function initGlobalResetListener() {
    db.ref('global_reset_signal').on('value', (snap) => {
        const serverSignal = snap.val();
        if (serverSignal) {
            const localSignalProcessed = localStorage.getItem('laundry_last_reset_processed');
            if (localSignalProcessed !== String(serverSignal)) {
                localStorage.setItem('laundry_last_reset_processed', String(serverSignal));
                lockAppComplete();
                showToast("Dispositivo scollegato da remoto dall'amministratore.", "error");
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
            showToast("La licenza di questo dispositivo è stata rimossa dall'amministratore.", "error");
            const expiredModal = document.getElementById('licenseExpiredModal');
            if (expiredModal) expiredModal.classList.remove('hidden');
        } else if (snap.exists()) {
            const licData = snap.val();
            if (licData.expiry) {
                localStorage.setItem('laundry_license_expiry', licData.expiry);
                if (Date.now() >= licData.expiry) {
                    lockAppComplete();
                    const expiredModal = document.getElementById('licenseExpiredModal');
                    if (expiredModal) expiredModal.classList.remove('hidden');
                }
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
            logoBtn.addEventListener(evt, (e) => {
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
    showToast("Sblocco forzato applicato!", "success");
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
    const isDemo = localStorage.getItem('laundry_is_demo') === 'true';

    if (deviceActivated === 'true' && licenseExpiry) {
        const now = Date.now();
        const expiryTime = parseInt(licenseExpiry, 10);

        if (now < expiryTime) {
            sessionStorage.setItem('laundry_auth', 'true');
            unlockApp();
            
            if (isDemo && !sessionStorage.getItem('demo_warning_shown')) {
                showDemoWarningModal(expiryTime);
                sessionStorage.setItem('demo_warning_shown', 'true');
            } else {
                checkDaysBeforeExpiry(now, expiryTime);
            }
            startLicenseCountdownMonitor();
            return;
        } else {
            lockAppComplete();
            const expiredModal = document.getElementById('licenseExpiredModal');
            if (expiredModal) expiredModal.classList.remove('hidden');
        }
    }
}

function showDemoWarningModal(expiryTime) {
    const diffMs = expiryTime - Date.now();
    const diffDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    const warningText = document.getElementById('licenseWarningText');
    if (warningText) {
        warningText.innerHTML = `Gentile utente, vi informiamo che questo terminale sta operando con una <b>Licenza di Valutazione (Demo)</b>.<br><br>Il periodo di prova scadrà tra <b>${diffDays} giorni</b>. Per continuare a usufruire di tutte le funzionalità del gestionale senza interruzioni, vi invitiamo a contattare il vostro fornitore per l'attivazione della licenza definitiva.`;
    }
    const warningModal = document.getElementById('licenseWarningModal');
    if (warningModal) warningModal.classList.remove('hidden');
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

        if (!hasShownTodayWarning && localStorage.getItem('laundry_is_demo') !== 'true') {
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
                warningText.textContent = `Avviso importante: La licenza di questo dispositivo scadrà domani. Si prega di provvedere al rinnovo per evitare la sospensione del servizio.`;
            } else {
                warningText.textContent = `Avviso di scadenza: La licenza scadrà tra ${diffDays} giorni. Contattare l'assistenza per rinnovare il contratto.`;
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
    const licenseInput = document.getElementById('licensePhoneInput');
    let enteredCode = licenseInput ? licenseInput.value.trim() : "";

    if (!enteredCode) {
        showToast("Inserisci il codice numerico della licenza", "error");
        return;
    }

    db.ref('used_licenses/' + enteredCode).once('value').then((usedSnap) => {
        if (usedSnap.exists() && enteredCode !== APP_PASSWORD && enteredCode !== "CLEO-MASTER") {
            showToast("Questo codice è già stato attivato su un altro dispositivo!", "error");
            return;
        }

        db.ref('licenses').once('value').then((snapshot) => {
            const licenses = snapshot.val();
            let matchedKey = null;
            let customExpiryVal = null;
            let clientNameVal = "Dispositivo Attivato";
            let isDemoVal = false;

            if (licenses) {
                for (let key in licenses) {
                    if (String(key) === String(enteredCode)) {
                        matchedKey = key;
                        customExpiryVal = typeof licenses[key] === 'object' ? licenses[key].expiry : licenses[key];
                        if (typeof licenses[key] === 'object') {
                            clientNameVal = licenses[key].clientName || clientNameVal;
                            isDemoVal = licenses[key].isDemo === true || licenses[key].isDemo === "true";
                        }
                        break;
                    } else if (typeof licenses[key] === 'object' && String(licenses[key].code) === String(enteredCode)) {
                        matchedKey = key;
                        customExpiryVal = licenses[key].expiry;
                        clientNameVal = licenses[key].clientName || clientNameVal;
                        isDemoVal = licenses[key].isDemo === true || licenses[key].isDemo === "true";
                        break;
                    }
                }
            }

            if (matchedKey || customExpiryVal) {
                let expirationTimestamp = Date.now() + (24 * 60 * 60 * 1000);

                if (customExpiryVal) {
                    let parsedTime = typeof customExpiryVal === 'number' ? customExpiryVal : new Date(customExpiryVal).getTime();
                    if (!isNaN(parsedTime) && parsedTime > Date.now()) {
                        expirationTimestamp = parsedTime;
                    }
                }
                
                const detectedDevice = getDeviceInfoString();

                db.ref('used_licenses/' + enteredCode).set({
                    usedAt: Date.now(),
                    expiry: expirationTimestamp,
                    clientName: clientNameVal,
                    isDemo: isDemoVal,
                    deviceInfo: detectedDevice
                });

                if (matchedKey) {
                    db.ref('licenses').child(matchedKey).remove().catch(() => {});
                }

                localStorage.setItem('laundry_device_activated', 'true');
                localStorage.setItem('laundry_active_license', enteredCode);
                localStorage.setItem('laundry_license_expiry', expirationTimestamp);
                localStorage.setItem('laundry_is_demo', isDemoVal ? 'true' : 'false');
                sessionStorage.setItem('laundry_auth', 'true');
                sessionStorage.setItem('laundry_logged_as_admin', 'false');
                hasShownTodayWarning = false;
                
                unlockApp();
                initRealtimeLicenseListener();
                startLicenseCountdownMonitor();
                
                if(isDemoVal) {
                    showDemoWarningModal(expirationTimestamp);
                    sessionStorage.setItem('demo_warning_shown', 'true');
                }
                
                const expiryDateFormatted = new Date(expirationTimestamp).toLocaleDateString('it-IT');
                showToast(`Licenza attivata con successo fino al ${expiryDateFormatted}!`, "success");
            } else {
                showToast("Codice licenza non valido o già riscattato.", "error");
            }
        }).catch(() => {
            showToast("Errore di connessione durante la verifica.", "error");
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
    localStorage.removeItem('laundry_is_demo');
    
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
                <div class="text-xs text-slate-400">${client.phone}</div>
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
