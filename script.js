/* ============================================
   SMART CROWD MANAGEMENT SYSTEM - JAVASCRIPT
   Firebase Firestore Integration
   Real-Time Monitoring & Analytics
   ============================================ */

// ============================================
// FIREBASE CONFIGURATION
// ============================================
// IMPORTANT: Replace with your Firebase project configuration
const firebaseConfig = {
    apiKey: "AIzaSyAeuYDKC3IJELbZ9OiJIWLaI__j45PRUWs",
    authDomain: "crowd-management-e0951.firebaseapp.com",
    projectId: "crowd-management-e0951",
    storageBucket: "crowd-management-e0951.firebasestorage.app",
    messagingSenderId: "792381160414",
    appId: "1:792381160414:web:98662868eaecc9025bbb4f",
    measurementId: "G-E5NNB9VPDG"
};

// Initialize Firebase connection status variable FIRST
let firebaseSyncStatus = 'disconnected'; // Track Firebase connection status

// Initialize Firebase
let db;

// Initialize Firebase only if config is valid
if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
    try {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        firebaseSyncStatus = 'connected';
        console.log("✅ Firebase initialized successfully");
        console.log("✅ Firestore connected");
    } catch (error) {
        console.error("❌ Firebase initialization error:", error);
        console.log("Using mock data instead");
        db = null;
        firebaseSyncStatus = 'error';
    }
} else {
    console.warn("⚠️ Firebase config not set. Using mock data for demonstration.");
    db = null;
    firebaseSyncStatus = 'unavailable';
}

// ============================================
// GLOBAL VARIABLES
// ============================================
let zonesData = [];
let chartInstance = null;
let mapInstance = null;
let zoneMarkers = {}; // Store markers for each zone
let zoneCircles = {}; // Store zone radius circles
let userDefinedZones = []; // Store user-defined zones
let isMapSelectMode = false; // Track if in map selection mode
let tempMapMarker = null; // Temporary marker for map selection
let crowdDataCache = []; // Cache for crowd data in localStorage

// Mock data for demonstration (when Firebase is not configured)
const mockZonesData = [
    { zone_name: "VNR Main Gate", density: 35, alert: "Low" },
    { zone_name: "VNR Central Campus", density: 65, alert: "Medium" },
    { zone_name: "VNR Academic Block", density: 80, alert: "High" }
];

// Default zones configuration
const defaultZones = [
    { name: "VNR Main Gate", latitude: 17.53890, longitude: 78.38450, radius: 50 },
    { name: "VNR Central Campus", latitude: 17.54000, longitude: 78.38600, radius: 50 },
    { name: "VNR Academic Block", latitude: 17.53900, longitude: 78.38700, radius: 50 }
];

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener("DOMContentLoaded", function () {
    console.log("🚀 Application started");

    // Check if user is authenticated
    checkAuthentication();

    // Initialize zone configuration (now async)
    initializeZoneConfiguration();

    // Small delay to ensure all Firebase scripts are loaded
    setTimeout(async () => {
        initializeLiveClock();
        initializeMap();
        initializeChart();
        loadCrowdData();

        // Wait for zones to load from Firebase
        await loadUserDefinedZones();
        addZoneBoundaries();
        updateMapMarkers();

        // Initialize Firebase sync status display
        updateFirebaseSyncStatus();
    }, 500);
});

// ============================================
// AUTHENTICATION & SESSION MANAGEMENT
// ============================================
/**
 * Checks if user is authenticated
 * Redirects to login page if not logged in
 */
function checkAuthentication() {
    const isLoggedIn = localStorage.getItem('user_logged_in') === 'true';
    const userEmail = localStorage.getItem('user_email');

    if (!isLoggedIn || !userEmail) {
        console.warn("⚠️ Not authenticated, redirecting to login...");
        window.location.href = 'login.html';
        return;
    }

    console.log("✅ User authenticated:", userEmail);

    // Display user info in header
    displayUserInfo(userEmail);

    // Setup logout functionality
    setupLogoutButton();
}

/**
 * Displays logged-in user information in header
 */
function displayUserInfo(email) {
    const userSection = document.getElementById('userSection');
    const userEmail = document.getElementById('userEmail');

    if (userSection && userEmail) {
        userEmail.textContent = `👤 ${email}`;
        userSection.style.display = 'flex';
    }
}

/**
 * Sets up logout button functionality
 */
function setupLogoutButton() {
    const logoutBtn = document.getElementById('logoutBtn');

    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
}

/**
 * Handles user logout
 */
function handleLogout() {
    console.log("Logging out user...");

    // Confirm logout
    if (!confirm("Are you sure you want to logout?")) {
        return;
    }

    // Clear session data
    localStorage.removeItem('user_logged_in');
    localStorage.removeItem('user_email');
    localStorage.removeItem('login_time');

    console.log("✅ User logged out");

    // Redirect to login page
    window.location.href = 'login.html';
}

// ============================================
// ZONE CONFIGURATION MANAGEMENT
// ============================================
/**
 * Initializes zone configuration system
 */
async function initializeZoneConfiguration() {
    await loadUserDefinedZones();
    setupZoneConfigModal();
}

/**
 * Loads user-defined zones from Firebase, localStorage, or uses defaults
 */
async function loadUserDefinedZones() {
    // Try to load from Firebase first
    if (db) {
        try {
            const firebaseZones = await loadZonesFromFirebase();
            if (firebaseZones && firebaseZones.length > 0) {
                userDefinedZones = firebaseZones;
                console.log("✅ Zones loaded from Firebase");
                return;
            }
        } catch (error) {
            console.error("Error loading from Firebase:", error);
        }
    }

    // Fall back to localStorage
    const saved = localStorage.getItem('userDefinedZones');
    if (saved) {
        try {
            userDefinedZones = JSON.parse(saved);
            console.log("✅ User-defined zones loaded from localStorage:", userDefinedZones);
            // Sync to Firebase if not already there
            if (db) saveZonesToFirebase();
        } catch (error) {
            console.error("Error loading zones:", error);
            userDefinedZones = [...defaultZones];
        }
    } else {
        userDefinedZones = [...defaultZones];
        saveUserDefinedZones();
    }
}

