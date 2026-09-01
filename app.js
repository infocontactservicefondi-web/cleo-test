/* global firebase, XLSX */

const firebaseConfig = {
    apiKey: "AIzaSyAhD...",
    authDomain: "lavanderia-cleo.firebaseapp.com",
    databaseURL: "https://lavanderia-cleo-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "lavanderia-cleo",
    storageBucket: "lavanderia-cleo.appspot.com",
    messagingSenderId: "367910186985",
    appId: "1:367910186985:web:8d00921a97df11b519edee"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

const APP_PASSWORD = "CLEO"; 
let hasShownTodayWarning = false;
let countdownInterval = null;
let historyData = {};

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    checkExistingActivation();
    window.addEventListener('online', checkExistingActivation);
    window.addEventListener('focus', checkExistingActivation);
}

// ==========================================
// ACCESSO AMMINISTRATORE (PASSWORD CLEO)
// ==========================================
function handleLogin(event) {
    if (event) event.preventDefault();
    
    const pwdInput = document.getElementById('passwordInput');
    const errorMsg = document.getElementById('loginError');
    const pwd = pwdInput ? pwdInput.value.trim() : '';

    if (pwd === APP_PASSWORD || pwd.toUpperCase() === "CLEO") {
        sessionStorage.setItem('laundry_auth', 'true');
        sessionStorage.setItem('laundry_logged_as_admin', 'true');
        if (errorMsg) errorMsg.classList.add('hidden');
        unlockApp();
        showToast("Accesso eseguito con successo!", "success");
    } else {
        if (errorMsg) {
            errorMsg.innerText = "Password errata! Riprova.";
            errorMsg.classList.remove('hidden');
        }
    }
}

// ==========================================
// CONTROLLO LICENZA NUMERICA / DISPOSITIVO
// ==========================================
function checkExistingActivation() {
    const isAuth = sessionStorage.getItem('laundry_auth');
    const isActivated = localStorage.getItem('laundry_device_activated');
    const expiryTimestamp = parseInt(localStorage.getItem('laundry_license_expiry'), 10);
    const now = Date.now();

    if (isAuth === 'true') {
        unlockApp();
        if (expiryTimestamp) startLicenseCountdownMonitor();
        return;
    }

    if (isActivated === 'true' && expiryTimestamp) {
        if (now >= expiryTimestamp) {
            lockAppExpired();
        } else {
            unlockApp();
            startLicenseCountdownMonitor();
            checkWarningThreshold(expiryTimestamp);
        }
    } else {
        showLoginScreen();
    }
}

function checkNumericLicense() {
    const input = document.getElementById('licensePhoneInput');
    const enteredCode = input ? input.value.trim() : "";

    if (!enteredCode) {
        showToast("Inserisci il codice licenza", "error");
        return;
    }

    if (enteredCode.toUpperCase() === "TEST1MIN") {
        let expirationTimestamp = Date.now() + (60 * 1000); 
        localStorage.setItem('laundry_device_activated', 'true');
        localStorage.setItem('laundry_license_expiry', expirationTimestamp);
        sessionStorage.setItem('laundry_auth', 'true');
        hasShownTodayWarning = false;
        unlockApp();
        startLicenseCountdownMonitor();
        showToast("TEST ATTIVO: Licenza di 1 minuto avviata!", "success");
        return;
    }

    if (enteredCode.toUpperCase() === APP_PASSWORD || enteredCode.toUpperCase() === "CLEO-MASTER") {
        let expirationTimestamp = Date.now() + (365 * 100 * 24 * 60 * 60 * 1000);
        localStorage.setItem('laundry_device_activated', 'true');
        localStorage.setItem('laundry_license_expiry', expirationTimestamp);
        sessionStorage.setItem('laundry_auth', 'true');
        hasShownTodayWarning = false;
        unlockApp();
        showToast("Accesso Master illimitato eseguito!", "success");
        return;
    }

    db.ref('licenses/' + enteredCode).once('value').then((snapshot) => {
        if (snapshot.exists()) {
            let expirationTimestamp = Date.now() + (365 * 24 * 60 * 60 * 1000);
            localStorage.setItem('laundry_device_activated', 'true');
            localStorage.setItem('laundry_license_expiry', expirationTimestamp);
            sessionStorage.setItem('laundry_auth', 'true');
            hasShownTodayWarning = false;
            unlockApp();
            startLicenseCountdownMonitor();
            showToast("Licenza attivata con successo!", "success");
        } else {
            showToast("Codice licenza non valido.", "error");
        }
    }).catch(() => {
        showToast("Errore durante la verifica della licenza.", "error");
    });
}

// ==========================================
// GESTIONE MONITORAGGIO E TIMER
// ==========================================
function startLicenseCountdownMonitor() {
    if (countdownInterval) clearInterval(countdownInterval);

    countdownInterval = setInterval(() => {
        const expiryTimestamp = parseInt(localStorage.getItem('laundry_license_expiry'), 10);
        if (!expiryTimestamp) return;

        if (Date.now() >= expiryTimestamp) {
            clearInterval(countdownInterval);
            lockAppExpired();
        }
    }, 1000);
}

