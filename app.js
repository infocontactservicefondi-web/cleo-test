// ==========================================
// LAVANDERIA CLEO - APP LOGIC (VERSIONE COMPLETA FINALE CON CODICI MONO-USO ANTI-SOVRAPPOSIZIONE)
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

const itemsTableBody = document.getElementById('itemsTableBody');
const noItemsMessage = document.getElementById('noItemsMessage');
const itemsCounterBadge = document.getElementById('itemsCounterBadge');
const activeTableFilter = document.getElementById('activeTableFilter');

let licenseCheckInterval = null;
let activeLicenseRef = null;

function parseDateToTimestamp(val) {
    if (!val) return null;
    if (typeof val === 'number') return val;
    if (typeof val === 'string' && val.includes('/')) {
        const parts = val.split('/');
        if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const year = parseInt(parts[2], 10);
            const d = new Date(year, month, day);
            if (!isNaN(d.getTime())) return d.getTime();
        }
    }
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
        inputs[0].placeholder = "Inserisci codice licenza monouso...";
    }
}

// Controllo in tempo reale per impedire sovrapposizioni e revoche remote
function listenActiveLicenseRealtime(licenseCode) {
    if (!licenseCode || licenseCode === APP_PASSWORD || licenseCode === "CLEO-MASTER") return;

    if (activeLicenseRef) activeLicenseRef.off();

    activeLicenseRef = db.ref('used_licenses/' + licenseCode);
    activeLicenseRef.on('value', (snap) => {
        if (!snap.exists()) {
            db.ref('licenses/' + licenseCode).once('value').then((licSnap) => {
                if (!licSnap.exists()) {
                    triggerHardLock("Licenza Revocata", "ATTENZIONE: La licenza associata a questo terminale è stata revocata o eliminata dall'amministrazione.");
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
                triggerHardLock("Dispositivo Disconnesso", "Il terminale è stato disconnesso da remoto dall'amministratore di sistema.");
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
                    let elapsed = Date.now() - startTime;
                    if (elapsed >= holdDuration) {
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
        const now = Date.now();
        const expiryTime = parseInt(licenseExpiry, 10);

        if (now < expiryTime) {
            sessionStorage.setItem('laundry_auth', 'true');
            const activeLicense = localStorage.getItem('laundry_active_license');
            if (activeLicense) listenActiveLicenseRealtime(activeLicense);
            
            const termsAccepted = localStorage.getItem('laundry_b2b_terms_accepted');
            if (termsAccepted === 'true') {
                unlockApp();
            } else {
                checkAndShowB2bConsentModal();
            }
        } else {
            triggerHardLock("Periodo di Scadenza Raggiunto", "La licenza associata a questo dispositivo è giunta a termine. Inserisci un nuovo codice valido per continuare.");
        }
    }
}

function checkAndShowB2bConsentModal() {
    const consentModal = document.getElementById('licenseTermsConsentModal');
    const checkbox = document.getElementById('acceptB2bTermsCheck');
    if (consentModal) {
        if (checkbox) checkbox.checked = false;
        consentModal.classList.remove('hidden');
    } else {
        unlockApp();
    }
}

window.confirmB2bLicenseConsent = function() {
    const checkbox = document.getElementById('acceptB2bTermsCheck');
    if (!checkbox || !checkbox.checked) {
        showToast("Devi accettare i Termini di Servizio B2B per proseguire", "error");
        return;
    }
    localStorage.setItem('laundry_b2b_terms_accepted', 'true');
    const consentModal = document.getElementById('licenseTermsConsentModal');
    if (consentModal) consentModal.classList.add('hidden');
    
    unlockApp();
    checkAndTriggerLicenseWarnings();
};

function checkAndTriggerLicenseWarnings() {
    const isDemo = localStorage.getItem('laundry_is_demo_license') === 'true';
    const expiryTimestamp = localStorage.getItem('laundry_license_expiry');
    if (!expiryTimestamp) return;

    const now = Date.now();
    const expiryTime = parseInt(expiryTimestamp, 10);
    const diffMs = expiryTime - now;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    const todayStr = new Date().toDateString();
    const lastWarningDate = localStorage.getItem('laundry_last_warning_date');

    let shouldShow = false;
    let warningMsg = "";
    const expiryDateStr = new Date(expiryTime).toLocaleDateString('it-IT');

    if (isDemo) {
        if (!localStorage.getItem('laundry_demo_initial_warning_shown')) {
            shouldShow = true;
            warningMsg = `⚠️ ATTENZIONE: Stai utilizzando una versione DEMO. La licenza scadrà in data ${expiryDateStr}.`;
            localStorage.setItem('laundry_demo_initial_warning_shown', 'true');
        } else if (diffDays <= 5 && diffDays >= 0) {
            if (lastWarningDate !== todayStr) {
                shouldShow = true;
                warningMsg = `⚠️ ATTENZIONE: Versione DEMO in scadenza tra ${diffDays} giorni (${expiryDateStr}).`;
                localStorage.setItem('laundry_last_warning_date', todayStr);
            }
        }
    } else {
        if (!localStorage.getItem('laundry_paid_initial_warning_shown')) {
            shouldShow = true;
            warningMsg = `ℹ️ NOTA LICENZA: Licenza ufficiale attiva fino al ${expiryDateStr}.`;
            localStorage.setItem('laundry_paid_initial_warning_shown', 'true');
        } else if (diffDays <= 5 && diffDays >= 0) {
            if (lastWarningDate !== todayStr) {
                shouldShow = true;
                warningMsg = `⚠️ NOTA SCADENZA: La licenza ufficiale scadrà tra ${diffDays} giorni (${expiryDateStr}).`;
                localStorage.setItem('laundry_last_warning_date', todayStr);
            }
        }
    }

    if (shouldShow) {
        const warningText = document.getElementById('licenseWarningText');
        if (warningText) warningText.textContent = warningMsg;
        const warningModal = document.getElementById('licenseWarningModal');
        if (warningModal) warningModal.classList.remove('hidden');
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
            localStorage.clear();
            sessionStorage.clear();
            
            const warningModal = document.getElementById('licenseWarningModal');
            if (warningModal) warningModal.classList.add('hidden');

            triggerHardLock("Periodo di Licenza Terminato", "La licenza ufficiale associata a questo dispositivo è scaduta.");
            return;
        }
    }, 1000); 
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
    let enteredPassword = inputs.length > 1 ? inputs[1].value.trim() : (passwordInput ? passwordInput.value.trim() : "");

    if (!enteredPassword) {
        showToast("Inserisci la password amministratore", "error");
        return;
    }

    if (enteredPassword === APP_PASSWORD || enteredPassword === "CLEO-MASTER") {
        sessionStorage.setItem('laundry_auth', 'true');
        sessionStorage.setItem('laundry_logged_as_admin', 'true');
        
        const termsAccepted = localStorage.getItem('laundry_b2b_terms_accepted');
        if (termsAccepted === 'true') {
            unlockApp();
        } else {
            checkAndShowB2bConsentModal();
        }
        showToast("Accesso amministratore eseguito", "success");
    } else {
        showToast("Password amministratore errata", "error");
        if (loginError) {
            loginError.textContent = "Password errata. Riprova.";
            loginError.classList.remove('hidden');
        }
    }
}

// LOGICA FONDAMENTALE ANTI-SOVRAPPOSIZIONE: CONTROLLO CODICE MONO-USO SU FIREBASE
window.checkNumericLicense = function() {
    const inputs = document.querySelectorAll('#loginScreen input');
    let enteredCode = inputs.length > 0 ? inputs[0].value.trim() : "";

    if (!enteredCode) {
        showToast("Inserisci il codice numerico della licenza", "error");
        return;
    }

    if (enteredCode === APP_PASSWORD || enteredCode === "CLEO-MASTER") {
        let expirationTimestamp = Date.now() + (365 * 100 * 24 * 60 * 60 * 1000);
        localStorage.setItem('laundry_device_activated', 'true');
        localStorage.setItem('laundry_license_expiry', expirationTimestamp);
        localStorage.setItem('laundry_is_demo_license', 'false'); 
        sessionStorage.setItem('laundry_auth', 'true');
        sessionStorage.setItem('laundry_logged_as_admin', 'true');
        
        checkAndShowB2bConsentModal();
        showToast("Accesso Master illimitato eseguito!", "success");
        return;
    }

    // 1. Verifica preventiva nel nodo used_licenses per impedire l'uso simultaneo/multiplo da altri negozi
    db.ref('used_licenses/' + enteredCode).once('value')
        .then((usedSnap) => {
            if (usedSnap.exists()) {
                showToast("Errore: Questo codice monouso è già stato utilizzato su un altro negozio/dispositivo e non può essere riutilizzato!", "error");
                return;
            }

            // 2. Verifica l'esistenza del codice nel generatore delle licenze
            db.ref('licenses/' + enteredCode).once('value')
                .then((snapshot) => {
                    const licenseData = snapshot.val();

                    if (!licenseData) {
                        showToast("Codice licenza non valido o inesistente.", "error");
                        return;
                    }

                    let expirationTimestamp = null;
                    let isDemoLicense = false;

                    if (typeof licenseData === 'object' && licenseData !== null) {
                        expirationTimestamp = parseDateToTimestamp(licenseData.expiry);
                        isDemoLicense = licenseData.isDemo === true;
                    } else {
                        expirationTimestamp = parseDateToTimestamp(licenseData);
                        const diffDaysCalc = Math.round((expirationTimestamp - Date.now()) / (1000 * 60 * 60 * 24));
                        isDemoLicense = (diffDaysCalc <= 31);
                    }

                    if (!expirationTimestamp || isNaN(expirationTimestamp)) {
                        expirationTimestamp = Date.now() + (15 * 24 * 60 * 60 * 1000); 
                        isDemoLicense = true;
                    }

                    // Registra immediatamente il codice come usato per bloccare qualsiasi altro tentativo da altri negozi
                    db.ref('used_licenses/' + enteredCode).set({
                        usedAt: Date.now(),
                        deviceInfo: navigator.userAgent || "Negozio / Terminale Web",
                        expiry: expirationTimestamp,
                        isDemo: isDemoLicense
                    });

                    localStorage.setItem('laundry_device_activated', 'true');
                    localStorage.setItem('laundry_active_license', enteredCode);
                    localStorage.setItem('laundry_license_expiry', expirationTimestamp);
                    localStorage.setItem('laundry_is_demo_license', isDemoLicense ? 'true' : 'false');
                    localStorage.removeItem('laundry_demo_initial_warning_shown');
                    localStorage.removeItem('laundry_paid_initial_warning_shown');
                    localStorage.removeItem('laundry_last_warning_date');
                    sessionStorage.setItem('laundry_auth', 'true');
                    sessionStorage.setItem('laundry_logged_as_admin', 'false');
                    
                    listenActiveLicenseRealtime(enteredCode);
                    checkAndShowB2bConsentModal();
                    startLicenseCountdownMonitor();
                    
                    const expiryDateFormatted = new Date(expirationTimestamp).toLocaleDateString('it-IT');
                    showToast(`Licenza monouso attivata con successo fino al ${expiryDateFormatted}!`, "success");
                })
                .catch(() => {
                    showToast("Errore di connessione al database.", "error");
                });
        })
        .catch(() => {
            showToast("Errore di verifica del codice nel database.", "error");
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
    if (icon) icon.className = isDark ? "fa-solid fa-moon" : "fa-solid fa-sun";
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
}

window.lockApp = function() {
    const deviceActivated = localStorage.getItem('laundry_device_activated');
    if (deviceActivated === 'true') {
        showToast("Dispositivo con licenza attiva: impossibile uscire", "error");
        return;
    }
    lockAppComplete();
};

function lockAppComplete() {
    if (licenseCheckInterval) clearInterval(licenseCheckInterval);
    if (activeLicenseRef) {
        activeLicenseRef.off();
        activeLicenseRef = null;
    }
    
    sessionStorage.clear();
    localStorage.clear();
    
    if(appContainer) {
        appContainer.style.opacity = '0';
        setTimeout(() => appContainer.classList.add('hidden'), 400);
    }
    if(loginScreen) {
        loginScreen.classList.remove('hidden');
        setTimeout(() => loginScreen.style.opacity = '1', 50);
    }
}

function showToast(message, type = "success") {
    console.log(`[${type.toUpperCase()}] ${message}`);
    // Se è presente una funzione toast personalizzata nell'interfaccia, viene richiamata automaticamente
    if (window.showCustomToast) {
        window.showCustomToast(message, type);
    }
}
