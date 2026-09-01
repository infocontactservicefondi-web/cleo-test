/* global firebase */

// ==========================================
// CONFIGURAZIONE FIREBASE
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyAhD...",
    authDomain: "lavanderia-cleo.firebaseapp.com",
    databaseURL: "https://lavanderia-cleo-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "lavanderia-cleo",
    storageBucket: "lavanderia-cleo.appspot.com",
    messagingSenderId: "367910186985",
    appId: "1:367910186985:web:8d00921a97df11b519edee"
};

// Inizializza Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

// Costante per la password Admin Master
const APP_PASSWORD = "CLEO"; 

// Variabile per evitare notifiche ripetute di pre-scadenza durante la stessa sessione
let hasShownTodayWarning = false;
let countdownInterval = null;

// ==========================================
// AVVIO APPLICAZIONE (DOM LOADED)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    setupNumpad();
    checkExistingActivation();

    // Ascolto cambio orario/connessione
    window.addEventListener('online', checkExistingActivation);
    window.addEventListener('focus', checkExistingActivation);
}

// ==========================================
// TASTIERINO NUMERICO (NUMPAD)
// ==========================================
function setupNumpad() {
    const numpadButtons = document.querySelectorAll('.numpad-btn');
    const input = document.querySelector('#loginScreen input');

    if (!input) return;

    numpadButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const val = btn.getAttribute('data-val');
            const action = btn.getAttribute('data-action');

            if (val !== null) {
                input.value += val;
            } else if (action === 'clear') {
                input.value = '';
            } else if (action === 'delete') {
                input.value = input.value.slice(0, -1);
            }
        });
    });

    const submitBtn = document.querySelector('#loginScreen button[type="submit"], #loginScreen .btn-primary');
    if (submitBtn) {
        submitBtn.addEventListener('click', (e) => {
            e.preventDefault();
            checkNumericLicense();
        });
    }

    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            checkNumericLicense();
        }
    });
}

// ==========================================
// CONTROLLO ATTIVAZIONE ESISTENTE ALL'AVVIO
// ==========================================
function checkExistingActivation() {
    const isActivated = localStorage.getItem('laundry_device_activated');
    const expiryTimestamp = parseInt(localStorage.getItem('laundry_license_expiry'), 10);
    const now = Date.now();

    if (isActivated === 'true' && expiryTimestamp) {
        if (now >= expiryTimestamp) {
            // Licenza Scaduta!
            lockAppExpired();
        } else {
            // Licenza Valida
            unlockApp();
            startLicenseCountdownMonitor();
            checkWarningThreshold(expiryTimestamp);
        }
    } else {
        // Dispositivo non attivato
        showLoginScreen();
    }
}

// ==========================================
// ATTIVAZIONE E VERIFICA CODICE LICENZA
// ==========================================
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

    // 1. Licenza di prova 1 minuto
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

    // 2. Controllo se il codice è già stato riscattato su questo dispositivo
    const alreadyUsedCode = localStorage.getItem('laundry_code_already_redeemed');
    if (alreadyUsedCode === enteredCode && enteredCode !== APP_PASSWORD && enteredCode !== "CLEO-MASTER") {
        showToast("Questo dispositivo ha già utilizzato questo codice. Non puoi riusarlo.", "error");
        return;
    }

    // 3. Accesso Master Illimitato (Password Admin)
    if (enteredCode === APP_PASSWORD || enteredCode === "CLEO-MASTER") {
        let expirationTimestamp = Date.now() + (365 * 100 * 24 * 60 * 60 * 1000); // 100 anni
        localStorage.setItem('laundry_device_activated', 'true');
        localStorage.setItem('laundry_license_expiry', expirationTimestamp);
        sessionStorage.setItem('laundry_auth', 'true');
        sessionStorage.setItem('laundry_logged_as_admin', 'true');
        hasShownTodayWarning = false;
        unlockApp();
        showToast("Accesso Master illimitato eseguito!", "success");
        return;
    }

    // 4. Verifica della licenza su Firebase Realtime Database
    db.ref('used_licenses/' + enteredCode).once('value').then((usedSnap) => {
        if (usedSnap.exists()) {
            showToast("Questo codice licenza è già stato utilizzato su un altro dispositivo!", "error");
            return;
        }

        db.ref('licenses').once('value')
            .then((snapshot) => {
                const licenses = snapshot.val();
                let matchedKey = null;
                let customExpiryVal = null;

                if (licenses) {
                    for (let key in licenses) {
                        if (String(key) === String(enteredCode)) {
                            matchedKey = key;
                            customExpiryVal = licenses[key];
                            break;
                        } else if (String(licenses[key]) === String(enteredCode)) {
                            matchedKey = key;
                            break;
                        }
                    }
                }

                if (matchedKey) {
                    // Impostazione predefinita: 1 anno da oggi (365 giorni)
                    let expirationTimestamp = Date.now() + (365 * 24 * 60 * 60 * 1000);

                    // Se su Firebase è stata inserita una data o un timestamp personalizzato
                    if (customExpiryVal && customExpiryVal !== true) {
                        let parsedTime = typeof customExpiryVal === 'number' ? customExpiryVal : new Date(customExpiryVal).getTime();
                        if (!isNaN(parsedTime)) {
                            expirationTimestamp = parsedTime;
                        }
                    }

                    // Marca come utilizzata e rimuovi da quelle disponibili
                    db.ref('used_licenses/' + enteredCode).set(true);
                    db.ref('licenses').child(matchedKey).remove().catch(() => {});

                    // Salva lo stato in locale
                    localStorage.setItem('laundry_device_activated', 'true');
                    localStorage.setItem('laundry_active_license', enteredCode);
                    localStorage.setItem('laundry_code_already_redeemed', enteredCode);
                    localStorage.setItem('laundry_license_expiry', expirationTimestamp);
                    sessionStorage.setItem('laundry_auth', 'true');
                    sessionStorage.setItem('laundry_logged_as_admin', 'false');
                    hasShownTodayWarning = false;

                    unlockApp();
                    startLicenseCountdownMonitor();
                    const expiryDateFormatted = new Date(expirationTimestamp).toLocaleDateString('it-IT');
                    showToast(`Licenza attivata con successo fino al ${expiryDateFormatted}!`, "success");
                } else {
                    showToast("Codice licenza non valido o già utilizzato.", "error");
                }
            })
            .catch((err) => {
                console.error(err);
                showToast("Errore di connessione o verifica fallita.", "error");
            });
    });
}

