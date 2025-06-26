// API configuratie
const API_KEY = '5b3ce3597851110001cf624886d30766477c4b77968596ef1aa3411b';
const CENTER_ADDRESS = 'Nieuwlandstraat 66, Tilburg';
const WORK_ADDRESS = 'Laan van Voorburg 4, Vught';
const PA_LONNIE_ADDRESS = 'Hopstraat 11, Schijndel';
const PA_PIEGIE_ADDRESS = 'Annenborch 64, Rosmalen';
const AMARANT_ADDRESS = 'Daniël de Brouwerpark, Tilburg';

// JSONBin configuratie - Vervang deze waarden met je eigen JSONBin gegevens
const JSONBIN_API_KEY = '$2a$10$VUgmGwUgwRlPKxGI00D6pe6mR6q1.wvmkx0a34vpNrxdHpnClZ0Zy'; // Vervang met jouw JSONBin API key
const JSONBIN_BIN_ID = '685d28288a456b7966b6087a'; // Vervang met jouw bin ID

// Globale variabelen
let searchResults = [];
let currentSelectedAddress = null;

// HOOFDFUNCTIES

// Zoekfunctie voor adressen
async function searchAddress() {
    const query = document.getElementById('addressInput').value.trim();
    if (!query) {
        alert('Voer een adres in om te zoeken.');
        return;
    }

    const resultsContainer = document.getElementById('resultsContainer');
    const resultsList = document.getElementById('resultsList');

    resultsContainer.style.display = 'block';
    resultsList.innerHTML = '<div class="loading">Zoeken naar adressen</div>';

    try {
        const response = await fetch(`https://api.openrouteservice.org/geocode/search?api_key=${API_KEY}&text=${encodeURIComponent(query)}&boundary.country=NL&size=10`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.features && data.features.length > 0) {
            searchResults = data.features;
            displayResults(data.features);
        } else {
            resultsList.innerHTML = '<div class="error">Geen resultaten gevonden. Probeer een ander adres.</div>';
        }
    } catch (error) {
        console.error('Error searching address:', error);
        resultsList.innerHTML = '<div class="error">Er is een fout opgetreden bij het zoeken. Controleer je internetverbinding en probeer het opnieuw.</div>';
    }
}

// Resultaten weergeven
function displayResults(features) {
    const resultsList = document.getElementById('resultsList');
    resultsList.innerHTML = '';

    features.forEach((feature, index) => {
        const resultItem = document.createElement('div');
        resultItem.className = 'result-item';
        resultItem.innerHTML = `
            <strong>${feature.properties.label}</strong><br>
            <small style="color: #666;">${feature.properties.country}${feature.properties.region ? ', ' + feature.properties.region : ''}</small>
        `;
        resultItem.onclick = () => selectAddress(index);
        resultsList.appendChild(resultItem);
    });
}

