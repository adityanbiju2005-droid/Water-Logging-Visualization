// Water Logging Visualization - Now with Google Apps Script Integration

// Google Apps Script URL - REPLACE WITH YOUR ACTUAL URL
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/YOUR_SCRIPT_ID_HERE/exec';

// Initialize the map centered on India
const map = L.map('leaflet-map').setView([22.5937, 78.9629], 5);

// Add OpenStreetMap tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Global variables
let marker = null;
let reports = [];
const statusOptions = ['Submitted', 'Under Review', 'In Progress', 'Resolved', 'Closed'];

// Function to add markers and fit map bounds
function addMarkersForReports(reportsArray) {
    const markers = [];
    reportsArray.forEach(report => {
        const pinIcon = L.icon({
            iconUrl: report.severity === "High"
                ? "https://maps.google.com/mapfiles/ms/icons/red-dot.png"
                : report.severity === "Medium"
                ? "https://maps.google.com/mapfiles/ms/icons/orange-dot.png"
                : "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
            iconSize: [32, 32],
            iconAnchor: [16, 32],
            popupAnchor: [0, -28]
        });
        const m = L.marker([report.lat, report.lng], {icon: pinIcon})
            .addTo(map)
            .bindPopup(
                `<b>${report.city}, ${report.state}</b><br>
                 <b>Severity:</b> ${report.severity}<br>
                 <b>Description:</b> ${report.comments}`
            );
        markers.push(m);
    });
    if (markers.length > 0) {
        const group = L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.2));
    }
}

// Function to convert file to Base64 (for your Apps Script)
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            resolve({
                data: base64,
                type: file.type,
                name: file.name
            });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Load reports from external JSON file
fetch('waterlogging_cities.json')
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('Loaded reports:', data);
        reports = data.map(r => ({
            id: r.id,
            lat: r.lat,
            lng: r.lng,
            severity: r.severity,
            comments: r.description,
            photoURL: '',
            status: 'Submitted',
            timestamp: new Date().toLocaleString(),
            photoFile: null,
            city: r.city,
            state: r.state
        }));
        addMarkersForReports(reports);
        renderReportsList();
    })
    .catch(err => {
        console.error('Failed to load waterlogging_cities.json:', err);
        renderReportsList();
    });