// ==========================================
// MONITORAGGIO COUNTDOWN E SCADENZE
// ==========================================
function startLicenseCountdownMonitor() {
    if (countdownInterval) clearInterval(countdownInterval);

    countdownInterval = setInterval(() => {
        const expiryTimestamp = parseInt(localStorage.getItem('laundry_license_expiry'), 10);
        if (!expiryTimestamp) return;

        const now = Date.now();

        if (now >= expiryTimestamp) {
            clearInterval(countdownInterval);
            lockAppExpired();
        } else {
            checkWarningThreshold(expiryTimestamp);
        }
    }, 1000);
}

function checkWarningThreshold(expiryTimestamp) {
    const now = Date.now();
    const diffMs = expiryTimestamp - now;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    // Mostra l'avviso se mancano tra 1 e 5 giorni
    if (diffDays <= 5 && diffDays > 0 && !hasShownTodayWarning) {
        hasShownTodayWarning = true;
        showExpiryWarningModal(diffDays);
    }
}

// ==========================================
// GESTIONE SCHERMATE E POPUP
// ==========================================
function showLoginScreen() {
    const loginScreen = document.getElementById('loginScreen');
    const mainApp = document.getElementById('mainApp');
    if (loginScreen) loginScreen.style.display = 'flex';
    if (mainApp) mainApp.style.display = 'none';
}

function unlockApp() {
    const loginScreen = document.getElementById('loginScreen');
    const mainApp = document.getElementById('mainApp');
    if (loginScreen) loginScreen.style.display = 'none';
    if (mainApp) mainApp.style.display = 'block';

    // Pulisce l'input della schermata di login
    const input = document.querySelector('#loginScreen input');
    if (input) input.value = '';
}

function lockAppExpired() {
    localStorage.removeItem('laundry_device_activated');
    localStorage.removeItem('laundry_license_expiry');
    sessionStorage.removeItem('laundry_auth');

    showLoginScreen();

    const expiredModal = document.getElementById('licenseExpiredModal');
    if (expiredModal) {
        expiredModal.style.display = 'flex';
    } else {
        showToast("LICENZA SCADUTA! Rinnoverla per continuare ad usare l'applicazione.", "error");
    }
}

function showExpiryWarningModal(daysLeft) {
    const warningModal = document.getElementById('licenseWarningModal');
    const daysContainer = document.getElementById('warningDaysLeft');

    if (daysContainer) {
        daysContainer.innerText = daysLeft;
    }

    if (warningModal) {
        warningModal.style.display = 'flex';
    } else {
        showToast(`ATTENZIONE: La licenza scadrà tra ${daysLeft} giorni!`, "error");
    }
}

// ==========================================
// UTILITY TOAST
// ==========================================
function showToast(message, type = "info") {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.style.position = 'fixed';
        container.style.bottom = '20px';
        container.style.right = '20px';
        container.style.zIndex = '9999';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerText = message;

    toast.style.marginTop = '10px';
    toast.style.padding = '12px 20px';
    toast.style.borderRadius = '8px';
    toast.style.color = '#fff';
    toast.style.fontWeight = 'bold';
    toast.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
    toast.style.transition = 'all 0.3s ease';

    if (type === 'error') {
        toast.style.backgroundColor = '#e74c3c';
    } else if (type === 'success') {
        toast.style.backgroundColor = '#2ecc71';
    } else {
        toast.style.backgroundColor = '#3498db';
    }

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}
