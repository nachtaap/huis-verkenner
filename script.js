// OpenRouteService Configuration
const ORS_CONFIG = {
    apiKey: '5b3ce3597851110001cf624886d30766477c4b77968596ef1aa3411b',
    baseUrl: 'https://api.openrouteservice.org/v2'
};

// Fixed locations for distance calculation
const FIXED_LOCATIONS = {
    centrum: {
        name: 'Centrum',
        address: 'Nieuwlandstraat 66, 5038 SP Tilburg',
        coordinates: [5.083721, 51.559661], // Approximate coordinates
        transport: 'cycling-regular',
        icon: '🚴‍♂️'
    },
    werk: {
        name: 'Werk',
        address: 'Laan van Voorburg 4, 5261 LS Vught',
        coordinates: [5.284264, 51.654503], // Approximate coordinates
        transport: 'driving-car',
        icon: '🚗'
    },
    schijndel: {
        name: 'Schijndel',
        address: 'Hopstraat 11, Schijndel',
        coordinates: [5.436000, 51.616000], // Approximate coordinates
        transport: 'driving-car',
        icon: '🚗'
    },
    rosmalen: {
        name: 'Rosmalen',
        address: 'De Hoef 64, Rosmalen',
        coordinates: [5.365000, 51.710000], // Approximate coordinates
        transport: 'driving-car',
        icon: '🚗'
    }
};

// Current address being viewed in detail
let currentDetailAddress = null;
let currentDetailIndex = null;

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
        
        // Transform Nominatim results to our consistent format
        const transformedResults = results.map(result => {
            const address = result.address || {};
            const street = address.road || query;
            const housenumber = address.house_number || '';
            const postcode = address.postcode || '';
            const city = address.city || address.town || address.village || address.municipality || '';
            
            // Create consistent label format: "Straat 123, 1234AB, Stad"
            let formattedLabel = street;
            if (housenumber) {
                formattedLabel += ` ${housenumber}`;
            }
            if (postcode) {
                formattedLabel += `, ${postcode}`;
            }
            if (city) {
                formattedLabel += `, ${city}`;
            }
            
            return {
                label: formattedLabel,
                originalLabel: result.display_name,
                coordinates: [parseFloat(result.lon), parseFloat(result.lat)],
                street: street,
                housenumber: housenumber,
                postalcode: postcode,
                locality: city,
                region: 'Noord-Brabant',
                country: 'Nederland'
            };
        });

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
            <div class="address-label" style="color: #999; font-size: 12px;">${result.originalLabel}</div>
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
        // First add to local array
        addresses.push(newAddress);
        
        // Save to localStorage immediately as backup
        saveToLocalStorage();
        
        // Update UI immediately
        updateAddressCount();
        updateAddressList();
        
        // Try to save to cloud
        await saveToCloud();
        updateLastSync();
        
        // Clear search and switch to addresses tab
        document.getElementById('search-input').value = '';
        clearSearchResults();
        switchTab('addresses');
        
        // Update tab display
        document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab')[1].classList.add('active');
        
        showNotification('Adres succesvol opgeslagen!', 'success');
        
    } catch (error) {
        console.error('Error saving to cloud:', error);
        // Keep the address locally but show warning
        showNotification('Adres lokaal opgeslagen. Cloud sync mislukt - probeer later opnieuw.', 'warning');
        
        // Clear search and switch to addresses tab anyway
        document.getElementById('search-input').value = '';
        clearSearchResults();
        switchTab('addresses');
        
        // Update tab display
        document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab')[1].classList.add('active');
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
    
    // Store the address to restore if needed
    const removedAddress = addresses[index];
    
    try {
        // Remove from local array first
        addresses.splice(index, 1);
        
        // Update UI immediately
        updateAddressCount();
        updateAddressList();
        
        // Save to localStorage as backup
        saveToLocalStorage();
        
        // Try to save to cloud
        await saveToCloud();
        updateLastSync();
        
        showNotification('Adres verwijderd!', 'success');
    } catch (error) {
        console.error('Error removing from cloud:', error);
        // Restore the address locally if cloud save failed
        addresses.splice(index, 0, removedAddress);
        updateAddressCount();
        updateAddressList();
        saveToLocalStorage();
        showNotification('Lokaal verwijderd. Cloud sync mislukt - probeer later opnieuw.', 'warning');
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
    // Find the clicked tab or use current if called programmatically
    const clickedTab = event?.target || document.querySelector(`.tab[onclick*="${tabName}"]`);
    
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    if (clickedTab) {
        clickedTab.classList.add('active');
    }

    // Hide all tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
    });

    // Show selected tab
    const targetTab = document.getElementById(tabName + '-tab');
    if (targetTab) {
        targetTab.classList.remove('hidden');
    }
    
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
        card.style.cursor = 'pointer';
        
        // Use the formatted label if available, otherwise fall back to original format
        const displayName = address.label || `${address.properties.street} ${address.properties.housenumber}`.trim();
        
        card.innerHTML = `
            <div class="address-header">
                <div class="address-name">${displayName}</div>
                <div>
                    <button class="btn btn-delete" onclick="removeAddress(${index}); event.stopPropagation();" title="Verwijder adres">
                        🗑️
                    </button>
                </div>
            </div>
            <div class="address-date">
                📅 Toegevoegd: ${formatDate(address.savedDate)}
            </div>
        `;
        
        // Add click handler for the entire card
        card.addEventListener('click', () => showAddressDetail(address, index));
        
        addressesList.appendChild(card);
    });
}