// Map click event to select location for new report
map.on('click', function(e) {
    if (marker) map.removeLayer(marker);
    marker = L.marker(e.latlng).addTo(map);
    document.getElementById("location").value = `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;
});

// Form submission handler - Updated to work with your Apps Script
document.getElementById('waterlog-form').onsubmit = async function(e) {
    e.preventDefault();

    const name = document.getElementById('name').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const email = document.getElementById('email').value.trim();
    const loc = document.getElementById('location').value;
    const severity = document.getElementById('severity').value;
    const description = document.getElementById('description').value.trim();
    const photoInput = document.getElementById('photo');
    const photoFile = photoInput ? photoInput.files[0] : null;

    if (!loc) return alert('Please click on the map to pick a location.');
    if (!severity) return alert('Please select severity level.');
    if (!photoFile) return alert('Please attach a photo.');
    if (photoFile && photoFile.size > 25 * 1024 * 1024) {
        return alert('Image must be less than 25 MB.');
    }

    const [lat, lng] = loc.split(',').map(Number);

    try {
        // Convert image to Base64 for your Apps Script
        const imageBase64 = await fileToBase64(photoFile);

        // Prepare data for your Apps Script (exact format it expects)
        const formData = {
            name: name,
            email: email,
            number: phone,  // Your script expects 'number', not 'phone'
            location: loc,
            severity: severity,
            description: description,
            image: imageBase64
        };

        // Submit to your Google Apps Script
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });

        const result = await response.text();

        if (result === 'Success') {
            alert('Report submitted successfully!');

            // Add marker to map
            const pinIcon = L.icon({
                iconUrl: severity === "High"
                    ? "https://maps.google.com/mapfiles/ms/icons/red-dot.png"
                    : severity === "Medium"
                    ? "https://maps.google.com/mapfiles/ms/icons/orange-dot.png"
                    : "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
                iconSize: [32, 32],
                iconAnchor: [16, 32],
                popupAnchor: [0, -28]
            });
            L.marker([lat, lng], {icon: pinIcon})
                .addTo(map)
                .bindPopup(
                    `<b>Severity:</b> ${severity}<br>
                     <b>Description:</b> ${description}<br>
                     <b>Lat/Lon:</b> ${lat.toFixed(3)}, ${lng.toFixed(3)}`
                );

            const reportId = Date.now();
            const newReport = {
                id: reportId,
                lat, lng, severity, 
                comments: description, 
                photoURL: URL.createObjectURL(photoFile),
                status: 'Submitted',
                timestamp: new Date().toLocaleString(),
                photoFile: photoFile ? photoFile.name : null,
                city: '',
                state: ''
            };
            reports.push(newReport);
            renderReportsList();

            this.reset();
            if (marker) { 
                map.removeLayer(marker); 
                marker = null; 
            }
            document.getElementById('location').value = '';
        } else {
            alert('Error: ' + result);
        }
    } catch (error) {
        console.error('Submission error:', error);
        alert('Network error. Please try again.');
    }
};

// Render reports list with city/state and image preview
function renderReportsList() {
    const el = document.getElementById('reports-list');
    if (reports.length === 0) {
        el.innerHTML = `
            <div class="reports-header">
                <h3>📋 Submitted Reports</h3>
                <p class="no-reports">No reports submitted yet.</p>
            </div>
        `;
        return;
    }
    el.innerHTML = `
        <div class="reports-header">
            <h3>📋 Submitted Reports (${reports.length})</h3>
        </div>
        <div class="reports-container">
            ${reports.map(report => `
                <div class="report-card">
                    <div class="report-header">
                        <div class="report-id">#${report.id.toString().slice(-4)}</div>
                        <div class="status-section">
                            <select class="status-dropdown" onchange="updateReportStatus(${report.id}, this.value)">
                                ${statusOptions.map(status => 
                                    `<option value="${status}" ${report.status === status ? 'selected' : ''}>${status}</option>`
                                ).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="report-content">
                        <div class="report-details">
                            <div class="detail-row">
                                <span class="label">🏙 City:</span>
                                <span class="value">${report.city || '—'}</span>
                            </div>
                            <div class="detail-row">
                                <span class="label">📍 Location:</span>
                                <span class="value">${report.lat.toFixed(4)}, ${report.lng.toFixed(4)}</span>
                            </div>
                            <div class="detail-row">
                                <span class="label">⚠️ Severity:</span>
                                <span class="value severity-${report.severity.toLowerCase()}">${report.severity}</span>
                            </div>
                            <div class="detail-row">
                                <span class="label">💬 Comments:</span>
                                <span class="value">${report.comments || "—"}</span>
                            </div>
                            <div class="detail-row">
                                <span class="label">🕒 Submitted:</span>
                                <span class="value">${report.timestamp}</span>
                            </div>
                        </div>
                        ${report.photoURL ? `
                            <div class="image-preview">
                                <img src="${report.photoURL}" alt="Report image" onclick="openImageModal('${report.photoURL}')">
                                <div class="image-filename">${report.photoFile}</div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
        <!-- Image Modal -->
        <div id="image-modal" class="modal" onclick="closeImageModal()">
            <div class="modal-content">
                <span class="close" onclick="closeImageModal()">&times;</span>
                <img id="modal-image" src="" alt="Full size image">
            </div>
        </div>
    `;
}

// Update report status
function updateReportStatus(reportId, newStatus) {
    const report = reports.find(r => r.id === reportId);
    if (report) {
        report.status = newStatus;
    }
}

// Image modal open/close
function openImageModal(imageSrc) {
    const modal = document.getElementById('image-modal');
    const modalImg = document.getElementById('modal-image');
    modal.style.display = 'block';
    modalImg.src = imageSrc;
}

function closeImageModal() {
    document.getElementById('image-modal').style.display = 'none';
}
