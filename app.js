// ==========================================
// FLUSSO ACCETTAZIONE CAPO E CESTA (FASE 1)
// ==========================================
if (clientForm) {
    clientForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('clientName').value.trim();
        const phone = document.getElementById('clientPhone').value.trim();
        const dob = document.getElementById('clientDob').value.trim();
        const address = document.getElementById('clientAddress').value.trim();

        if (!name) return;

        const clientId = 'cli_' + Date.now();
        const newClient = { name, phone, dob, address };

        clientsData[clientId] = newClient;
        localStorage.setItem('laundry_clients', JSON.stringify(clientsData));
        db.ref('clients').child(clientId).set(newClient).catch(() => {});

        // Stampa etichetta provvisoria da mettere sulla cesta
        printBasketLabel(name, phone);

        clientForm.reset();
        showToast(`Cliente "${name}" registrato e capo in cesta!`, "success");
        renderItems();
        const managerModal = document.getElementById('clientManagerModal');
        if (managerModal && !managerModal.classList.contains('hidden')) {
            renderClientManagerTable();
        }
    });
}

window.printBasketLabel = function(clientName, clientPhone) {
    const dateStr = new Date().toLocaleDateString('it-IT') + ' ' + new Date().toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'});
    let printText = "\x1B\x40\x1B\x61\x01\x1B\x21\x10LAVANDERIA CLEO\n\x1B\x21\x08[DA LAVARE / CESTA]\n" + dateStr + "\n\x1B\x21\x00--------------------------------\n\x1B\x61\x00Cliente: " + clientName + "\nTel: " + (clientPhone || "N/D") + "\n--------------------------------\n\x1B\x61\x01\x1B\x21\x20IN CESTA\n\x1B\x21\x00\n\n\n\x1D\x56\x41\x03";
    try {
        const base64Data = btoa(unescape(encodeURIComponent(printText)));
        window.location.href = `rawbt:base64,${base64Data}`;
    } catch (err) {
        showToast("Errore stampa etichetta cesta.", "error");
    }
};

// ==========================================
// ASSEGNAZIONE CAPO LAVATO E ARMADIO (FASE 2)
// ==========================================
if (itemForm) {
    itemForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const clientId = selectedClientIdInput.value;
        const type = document.getElementById('itemType').value.trim();
        const cabinet = document.getElementById('itemCabinet').value.trim();
        const position = document.getElementById('itemPosition').value.trim();
        const price = parseFloat(document.getElementById('itemPrice').value) || 0;
        const notes = document.getElementById('itemNotes') ? document.getElementById('itemNotes').value.trim() : "";
        const status = "In lavorazione";

        if (!clientId || !clientsData[clientId]) {
            showToast("Seleziona un cliente valido", "error");
            return;
        }

        const itemId = 'item_' + Date.now();
        const newItem = { clientId, type, cabinet, position, price, notes, status, timestamp: Date.now() };

        itemsData[itemId] = newItem;
        localStorage.setItem('laundry_items', JSON.stringify(itemsData));
        db.ref('items').child(itemId).set(newItem).catch(() => {});

        // Stampa etichetta finale da mettere sul capo nell'armadio
        printFinalItemLabel(clientId, type, cabinet, position, price, notes);

        itemForm.reset();
        if(assignClientSearch) assignClientSearch.value = "";
        if(selectedClientIdInput) selectedClientIdInput.value = "";
        showToast(`Capo (${type}) assegnato all'armadio ${cabinet}!`, "success");
        renderItems();
    });
}

window.printFinalItemLabel = function(clientId, type, cabinet, position, price, notes) {
    const client = clientsData[clientId];
    const dateStr = new Date().toLocaleDateString('it-IT') + ' ' + new Date().toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'});

    const generateReceipt = (copyType) => {
        let block = "";
        block += "\x1B\x40\x1B\x61\x01\x1B\x21\x10LAVANDERIA CLEO\n\x1B\x21\x08[COPIA " + copyType + "]\n" + dateStr + "\n\x1B\x21\x00--------------------------------\n\x1B\x61\x00Cliente: " + client.name + "\nTel: " + (client.phone || "N/D") + "\nCapo:    " + type + "\n";
        if (notes) block += `Note:    ${notes}\n`;
        block += "--------------------------------\n\x1B\x61\x01\x1B\x21\x30ARM: " + cabinet + "\nPOS: " + position + "\n\x1B\x21\x00--------------------------------\n\x1B\x61\x02\x1B\x21\x10Prezzo: EUR " + parseFloat(price || 0).toFixed(2) + "\n\x1B\x21\x00\x1B\x61\x01\n* Conservare per il ritiro *\n\n\n";
        return block;
    };

    let printText = generateReceipt("ATTIVITA") + "\x1D\x56\x41\x03" + generateReceipt("CLIENTE") + "\x1D\x56\x41\x03";
    try {
        const base64Data = btoa(unescape(encodeURIComponent(printText)));
        window.location.href = `rawbt:base64,${base64Data}`;
    } catch (err) {
        showToast("Errore stampa etichetta armadio.", "error");
    }
};