/**
 * Saves user-defined zones to localStorage and Firebase
 */
function saveUserDefinedZones() {
    // Save to localStorage
    localStorage.setItem('userDefinedZones', JSON.stringify(userDefinedZones));
    console.log("✅ Zones saved to localStorage");

    // Save to Firebase if connected
    if (db) {
        saveZonesToFirebase();
    }
}

/**
 * Saves zones to Firebase Firestore 'zones' collection with error handling
 */
async function saveZonesToFirebase() {
    if (!db) {
        firebaseSyncStatus = 'unavailable';
        return;
    }

    try {
        firebaseSyncStatus = 'syncing';
        updateFirebaseSyncStatus();

        // Clear existing zones in Firestore
        const snapshot = await db.collection('zones').get();
        for (const doc of snapshot.docs) {
            await db.collection('zones').doc(doc.id).delete();
        }

        // Add updated zones to Firestore
        for (const zone of userDefinedZones) {
            await db.collection('zones').doc(zone.name).set({
                name: zone.name,
                latitude: zone.latitude,
                longitude: zone.longitude,
                radius: zone.radius,
                createdAt: new Date().toISOString()
            });
        }

        firebaseSyncStatus = 'connected';
        console.log("✅ Zones successfully synced to Firebase");
    } catch (error) {
        firebaseSyncStatus = 'error';
        console.error("❌ Error syncing zones to Firebase:", error.message);
    } finally {
        updateFirebaseSyncStatus();
    }
}

/**
 * Saves crowd data to localStorage as backup
 */
function saveCrowdDataToLocalStorage() {
    localStorage.setItem('crowdData', JSON.stringify(zonesData));
    console.log("✅ Crowd data saved to localStorage");
}

/**
 * Loads crowd data from localStorage
 */
function loadCrowdDataFromLocalStorage() {
    const saved = localStorage.getItem('crowdData');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            console.log("✅ Crowd data loaded from localStorage:", data);
            return data;
        } catch (error) {
            console.error("Error loading crowd data from localStorage:", error);
            return [];
        }
    }
    return [];
}

/**
 * Initializes crowd data with default values
 */
function initializeCrowdData() {
    // Create crowd data for all user-defined zones if they don't exist
    userDefinedZones.forEach(zone => {
        const exists = zonesData.find(z => z.zone_name === zone.name);
        if (!exists) {
            const randomDensity = Math.floor(Math.random() * 51) + 30;
            const densityLevel = randomDensity <= 40 ? 'Low' : randomDensity <= 70 ? 'Medium' : 'High';
            zonesData.push({
                zone_name: zone.name,
                density: randomDensity,
                alert: densityLevel
            });
        }
    });
    saveCrowdDataToLocalStorage();
    console.log("✅ Crowd data initialized");
}

/**
 * Loads zones from Firebase Firestore 'zones' collection
 */
function loadZonesFromFirebase() {
    if (!db) return Promise.resolve([]);

    return new Promise((resolve) => {
        db.collection('zones').get()
            .then(snapshot => {
                const zones = [];
                snapshot.forEach(doc => {
                    zones.push(doc.data());
                });
                if (zones.length > 0) {
                    console.log("✅ Zones loaded from Firebase:", zones);
                }
                resolve(zones);
            })
            .catch(error => {
                // Silently fail - app uses localStorage as backup
                resolve([]);
            });
    });
}

/**
 * Sets up zone configuration modal
 */
function setupZoneConfigModal() {
    const configBtn = document.getElementById('configZonesBtn');
    const modal = document.getElementById('zoneConfigModal');
    const closeBtn = document.getElementById('closeConfigBtn');
    const addZoneBtn = document.getElementById('addZoneBtn');
    const saveConfigBtn = document.getElementById('saveConfigBtn');
    const resetZonesBtn = document.getElementById('resetZonesBtn');
    const enableMapSelectBtn = document.getElementById('enableMapSelectBtn');
    const cancelMapSelectBtn = document.getElementById('cancelMapSelectBtn');

    configBtn.addEventListener('click', openZoneConfigModal);
    closeBtn.addEventListener('click', closeZoneConfigModal);
    addZoneBtn.addEventListener('click', addNewZone);
    saveConfigBtn.addEventListener('click', closeZoneConfigModal);
    resetZonesBtn.addEventListener('click', resetZonesToDefault);
    enableMapSelectBtn.addEventListener('click', toggleMapSelectMode);
    cancelMapSelectBtn.addEventListener('click', disableMapSelectMode);

    // Close modal when clicking outside
    modal.addEventListener('click', function (event) {
        if (event.target === modal) {
            closeZoneConfigModal();
        }
    });
}

/**
 * Opens zone configuration modal
 */
function openZoneConfigModal() {
    const modal = document.getElementById('zoneConfigModal');
    modal.classList.add('active');
    renderZonesList();

    // Refresh map size after modal layout is applied (CSS handles positioning)
    setTimeout(() => {
        if (mapInstance) {
            mapInstance.invalidateSize();
            // Force redraw of zone boundaries
            addZoneBoundaries();
        }
    }, 150);

    // Clear input fields
    document.getElementById('zoneName').value = '';
    document.getElementById('zoneLatitude').value = '';
    document.getElementById('zoneLongitude').value = '';
    document.getElementById('zoneRadius').value = '50';

    // Disable map select mode if it was active
    disableMapSelectMode();
}

/**
 * Closes zone configuration modal
 */
