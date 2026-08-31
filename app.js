const firebaseConfig = {
    apiKey: "TUA_API_KEY",
    authDomain: "tuo-progetto.firebaseapp.com",
    databaseURL: "https://tuo-progetto-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "tuo-progetto",
    storageBucket: "tuo-progetto.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef"
};

// Inizializzazione Firebase sicura
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

let allClients = {};
let allItems = {};

document.addEventListener('DOMContentLoaded', () => {
    initAuthAndListeners();
});

// ================= GESTIONE ACCESSO (LOGIN) E ASCOLTATORI =================
function initAuthAndListeners() {
    const savedAuth = localStorage.getItem('cleo_auth_passed');
    const savedLicense = localStorage.getItem('cleo_license_valid');

    // Controllo se l'utente aveva già fatto login
    if (savedAuth === 'true') {
        const loginScreen = document.getElementById('loginScreen');
        const appContainer = document.getElementById('appContainer');
        if (loginScreen && appContainer) {
            loginScreen.classList.add('opacity-0');
            setTimeout(() => {
                loginScreen.classList.add('hidden');
                appContainer.classList.remove('hidden');
                appContainer.classList.add('opacity-100');
                startAppListeners(); // Avvia Firebase solo se autenticato
            }, 300);
        }
    }

    if (savedLicense) {
        const badge = document.getElementById('licenseBadge');
        const input = document.getElementById('licensePhoneInput');
        if (badge && input) {
            badge.className = "px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-900";
            badge.innerText = "Attiva";
            input.value = savedLicense;
        }
    }

    // Gestione Evento Modulo di Accesso
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const passwordInput = document.getElementById('passwordInput');
            const pwd = passwordInput ? passwordInput.value.trim() : "";
            
            // Le password per accedere
            if (pwd === "admin123" || pwd === "cleo2026") {
                localStorage.setItem('cleo_auth_passed', 'true');
                const loginScreen = document.getElementById('loginScreen');
                const appContainer = document.getElementById('appContainer');
                if (loginScreen && appContainer) {
                    loginScreen.classList.add('opacity-0');
                    setTimeout(() => {
                        loginScreen.classList.add('hidden');
                        appContainer.classList.remove('hidden');
                        appContainer.classList.add('opacity-100');
                        startAppListeners(); // Avvia Firebase dopo il login
                    }, 300);
                }
            } else {
                const err = document.getElementById('loginError');
                if (err) {
                    err.innerText = "Password amministratore errata.";
                    err.classList.remove('hidden');
                }
            }
        });
    }

    // Assegna gli ascoltatori dei form (Clienti e Capi)
    const clientForm = document.getElementById('clientForm');
    if (clientForm) clientForm.addEventListener('submit', handleClientSubmit);

    const itemForm = document.getElementById('itemForm');
    if (itemForm) itemForm.addEventListener('submit', handleItemSubmitWithPrint);

    // Inizializza i due menu a tendina (ricerca clienti)
    setupManageClientSearchDropdown();
    setupAssignClientSearchDropdown();
}

function checkNumericLicense() {
    const input = document.getElementById('licensePhoneInput');
    const val = input ? input.value.trim().toUpperCase() : "";
    if (val.length > 3) {
        localStorage.setItem('cleo_license_valid', val);
        const badge = document.getElementById('licenseBadge');
        if (badge) {
            badge.className = "px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-900";
            badge.innerText = "Attiva";
        }
        showToast("Licenza attivata con successo!");
    } else {
        showToast("Codice licenza non valido", "error");
    }
}

function lockApp() {
    localStorage.removeItem('cleo_auth_passed');
    location.reload();
}

// Avvia i caricamenti dei dati in tempo reale da Firebase
function startAppListeners() {
    db.ref('clients').on('value', (snapshot) => {
        allClients = snapshot.val() || {};
        renderManagerClientsTable();
    });

    db.ref('items').on('value', (snapshot) => {
        allItems = snapshot.val() || {};
        renderActiveItemsTable();
        renderHistory();
    });
}

// ================= STAMPA SICURA (PER TABLET E DISPOSITIVI MOBILI) =================
function triggerSecurePrint(htmlContent) {
    // Apriamo una nuova finestra per la stampa (è il metodo più affidabile su browser per tablet)
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
        // Diamo un breve ritardo per assicurarci che il contenuto HTML sia stato renderizzato
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 500);
    } else {
        showToast("Impossibile stampare: sblocca i pop-up nel browser!", "error");
    }
}