function checkWarningThreshold(expiryTimestamp) {
    const diffDays = Math.ceil((expiryTimestamp - Date.now()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 5 && diffDays > 0 && !hasShownTodayWarning) {
        hasShownTodayWarning = true;
        showToast(`ATTENZIONE: La licenza scadrà tra ${diffDays} giorni!`, "error");
    }
}

// ==========================================
// GESTIONE INTERFACCIA E TEMA
// ==========================================
function showLoginScreen() {
    const loginScreen = document.getElementById('loginScreen');
    const mainApp = document.getElementById('appContainer');
    if (loginScreen) loginScreen.style.display = 'flex';
    if (mainApp) {
        mainApp.classList.add('hidden');
        mainApp.style.opacity = '0';
    }
}

function unlockApp() {
    const loginScreen = document.getElementById('loginScreen');
    const mainApp = document.getElementById('appContainer');
    if (loginScreen) loginScreen.style.display = 'none';
    if (mainApp) {
        mainApp.classList.remove('hidden');
        setTimeout(() => {
            mainApp.style.opacity = '1';
        }, 50);
    }
}

function lockApp() {
    sessionStorage.removeItem('laundry_auth');
    showLoginScreen();
}

function lockAppExpired() {
    localStorage.removeItem('laundry_device_activated');
    localStorage.removeItem('laundry_license_expiry');
    sessionStorage.removeItem('laundry_auth');
    showLoginScreen();
    const modal = document.getElementById('licenseExpiredModal');
    if (modal) modal.classList.remove('hidden');
}

function closeWarningModal() {
    const modal = document.getElementById('licenseWarningModal');
    if (modal) modal.classList.add('hidden');
}

function closeExpiredModalAndRelogin() {
    const modal = document.getElementById('licenseExpiredModal');
    if (modal) modal.classList.add('hidden');
    showLoginScreen();
}

function toggleTheme() {
    const html = document.documentElement;
    if (html.classList.contains('dark')) {
        html.classList.remove('dark');
        localStorage.setItem('laundry_theme', 'light');
    } else {
        html.classList.add('dark');
        localStorage.setItem('laundry_theme', 'dark');
    }
}

// ==========================================
// ESPORTAZIONE EXCEL CON SHEETJS
// ==========================================
window.exportBackup = function() {
    const historySource = historyData || {};
    const todayDateStr = new Date().toLocaleDateString('it-IT');

    const sortedHistory = Object.entries(historySource).sort((a, b) => {
        return (b[1].returnedAt || 0) - (a[1].returnedAt || 0);
    });

    const dataRows = [];
    const summaryMap = {};
    let totalRevenue = 0;
    let totalItems = 0;

    sortedHistory.forEach(([id, item]) => {
        const price = parseFloat(item.price) || 0;
        const retDate = item.returnedAt ? new Date(item.returnedAt).toLocaleDateString('it-IT') : todayDateStr;
        const capoType = item.type || "Altro";

        totalRevenue += price;
        totalItems++;

        if (!summaryMap[capoType]) {
            summaryMap[capoType] = { count: 0, revenue: 0 };
        }
        summaryMap[capoType].count += 1;
        summaryMap[capoType].revenue += price;

        dataRows.push({
            "Data Ritiro": retDate,
            "Cliente": item.clientName || "N/D",
            "Telefono": item.clientPhone || "N/D",
            "Tipologia Capo": capoType,
            "Prezzo (€)": price,
            "Armadio": item.cabinet || "-",
            "Posizione": item.position || "-"
        });
    });

    const wb = XLSX.utils.book_new();
    const averageTicket = totalItems > 0 ? (totalRevenue / totalItems) : 0;
    
    const summaryRows = [
        ["LAVANDERIA CLEO - REPORT GESTIONALE"],
        [`Data Generazione Report: ${todayDateStr}`],
        [],
        ["=== SINTESI GENERALE ==="],
        ["Metrica", "Valore"],
        ["Incasso Totale (€)", totalRevenue],
        ["Totale Capi Ritirati", totalItems],
        ["Scontrino Medio (€)", averageTicket],
        [],
        ["=== RIEPILOGO PER TIPOLOGIA CAPO ==="],
        ["Tipologia Capo", "Quantità Ritirata", "Incasso Totale (€)", "% Su Incasso"]
    ];

    Object.keys(summaryMap).sort().forEach(type => {
        const count = summaryMap[type].count;
        const revenue = summaryMap[type].revenue;
        const percentage = totalRevenue > 0 ? (revenue / totalRevenue) : 0;

        summaryRows.push([
            type,
            count,
            revenue,
            percentage
        ]);
    });

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    wsSummary['!cols'] = [{ wch: 28 }, { wch: 18 }, { wch: 18 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, "Riepilogo");

    const wsHistory = XLSX.utils.json_to_sheet(dataRows);
    wsHistory['!cols'] = [{ wch: 14 }, { wch: 25 }, { wch: 16 }, { wch: 20 }, { wch: 14 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsHistory, "Storico Capi Ritirati");

    const fileName = `Report_Lavanderia_Cleo_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);

    showToast("Report Excel esportato con successo!", "success");
};

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
    toast.innerText = message;
    toast.style.marginTop = '10px';
    toast.style.padding = '12px 20px';
    toast.style.borderRadius = '8px';
    toast.style.color = '#fff';
    toast.style.fontWeight = 'bold';
    toast.style.backgroundColor = type === 'error' ? '#e74c3c' : '#2ecc71';

    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}
