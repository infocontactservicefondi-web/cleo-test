// ==========================================
// LAVANDERIA CLEO - APP LOGIC (VERSIONE CORRETTA USED_LICENSES)
// ==========================================

const firebaseConfig = {
  apiKey: "AIzaSyBsqq_nKIFgTJycbJzdDkzC2vVya1GiasE",
  authDomain: "cleo-test-36894.firebaseapp.com",
  databaseURL: "https://cleo-test-36894-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "cleo-test-36894",
  storageBucket: "cleo-test-36894.firebasestorage.app",
  messagingSenderId: "664698660023",
  appId: "1:664698660023:web:05c0f10bde14cbe34c1932"
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

let licenseCheckInterval = null;
let activeLicenseRef = null;

function getStorePath(nodeName) {
    const storeId = localStorage.getItem('laundry_active_license') || 'default_store';
    return `stores/${storeId}/${nodeName}`;
}

function parseDateToTimestamp(val) {
    if (!val) return null;
    if (typeof val === 'number') return val;
    const parsed = new Date(val).getTime();
    return isNaN(parsed) ? null : parsed;
}

document.addEventListener('DOMContentLoaded', () => {
    initLicenseSystem();
    initTheme();
    initConnectionMonitor(); 
    initGlobalResetListener();
    initProtectedLogo();
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
        inputs[0].placeholder = "Inserisci codice licenza...";
    }
}

function listenActiveLicenseRealtime(licenseCode) {
    if (!licenseCode || licenseCode === APP_PASSWORD || licenseCode === "CLEO-MASTER") return;
    if (activeLicenseRef) activeLicenseRef.off();

    activeLicenseRef = db.ref('used_licenses/' + licenseCode);
    activeLicenseRef.on('value', (snap) => {
        if (!snap.exists()) {
            db.ref('licenses/' + licenseCode).once('value').then((licSnap) => {
                if (!licSnap.exists()) {
                    triggerHardLock("Licenza Revocata", "ATTENZIONE: La licenza associata a questo terminale è stata revocata.");
                }
            });
        }
    });
}

function initGlobalResetListener() {
    db.ref('global_reset_signal').on('value', (snap) => {
        const serverSignal = snap.val();
        if (serverSignal) {
            const localSignalProcessed = localStorage.getItem('laundry_last_reset_processed');
            if (localSignalProcessed !== String(serverSignal)) {
                localStorage.setItem('laundry_last_reset_processed', String(serverSignal));
                triggerHardLock("Dispositivo Disconnesso", "Il terminale è stato disconnesso da remoto dall'amministratore.");
            }
        }
    });
}

function triggerHardLock(title, message) {
    lockAppComplete();
    const expiredModal = document.getElementById('licenseExpiredModal');
    const titleEl = document.getElementById('expiredModalTitle');
    const textEl = document.getElementById('expiredModalText');
    if (titleEl) titleEl.textContent = title;
    if (textEl) textEl.textContent = message;
    if (expiredModal) expiredModal.classList.remove('hidden');
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
                    if (Date.now() - startTime >= holdDuration) {
                        clearInterval(logoPressTimer);
                        if(progressFill) progressFill.style.height = '0%';
                        lockAppComplete();
                        showToast("Sblocco forzato attivato!", "success");
                    }
                }, 100);
            });
        });

        ['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach(evt => {
            logoBtn.addEventListener(evt, () => {
                if (logoPressTimer) clearInterval(logoPressTimer);
                if(progressFill) progressFill.style.height = '0%';
            });
        });
    }
}

function initLicenseSystem() {
    const deviceActivated = localStorage.getItem('laundry_device_activated');
    const licenseExpiry = localStorage.getItem('laundry_license_expiry');

    if (deviceActivated === 'true' && licenseExpiry) {
        if (Date.now() < parseInt(licenseExpiry, 10)) {
            sessionStorage.setItem('laundry_auth', 'true');
            const activeLicense = localStorage.getItem('laundry_active_license');
            if (activeLicense) listenActiveLicenseRealtime(activeLicense);
            unlockApp();
        } else {
            triggerHardLock("Periodo di Scadenza Raggiunto", "La licenza è giunta a termine.");
        }
    }
}

function checkNumericLicense() {
    const inputs = document.querySelectorAll('#loginScreen input');
    let enteredCode = inputs.length > 0 ? inputs[0].value.trim() : "";

    if (!enteredCode) {
        showToast("Inserisci il codice numerico della licenza", "error");
        return;
    }

    db.ref('licenses/' + enteredCode).once('value')
        .then((snapshot) => {
            const licenseData = snapshot.val();
            if (!licenseData) {
                showToast("Codice licenza non valido o inesistente.", "error");
                return;
            }

            let expirationTimestamp = parseDateToTimestamp(licenseData.expiry);
            let isDemoLicense = licenseData.isDemo === true;

            // Registrazione corretta su used_licenses
            db.ref('used_licenses/' + enteredCode).set({
                usedAt: Date.now(),
                deviceInfo: "Dispositivo Web Tablet",
                expiry: expirationTimestamp,
                isDemo: isDemoLicense,
                clientName: licenseData.clientName || "Lavanderia",
                phone: licenseData.phone || ""
            });

            localStorage.setItem('laundry_device_activated', 'true');
            localStorage.setItem('laundry_active_license', enteredCode);
            localStorage.setItem('laundry_license_expiry', expirationTimestamp);
            localStorage.setItem('laundry_is_demo_license', isDemoLicense ? 'true' : 'false');
            sessionStorage.setItem('laundry_auth', 'true');
            sessionStorage.setItem('laundry_logged_as_admin', 'false');
            
            listenActiveLicenseRealtime(enteredCode);
            unlockApp();
            showToast("Licenza attivata con successo!", "success");
        })
        .catch(() => {
            showToast("Errore di connessione al database.", "error");
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
    if (licenseCheckInterval) clearInterval(licenseCheckInterval);
    if (activeLicenseRef) {
        activeLicenseRef.off();
        activeLicenseRef = null;
    }
    sessionStorage.clear();
    localStorage.clear();
    if(appContainer) appContainer.classList.add('hidden');
    if(loginScreen) loginScreen.classList.remove('hidden');
}

function initApp() {
    loadClients();
    loadItems();
    loadHistory();
}

// Funzioni di utilità rimanenti per la gestione capi e clienti dell'app...
window.switchTab = function(tab) {
    const viewActive = document.getElementById('viewActive');
    const viewStats = document.getElementById('viewStats');
    if (tab === 'active') {
        if(viewStats) viewStats.classList.add('hidden');
        if(viewActive) viewActive.classList.remove('hidden');
    } else {
        if(viewActive) viewActive.classList.add('hidden');
        if(viewStats) viewStats.classList.remove('hidden');
    }
};

function showToast(message, type = "success") {
    // Gestione notifiche toast
    alert(message);
}