// Sync from cloud manually
async function syncFromCloud() {
    const syncBtn = document.getElementById('sync-btn');
    syncBtn.disabled = true;
    syncBtn.textContent = '📥 Synchroniseren...';
    
    showLoading('Synchroniseren met cloud...');
    
    try {
        await loadFromCloud();
        updateAddressCount();
        updateAddressList();
        updateLastSync();
        showNotification('Synchronisatie succesvol!', 'success');
    } catch (error) {
        console.error('Sync error:', error);
        showNotification('Synchronisatie mislukt. Controleer je internetverbinding.', 'error');
    } finally {
        hideLoading();
        syncBtn.disabled = false;
        syncBtn.textContent = '📥 Synchroniseer van cloud';
    }
}

// Export addresses as JSON
function exportAddresses() {
    if (addresses.length === 0) {
        showNotification('Geen adressen om te exporteren!', 'warning');
        return;
    }

    const dataStr = JSON.stringify({ addresses: addresses }, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `adressen_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    showNotification(`${addresses.length} adressen geëxporteerd!`, 'success');
}

// Update last sync time
function updateLastSync() {
    const lastSync = localStorage.getItem('lastSync');
    const lastSyncElement = document.getElementById('last-sync');
    
    if (lastSync) {
        lastSyncElement.textContent = formatDate(lastSync);
    } else {
        lastSyncElement.textContent = 'Nog niet gesynchroniseerd';
    }
}

// Format date
function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('nl-NL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Loading overlay functions
function showLoading(text = 'Laden...') {
    document.getElementById('loading-text').textContent = text;
    document.getElementById('loading-overlay').classList.remove('hidden');
    isLoading = true;
}

function hideLoading() {
    document.getElementById('loading-overlay').classList.add('hidden');
    isLoading = false;
}

// Notification system
function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notification-text');
    
    // Remove existing type classes
    notification.classList.remove('error', 'warning', 'success');
    
    // Add new type class
    if (type !== 'success') {
        notification.classList.add(type);
    }
    
    notificationText.textContent = message;
    notification.classList.remove('hidden');
    
    // Auto hide after 3 seconds
    setTimeout(() => {
        notification.classList.add('hidden');
    }, 3000);
}

// Error handling for network issues
window.addEventListener('online', function() {
    showNotification('Internetverbinding hersteld!', 'success');
});

window.addEventListener('offline', function() {
    showNotification('Geen internetverbinding. App werkt offline.', 'warning');
});

// Auto-save to localStorage as backup
function saveToLocalStorage() {
    try {
        localStorage.setItem('addresses', JSON.stringify(addresses));
        localStorage.setItem('lastLocalSave', new Date().toISOString());
    } catch (error) {
        console.error('Error saving to localStorage:', error);
    }
}

// Show address detail page
async function showAddressDetail(address, index) {
    currentDetailAddress = address;
    currentDetailIndex = index;
    
    // Extract street name for title
    const streetName = address.properties?.street || 
                      address.label?.split(',')[0]?.split(' ').slice(0, -1).join(' ') || 
                      'Adres';
    
    // Update detail page content
    document.getElementById('detail-title').textContent = streetName;
    
    // Show address info
    const displayName = address.label || `${address.properties.street} ${address.properties.housenumber}`.trim();
    document.getElementById('detail-full-address').textContent = displayName;
    document.getElementById('detail-coordinates').textContent = `${address.coordinates[1].toFixed(6)}, ${address.coordinates[0].toFixed(6)}`;
    document.getElementById('detail-saved-date').textContent = formatDate(address.savedDate);
    
    // Reset distance displays
    Object.keys(FIXED_LOCATIONS).forEach(key => {
        const card = document.getElementById(`distance-${key}`);
        const valueElement = card.querySelector('.distance-value');
        const transport = FIXED_LOCATIONS[key];
        valueElement.textContent = `${transport.icon} Berekenen...`;
        card.classList.add('loading');
    });
    
    // Reset CBS info displays
    ['gezinnen', 'alleenstaand', '1ouder', 'overig'].forEach(type => {
        const card = document.getElementById(`info-${type}`);
        const valueElement = card.querySelector('.info-value');
        valueElement.textContent = 'Laden...';
        card.classList.add('loading');
    });
    
    // Switch to detail tab
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    document.getElementById('address-detail-tab').classList.remove('hidden');
    
    // Calculate distances and get CBS data
    await Promise.all([
        calculateDistances(address.coordinates),
        getCBSData(address.coordinates, displayName)
    ]);
}

// Calculate distances to fixed locations
async function calculateDistances(fromCoordinates) {
    const [fromLng, fromLat] = fromCoordinates;
    
    for (const [key, location] of Object.entries(FIXED_LOCATIONS)) {
        try {
            const distance = await getRouteDistance(
                fromCoordinates,
                location.coordinates,
                location.transport
            );
            
            const card = document.getElementById(`distance-${key}`);
            const valueElement = card.querySelector('.distance-value');
            
            if (distance) {
                const timeText = formatTime(distance.duration);
                const distanceText = formatDistance(distance.distance);
                valueElement.textContent = `${location.icon} ${timeText} / ${distanceText}`;
            } else {
                valueElement.textContent = `${location.icon} Niet beschikbaar`;
            }
            
            card.classList.remove('loading');
        } catch (error) {
            console.error(`Error calculating distance to ${key}:`, error);
            const card = document.getElementById(`distance-${key}`);
            const valueElement = card.querySelector('.distance-value');
            valueElement.textContent = `${location.icon} Fout bij berekenen`;
            card.classList.remove('loading');
        }
    }
}

// Get route distance and duration from OpenRouteService
async function getRouteDistance(fromCoords, toCoords, profile) {
    try {
        const [fromLng, fromLat] = fromCoords;
        const [toLng, toLat] = toCoords;
        
        const response = await fetch(`${ORS_CONFIG.baseUrl}/directions/${profile}`, {
            method: 'POST',
            headers: {
                'Authorization': ORS_CONFIG.apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                coordinates: [[fromLng, fromLat], [toLng, toLat]],
                format: 'json'
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            return {
                distance: route.summary.distance, // in meters
                duration: route.summary.duration  // in seconds
            };
        }
        
        return null;
    } catch (error) {
        console.error('OpenRouteService error:', error);
        return null;
    }
}

// Format time duration
function formatTime(seconds) {
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) {
        return `${minutes} min`;
    } else {
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return remainingMinutes > 0 ? `${hours}u ${remainingMinutes}m` : `${hours}u`;
    }
}

// Format distance
function formatDistance(meters) {
    if (meters < 1000) {
        return `${Math.round(meters)} m`;
    } else {
        const km = (meters / 1000).toFixed(1);
        return `${km} km`;
    }
}

// Go back to addresses list
function goBackToAddresses() {
    currentDetailAddress = null;
    currentDetailIndex = null;
    
    // Hide detail tab and show addresses tab
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    document.getElementById('addresses-tab').classList.remove('hidden');
    
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab')[1].classList.add('active');
}

// Get CBS data for the address using real CBS API
async function getCBSData(coordinates, addressName) {
    try {
        const [lng, lat] = coordinates;
        
        // First get the CBS area (gemeente/wijk/buurt) from coordinates
        showNotification('CBS data ophalen...', 'info');
        
        const cbsAreaData = await getCBSAreaFromCoordinates(lng, lat);
        
        if (cbsAreaData) {
            console.log('Found CBS area:', cbsAreaData);
            
            // Get household composition data from CBS API
            const householdData = await getCBSHouseholdData(cbsAreaData);
            
            if (householdData) {
                updateCBSInfo('gezinnen', householdData.gezinnen);
                updateCBSInfo('alleenstaand', householdData.alleenstaand);
                updateCBSInfo('1ouder', householdData.eenOuder);
                updateCBSInfo('overig', householdData.overig);
                
                showNotification('CBS data succesvol geladen!', 'success');
                return;
            }
        }
        
        // If no data found, show that
        ['gezinnen', 'alleenstaand', '1ouder', 'overig'].forEach(type => {
            updateCBSInfo(type, null);
        });
        
        showNotification('Geen CBS data beschikbaar voor dit gebied', 'warning');
        
    } catch (error) {
        console.error('Error getting CBS data:', error);
        
        // Show error state
        ['gezinnen', 'alleenstaand', '1ouder', 'overig'].forEach(type => {
            updateCBSInfo(type, null);
        });
        
        showNotification('Fout bij ophalen CBS data', 'error');
    }
}

// Get CBS area (gemeente/wijk/buurt) from coordinates
async function getCBSAreaFromCoordinates(lng, lat) {
    try {
        // First try to get buurt (neighborhood) level data
        let wfsUrl = `https://geodata.nationaalgeoregister.nl/cbs/wfs/v1_0?` +
            `service=WFS&version=2.0.0&request=GetFeature&typeName=cbs:cbs_buurten_2024&` +
            `outputFormat=application/json&count=1&` +
            `cql_filter=INTERSECTS(geom,POINT(${lng} ${lat}))`;
        
        let response = await fetch(wfsUrl);
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.features && data.features.length > 0) {
                const feature = data.features[0];
                return {
                    type: 'buurt',
                    code: feature.properties.BU_CODE,
                    naam: feature.properties.BU_NAAM,
                    wijkCode: feature.properties.WK_CODE,
                    gemeenteCode: feature.properties.GM_CODE,
                    gemeenteNaam: feature.properties.GM_NAAM
                };
            }
        }
        
        // If buurt failed, try wijk (district) level
        wfsUrl = `https://geodata.nationaalgeoregister.nl/cbs/wfs/v1_0?` +
            `service=WFS&version=2.0.0&request=GetFeature&typeName=cbs:cbs_wijken_2024&` +
            `outputFormat=application/json&count=1&` +
            `cql_filter=INTERSECTS(geom,POINT(${lng} ${lat}))`;
        
        response = await fetch(wfsUrl);
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.features && data.features.length > 0) {
                const feature = data.features[0];
                return {
                    type: 'wijk',
                    code: feature.properties.WK_CODE,
                    naam: feature.properties.WK_NAAM,
                    gemeenteCode: feature.properties.GM_CODE,
                    gemeenteNaam: feature.properties.GM_NAAM
                };
            }
        }
        
        // If wijk failed, try gemeente (municipality) level
        wfsUrl = `https://geodata.nationaalgeoregister.nl/cbs/wfs/v1_0?` +
            `service=WFS&version=2.0.0&request=GetFeature&typeName=cbs:cbs_gemeenten_2024&` +
            `outputFormat=application/json&count=1&` +
            `cql_filter=INTERSECTS(geom,POINT(${lng} ${lat}))`;
        
        response = await fetch(wfsUrl);
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.features && data.features.length > 0) {
                const feature = data.features[0];
                return {
                    type: 'gemeente',
                    code: feature.properties.GM_CODE,
                    naam: feature.properties.GM_NAAM
                };
            }
        }
        
        return null;
    } catch (error) {
        console.error('Error getting CBS area:', error);
        return null;
    }
}