function closeZoneConfigModal() {
    const modal = document.getElementById('zoneConfigModal');
    modal.classList.remove('active');

    // Refresh map size after modal layout is removed (CSS handles positioning)
    setTimeout(() => {
        if (mapInstance) {
            mapInstance.invalidateSize();
            // Redraw zone boundaries and markers
            addZoneBoundaries();
            updateMapMarkers();
        }
    }, 150);

    disableMapSelectMode();
}

/**
 * Toggles map selection mode
 */
function toggleMapSelectMode() {
    if (isMapSelectMode) {
        disableMapSelectMode();
    } else {
        enableMapSelectMode();
    }
}

/**
 * Enables map selection mode
 */
function enableMapSelectMode() {
    if (!mapInstance) {
        alert('Map is not initialized yet. Please wait a moment and try again.');
        return;
    }

    // Remove any previous click handlers first
    if (mapInstance) {
        mapInstance.off('click', handleMapClickForZone);
    }

    isMapSelectMode = true;

    // Get modal elements
    const modal = document.getElementById('zoneConfigModal');
    const modalContent = document.querySelector('.modal-content');
    const modalBody = document.querySelector('.modal-body');
    const modalHeader = document.querySelector('.modal-header');
    const modalFooter = document.querySelector('.modal-footer');
    const mapContainer = document.getElementById('crowdMap');

    // Hide modal content but keep modal open
    modalBody.style.display = 'none';
    modalHeader.style.display = 'none';
    modalFooter.style.display = 'none';

    // Make modal-content transparent and take full screen
    modalContent.style.background = 'transparent';
    modalContent.style.boxShadow = 'none';
    modalContent.style.width = '100%';
    modalContent.style.height = '100%';
    modalContent.style.left = '0';
    modalContent.style.top = '0';
    modalContent.style.zIndex = '999';

    // Show status indicator
    const mapSelectStatus = document.getElementById('mapSelectStatus');
    mapSelectStatus.style.display = 'flex';
    mapSelectStatus.style.zIndex = '2000';

    // Change button style
    const enableBtn = document.getElementById('enableMapSelectBtn');
    enableBtn.style.display = 'none';

    // Make map fully interactive and large
    mapContainer.style.position = 'fixed';
    mapContainer.style.top = '0';
    mapContainer.style.left = '0';
    mapContainer.style.width = '100vw';
    mapContainer.style.height = '100vh';
    mapContainer.style.zIndex = '1000';
    mapContainer.style.cursor = 'crosshair';
    mapContainer.style.border = '3px solid #3498db';
    mapContainer.style.boxShadow = '0 0 20px rgba(52, 152, 219, 0.5)';

    // Ensure leaflet container is fully interactive
    const leafletContainer = document.querySelector('.leaflet-container');
    if (leafletContainer) {
        leafletContainer.style.pointerEvents = 'auto';
    }

    // Refresh map display
    setTimeout(() => {
        if (mapInstance) {
            mapInstance.invalidateSize();
            // Focus on map by simulating click
            mapContainer.focus();
        }
    }, 100);

    // Add click handler to map with proper event binding
    try {
        mapInstance.on('click', handleMapClickForZone);
        console.log("🗺️ Map selection mode enabled - Click on the map to select location");
    } catch (error) {
        console.error("❌ Error enabling map click handler:", error);
        alert('Error activating map selection. Please try again.');
        disableMapSelectMode();
        return;
    }
}

/**
 * Disables map selection mode
 */
function disableMapSelectMode() {
    if (!isMapSelectMode) return;

    isMapSelectMode = false;

    // Get modal elements
    const modal = document.getElementById('zoneConfigModal');
    const modalContent = document.querySelector('.modal-content');
    const modalBody = document.querySelector('.modal-body');
    const modalHeader = document.querySelector('.modal-header');
    const modalFooter = document.querySelector('.modal-footer');
    const mapContainer = document.getElementById('crowdMap');

    // Restore modal content display
    modalBody.style.display = 'block';
    modalHeader.style.display = 'flex';
    modalFooter.style.display = 'flex';

    // Restore modal-content styles
    modalContent.style.background = 'white';
    modalContent.style.boxShadow = '2px 0 20px rgba(0, 0, 0, 0.2)';
    modalContent.style.width = '420px';
    modalContent.style.height = '100vh';
    modalContent.style.left = '0';
    modalContent.style.top = '0';
    modalContent.style.zIndex = '1001';

    // Hide status indicator
    const mapSelectStatus = document.getElementById('mapSelectStatus');
    mapSelectStatus.style.display = 'none';

    // Change button style
    const enableBtn = document.getElementById('enableMapSelectBtn');
    enableBtn.style.display = 'block';

    // Restore map to normal
    mapContainer.style.position = 'relative';
    mapContainer.style.top = 'auto';
    mapContainer.style.left = 'auto';
    mapContainer.style.width = '100%';
    mapContainer.style.height = 'auto';
    mapContainer.style.zIndex = 'auto';
    mapContainer.style.cursor = 'grab';
    mapContainer.style.border = 'none';
    mapContainer.style.boxShadow = 'none';

    // Remove click event from map
    if (mapInstance) {
        mapInstance.off('click', handleMapClickForZone);
        mapInstance.invalidateSize();
    }

    // Remove temporary marker
    if (tempMapMarker) {
        mapInstance.removeLayer(tempMapMarker);
        tempMapMarker = null;
    }

    console.log("🗺️ Map selection mode disabled");
}

/**
 * Handles map click for zone selection
 */
