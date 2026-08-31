// Configurazione Firebase (Sostituisci con i tuoi dati reali)
const firebaseConfig = {
    apiKey: "TUA_API_KEY",
    authDomain: "tuo-progetto.firebaseapp.com",
    databaseURL: "https://tuo-progetto-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "tuo-progetto",
    storageBucket: "tuo-progetto.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef"
};

// Inizializzazione Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

// Variabili di stato globali
let allClients = {};
let allItems = {};
let currentStatPeriod = 'all';

// Avvio applicazione al caricamento del DOM
document.addEventListener('DOMContentLoaded', () => {
    initAuthAndListeners();
});

function initAuthAndListeners() {
    // Gestione Login con password amministratore fissa o salvata
    const savedAuth = localStorage.getItem('cleo_auth_passed');
    const savedLicense = localStorage.getItem('cleo_license_valid');

    if (savedAuth === 'true') {
        document.getElementById('loginScreen').classList.add('opacity-0');
        setTimeout(() => {
            document.getElementById('loginScreen').classList.add('hidden');
            document.getElementById('appContainer').classList.remove('hidden');
            document.getElementById('appContainer').classList.add('opacity-100');
            startAppListeners();
        }, 300);
    }

    if (savedLicense) {
        document.getElementById('licenseBadge').className = "px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-900";
        document.getElementById('licenseBadge').innerText = "Attiva";
        document.getElementById('licensePhoneInput').value = savedLicense;
    }

    document.getElementById('loginForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const pwd = document.getElementById('passwordInput').value.trim();
        if (pwd === "admin123" || pwd === "cleo2026") { // Sostituisci o adatta la password admin
            localStorage.setItem('cleo_auth_passed', 'true');
            document.getElementById('loginScreen').classList.add('opacity-0');
            setTimeout(() => {
                document.getElementById('loginScreen').classList.add('hidden');
                document.getElementById('appContainer').classList.remove('hidden');
                document.getElementById('appContainer').classList.add('opacity-100');
                startAppListeners();
            }, 300);
        } else {
            const err = document.getElementById('loginError');
            err.innerText = "Password amministratore errata.";
            err.classList.remove('hidden');
        }
    });

    // Eventi form cliente
    document.getElementById('clientForm').addEventListener('submit', handleClientSubmit);

    // Eventi form capo (Unito con stampa ricevuta automatica)
    document.getElementById('itemForm').addEventListener('submit', handleItemSubmitWithPrint);

    // Gestione ricerca cliente con lente nel modulo accettazione capo
    setupClientSearchDropdown();
}

function checkNumericLicense() {
    const val = document.getElementById('licensePhoneInput').value.trim().toUpperCase();
    if (val.length > 3) {
        localStorage.setItem('cleo_license_valid', val);
        document.getElementById('licenseBadge').className = "px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-900";
        document.getElementById('licenseBadge').innerText = "Attiva";
        showToast("Licenza attivata con successo!");
    } else {
        showToast("Codice licenza non valido", "error");
    }
}

function lockApp() {
    localStorage.removeItem('cleo_auth_passed');
    location.reload();
}

function startAppListeners() {
    // Sincronizzazione Clienti da Firebase
    db.ref('clients').on('value', (snapshot) => {
        allClients = snapshot.val() || {};
        renderManagerClientsTable();
    });

    // Sincronizzazione Capi da Firebase
    db.ref('items').on('value', (snapshot) => {
        allItems = snapshot.val() || {};
        renderActiveItemsTable();
        renderHistory();
    });
}

// ================= GESTIONE CLIENTI & STAMPA ETICHETTA =================
function handleClientSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('clientName').value.trim();
    const phone = document.getElementById('clientPhone').value.trim();
    const dob = document.getElementById('clientDob').value.trim();
    const address = document.getElementById('clientAddress').value.trim();

    if (!name || !phone) {
        showToast("Nome e Telefono sono obbligatori!", "error");
        return;
    }

    const newClientData = { name, phone, dob, address, createdAt: firebase.database.ServerValue.TIMESTAMP };
    db.ref('clients').push(newClientData).then(() => {
        showToast("Cliente registrato con successo!");
        document.getElementById('clientForm').reset();
    }).catch(err => {
        showToast("Errore: " + err.message, "error");
    });
}