// Get household composition data from CBS OData API (71486ned)
async function getCBSHouseholdData(areaData) {
    try {
        // CBS OData API endpoint for table 71486ned (Huishoudens; samenstelling, grootte, regio, 1 januari)
        const apiUrl = `https://opendata.cbs.nl/ODataApi/OData/71486ned/TypedDataSet`;
        
        // Use the most detailed area code we have
        const regionCode = areaData.code;
        const regionType = areaData.type;
        
        // Get latest available period (2024)
        const filter = `$filter=RegioS eq '${regionCode}' and Perioden eq '2024JJ00'`;
        const select = `$select=Totaal_1,Eenpersoonshuishoudens_2,MeerpersoonshuishZonderKind_3,EenoudergezinnenMeerpersoonshuish_4,PaarMetKinderenMeerpersoonshuish_5`;
        
        const response = await fetch(`${apiUrl}?${filter}&${select}`, {
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            console.log(`No data for ${regionCode}, trying 2023...`);
            
            // Try 2023 if 2024 not available
            const filter2023 = `$filter=RegioS eq '${regionCode}' and Perioden eq '2023JJ00'`;
            const response2023 = await fetch(`${apiUrl}?${filter2023}&${select}`, {
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (!response2023.ok) {
                throw new Error(`CBS API request failed: ${response2023.status}`);
            }
            
            const data2023 = await response2023.json();
            return processCBSHouseholdData(data2023, areaData.naam, '2023');
        }
        
        const data = await response.json();
        return processCBSHouseholdData(data, areaData.naam, '2024');
        
    } catch (error) {
        console.error('Error getting CBS household data:', error);
        return null;
    }
}

// Process CBS household data response
function processCBSHouseholdData(data, areaName, year) {
    if (data.value && data.value.length > 0) {
        const record = data.value[0];
        
        // CBS data fields:
        // Totaal_1: Total households
        // Eenpersoonshuishoudens_2: Single person households  
        // MeerpersoonshuishZonderKind_3: Multi-person households without children
        // EenoudergezinnenMeerpersoonshuish_4: Single parent families
        // PaarMetKinderenMeerpersoonshuish_5: Couples with children
        
        const total = record.Totaal_1;
        
        if (!total || total === 0) {
            console.log('No household data available for this area');
            return null;
        }
        
        // Calculate percentages - handle null values
        const alleenstaand = record.Eenpersoonshuishoudens_2 ? 
            Math.round((record.Eenpersoonshuishoudens_2 / total) * 100) : 0;
        
        const paarZonderKind = record.MeerpersoonshuishZonderKind_3 ? 
            Math.round((record.MeerpersoonshuishZonderKind_3 / total) * 100) : 0;
        
        const eenOuder = record.EenoudergezinnenMeerpersoonshuish_4 ? 
            Math.round((record.EenoudergezinnenMeerpersoonshuish_4 / total) * 100) : 0;
        
        const paarMetKind = record.PaarMetKinderenMeerpersoonshuish_5 ? 
            Math.round((record.PaarMetKinderenMeerpersoonshuish_5 / total) * 100) : 0;
        
        console.log(`CBS data for ${areaName} (${year}):`, {
            total,
            alleenstaand: `${alleenstaand}%`,
            gezinnen: `${paarMetKind}%`, 
            eenOuder: `${eenOuder}%`,
            overig: `${paarZonderKind}%`
        });
        
        return {
            alleenstaand: alleenstaand,
            gezinnen: paarMetKind,
            eenOuder: eenOuder,
            overig: paarZonderKind,
            bron: `CBS ${year}, ${areaName}`,
            total: total
        };
    }
    
    return null;
}

// Update CBS info card
function updateCBSInfo(type, percentage) {
    const card = document.getElementById(`info-${type}`);
    const valueElement = card.querySelector('.info-value');
    
    if (percentage !== null) {
        valueElement.textContent = `${percentage}%`;
    } else {
        valueElement.textContent = '-';
    }
    
    card.classList.remove('loading');
}

// Delete current address from detail page
async function deleteCurrentAddress() {
    if (currentDetailIndex !== null) {
        if (confirm('Weet je zeker dat je dit adres wilt verwijderen?')) {
            await removeAddress(currentDetailIndex);
            goBackToAddresses();
        }
    }
}

// Periodic sync (every 5 minutes if app is active)
setInterval(async () => {
    if (!isLoading && navigator.onLine) {
        try {
            await saveToCloud();
            console.log('Periodic sync completed');
        } catch (error) {
            console.log('Periodic sync failed:', error);
        }
    }
}, 5 * 60 * 1000); // 5 minutes