function handleMapClickForZone(event) {
    if (!isMapSelectMode) return;

    const latitude = event.latlng.lat;
    const longitude = event.latlng.lng;

    // Update form fields
    document.getElementById('zoneLatitude').value = latitude.toFixed(5);
    document.getElementById('zoneLongitude').value = longitude.toFixed(5);

    // Remove old temporary marker
    if (tempMapMarker) {
        mapInstance.removeLayer(tempMapMarker);
    }

    // Add temporary marker at selected location
    const tempIcon = L.divIcon({
        className: 'temp-marker',
        html: `<div style="
            background: #3498db;
            width: 35px;
            height: 35px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 18px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.4);
            border: 3px solid white;
            animation: bounce 0.5s ease;
        ">📍</div>`,
        iconSize: [35, 35],
        iconAnchor: [17, 35]
    });

    tempMapMarker = L.marker([latitude, longitude], { icon: tempIcon })
        .addTo(mapInstance)
        .bindPopup(`<strong>Selected Location</strong><br>Lat: ${latitude.toFixed(5)}<br>Lon: ${longitude.toFixed(5)}`);

    tempMapMarker.openPopup();

    console.log(`✅ Location selected: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
}

/**
 * Adds a new zone
 */
function addNewZone() {
    const name = document.getElementById('zoneName').value.trim();
    const latitude = parseFloat(document.getElementById('zoneLatitude').value);
    const longitude = parseFloat(document.getElementById('zoneLongitude').value);
    const radius = parseFloat(document.getElementById('zoneRadius').value);

    // Validation
    if (!name) {
        alert('❌ Please enter a zone name');
        return;
    }

    if (isNaN(latitude) || isNaN(longitude)) {
        alert('❌ Please enter valid coordinates');
        return;
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        alert('❌ Invalid coordinates. Latitude: -90 to 90, Longitude: -180 to 180');
        return;
    }

    if (isNaN(radius) || radius < 10 || radius > 500) {
        alert('❌ Radius must be between 10 and 500 meters');
        return;
    }

    // Check for duplicate names
    if (userDefinedZones.some(z => z.name.toLowerCase() === name.toLowerCase())) {
        alert('❌ Zone name already exists');
        return;
    }

    // Add zone
    const newZone = { name, latitude, longitude, radius };
    userDefinedZones.push(newZone);
    console.log("✅ Zone added to array:", newZone);
    saveUserDefinedZones();

    // Generate random crowd density for new zone (30-80%)
    const randomDensity = Math.floor(Math.random() * 51) + 30; // 30-80%
    const densityLevel = randomDensity <= 40 ? 'Low' : randomDensity <= 70 ? 'Medium' : 'High';

    // Also save directly to Firebase with proper error handling
    if (db) {
        (async () => {
            try {
                // Save zone configuration
                await db.collection('zones').doc(name).set({
                    name: name,
                    latitude: latitude,
                    longitude: longitude,
                    radius: radius,
                    createdAt: new Date().toISOString()
                });
                console.log("✅ Zone configuration saved to Firebase:", name);

                // Add crowd data for new zone with random density
                await db.collection('crowd_data').doc(name).set({
                    zone_name: name,
                    density: randomDensity,
                    alert: densityLevel,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
                console.log(`✅ Crowd data saved to Firebase: ${name} (${randomDensity}%, ${densityLevel})`);
                firebaseSyncStatus = 'connected';
                updateFirebaseSyncStatus();
            } catch (error) {
                console.error("❌ Firebase error adding zone:", error.message);
                firebaseSyncStatus = 'error';
                updateFirebaseSyncStatus();
            }
        })();
    }

    // Add to zonesData immediately so it appears in monitoring
    zonesData.push({
        zone_name: name,
        density: randomDensity,
        alert: densityLevel
    });
    console.log("✅ Zone added to monitoring:", name, randomDensity + "%");

    // Save to localStorage as backup (CRITICAL for persistence)
    saveCrowdDataToLocalStorage();
    console.log("✅ Zone saved to localStorage backup");

    // Refresh map immediately
    if (mapInstance) {
        console.log("📍 Redrawing zone boundaries...");
        addZoneBoundaries();
        console.log("📍 Current zones on map:", Object.keys(zoneCircles));
    }

    // Update dashboard to show new zone in cards and chart
    updateDashboard();

    // Clear inputs
    document.getElementById('zoneName').value = '';
    document.getElementById('zoneLatitude').value = '';
    document.getElementById('zoneLongitude').value = '';
    document.getElementById('zoneRadius').value = '50';

    renderZonesList();
    console.log("✅ Zone fully added and displayed:", newZone);
}

/**
 * Deletes a zone
 */
function deleteZone(zoneName) {
    if (!confirm(`Delete zone "${zoneName}"?`)) {
        return;
    }

    userDefinedZones = userDefinedZones.filter(z => z.name !== zoneName);
    saveUserDefinedZones();

    // Also remove from zonesData and save to localStorage
    zonesData = zonesData.filter(z => z.zone_name !== zoneName);
    saveCrowdDataToLocalStorage();

    // Delete from Firebase with error handling
    if (db) {
        (async () => {
            try {
                // Delete zone configuration
                await db.collection('zones').doc(zoneName).delete();
                console.log("✅ Zone configuration deleted from Firebase:", zoneName);

                // Delete associated crowd data
                await db.collection('crowd_data').doc(zoneName).delete();
                console.log("✅ Crowd data deleted from Firebase:", zoneName);
                firebaseSyncStatus = 'connected';
            } catch (error) {
                console.error("❌ Firebase error deleting zone:", error.message);
                firebaseSyncStatus = 'error';
            } finally {
                updateFirebaseSyncStatus();
            }
        })();
    }

    addZoneBoundaries();
    renderZonesList();
    updateMapMarkers();
    updateDashboard();
    console.log("✅ Zone deleted:", zoneName);
}

/**
 * Renders zones list in modal
 */
function renderZonesList() {
    const zonesList = document.getElementById('zonesList');

    if (userDefinedZones.length === 0) {
        zonesList.innerHTML = '<p class="no-zones">No zones configured yet. Add a zone above.</p>';
        return;
    }

    zonesList.innerHTML = userDefinedZones.map(zone => `
        <div class="zone-item">
            <div class="zone-item-info">
                <div class="zone-item-name">${zone.name}</div>
                <div class="zone-item-coords">
                    📍 Lat: ${zone.latitude.toFixed(5)}, Lon: ${zone.longitude.toFixed(5)} | 
                    🔵 Radius: ${zone.radius}m
                </div>
            </div>
            <div class="zone-item-actions">
                <button class="btn-delete" onclick="deleteZone('${zone.name}')">🗑️ Delete</button>
            </div>
        </div>
    `).join('');
}

/**
 * Resets zones to default configuration
 */
function resetZonesToDefault() {
    if (!confirm('Reset all zones to default configuration?')) {
        return;
    }

    userDefinedZones = [...defaultZones];
    saveUserDefinedZones();

    // Reset zonesData to defaults with random densities
    zonesData = [];
    defaultZones.forEach(zone => {
        const randomDensity = Math.floor(Math.random() * 51) + 30;
        const densityLevel = randomDensity <= 40 ? 'Low' : randomDensity <= 70 ? 'Medium' : 'High';
        zonesData.push({
            zone_name: zone.name,
            density: randomDensity,
            alert: densityLevel
        });
    });
    saveCrowdDataToLocalStorage();

    // Also update Firebase with default zones and crowd data
    if (db) {
        // Save default zones to Firebase
        defaultZones.forEach(zone => {
            db.collection('zones').doc(zone.name).set({
                name: zone.name,
                latitude: zone.latitude,
                longitude: zone.longitude,
                radius: zone.radius,
                createdAt: new Date().toISOString()
            }).catch(() => {
                // Silently handle - app uses localStorage as backup
            });

            // Generate random crowd data for default zones
            const randomDensity = Math.floor(Math.random() * 51) + 30; // 30-80%
            const densityLevel = randomDensity <= 40 ? 'Low' : randomDensity <= 70 ? 'Medium' : 'High';

            db.collection('crowd_data').doc(zone.name).set({
                zone_name: zone.name,
                density: randomDensity,
                alert: densityLevel,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }).catch(() => {
                // Silently handle - app uses localStorage as backup
            });
        });

        console.log("✅ Default zones and crowd data synced to Firebase (or using localStorage)");
    }

    renderZonesList();
    refreshMapWithZones();
    updateMapMarkers();
    updateDashboard();
    console.log("✅ Zones reset to default");
}

// ============================================
// FIREBASE SYNC STATUS
// ============================================
/**
 * Updates Firebase sync status display
 */
function updateFirebaseSyncStatus() {
    const statusEl = document.getElementById('firebaseSyncStatus');
    if (!statusEl) return;

    let statusText = '';
    let statusColor = '';

    switch (firebaseSyncStatus) {
        case 'connected':
            statusText = '🟢 Firebase';
            statusColor = '#27ae60';
            break;
        case 'syncing':
            statusText = '🟡 Syncing...';
            statusColor = '#f39c12';
            break;
        case 'error':
            statusText = '🔴 Firebase Error';
            statusColor = '#e74c3c';
            break;
        case 'unavailable':
            statusText = '⚪ Using Local Storage';
            statusColor = '#95a5a6';
            break;
        default:
            statusText = '⚪ Disconnected';
            statusColor = '#95a5a6';
    }

    statusEl.textContent = statusText;
    statusEl.style.color = statusColor;
}

// ============================================
// LIVE CLOCK FUNCTION
// ============================================
/**
 * Updates the live clock display every second with current time
 */
function initializeLiveClock() {
    function updateClock() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        document.getElementById('clockDisplay').textContent = `${hours}:${minutes}:${seconds}`;
    }

    updateClock(); // Initial call
    setInterval(updateClock, 1000); // Update every second
}

// ============================================
// LOAD CROWD DATA FROM FIRESTORE
// ============================================
/**
 * Fetches real-time crowd data from Firestore collection 'crowd_data'
 * Falls back to localStorage if Firebase is unavailable
 */
function loadCrowdData() {
    if (db) {
        // Set up real-time listener for Firestore collection
        console.log("📡 Connecting to Firestore...");
        try {
            db.collection('crowd_data').onSnapshot(
                snapshot => {
                    if (snapshot.empty) {
                        console.log("⚠️ No documents in crowd_data collection. Trying localStorage...");
                        const localData = loadCrowdDataFromLocalStorage();
                        if (localData.length > 0) {
                            zonesData = localData;
                            firebaseSyncStatus = 'connected';
                        } else {
                            // Initialize with zones from userDefinedZones or defaults
                            zonesData = [];
                            userDefinedZones.forEach(zone => {
                                const randomDensity = Math.floor(Math.random() * 51) + 30;
                                const densityLevel = randomDensity <= 40 ? 'Low' : randomDensity <= 70 ? 'Medium' : 'High';
                                zonesData.push({
                                    zone_name: zone.name,
                                    density: randomDensity,
                                    alert: densityLevel
                                });
                            });
                            firebaseSyncStatus = 'unavailable';
                        }
                        updateDashboard();
                        updateFirebaseSyncStatus();
                        return;
                    }

                    zonesData = [];
                    snapshot.forEach(doc => {
                        zonesData.push({
                            id: doc.id,
                            zone_name: doc.data().zone_name || "Unknown",
                            density: doc.data().density || 0,
                            alert: doc.data().alert || "Low"
                        });
                    });

                    // Also add zones from userDefinedZones that aren't in Firebase yet
                    userDefinedZones.forEach(zone => {
                        const exists = zonesData.find(z => z.zone_name === zone.name);
                        if (!exists) {
                            // Generate default crowd data for zone not yet in Firebase
                            const randomDensity = Math.floor(Math.random() * 51) + 30;
                            const densityLevel = randomDensity <= 40 ? 'Low' : randomDensity <= 70 ? 'Medium' : 'High';
                            zonesData.push({
                                zone_name: zone.name,
                                density: randomDensity,
                                alert: densityLevel,
                                isLocal: true  // Mark as not yet synced to Firebase
                            });
                            console.log("⚠️ Zone not in Firebase yet, using local data:", zone.name);
                        }
                    });

                    console.log("✅ Data loaded from Firestore:", zonesData);
                    saveCrowdDataToLocalStorage(); // Backup to localStorage
                    firebaseSyncStatus = 'connected';
                    updateDashboard();
                    updateLastUpdateTime();
                    updateFirebaseSyncStatus();
                },
                error => {
                    // Firebase error - use localStorage as backup
                    console.error("❌ Firebase error:", error.message);
                    firebaseSyncStatus = 'error';
                    const localData = loadCrowdDataFromLocalStorage();
                    zonesData = [];

                    if (localData.length > 0) {
                        zonesData = localData;
                        console.log("✅ Using localStorage backup");
                    } else {
                        // Use zones from userDefinedZones with default crowd data
                        userDefinedZones.forEach(zone => {
                            const randomDensity = Math.floor(Math.random() * 51) + 30;
                            const densityLevel = randomDensity <= 40 ? 'Low' : randomDensity <= 70 ? 'Medium' : 'High';
                            zonesData.push({
                                zone_name: zone.name,
                                density: randomDensity,
                                alert: densityLevel
                            });
                        });
                        console.log("⚠️ Using userDefinedZones with default data");
                    }
                    updateDashboard();
                    updateFirebaseSyncStatus();
                }
            );
        } catch (error) {
            // Error connecting - try localStorage
            console.error("❌ Error connecting to Firebase:", error.message);
            firebaseSyncStatus = 'error';
            const localData = loadCrowdDataFromLocalStorage();
            zonesData = [];

            if (localData.length > 0) {
                zonesData = localData;
            } else {
                // Use zones from userDefinedZones with default crowd data
                userDefinedZones.forEach(zone => {
                    const randomDensity = Math.floor(Math.random() * 51) + 30;
                    const densityLevel = randomDensity <= 40 ? 'Low' : randomDensity <= 70 ? 'Medium' : 'High';
                    zonesData.push({
                        zone_name: zone.name,
                        density: randomDensity,
                        alert: densityLevel
                    });
                });
            }
            updateDashboard();
            updateFirebaseSyncStatus();
        }
    } else {
        // Firebase not configured - use localStorage or mock data
        console.log("📦 Firebase not connected. Trying localStorage...");
        firebaseSyncStatus = 'unavailable';
        const localData = loadCrowdDataFromLocalStorage();
        if (localData.length > 0) {
            zonesData = localData;
            console.log("✅ Loaded from localStorage");
        } else {
            console.log("📦 Using mock data for demonstration");
            zonesData = mockZonesData;
        }
        updateDashboard();
        updateFirebaseSyncStatus();
    }
}

// ============================================
// UPDATE DASHBOARD
// ============================================
/**
 * Updates all dashboard components with latest crowd data
 */
function updateDashboard() {
    if (zonesData.length === 0) {
        return;
    }

    updateZoneCards();
    updateChart();
    updateSystemStatus();
    updateEmergencyAlert();
    updateMapMarkers();
    updateStatistics();
}

// ============================================
// UPDATE ZONE CARDS
// ============================================
/**
 * Renders zone monitoring cards with real-time data
 * Color codes based on density levels
 */
function updateZoneCards() {
    const zonesContainer = document.getElementById('zonesContainer');
    zonesContainer.innerHTML = ''; // Clear existing cards

    zonesData.forEach(zone => {
        // Determine alert level based on density
        const alertLevel = getDensityLevel(zone.density);

        // Create zone card element
        const card = document.createElement('div');
        card.className = `zone-card ${alertLevel}`;

        // Calculate percentage for visual representation
        const densityPercent = zone.density;

        card.innerHTML = `
            <div class="zone-name">${zone.zone_name}</div>
            <div class="zone-info">
                <div class="zone-stat">
                    <span class="stat-name">Crowd Density</span>
                    <span class="stat-value">${densityPercent}%</span>
                </div>
                <div class="density-bar">
                    <div class="density-fill ${alertLevel}" style="width: ${densityPercent}%"></div>
                </div>
                <div class="zone-stat">
                    <span class="stat-name">Status</span>
                    <span class="alert-status ${alertLevel}">${zone.alert}</span>
                </div>
            </div>
        `;

        zonesContainer.appendChild(card);
    });
}

// ============================================
// GET DENSITY LEVEL
// ============================================
/**
 * Determines density level (low/medium/high) based on percentage
 * @param {number} density - Density percentage (0-100)
 * @returns {string} - Level: 'low', 'medium', or 'high'
 */
function getDensityLevel(density) {
    if (density <= 40) return 'low';
    if (density <= 70) return 'medium';
    return 'high';
}

// ============================================
// INITIALIZE & UPDATE CHART
// ============================================
/**
 * Initializes Chart.js bar chart showing density distribution
 */
function initializeChart() {
    const ctx = document.getElementById('densityChart').getContext('2d');
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['High Zones', 'Medium Zones', 'Low Zones'],
            datasets: [{
                label: 'Number of Zones',
                data: [0, 0, 0],
                backgroundColor: [
                    'rgba(231, 76, 60, 0.8)',      // Red for High
                    'rgba(243, 156, 18, 0.8)',     // Orange for Medium
                    'rgba(39, 174, 96, 0.8)'       // Green for Low
                ],
                borderColor: [
                    'rgb(231, 76, 60)',
                    'rgb(243, 156, 18)',
                    'rgb(39, 174, 96)'
                ],
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: { size: 12, weight: 'bold' },
                        padding: 15
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 10,
                    title: { display: true, text: 'Count' },
                    ticks: { stepSize: 1 }
                }
            }
        }
    });
}

/**
 * Updates the bar chart with current density distribution
 */
function updateChart() {
    if (!chartInstance || zonesData.length === 0) return;

    // Count zones by density level
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;

    zonesData.forEach(zone => {
        const level = getDensityLevel(zone.density);
        if (level === 'high') highCount++;
        if (level === 'medium') mediumCount++;
        if (level === 'low') lowCount++;
    });

    // Update chart data
    chartInstance.data.datasets[0].data = [highCount, mediumCount, lowCount];
    chartInstance.update();
}

// ============================================
// SYSTEM STATUS MANAGEMENT
// ============================================
/**
 * Updates system status based on zone density levels
 * Safe if most zones are low/medium, Critical if multiple zones are high
 */
function updateSystemStatus() {
    const statusBox = document.getElementById('statusBox');
    const statusIndicator = document.getElementById('statusIndicator');
    const statusValue = document.getElementById('statusValue');

    // Count high density zones
    const highDensityZones = zonesData.filter(z => getDensityLevel(z.density) === 'high').length;

    // Determine status
    if (highDensityZones >= 2) {
        statusIndicator.className = 'status-indicator critical';
        statusValue.textContent = 'Critical 🚨';
    } else {
        statusIndicator.className = 'status-indicator safe';
        statusValue.textContent = 'Safe ✅';
    }
}

// ============================================
// EMERGENCY ALERT LOGIC
// ============================================
/**
 * Shows/hides emergency alert based on multiple high-density zones
 * Triggers when 2 or more zones are at high density
 */
function updateEmergencyAlert() {
    const emergencyAlert = document.getElementById('emergencyAlert');
    const highDensityZones = zonesData.filter(z => getDensityLevel(z.density) === 'high');

    if (highDensityZones.length >= 2) {
        emergencyAlert.style.display = 'flex';
        const zoneNames = highDensityZones.map(z => z.zone_name).join(', ');
        document.getElementById('alertText').textContent =
            `🚨 Emergency Alert: ${zoneNames} overcrowded! Multiple zones at high density!`;
    } else {
        emergencyAlert.style.display = 'none';
    }
}

// ============================================
// INITIALIZE MAP
// ============================================
/**
 * Initializes Leaflet.js map centered on VNR Vignana Jyothi College
 * Draws user-defined zones with 50-meter radius circles
 */
function initializeMap() {
    try {
        // VNR Vignana Jyothi College, Hyderabad - Correct coordinates
        const collegeCenter = [17.53934155200406, 78.38597090355954];

        // Initialize map centered on college
        mapInstance = L.map('crowdMap').setView(collegeCenter, 17);

        // Add OpenStreetMap tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(mapInstance);

        // College boundary coordinates (approximate polygon around campus)
        const collegeBoundary = [
            [17.54050, 78.38450],  // Top-left
            [17.54050, 78.38750],  // Top-right
            [17.53800, 78.38750],  // Bottom-right
            [17.53800, 78.38450],  // Bottom-left
            [17.54050, 78.38450]   // Close polygon
        ];

        // Draw red dashed boundary around college
        L.polyline(collegeBoundary, {
            color: '#e74c3c',           // Red color
            weight: 3,                  // Line thickness
            opacity: 0.8,               // Transparency
            dashArray: '10, 5',         // Dashed pattern (10px dash, 5px gap)
            lineCap: 'round',
            lineJoin: 'round'
        }).addTo(mapInstance);

        // Add college boundary label
        const boundaryCenter = [17.53925, 78.38600];
        L.marker(boundaryCenter, {
            icon: L.divIcon({
                className: 'college-label',
                html: `<div style="background: rgba(231, 76, 60, 0.9); color: white; padding: 8px 12px; border-radius: 6px; font-weight: bold; font-size: 13px; box-shadow: 0 2px 8px rgba(0,0,0,0.3); white-space: nowrap; text-align: center;">🏫 VNR Vignana Jyothi College</div>`,
                iconSize: [200, 35],
                iconAnchor: [100, 35]
            })
        }).addTo(mapInstance);

        // Add user-defined zones with 50-meter radius circles
        addZoneBoundaries();

        console.log("✅ Map initialized - VNR Vignana Jyothi College campus");
        console.log("✅ College boundary marked with red dashed line");
        console.log("✅ User-defined zones displayed");
    } catch (error) {
        console.error("Error initializing map:", error);
    }
}

/**
 * Adds visual boundaries for each user-defined zone with 50-meter radius circles
 */
function addZoneBoundaries() {
    if (!mapInstance) return;

    // Clear existing zone circles
    Object.values(zoneCircles).forEach(circle => {
        mapInstance.removeLayer(circle);
    });
    zoneCircles = {};

    // Color palette for zones
    const colors = ['#3498db', '#f39c12', '#27ae60', '#e74c3c', '#9b59b6', '#1abc9c'];

    userDefinedZones.forEach((zone, index) => {
        const color = colors[index % colors.length];

        // Draw 50-meter radius circle
        const circle = L.circle([zone.latitude, zone.longitude], {
            radius: zone.radius,
            color: color,
            weight: 2,
            opacity: 0.8,
            fillColor: color,
            fillOpacity: 0.1,
            dashArray: '5, 3'
        }).addTo(mapInstance);

        zoneCircles[zone.name] = circle;

        // Add zone label
        L.marker([zone.latitude, zone.longitude], {
            icon: L.divIcon({
                className: 'zone-label',
                html: `<div style="background: ${color}; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${zone.name}</div>`,
                iconSize: [70, 24],
                iconAnchor: [35, 24]
            })
        }).addTo(mapInstance);

        console.log(`✅ Zone "${zone.name}" added: ${zone.radius}m radius circle`);
    });
}