function printClientLabel() {
    const name = document.getElementById('clientName').value.trim();
    const phone = document.getElementById('clientPhone').value.trim();
    const address = document.getElementById('clientAddress').value.trim();

    if (!name || !phone) {
        showToast("Inserisci almeno Nome e Telefono per stampare l'etichetta cliente!", "error");
        return;
    }

    const printWindow = window.open('', '_blank', 'width=400,height=400');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Etichetta Cliente - Lavanderia Cleo</title>
            <style>
                body { font-family: sans-serif; text-align: center; padding: 20px; margin: 0; }
                h2 { margin: 0 0 10px 0; font-size: 18px; }
                p { margin: 4px 0; font-size: 14px; }
                .box { border: 2px solid #000; padding: 15px; border-radius: 8px; }
            </style>
        </head>
        <body>
            <div class="box">
                <h2>CLIENTE - LAVANDERIA CLEO</h2>
                <p><strong>Nome:</strong> ${name}</p>
                <p><strong>Tel:</strong> ${phone}</p>
                ${address ? `<p><strong>Indirizzo:</strong> ${address}</p>` : ''}
            </div>
            <script>
                window.onload = function() { window.print(); window.close(); }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// ================= RICERCA CON LENTE CLIENTE ESISTENTE =================
function setupClientSearchDropdown() {
    const searchInput = document.getElementById('assignClientSearch');
    const hiddenIdInput = document.getElementById('selectedClientIdInput');
    const dropdown = document.getElementById('assignClientDropdown');
    const toggleBtn = document.getElementById('assignClientToggleBtn');

    function filterAndShow(query) {
        dropdown.innerHTML = '';
        const q = query.toLowerCase();
        const matches = Object.entries(allClients).filter(([id, c]) => 
            c.name.toLowerCase().includes(q) || c.phone.includes(q)
        );

        if (matches.length === 0) {
            dropdown.innerHTML = `<div class="p-3 text-xs text-slate-400 text-center">Nessun cliente trovato. Registralo a sinistra.</div>`;
        } else {
            matches.forEach(([id, c]) => {
                const item = document.createElement('div');
                item.className = "p-2.5 hover:bg-darkCard cursor-pointer text-xs flex justify-between items-center border-b border-darkBorder/30 last:border-0";
                item.innerHTML = `<div><strong class="text-white">${c.name}</strong><br><span class="text-slate-400">${c.phone}</span></div><i class="fa-solid fa-check text-blue-500 opacity-0"></i>`;
                item.onclick = () => {
                    searchInput.value = c.name;
                    hiddenIdInput.value = id;
                    dropdown.classList.add('hidden');
                };
                dropdown.appendChild(item);
            });
        }
        dropdown.classList.remove('hidden');
    }

    searchInput.addEventListener('input', (e) => {
        hiddenIdInput.value = '';
        filterAndShow(e.target.value);
    });

    toggleBtn.addEventListener('click', () => {
        if (dropdown.classList.contains('hidden')) {
            filterAndShow('');
        } else {
            dropdown.classList.add('hidden');
        }
    });

    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !dropdown.contains(e.target) && !toggleBtn.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    });
}