// Adres selecteren uit zoekresultaten
async function selectAddress(index) {
    const selectedFeature = searchResults[index];
    const coords = selectedFeature.geometry.coordinates; // [longitude, latitude]

    // Huidige selectie opslaan voor later opslaan
    currentSelectedAddress = {
        label: selectedFeature.properties.label,
        coordinates: coords,
        properties: selectedFeature.properties
    };

    document.getElementById('selectedAddress').textContent = selectedFeature.properties.label;
    document.getElementById('detailsContainer').style.display = 'block';

    // Reset afstand displays
    resetDistanceDisplays();
    // Reset huishoudens displays
    resetHouseholdDisplays();

    // Street View link instellen
    const streetviewLink = document.getElementById('streetviewLink');
    streetviewLink.href = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${coords[1]},${coords[0]}`;

    // Afstanden berekenen en huishoudensgegevens laden
    await calculateDistances(coords);
    await loadHouseholdData(selectedFeature.properties);
}

// AFSTAND BEREKENING FUNCTIES

// Reset afstand displays
function resetDistanceDisplays() {
    document.getElementById('distanceToCenter').textContent = '...';
    document.getElementById('timeToCenter').textContent = 'Berekenen...';
    document.getElementById('distanceToWork').textContent = '...';
    document.getElementById('timeToWork').textContent = 'Berekenen...';
    document.getElementById('distanceToPaLonnie').textContent = '...';
    document.getElementById('timeToPaLonnie').textContent = 'Berekenen...';
    document.getElementById('distanceToPaPiegie').textContent = '...';
    document.getElementById('timeToPaPiegie').textContent = 'Berekenen...';
    document.getElementById('distanceToAmarant').textContent = '...';
    document.getElementById('timeToAmarant').textContent = 'Berekenen...';
}

// Alle afstanden berekenen
async function calculateDistances(selectedCoords) {
    // Coördinaten ophalen voor alle bestemmingen
    const centerCoords = await getCoordinates(CENTER_ADDRESS);
    const workCoords = await getCoordinates(WORK_ADDRESS);
    const paLonnieCoords = await getCoordinates(PA_LONNIE_ADDRESS);
    const paPiegieCoords = await getCoordinates(PA_PIEGIE_ADDRESS);
    const amarantCoords = await getCoordinates(AMARANT_ADDRESS);

    // Routes berekenen
    if (centerCoords) {
        await calculateRoute(selectedCoords, centerCoords, 'center');
    } else {
        document.getElementById('distanceToCenter').textContent = 'Fout';
        document.getElementById('timeToCenter').textContent = 'Kon adres niet vinden';
    }

    if (workCoords) {
        await calculateRoute(selectedCoords, workCoords, 'work');
    } else {
        document.getElementById('distanceToWork').textContent = 'Fout';
        document.getElementById('timeToWork').textContent = 'Kon adres niet vinden';
    }

    if (paLonnieCoords) {
        await calculateRoute(selectedCoords, paLonnieCoords, 'palonnie');
    } else {
        document.getElementById('distanceToPaLonnie').textContent = 'Fout';
        document.getElementById('timeToPaLonnie').textContent = 'Kon adres niet vinden';
    }

    if (paPiegieCoords) {
        await calculateRoute(selectedCoords, paPiegieCoords, 'papiegie');
    } else {
        document.getElementById('distanceToPaPiegie').textContent = 'Fout';
        document.getElementById('timeToPaPiegie').textContent = 'Kon adres niet vinden';
    }

    if (amarantCoords) {
        await calculateRoute(selectedCoords, amarantCoords, 'amarant');
    } else {
        document.getElementById('distanceToAmarant').textContent = 'Fout';
        document.getElementById('timeToAmarant').textContent = 'Kon adres niet vinden';
    }
}

// Coördinaten ophalen voor een adres
async function getCoordinates(address) {
    try {
        const response = await fetch(`https://api.openrouteservice.org/geocode/search?api_key=${API_KEY}&text=${encodeURIComponent(address)}&boundary.country=NL&size=1`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.features && data.features.length > 0) {
            return data.features[0].geometry.coordinates;
        }
        return null;
    } catch (error) {
        console.error('Error getting coordinates for', address, ':', error);
        return null;
    }
}