// ================= MENU A TENDINA: "NUOVO / CERCA CLIENTE" =================
function setupManageClientSearchDropdown() {
    const searchInput = document.getElementById('clientName');
    const hiddenIdInput = document.getElementById('manageClientIdInput');
    const dropdown = document.getElementById('clientSearchDropdown');
    const toggleBtn = document.getElementById('clientSearchToggleBtn');

    if (!searchInput || !dropdown) return;

    function filterAndShow(query) {
        dropdown.innerHTML = `
            <div class="grid grid-cols-3 px-3 py-2 text-[10px] font-bold text-slate-400 uppercase border-b border-darkBorder bg-darkSurface sticky top-0">
                <div>Cliente (Nome)</div>
                <div>Telefono</div>
                <div>Indirizzo</div>
            </div>
        `;
        const q = query.toLowerCase();
        const matches = Object.entries(allClients).filter(([id, c]) => 
            c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q))
        );

        if (matches.length === 0) {
            dropdown.innerHTML += `<div class="p-3 text-xs text-slate-400 text-center">Nessun cliente esistente. Compila i campi per registrarlo.</div>`;
        } else {
            matches.forEach(([id, c]) => {
                const item = document.createElement('div');
                item.className = "grid grid-cols-3 p-2.5 hover:bg-darkCard cursor-pointer text-xs items-center border-b border-darkBorder/30 last:border-0";
                item.innerHTML = `
                    <div class="font-semibold text-white truncate">${c.name}</div>
                    <div class="text-slate-300 truncate">${c.phone || '-'}</div>
                    <div class="text-slate-400 truncate">${c.address || 'N/D'}</div>
                `;
                item.onclick = (e) => {
                    e.stopPropagation();
                    searchInput.value = c.name;
                    hiddenIdInput.value = id;
                    document.getElementById('clientPhone').value = c.phone || '';
                    document.getElementById('clientDob').value = c.dob || '';
                    document.getElementById('clientAddress').value = c.address || '';
                    dropdown.classList.add('hidden');
                    showToast("Cliente caricato. Puoi modificare o stampare.");
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

    searchInput.addEventListener('focus', (e) => {
        filterAndShow(e.target.value);
    });

    if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (dropdown.classList.contains('hidden')) {
                filterAndShow(searchInput.value);
            } else {
                dropdown.classList.add('hidden');
            }
        });
    }

    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !dropdown.contains(e.target) && (!toggleBtn || !toggleBtn.contains(e.target))) {
            dropdown.classList.add('hidden');
        }
    });
}

function resetClientForm() {
    const form = document.getElementById('clientForm');
    const hiddenId = document.getElementById('manageClientIdInput');
    if (form) form.reset();
    if (hiddenId) hiddenId.value = '';
    showToast("Modulo pulito per un nuovo cliente.");
}

function handleClientSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('clientName').value.trim();
    const phone = document.getElementById('clientPhone').value.trim();
    const dob = document.getElementById('clientDob').value.trim();
    const address = document.getElementById('clientAddress').value.trim();
    const existingId = document.getElementById('manageClientIdInput').value;

    if (!name || !phone) {
        showToast("Nome e Telefono sono obbligatori!", "error");
        return;
    }

    const clientData = { name, phone, dob, address };

    if (existingId) {
        db.ref(`clients/${existingId}`).update(clientData).then(() => {
            showToast("Dati cliente aggiornati correttamente!");
            resetClientForm();
        }).catch(err => showToast("Errore: " + err.message, "error"));
    } else {
        clientData.createdAt = firebase.database.ServerValue.TIMESTAMP;
        db.ref('clients').push(clientData).then(() => {
            showToast("Nuovo cliente registrato con successo!");
            resetClientForm();
        }).catch(err => showToast("Errore: " + err.message, "error"));
    }
}