// ================= GESTIONE ETICHETTA CESTA =================
function printBasketLabel() {
    const clientNameVal = document.getElementById('assignClientSearch').value.trim();
    const itemTypeVal = document.getElementById('itemType').value.trim();

    if (!clientNameVal || !itemTypeVal) {
        showToast("Inserisci il cliente e il tipo di capo per l'etichetta cesta!", "error");
        return;
    }

    const printWindow = window.open('', '_blank', 'width=400,height=400');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Etichetta Cesta - Lavanderia Cleo</title>
            <style>
                body { font-family: sans-serif; text-align: center; padding: 20px; margin: 0; }
                h2 { margin: 0 0 10px 0; font-size: 20px; }
                p { margin: 5px 0; font-size: 16px; }
                .box { border: 2px dashed #000; padding: 15px; border-radius: 10px; }
            </style>
        </head>
        <body>
            <div class="box">
                <h2>LAVANDERIA CLEO</h2>
                <p><strong>Cliente:</strong> ${clientNameVal}</p>
                <p><strong>Capo:</strong> ${itemTypeVal}</p>
                <p style="font-size: 12px; margin-top: 15px;">Data: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
            </div>
            <script>
                window.onload = function() { window.print(); window.close(); }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// ================= INSERIMENTO CAPO E STAMPA RICEVUTA UNITE =================
function handleItemSubmitWithPrint(e) {
    e.preventDefault();

    const clientId = document.getElementById('selectedClientIdInput').value;
    const clientNameText = document.getElementById('assignClientSearch').value;
    const itemType = document.getElementById('itemType').value;
    const itemCabinet = document.getElementById('itemCabinet').value;
    const itemPosition = document.getElementById('itemPosition').value;
    const itemPrice = document.getElementById('itemPrice').value || '0.00';
    const itemNotes = document.getElementById('itemNotes').value;

    if (!clientId) {
        showToast("Seleziona un cliente valido tramite la ricerca con lente!", "error");
        return;
    }

    // 1. Stampa automatica ricevuta contestuale
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Ricevuta Capo - Lavanderia Cleo</title>
            <style>
                body { font-family: monospace; padding: 15px; font-size: 12px; }
                .center { text-align: center; }
                .line { border-bottom: 1px dashed #000; margin: 10px 0; }
            </style>
        </head>
        <body>
            <div class="center">
                <strong>LAVANDERIA CLEO</strong><br>
                Ricevuta Accettazione Capo
            </div>
            <div class="line"></div>
            <p><strong>Cliente:</strong> ${clientNameText}</p>
            <p><strong>Capo:</strong> ${itemType}</p>
            <p><strong>Armadio/Pos:</strong> ${itemCabinet} - ${itemPosition}</p>
            <p><strong>Prezzo:</strong> EUR ${Number(itemPrice).toFixed(2)}</p>
            ${itemNotes ? `<p><strong>Note:</strong> ${itemNotes}</p>` : ''}
            <div class="line"></div>
            <div class="center" style="font-size: 10px;">
                Conservare la ricevuta per il ritiro<br>
                ${new Date().toLocaleString()}
            </div>
            <script>
                window.onload = function() { window.print(); window.close(); }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();

    // 2. Salvataggio in archivio Firebase
    const newItemData = {
        clientId: clientId,
        clientName: clientNameText,
        type: itemType,
        cabinet: itemCabinet,
        position: itemPosition,
        price: Number(itemPrice),
        notes: itemNotes,
        status: 'active',
        createdAt: firebase.database.ServerValue.TIMESTAMP
    };

    db.ref('items').push(newItemData).then(() => {
        showToast("Capo inserito e ricevuta stampata!");
        document.getElementById('itemForm').reset();
        document.getElementById('selectedClientIdInput').value = '';
    }).catch((error) => {
        showToast("Errore durante il salvataggio: " + error.message, "error");
    });
}

// ================= RENDERIZZAZIONE TABELLE E UTILITIES =================
function renderActiveItemsTable() {
    const tbody = document.getElementById('itemsTableBody');
    const noMsg = document.getElementById('noItemsMessage');
    const counter = document.getElementById('itemsCounterBadge');
    tbody.innerHTML = '';

    const activeItems = Object.entries(allItems).filter(([id, item]) => item.status === 'active');
    counter.innerText = `${activeItems.length} capi`;

    if (activeItems.length === 0) {
        noMsg.classList.remove('hidden');
        noMsg.classList.add('flex');
        return;
    } else {
        noMsg.classList.remove('flex');
        noMsg.classList.add('hidden');
    }

    activeItems.reverse().forEach(([id, item]) => {
        const tr = document.createElement('tr');
        tr.className = "border-b border-darkBorder/40 hover:bg-darkSurface/50";
        tr.innerHTML = `
            <td class="py-3 px-4 font-semibold text-white">${item.clientName || 'Sconosciuto'}</td>
            <td class="py-3 px-4">
                <div class="font-medium text-white">${item.type}</div>
                <div class="text-[11px] text-emerald-400 font-semibold">€ ${Number(item.price || 0).toFixed(2)}</div>
            </td>
            <td class="py-3 px-4"><span class="px-2 py-1 bg-darkCard border border-darkBorder rounded font-mono text-xs text-slate-300">${item.cabinet} - ${item.position}</span></td>
            <td class="py-3 px-4"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-400 border border-amber-900">In Lavorazione</span></td>
            <td class="py-3 px-4 text-right">
                <button onclick="markItemAsCompleted('${id}')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-sm">
                    <i class="fa-solid fa-check mr-1"></i> Ritirato
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function markItemAsCompleted(itemId) {
    db.ref(`items/${itemId}`).update({
        status: 'completed',
        completedAt: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        showToast("Capo segnato come ritirato!");
    });
}

function renderHistory() {
    const tbody = document.getElementById('historyTableBody');
    const counter = document.getElementById('historyCounter');
    tbody.innerHTML = '';

    const completedItems = Object.entries(allItems).filter(([id, item]) => item.status === 'completed');
    counter.innerText = `${completedItems.length} elementi`;

    let totalRev = 0;
    completedItems.forEach(([id, item]) => {
        totalRev += Number(item.price || 0);
        const tr = document.createElement('tr');
        tr.className = "border-b border-darkBorder/40 hover:bg-darkSurface/50";
        const dateStr = item.completedAt ? new Date(item.completedAt).toLocaleDateString() : '-';
        tr.innerHTML = `
            <td class="py-3 px-4 text-slate-300">${dateStr}</td>
            <td class="py-3 px-4 font-semibold text-white">${item.clientName}</td>
            <td class="py-3 px-4 text-slate-300">${item.type}</td>
            <td class="py-3 px-4 text-emerald-400 font-semibold">€ ${Number(item.price || 0).toFixed(2)}</td>
            <td class="py-3 px-4"><span class="px-2 py-0.5 bg-darkCard border border-darkBorder rounded text-[11px] font-mono text-slate-300">${item.cabinet} - ${item.position}</span></td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('statTotalCount').innerText = completedItems.length;
    document.getElementById('statTotalRevenue').innerText = `€ ${totalRev.toFixed(2)}`;
    document.getElementById('statUniqueClients').innerText = Object.keys(allClients).length;
}

function renderManagerClientsTable() {
    const tbody = document.getElementById('managerClientsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    Object.entries(allClients).forEach(([id, c]) => {
        const tr = document.createElement('tr');
        tr.className = "border-b border-darkBorder/40 hover:bg-darkSurface/50";
        tr.innerHTML = `
            <td class="py-3 px-4 font-semibold text-white">${c.name}</td>
            <td class="py-3 px-4 text-slate-300">${c.phone}</td>
            <td class="py-3 px-4 text-slate-400 text-[11px]">${c.address || '-'} / ${c.dob || '-'}</td>
            <td class="py-3 px-4 text-right">
                <button onclick="deleteClient('${id}')" class="px-2.5 py-1 bg-rose-950/60 hover:bg-rose-900 text-rose-400 rounded-lg text-xs cursor-pointer"><i class="fa-solid fa-trash-can"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function deleteClient(id) {
    if (confirm("Vuoi davvero eliminare questo cliente?")) {
        db.ref(`clients/${id}`).remove().then(() => showToast("Cliente eliminato"));
    }
}

function openClientManagerModal() {
    document.getElementById('clientManagerModal').classList.remove('hidden');
}

function closeClientManagerModal() {
    document.getElementById('clientManagerModal').classList.add('hidden');
}

function switchTab(tab) {
    if (tab === 'active') {
        document.getElementById('viewActive').classList.remove('hidden');
        document.getElementById('viewStats').classList.add('hidden');
        document.getElementById('navTabActive').className = "px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white shadow-sm cursor-pointer";
        document.getElementById('navTabStats').className = "px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-darkSurface/50 cursor-pointer";
    } else {
        document.getElementById('viewActive').classList.add('hidden');
        document.getElementById('viewStats').classList.remove('hidden');
        document.getElementById('navTabStats').className = "px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white shadow-sm cursor-pointer";
        document.getElementById('navTabActive').className = "px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-darkSurface/50 cursor-pointer";
    }
}

function toggleTheme() {
    document.documentElement.classList.toggle('dark');
}

function showToast(msg, type = 'success') {
    const toast = document.getElementById('toastNotification');
    document.getElementById('toastMessage').innerText = msg;
    toast.classList.remove('translate-y-20', 'opacity-0');
    setTimeout(() => {
        toast.classList.add('translate-y-20', 'opacity-0');
    }, 3000);
}