// Route berekenen tussen twee punten
async function calculateRoute(startCoords, endCoords, type) {
    try {
        // Verschillende vervoersmodi: fietsen voor centrum, auto voor de rest
        const transportMode = type === 'center' ? 'cycling-regular' : 'driving-car';

        const response = await fetch(`https://api.openrouteservice.org/v2/directions/${transportMode}?api_key=${API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                coordinates: [startCoords, endCoords]
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            const distance = (route.summary.distance / 1000).toFixed(1); // Naar km
            const duration = Math.round(route.summary.duration / 60); // Naar minuten

            // Resultaten weergeven
            updateDistanceDisplay(type, distance, duration);
        } else {
            throw new Error('No route found');
        }
    } catch (error) {
        console.error('Error calculating route:', error);
        updateDistanceDisplayError(type);
    }
}

// Distance display bijwerken met resultaten
function updateDistanceDisplay(type, distance, duration) {
    if (type === 'center') {
        document.getElementById('distanceToCenter').textContent = `${distance} km`;
        document.getElementById('timeToCenter').textContent = `${duration} min fietsen`;
    } else if (type === 'work') {
        document.getElementById('distanceToWork').textContent = `${distance} km`;
        document.getElementById('timeToWork').textContent = `${duration} min rijden`;
    } else if (type === 'palonnie') {
        document.getElementById('distanceToPaLonnie').textContent = `${distance} km`;
        document.getElementById('timeToPaLonnie').textContent = `${duration} min rijden`;
    } else if (type === 'papiegie') {
        document.getElementById('distanceToPaPiegie').textContent = `${distance} km`;
        document.getElementById('timeToPaPiegie').textContent = `${duration} min rijden`;
    } else if (type === 'amarant') {
        document.getElementById('distanceToAmarant').textContent = `${distance} km`;
        document.getElementById('timeToAmarant').textContent = `${duration} min rijden`;
    }
}

// Distance display bijwerken met fout
function updateDistanceDisplayError(type) {
    if (type === 'center') {
        document.getElementById('distanceToCenter').textContent = 'Fout';
        document.getElementById('timeToCenter').textContent = 'Route niet gevonden';
    } else if (type === 'work') {
        document.getElementById('distanceToWork').textContent = 'Fout';
        document.getElementById('timeToWork').textContent = 'Route niet gevonden';
    } else if (type === 'palonnie') {
        document.getElementById('distanceToPaLonnie').textContent = 'Fout';
        document.getElementById('timeToPaLonnie').textContent = 'Route niet gevonden';
    } else if (type === 'papiegie') {
        document.getElementById('distanceToPaPiegie').textContent = 'Fout';
        document.getElementById('timeToPaPiegie').textContent = 'Route niet gevonden';
    } else if (type === 'amarant') {
        document.getElementById('distanceToAmarant').textContent = 'Fout';
        document.getElementById('timeToAmarant').textContent = 'Route niet gevonden';
    }
}

// OPGESLAGEN ADRESSEN FUNCTIES

// Opgeslagen adressen laden van JSONBin
async function loadSavedAddresses() {
    const savedList = document.getElementById('savedAddressesList');
    savedList.innerHTML = '<div class="loading">Opgeslagen adressen laden…</div>';

    try {
        const response = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
            headers: {
                'X-Master-Key': JSONBIN_API_KEY
            }
        });

        if (response.ok) {
            const data = await response.json();
            const addresses = data.record.addresses || [];
            displaySavedAddresses(addresses);
        } else if (response.status === 404) {
            // Bin bestaat nog niet, lege state tonen
            savedList.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">Nog geen opgeslagen adressen. Zoek een adres en sla het op!</div>';
        } else {
            throw new Error('Failed to load addresses');
        }
    } catch (error) {
        console.error('Error loading saved addresses:', error);
        savedList.innerHTML = '<div class="error">⚠️ Zet je JSONBin API key en Bin ID in de code om adressen op te slaan</div>';
    }
}

// Opgeslagen adressen weergeven
function displaySavedAddresses(addresses) {
    const savedList = document.getElementById('savedAddressesList');

    if (addresses.length === 0) {
        savedList.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">Nog geen opgeslagen adressen. Zoek een adres en sla het op!</div>';
        return;
    }

    savedList.innerHTML = '';
    addresses.forEach((address, index) => {
        const addressItem = document.createElement('div');
        addressItem.className = 'saved-address-item';
        addressItem.innerHTML = `
            <button class="delete-btn" onclick="deleteSavedAddress(${index})" title="Verwijderen">×</button>
            <div class="saved-address-content">
                <strong>${address.label}</strong><br>
                <small style="color: #666;">Opgeslagen op ${new Date(address.savedDate).toLocaleDateString('nl-NL')}</small>
            </div>
        `;
        addressItem.onclick = (e) => {
            if (e.target.classList.contains('delete-btn')) return;
            selectSavedAddress(address);
        };
        savedList.appendChild(addressItem);
    });
}

// Huidig adres opslaan
async function saveCurrentAddress() {
    if (!currentSelectedAddress) {
        alert('Selecteer eerst een adres om op te slaan.');
        return;
    }

    try {
        // Bestaande adressen laden
        const response = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
            headers: {
                'X-Master-Key': JSONBIN_API_KEY
            }
        });

        let addresses = [];
        if (response.ok) {
            const data = await response.json();
            addresses = data.record.addresses || [];
        }

        // Controleren of adres al bestaat
        const exists = addresses.some(addr => addr.label === currentSelectedAddress.label);
        if (exists) {
            alert('Dit adres is al opgeslagen!');
            return;
        }

        // Nieuw adres toevoegen
        const newAddress = {
            ...currentSelectedAddress,
            savedDate: new Date().toISOString()
        };
        addresses.push(newAddress);

        // Terugslaan naar JSONBin
        const saveResponse = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': JSONBIN_API_KEY
            },
            body: JSON.stringify({ addresses })
        });

        if (saveResponse.ok) {
            alert('Adres succesvol opgeslagen!');
            loadSavedAddresses();
        } else {
            throw new Error('Failed to save address');
        }

    } catch (error) {
        console.error('Error saving address:', error);
        alert('Er is een fout opgetreden bij het opslaan. Controleer je JSONBin configuratie.');
    }
}

// Opgeslagen adres verwijderen
async function deleteSavedAddress(index) {
    if (!confirm('Weet je zeker dat je dit adres wilt verwijderen?')) {
        return;
    }

    try {
        // Bestaande adressen laden
        const response = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
            headers: {
                'X-Master-Key': JSONBIN_API_KEY
            }
        });

        if (response.ok) {
            const data = await response.json();
            let addresses = data.record.addresses || [];
            
            // Adres op index verwijderen
            addresses.splice(index, 1);

            // Terugslaan naar JSONBin
            const saveResponse = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': JSONBIN_API_KEY
                },
                body: JSON.stringify({ addresses })
            });

            if (saveResponse.ok) {
                loadSavedAddresses();
            } else {
                throw new Error('Failed to delete address');
            }
        }
    } catch (error) {
        console.error('Error deleting address:', error);
        alert('Er is een fout opgetreden bij het verwijderen.');
    }
}

// Opgeslagen adres selecteren
function selectSavedAddress(address) {
    // Huidige selectie opslaan
    currentSelectedAddress = address;

    document.getElementById('selectedAddress').textContent = address.label;
    document.getElementById('detailsContainer').style.display = 'block';

    // Reset displays
    resetDistanceDisplays();
    resetHouseholdDisplays();

    // Street View link instellen
    const streetviewLink = document.getElementById('streetviewLink');
    streetviewLink.href = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${address.coordinates[1]},${address.coordinates[0]}`;

    // Afstanden berekenen en huishoudensgegevens laden
    calculateDistances(address.coordinates);
    loadHouseholdData(address.properties);

    // Naar details scrollen
    document.getElementById('detailsContainer').scrollIntoView({ behavior: 'smooth' });
}

// HUISHOUDENSGEGEVENS FUNCTIES

// Reset huishoudens displays
function resetHouseholdDisplays() {
    document.getElementById('singleHouseholds').textContent = '…';
    document.getElementById('couplesNoKids').textContent = '…';
    document.getElementById('couplesWithKids').textContent = '…';
    document.getElementById('singleParents').textContent = '…';
    document.getElementById('otherHouseholds').textContent = '…';
    document.getElementById('avgHouseholdSize').textContent = '…';
}

// Huishoudensgegevens laden
async function loadHouseholdData(addressProperties) {
    try {
        // Postcode uit adres halen
        let postalCode = extractPostalCode(addressProperties);

        if (!postalCode) {
            showHouseholdError('Geen postcode gevonden in het adres');
            return;
        }

        // Voor demo gebruiken we gesimuleerde CBS data
        // In werkelijkheid zou je de echte CBS API aanroepen
        const householdData = await getHouseholdDataFromCBS(postalCode);
        
        if (householdData) {
            displayHouseholdData(householdData);
        } else {
            showHouseholdError('Geen huishoudensgegevens beschikbaar voor deze postcode');
        }
        
    } catch (error) {
        console.error('Error loading household data:', error);
        showHouseholdError('Fout bij ophalen van huishoudensgegevens');
    }
}

// Postcode uit adres eigenschappen halen
function extractPostalCode(properties) {
    // Probeer postcode uit verschillende eigenschappen te halen
    const label = properties.label || '';
    const postalcode = properties.postalcode;

    if (postalcode) {
        return postalcode.substring(0, 4); // Eerste 4 cijfers gebruiken
    }

    // Probeer uit label te halen met regex
    const postalCodeMatch = label.match(/(\d{4})\s*[A-Z]{2}/);
    if (postalCodeMatch) {
        return postalCodeMatch[1];
    }

    return null;
}

// Gesimuleerde CBS data ophalen
async function getHouseholdDataFromCBS(postalCode) {
    // Dit is een gesimuleerde functie. In werkelijkheid zou je:
    // 1. De CBS StatLine API aanroepen
    // 2. De postcode gebruiken om het juiste statistische gebied te krijgen
    // 3. Echte huishoudenssamenstelling data ophalen

    // Voor nu simuleren we een API vertraging
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Gesimuleerde data - in werkelijkheid komt dit van CBS
    const simulatedData = generateSimulatedHouseholdData(postalCode);

    return simulatedData;
}

// Gesimuleerde huishoudensgegevens genereren
function generateSimulatedHouseholdData(postalCode) {
    // Realistische data genereren op basis van postcode
    const seed = parseInt(postalCode) || 1000;
    const random = (min, max) => Math.round(min + (seed % 100) / 100 * (max - min));

    // Verschillende huishoudenspatronen simuleren voor verschillende gebieden
    let baseData;
    if (seed < 3000) {
        // Stedelijke gebieden - meer eenpersoonshuishoudens
        baseData = {
            singleHouseholds: random(35, 50),
            couplesNoKids: random(25, 35),
            couplesWithKids: random(20, 30),
            singleParents: random(8, 15),
            avgSize: (random(19, 24) / 10)
        };
    } else if (seed < 7000) {
        // Voorstedelijke gebieden - meer gezinnen
        baseData = {
            singleHouseholds: random(25, 35),
            couplesNoKids: random(20, 30),
            couplesWithKids: random(30, 45),
            singleParents: random(5, 12),
            avgSize: (random(22, 28) / 10)
        };
    } else {
        // Landelijke gebieden - gemengd patroon
        baseData = {
            singleHouseholds: random(30, 40),
            couplesNoKids: random(25, 35),
            couplesWithKids: random(25, 35),
            singleParents: random(6, 10),
            avgSize: (random(20, 26) / 10)
        };
    }

    // Restpercentage berekenen voor "overige huishoudens"
    const totalPercentage = baseData.singleHouseholds + baseData.couplesNoKids + 
                           baseData.couplesWithKids + baseData.singleParents;
    baseData.otherHouseholds = Math.max(0, 100 - totalPercentage);

    return baseData;
}

// Huishoudensgegevens weergeven
function displayHouseholdData(data) {
    document.getElementById('singleHouseholds').textContent = `${data.singleHouseholds}%`;
    document.getElementById('couplesNoKids').textContent = `${data.couplesNoKids}%`;
    document.getElementById('couplesWithKids').textContent = `${data.couplesWithKids}%`;
    document.getElementById('singleParents').textContent = `${data.singleParents}%`;
    document.getElementById('otherHouseholds').textContent = `${data.otherHouseholds}%`;
    document.getElementById('avgHouseholdSize').textContent = `${data.avgSize}`;
}

// Huishoudensgegevens fout weergeven
function showHouseholdError(message) {
    document.getElementById('singleHouseholds').textContent = 'N/A';
    document.getElementById('couplesNoKids').textContent = 'N/A';
    document.getElementById('couplesWithKids').textContent = 'N/A';
    document.getElementById('singleParents').textContent = 'N/A';
    document.getElementById('otherHouseholds').textContent = 'N/A';
    document.getElementById('avgHouseholdSize').textContent = 'N/A';
    console.log('Household data error:', message);
}

// EVENT LISTENERS EN INITIALISATIE

// Enter toets voor zoeken
document.getElementById('addressInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        searchAddress();
    }
});

// Focus op input en opgeslagen adressen laden bij laden van pagina
window.addEventListener('load', function() {
    document.getElementById('addressInput').focus();
    loadSavedAddresses();
});
