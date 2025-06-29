// JSONBin Configuration
const JSONBIN_CONFIG = {
    binId: '685d28288a456b7966b6087a',
    apiKey: '$2a$10$VUgmGwUgwRlPKxGI00D6pe6mR6q1.wvmkx0a34vpNrxdHpnClZ0Zy',
    baseUrl: 'https://api.jsonbin.io/v3'
};

// App State
let addresses = [];
let currentTab = 'search';
let searchTimeout;
let isLoading = false;

// Initialize app
document.addEventListener('DOMContentLoaded', async function() {
    showLoading('App laden...');
    
    try {
        // Load addresses from JSONBin
        await loadFromCloud();
        updateAddressCount();
        updateAddressList();
        updateLastSync();
        
        showNotification('App succesvol geladen!', 'success');
    } catch (error) {
        console.error('Error loading app:', error);
        // Fallback to localStorage
        addresses = JSON.parse(localStorage.getItem('addresses') || '[]');
        updateAddressCount();
        updateAddressList();
        showNotification('Offline modus - data geladen van lokale opslag', 'warning');
    } finally {
        hideLoading();
    }
    
    // Search input event
    document.getElementById('search-input').addEventListener('input', function(e) {
        const query = e.target.value;
        clearTimeout(searchTimeout);
        
        if (query.trim()) {
            document.getElementById('loading').classList.remove('hidden');
            searchTimeout = setTimeout(() => searchAddresses(query), 300);
        } else {
            clearSearchResults();
        }
    });
});

// JSONBin API Functions
async function saveToCloud() {
    try {
        const response = await fetch(`${JSONBIN_CONFIG.baseUrl}/b/${JSONBIN_CONFIG.binId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': JSONBIN_CONFIG.apiKey
            },
            body: JSON.stringify({ addresses: addresses })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Data saved to cloud:', data);
        
        // Also save to localStorage as backup
        localStorage.setItem('addresses', JSON.stringify(addresses));
        localStorage.setItem('lastSync', new Date().toISOString());
        
        return true;
    } catch (error) {
        console.error('Error saving to cloud:', error);
        // Fallback to localStorage
        localStorage.setItem('addresses', JSON.stringify(addresses));
        throw error;
    }
}

async function loadFromCloud() {
    try {
        const response = await fetch(`${JSONBIN_CONFIG.baseUrl}/b/${JSONBIN_CONFIG.binId}/latest`, {
            method: 'GET',
            headers: {
                'X-Master-Key': JSONBIN_CONFIG.apiKey
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.record && data.record.addresses) {
            addresses = data.record.addresses;
            localStorage.setItem('addresses', JSON.stringify(addresses));
            localStorage.setItem('lastSync', new Date().toISOString());
            console.log('Data loaded from cloud:', addresses.length, 'addresses');
        } else {
            // Initialize empty bin if no data
            addresses = [];
            await saveToCloud();
        }
        
        return true;
    } catch (error) {
        console.error('Error loading from cloud:', error);
        throw error;
    }
}

// Search addresses using Nominatim (OpenStreetMap)
async function searchAddresses(query) {
    try {
        const encodedQuery = encodeURIComponent(query + ', Nederland');
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodedQuery}&limit=5&addressdetails=1&countrycodes=nl`);
        
        if (!response.ok) {
            throw new Error('Search API error');
        }
        
        const results = await response.json();
        
        // Transform Nominatim results to our format
        const transformedResults = results.map(result => ({
            label: result.display_name,
            coordinates: [parseFloat(result.lon), parseFloat(result.lat)],
            street: result.address?.road || query,
            housenumber: result.address?.house_number || '',
            postalcode: result.address?.postcode || '',
            locality: result.address?.city || result.address?.town || result.address?.village || '',
            region: result.address?.state || 'Noord-Brabant',
            country: 'Nederland'
        }));

        displaySearchResults(transformedResults);
    } catch (error) {
        console.error('Search error:', error);
        showNotification('Zoeken mislukt. Probeer opnieuw.', 'error');
        showNoResults();
    } finally {
        document.getElementById('loading').classList.add('hidden');
    }
}

// Display search results
function displaySearchResults(results) {
    const resultsContainer = document.getElementById('search-results');
    const resultsList = document.getElementById('results-list');
    const noResults = document.getElementById('no-results');

    if (results.length === 0) {
        showNoResults();
        return;
    }

    resultsList.innerHTML = '';
    
    results.forEach((result, index) => {
        const card = document.createElement('div');
        card.className = 'address-card';
        card.innerHTML = `
            <div class="address-header">
                <div class="address-name">${result.label}</div>
                <button class="btn btn-add" onclick="addAddress(${index})" title="Adres toevoegen">
                    ➕
                </button>
            </div>
            <div class="address-label">${result.postalcode} ${result.locality}</div>
        `;
        resultsList.appendChild(card);
    });

    // Store results temporarily for adding
    window.currentSearchResults = results;

    resultsContainer.classList.remove('hidden');
    noResults.classList.add('hidden');
}