/**
 * Refreshes map with updated zones
 */
function refreshMapWithZones() {
    if (mapInstance) {
        addZoneBoundaries();
    }
}

// ============================================
// UPDATE MAP MARKERS
// ============================================
/**
 * Updates map markers based on zone locations
 * Clicking on zone circles will show density information
 */
function updateMapMarkers() {
    if (!mapInstance) return;

    // Remove old markers
    Object.values(zoneMarkers).forEach(marker => {
        mapInstance.removeLayer(marker);
    });
    zoneMarkers = {};

    // Add click handlers to zone circles to show density
    zonesData.forEach(zone => {
        const userZone = userDefinedZones.find(z => z.name === zone.zone_name);
        if (!userZone || !zoneCircles[zone.zone_name]) return;

        const circle = zoneCircles[zone.zone_name];

        // Add click event to show density popup
        circle.bindPopup(`
            <strong>${zone.zone_name}</strong><br>
            Density: ${zone.density}%<br>
            Status: ${zone.alert}<br>
            📍 Lat: ${userZone.latitude.toFixed(5)}, Lon: ${userZone.longitude.toFixed(5)}
        `);
    });
}

// ============================================
// UPDATE STATISTICS
// ============================================
/**
 * Updates system statistics section
 * Shows total zones, average density, and last update time
 */