function printClientReceiptLabel() {
    const name = document.getElementById('clientName').value.trim();
    const phone = document.getElementById('clientPhone').value.trim();
    const dob = document.getElementById('clientDob').value.trim();
    const address = document.getElementById('clientAddress').value.trim();

    if (!name || !phone) {
        showToast("Devi compilare Nome e Telefono per stampare l'etichetta!", "error");
        return;
    }

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Etichetta Cliente - Cleo</title>
            <style>
                body { font-family: monospace; padding: 10px; font-size: 12px; width: 280px; }
                .center { text-align: center; }
                .line { border-bottom: 1px dashed #000; margin: 8px 0; }
                p { margin: 4px 0; }
            </style>
        </head>
        <body>
            <div class="center">
                <strong>LAVANDERIA CLEO</strong><br>
                Scheda Anagrafica Cliente
            </div>
            <div class="line"></div>
            <p><strong>Nome:</strong> ${name}</p>
            <p><strong>Tel:</strong> ${phone}</p>
            ${dob ? `<p><strong>Nato il:</strong> ${dob}</p>` : ''}
            ${address ? `<p><strong>Indirizzo:</strong> ${address}</p>` : ''}
            <div class="line"></div>
            <div class="center" style="font-size: 9px;">
                ${new Date().toLocaleString()}
            </div>
        </body>
        </html>
    `;
    triggerSecurePrint(html);
}

// ================= MENU A TENDINA: "ACCETTA CAPO" =================
function setupAssignClientSearchDropdown() {
    const searchInput = document.getElementById('assignClientSearch');
    const hiddenIdInput = document.getElementById('selectedClientIdInput');
    const dropdown = document.getElementById('assignClientDropdown');
    const toggleBtn = document.getElementById('assignClientToggleBtn');

    if (!searchInput || !dropdown) return;

    function filterAndShow(query) {
        dropdown.innerHTML = `
            <div class="grid grid-cols-3 px-3 py-2 text-[10px] font-bold text-slate-400 uppercase border-b border-darkBorder bg-darkSurface sticky top-0">
                <div>Cliente (Nome)</div>
                <div>Telefono</div>
                <div>Indirizzo</div>
            </div>
        `;
        const q = query.toLowerCase();
        const matches = Object.entries(allClients).filter(([id, c]) => 
            c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q))
        );

        if (matches.length === 0) {
            dropdown.innerHTML += `<div class="p-3 text-xs text-slate-400 text-center">Nessun cliente trovato. Registralo prima nel box di sinistra.</div>`;
        } else {
            matches.forEach(([id, c]) => {
                const item = document.createElement('div');
                item.className = "grid grid-cols-3 p-2.5 hover:bg-darkCard cursor-pointer text-xs items-center border-b border-darkBorder/30 last:border-0";
                item.innerHTML = `
                    <div class="font-semibold text-white truncate">${c.name}</div>
                    <div class="text-slate-300 truncate">${c.phone || '-'}</div>
                    <div class="text-slate-400 truncate">${c.address || 'N/D'}</div>
                `;
                item.onclick = (e) => {
                    e.stopPropagation();
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

    searchInput.addEventListener('focus', (e) => {
        filterAndShow(e.target.value);
    });

    if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (dropdown.classList.contains('hidden')) {
                filterAndShow(searchInput.value);
            } else {
                dropdown.classList.add('hidden');
            }
        });
    }

    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !dropdown.contains(e.target) && (!toggleBtn || !toggleBtn.contains(e.target))) {
            dropdown.classList.add('hidden');
        }
    });
}

// ================= INSERISCI CAPO E STAMPA RICEVUTA =================
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
        showToast("Errore: devi prima cercare e selezionare un cliente dall'elenco a tendina!", "error");
        return;
    }

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Ricevuta Capo - Cleo</title>
            <style>
                body { font-family: monospace; padding: 10px; font-size: 12px; width: 280px; }
                .center { text-align: center; }
                .line { border-bottom: 1px dashed #000; margin: 8px 0; }
                p { margin: 4px 0; }
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
            <p><strong>Costo Previsto:</strong> EUR ${Number(itemPrice).toFixed(2)}</p>
            ${itemNotes ? `<p><strong>Note:</strong> ${itemNotes}</p>` : ''}
            <div class="line"></div>
            <div class="center" style="font-size: 9px;">
                Mostrare questa ricevuta al ritiro.<br>
                ${new Date().toLocaleString()}
            </div>
        </body>
        </html>
    `;
    
    // Mostriamo la schermata di stampa
    triggerSecurePrint(html);

    // Dati da salvare
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

    // Salviamo su DB
    db.ref('items').push(newItemData).then(() => {
        showToast("Capo registrato con successo!");
        document.getElementById('itemForm').reset();
        document.getElementById('selectedClientIdInput').value = '';
    }).catch((error) => {
        showToast("Errore salvataggio: " + error.message, "error");
    });
}

// ================= GESTIONE VISTE E TABELLE =================
function renderActiveItemsTable() {
    const tbody = document.getElementById('itemsTableBody');
    const noMsg = document.getElementById('noItemsMessage');
    const counter = document.getElementById('itemsCounterBadge');
    if (!tbody) return;
    tbody.innerHTML = '';

    const activeItems = Object.entries(allItems).filter(([id, item]) => item.status === 'active');
    if (counter) counter.innerText = `${activeItems.length} capi`;

    if (activeItems.length === 0) {
        if (noMsg) {
            noMsg.classList.remove('hidden');
            noMsg.classList.add('flex');
        }
        return;
    } else {
        if (noMsg) {
            noMsg.classList.remove('flex');
            noMsg.classList.add('hidden');
        }
    }

    activeItems.reverse().forEach(([id, item]) => {
        const tr = document.createElement('tr');
        tr.className = "border-b border-darkBorder/40 hover:bg-darkSurface/50 transition-colors";
        tr.innerHTML = `
            <td class="py-3 px-4 font-semibold text-white">${item.clientName || 'Sconosciuto'}</td>
            <td class="py-3 px-4">
                <div class="font-medium text-white">${item.type}</div>
                <div class="text-[11px] text-emerald-400 font-semibold">€ ${Number(item.price || 0).toFixed(2)}</div>
            </td>
            <td class="py-3 px-4"><span class="px-2 py-1 bg-darkCard border border-darkBorder rounded font-mono text-xs text-slate-300">${item.cabinet} - ${item.position}</span></td>
            <td class="py-3 px-4"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-400 border border-amber-900">In Deposito</span></td>
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
    if(confirm("Confermi di segnare questo capo come RITIRATO?")) {
        db.ref(`items/${itemId}`).update({
            status: 'completed',
            completedAt: firebase.database.ServerValue.TIMESTAMP
        }).then(() => {
            showToast("Capo spostato nello storico completati!");
        });
    }
}

function renderHistory() {
    const tbody = document.getElementById('historyTableBody');
    const counter = document.getElementById('historyCounter');
    if (!tbody) return;
    tbody.innerHTML = '';

    const completedItems = Object.entries(allItems).filter(([id, item]) => item.status === 'completed');
    if (counter) counter.innerText = `${completedItems.length} elementi`;

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

    const statCount = document.getElementById('statTotalCount');
    const statRev = document.getElementById('statTotalRevenue');
    const statClients = document.getElementById('statUniqueClients');

    if (statCount) statCount.innerText = completedItems.length;
    if (statRev) statRev.innerText = `€ ${totalRev.toFixed(2)}`;
    if (statClients) statClients.innerText = Object.keys(allClients).length;
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
            <td class="py-3 px-4 text-slate-400 text-[11px]">${c.address || '-'} <br> ${c.dob || '-'}</td>
            <td class="py-3 px-4 text-right">
                <button onclick="deleteClient('${id}')" class="px-2.5 py-1 bg-rose-950/60 hover:bg-rose-900 text-rose-400 rounded-lg text-xs cursor-pointer"><i class="fa-solid fa-trash-can"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function deleteClient(id) {
    if (confirm("Attenzione: Vuoi davvero eliminare questo cliente dal database?")) {
        db.ref(`clients/${id}`).remove().then(() => showToast("Cliente eliminato."));
    }
}

// ================= MODALI E UI =================
function openClientManagerModal() {
    const modal = document.getElementById('clientManagerModal');
    if (modal) modal.classList.remove('hidden');
}

function closeClientManagerModal() {
    const modal = document.getElementById('clientManagerModal');
    if (modal) modal.classList.add('hidden');
}

function switchTab(tab) {
    const viewActive = document.getElementById('viewActive');
    const viewStats = document.getElementById('viewStats');
    const navTabActive = document.getElementById('navTabActive');
    const navTabStats = document.getElementById('navTabStats');

    if (!viewActive || !viewStats) return;

    if (tab === 'active') {
        viewActive.classList.remove('hidden');
        viewStats.classList.add('hidden');
        if (navTabActive) navTabActive.className = "px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white shadow-sm cursor-pointer";
        if (navTabStats) navTabStats.className = "px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-darkSurface/50 cursor-pointer transition-colors";
    } else {
        viewActive.classList.add('hidden');
        viewStats.classList.remove('hidden');
        if (navTabStats) navTabStats.className = "px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white shadow-sm cursor-pointer";
        if (navTabActive) navTabActive.className = "px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-darkSurface/50 cursor-pointer transition-colors";
    }
}

function toggleTheme() {
    document.documentElement.classList.toggle('dark');
}

function showToast(msg, type = 'success') {
    const toast = document.getElementById('toastNotification');
    const msgEl = document.getElementById('toastMessage');
    if (!toast || !msgEl) return;
    
    msgEl.innerText = msg;
    
    // Cambia colore base per errori
    if(type === 'error') {
        toast.querySelector('.bg-emerald-500\\/20').className = "w-7 h-7 bg-rose-500/20 text-rose-400 rounded-xl flex items-center justify-center text-xs";
    } else {
        toast.querySelector('.w-7').className = "w-7 h-7 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center text-xs";
    }

    toast.classList.remove('translate-y-20', 'opacity-0');
    
    setTimeout(() => {
        toast.classList.add('translate-y-20', 'opacity-0');
    }, 3500);
}