// Show no results
function showNoResults() {
    const query = document.getElementById('search-input').value;
    document.getElementById('no-results').innerHTML = `
        <div class="empty-icon">📍</div>
        <div>Geen adressen gevonden voor "${query}"</div>
    `;
    document.getElementById('search-results').classList.add('hidden');
    document.getElementById('no-results').classList.remove('hidden');
}

// Clear search results
function clearSearchResults() {
    document.getElementById('search-results').classList.add('hidden');
    document.getElementById('no-results').classList.add('hidden');
    document.getElementById('loading').classList.add('hidden');
}

// Add address to saved list
async function addAddress(index) {
    if (!window.currentSearchResults) return;

    const addressData = window.currentSearchResults[index];
    
    // Check if address already exists
    const exists = addresses.some(addr => 
        addr.label === addressData.label || 
        (addr.properties.street === addressData.street && 
         addr.properties.housenumber === addressData.housenumber &&
         addr.properties.postalcode === addressData.postalcode)
    );

    if (exists) {
        showNotification('Dit adres is al opgeslagen!', 'warning');
        return;
    }
    
    const newAddress = {
        label: addressData.label,
        coordinates: addressData.coordinates,
        properties: {
            id: `node/${Date.now()}`,
            name: `${addressData.street} ${addressData.housenumber}`.trim(),
            housenumber: addressData.housenumber,
            street: addressData.street,
            postalcode: addressData.postalcode,
            locality: addressData.locality,
            region: addressData.region,
            country: addressData.country,
            label: addressData.label
        },
        savedDate: new Date().toISOString()
    };

    showLoading('Adres opslaan...');

    try {
        addresses.push(newAddress);
        await saveToCloud();
        
        // Clear search and switch to addresses tab
        document.getElementById('search-input').value = '';
        clearSearchResults();
        updateAddressCount();
        updateAddressList();
        updateLastSync();
        switchTab('addresses');
        
        // Update tab display
        document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab')[1].classList.add('active');
        
        showNotification('Adres succesvol opgeslagen!', 'success');
        
    } catch (error) {
        console.error('Error adding address:', error);
        // Remove from local array if cloud save failed
        addresses.pop();
        showNotification('Opslaan mislukt. Controleer je internetverbinding.', 'error');
    } finally {
        hideLoading();
    }
}

// Remove address
async function removeAddress(index) {
    if (!confirm('Weet je zeker dat je dit adres wilt verwijderen?')) {
        return;
    }

    showLoading('Adres verwijderen...');
    
    try {
        const removedAddress = addresses[index];
        addresses.splice(index, 1);
        await saveToCloud();
        
        updateAddressCount();
        updateAddressList();
        updateLastSync();
        
        showNotification('Adres verwijderd!', 'success');
    } catch (error) {
        console.error('Error removing address:', error);
        // Restore the address if cloud save failed
        addresses.splice(index, 0, removedAddress);
        showNotification('Verwijderen mislukt. Controleer je internetverbinding.', 'error');
    } finally {
        hideLoading();
    }
}

// Open address in maps
function openInMaps(coordinates) {
    const [lng, lat] = coordinates;
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
}

// Tab switching
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');

    // Hide all tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
    });

    // Show selected tab
    document.getElementById(tabName + '-tab').classList.remove('hidden');
    currentTab = tabName;

    // Update addresses display when switching to addresses tab
    if (tabName === 'addresses') {
        updateAddressList();
    }
}

// Update address count
function updateAddressCount() {
    document.getElementById('address-count').textContent = `Adressen (${addresses.length})`;
    document.getElementById('total-addresses').textContent = addresses.length;
}

// Update addresses list
function updateAddressList() {
    const addressesList = document.getElementById('addresses-list');
    const emptyState = document.getElementById('empty-addresses');

    if (addresses.length === 0) {
        addressesList.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    
    addressesList.innerHTML = `
        <div class="section-title">Opgeslagen adressen (${addresses.length})</div>
    `;

    addresses.forEach((address, index) => {
        const card = document.createElement('div');
        card.className = 'address-card';
        card.innerHTML = `
            <div class="address-header">
                <div class="address-name">${address.properties.name || address.label}</div>
                <div>
                    <button class="btn btn-map" onclick="openInMaps([${address.coordinates.join(',')}])" title="Open in kaarten">
                        🧭
                    </button>
                    <button class="btn btn-delete" onclick="removeAddress(${index})" title="Verwijder adres">
                        🗑️
                    </button>
                </div>
            </div>