function updateStatistics() {
    // Update total zones count
    document.getElementById('totalZones').textContent = zonesData.length;

    // Calculate average density
    if (zonesData.length > 0) {
        const avgDensity = Math.round(
            zonesData.reduce((sum, zone) => sum + zone.density, 0) / zonesData.length
        );
        document.getElementById('avgDensity').textContent = avgDensity + '%';
    } else {
        document.getElementById('avgDensity').textContent = '0%';
    }
}

// ============================================
// UPDATE LAST UPDATE TIME
// ============================================
/**
 * Updates the "Last Update" timestamp in statistics
 */
function updateLastUpdateTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('lastUpdate').textContent = `${hours}:${minutes}`;
}

// ============================================
// SAMPLE DATA INSERTION (FOR TESTING)
// ============================================
/**
 * Helper function to insert sample data into Firestore for testing
 * Uncomment and run once in console to populate database
 */
function insertSampleData() {
    if (!db) {
        console.error("Firebase not initialized");
        return;
    }

    const sampleData = [
        { zone_name: "Zone A", density: 35, alert: "Low" },
        { zone_name: "Zone B", density: 60, alert: "Medium" },
        { zone_name: "Zone C", density: 85, alert: "High" }
    ];

    sampleData.forEach(data => {
        db.collection('crowd_data').doc(data.zone_name).set(data)
            .then(() => console.log(`${data.zone_name} added successfully`))
            .catch(error => console.error("Error adding document:", error));
    });
}

