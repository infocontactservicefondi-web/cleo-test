// Configurazione Firebase (inserisci qui i tuoi dati)
const firebaseConfig = {
    apiKey: "TUA_API_KEY",
    authDomain: "TUA_AUTH_DOMAIN",
    databaseURL: "TUO_DATABASE_URL",
    projectId: "TUO_PROJECT_ID",
    storageBucket: "TUO_STORAGE_BUCKET",
    messagingSenderId: "TUO_MESSAGING_SENDER_ID",
    appId: "TUO_APP_ID"
};

// Inizializzazione Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

// Variabili di stato globali
let clientsData = {};
let itemsData = {};
let historyData = {};

// Avvio applicazione al caricamento della pagina
document.addEventListener('DOMContentLoaded', () => {
    checkLoginState();
    setupEventListeners();
});

// Gestione Login con password amministratore
function checkLoginState() {
    const isLogged = sessionStorage.getItem('cleo_logged');
    if (isLogged === 'true') {
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('appContainer').classList.remove('hidden');
        initRealtimeListeners();
    } else {
        document.getElementById('loginScreen').classList.remove('hidden');
        document.getElementById('appContainer').classList.add('hidden');
    }
}

function setupEventListeners() {
    // Form Login
    document.getElementById('loginForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const pwd = document.getElementById('passwordInput').value.trim();
        if (pwd === 'BAUBAU06') {
            sessionStorage.setItem('cleo_logged', 'true');
            document.getElementById('loginError').classList.add('hidden');
            checkLoginState();
        } else {
            const err = document.getElementById('loginError');
            err.textContent = 'Password errata!';
            err.classList.remove('hidden');
        }
    });

    // Form Registrazione Cliente
    document.getElementById('clientForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('clientName').value.trim();
        const phone = document.getElementById('clientPhone').value.trim();
        
        if (!name || !phone) return;

        const newClientRef = db.ref('clients').push();
        newClientRef.set({
            name: name,
            phone: phone,
            createdAt: new Date().toISOString()
        }, (error) => {
            if (!error) {
                showToast('Cliente salvato con successo!');
                document.getElementById('clientForm').reset();
            }
        });
    });

    // Ricerca dinamica cliente nel modulo inserimento capo
    const searchInput = document.getElementById('assignClientSearch');
    const dropdown = document.getElementById('assignClientDropdown');

    searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase().trim();
        dropdown.innerHTML = '';
        if (query.length === 0) {
            dropdown.classList.add('hidden');
            return;
        }

        const filtered = Object.entries(clientsData).filter(([id, c]) => 
            c.name.toLowerCase().includes(query) || c.phone.includes(query)
        );

        if (filtered.length === 0) {
            dropdown.innerHTML = '<div class="p-3 text-xs text-slate-400">Nessun cliente trovato</div>';
        } else {
            filtered.forEach(([id, c]) => {
                const div = document.createElement('div');
                div.className = 'p-2.5 hover:bg-darkCard cursor-pointer text-xs text-slate-200 border-b border-darkBorder/50';
                div.innerHTML = `<div class="font-bold">${c.name}</div><div class="text-[10px] text-slate-400">Tel: ${c.phone}</div>`;
                div.onclick = () => {
                    searchInput.value = c.name;
                    document.getElementById('selectedClientIdInput').value = id;
                    dropdown.classList.add('hidden');
                };
                dropdown.appendChild(div);
            });
        }
        dropdown.classList.remove('hidden');
    });

    // Form Inserimento Capo post-lavaggio
    document.getElementById('itemForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const clientId = document.getElementById('selectedClientIdInput').value;
        const type = document.getElementById('itemType').value.trim();
        const cabinet = document.getElementById('itemCabinet').value.trim();
        const position = document.getElementById('itemPosition').value.trim();
        const price = parseFloat(document.getElementById('itemPrice').value) || 0;

        if (!clientId || !clientsData[clientId]) {
            alert('Seleziona un cliente valido dalla lista!');
            return;
        }

        const newItemRef = db.ref('items').push();
        newItemRef.set({
            clientId: clientId,
            clientName: clientsData[clientId].name,
            clientPhone: clientsData[clientId].phone,
            type: type,
            cabinet: cabinet,
            position: position,
            price: price,
            dateAdded: new Date().toISOString()
        }, (error) => {
            if (!error) {
                showToast('Capo inserito in armadio!');
                document.getElementById('itemForm').reset();
                document.getElementById('selectedClientIdInput').value = '';
            }
        });
    });

    // Ricerca Globale nella navbar
    document.getElementById('globalSearch').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        const drop = document.getElementById('globalSearchDropdown');
        drop.innerHTML = '';
        if (query.length === 0) {
            drop.classList.add('hidden');
            return;
        }

        let resultsCount = 0;
        // Cerca tra i capi in armadio
        Object.entries(itemsData).forEach(([id, item]) => {
            if (item.clientName.toLowerCase().includes(query) || item.type.toLowerCase().includes(query) || item.cabinet.toLowerCase().includes(query)) {
                resultsCount++;
                const div = document.createElement('div');
                div.className = 'p-3 hover:bg-darkCard cursor-pointer text-xs';
                div.innerHTML = `<span class="font-bold text-white">${item.clientName}</span> - <span class="text-blue-400">${item.type}</span> (Armadio: ${item.cabinet}/${item.position})`;
                div.onclick = () => {
                    drop.classList.add('hidden');
                    document.getElementById('globalSearch').value = '';
                };
                drop.appendChild(div);
            }
        });

        if (resultsCount === 0) {
            drop.innerHTML = '<div class="p-3 text-xs text-slate-400">Nessun risultato trovato</div>';
        }
        drop.classList.remove('hidden');
    });
}

// Sincronizzazione in tempo reale con Firebase
function initRealtimeListeners() {
    // Ascolta Clienti
    db.ref('clients').on('value', (snapshot) => {
        clientsData = snapshot.val() || {};
        renderClientManagerTable();
    });

    // Ascolta Capi in Armadio
    db.ref('items').on('value', (snapshot) => {
        itemsData = snapshot.val() || {};
        renderItemsTable();
    });

    // Ascolta Storico Ritirati
    db.ref('history').on('value', (snapshot) => {
        historyData = snapshot.val() || {};
        renderStats();
    });
}

// Funzione Stampa Etichetta Termica
function printItemLabel() {
    const clientName = document.getElementById('assignClientSearch').value;
    const type = document.getElementById('itemType').value;
    const cabinet = document.getElementById('itemCabinet').value;
    const position = document.getElementById('itemPosition').value;

    if (!clientName || !type || !cabinet || !position) {
        alert('Compila tutti i campi prima di stampare l\'etichetta!');
        return;
    }

    const printWindow = window.open('', '_blank', 'width=300,height=300');
    printWindow.document.write(`
        <html>
        <head><title>Stampa Etichetta</title></head>
        <body style="font-family: monospace; text-align: center; padding: 10px; margin: 0;">
            <h3 style="margin: 0 0 5px 0; font-size: 16px;">LAVANDERIA CLEO</h3>
            <hr style="border: dashed 1px #000;">
            <p style="font-size: 14px; margin: 5px 0;"><b>Cliente:</b> ${clientName}</p>
            <p style="font-size: 14px; margin: 5px 0;"><b>Capo:</b> ${type}</p>
            <p style="font-size: 16px; margin: 10px 0;"><b>ARMADIO: ${cabinet}</b></p>
            <p style="font-size: 14px; margin: 5px 0;">Posizione: ${position}</p>
            <hr style="border: dashed 1px #000;">
            <script>window.print(); setTimeout(() => window.close(), 500);</script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// Render Tabella Capi in Armadio
function renderItemsTable() {
    const tbody = document.getElementById('itemsTableBody');
    const noMsg = document.getElementById('noItemsMessage');
    const badge = document.getElementById('itemsCounterBadge');
    tbody.innerHTML = '';

    const keys = Object.keys(itemsData);
    badge.textContent = `${keys.length} capi`;

    if (keys.length === 0) {
        noMsg.classList.remove('flex');
        noMsg.classList.add('hidden');
        return;
    }
    noMsg.classList.add('hidden');

    keys.forEach(id => {
        const item = itemsData[id];
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-darkCard/50';
        tr.innerHTML = `
            <td class="py-3 px-4">
                <div class="font-bold text-white">${item.clientName}</div>
                <div class="text-[10px] text-slate-400">${item.clientPhone}</div>
            </td>
            <td class="py-3 px-4">
                <div class="text-white font-semibold">${item.type}</div>
                <div class="text-[11px] text-emerald-400">€ ${item.price.toFixed(2)}</div>
            </td>
            <td class="py-3 px-4">
                <span class="px-2 py-1 bg-zinc-800 text-blue-400 font-bold rounded-md text-[11px]">Arm. ${item.cabinet} - Pos. ${item.position}</span>
            </td>
            <td class="py-3 px-4 text-right">
                <button onclick="markAsCollected('${id}')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-sm">
                    <i class="fa-solid fa-check mr-1"></i> Segna come Ritirato
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Segna capo come ritirato (sposta in history e aggiorna statistiche)
function markAsCollected(id) {
    const item = itemsData[id];
    if (!item) return;

    const historyRef = db.ref('history').push();
    historyRef.set({
        ...item,
        dateCollected: new Date().toISOString()
    }, (error) => {
        if (!error) {
            db.ref(`items/${id}`).remove().then(() => {
                showToast('Capo ritirato e incassato!');
            });
        }
    });
}

// Render Statistiche e Storico
function renderStats() {
    const historyKeys = Object.keys(historyData);
    let totalRevenue = 0;
    let uniqueClientsSet = new Set();
    let typeCount = {};

    const tbody = document.getElementById('historyTableBody');
    tbody.innerHTML = '';

    historyKeys.forEach(id => {
        const h = historyData[id];
        totalRevenue += (h.price || 0);
        uniqueClientsSet.add(h.clientName);
        typeCount[h.type] = (typeCount[h.type] || 0) + 1;

        const dateStr = new Date(h.dateCollected).toLocaleDateString('it-IT');
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-darkCard/50';
        tr.innerHTML = `
            <td class="py-3 px-4 text-slate-300">${dateStr}</td>
            <td class="py-3 px-4 font-bold text-white">${h.clientName}</td>
            <td class="py-3 px-4 text-blue-400">${h.type}</td>
            <td class="py-3 px-4 text-emerald-400 font-semibold">€ ${(h.price || 0).toFixed(2)}</td>
            <td class="py-3 px-4 text-slate-400">${h.cabinet} / ${h.position}</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('statTotalCount').textContent = historyKeys.length;
    document.getElementById('statTotalRevenue').textContent = `€ ${totalRevenue.toFixed(2)}`;
    document.getElementById('statUniqueClients').textContent = uniqueClientsSet.size;
    document.getElementById('historyCounter').textContent = `${historyKeys.length} elementi`;

    let topType = '-';
    let maxCount = 0;
    for (let t in typeCount) {
        if (typeCount[t] > maxCount) {
            maxCount = typeCount[t];
            topType = t;
        }
    }
    document.getElementById('statTopItemType').textContent = topType;
}

// Anagrafica Clienti Modal
function openClientManagerModal() {
    document.getElementById('clientManagerModal').classList.remove('hidden');
}
function closeClientManagerModal() {
    document.getElementById('clientManagerModal').classList.add('hidden');
}

function renderClientManagerTable() {
    const tbody = document.getElementById('managerClientsTableBody');
    tbody.innerHTML = '';
    Object.entries(clientsData).forEach(([id, c]) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-darkCard/50';
        tr.innerHTML = `
            <td class="py-3 px-4 font-bold text-white">${c.name}</td>
            <td class="py-3 px-4 text-slate-300">${c.phone}</td>
            <td class="py-3 px-4 text-right">
                <button onclick="deleteClient('${id}')" class="px-2.5 py-1 bg-rose-950/60 hover:bg-rose-900 text-rose-400 rounded-lg text-xs cursor-pointer">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function deleteClient(id) {
    if (confirm('Vuoi davvero eliminare questo cliente?')) {
        db.ref(`clients/${id}`).remove().then(() => showToast('Cliente eliminato'));
    }
}

// Cambio Tab Navigazione
function switchTab(tab) {
    const tabActive = document.getElementById('navTabActive');
    const tabStats = document.getElementById('navTabStats');
    const viewActive = document.getElementById('viewActive');
    const viewStats = document.getElementById('viewStats');

    if (tab === 'active') {
        tabActive.className = 'px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white shadow-sm cursor-pointer';
        tabStats.className = 'px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white cursor-pointer';
        viewActive.classList.remove('hidden');
        viewStats.classList.add('hidden');
    } else {
        tabStats.className = 'px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white shadow-sm cursor-pointer';
        tabActive.className = 'px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white cursor-pointer';
        viewStats.classList.remove('hidden');
        viewActive.classList.add('hidden');
    }
}

// Blocco App / Logout
function lockApp() {
    sessionStorage.removeItem('cleo_logged');
    checkLoginState();
}

// Notifiche Toast Grafiche
function showToast(message) {
    const toast = document.getElementById('toastNotification');
    document.getElementById('toastMessage').textContent = message;
    toast.classList.remove('translate-y-20', 'opacity-0');
    setTimeout(() => {
        toast.classList.add('translate-y-20', 'opacity-0');
    }, 3000);
}