// ============================================
// CONSOLE HELPERS
// ============================================
/**
 * Log current data to console for debugging
 */
function logCurrentData() {
    console.log("Current Zones Data:", zonesData);
    console.log("Available Zone Names:", zonesData.map(z => z.zone_name));
    console.log("Chart Data:", chartInstance?.data);
    console.log("Map Instance:", mapInstance);
}

/**
 * Show available zones for updating
 */
function showAvailableZones() {
    console.log("📍 Available zones for updating:");
    zonesData.forEach((zone, index) => {
        console.log(`  ${index + 1}. ${zone.zone_name} - Density: ${zone.density}%, Status: ${zone.alert}`);
    });
}

/**
 * Update density for a specific zone (for testing)
 * Usage: updateZoneDensity('VNR Main Gate', 90)
 */
function updateZoneDensity(zoneName, newDensity) {
    // Validate density
    if (newDensity < 0 || newDensity > 100) {
        console.warn("⚠️ Density must be between 0 and 100");
        return;
    }

    // Update local data first (guaranteed to work)
    const index = zonesData.findIndex(z => z.zone_name === zoneName);
    if (index !== -1) {
        zonesData[index].density = newDensity;
        zonesData[index].alert = getDensityLevel(newDensity).charAt(0).toUpperCase() +
            getDensityLevel(newDensity).slice(1);
        updateDashboard();
        console.log(`✅ ${zoneName} updated to ${newDensity}%`);
    } else {
        console.warn(`⚠️ Zone "${zoneName}" not found`);
        console.log("📍 Available zones:");
        showAvailableZones();
        return;
    }

    // Try to sync to Firebase (silently handle errors)
    if (db) {
        db.collection('crowd_data').doc(zoneName).update({
            density: newDensity,
            alert: getDensityLevel(newDensity).charAt(0).toUpperCase() +
                getDensityLevel(newDensity).slice(1),
            updatedAt: new Date().toISOString()
        }).then(() => {
            console.log(`✅ ${zoneName} synced to Firebase`);
        }).catch(() => {
            // Silently fail - local update already done
        });
    }
}

// ============================================
// RESPONSIVE ADJUSTMENTS
// ============================================
/**
 * Adjust dashboard on window resize
 */
window.addEventListener('resize', function () {
    if (chartInstance) {
        chartInstance.resize();
    }
    if (mapInstance) {
        mapInstance.invalidateSize();
    }
});

// ============================================
// ERROR HANDLING & LOGGING
// ============================================
window.addEventListener('error', function (event) {
    console.error('Global error:', event.error);
});

// Log when page loads
console.log("Smart Crowd Management System loaded successfully");
console.log("To view available zones, run: showAvailableZones()");
console.log("To update zone density, run: updateZoneDensity('Zone Name', 80)");
console.log("To view current data, run: logCurrentData()");
console.log("To insert test data, run: insertSampleData()");
