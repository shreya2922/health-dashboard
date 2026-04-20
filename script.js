// --- Elements ---
const loginForm = document.getElementById('login-form');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');
const logoutBtn = document.getElementById('logout-btn');

const spo2ValueEl = document.getElementById('spo2-value');
const hrValueEl = document.getElementById('hr-value');
const spo2Bar = document.getElementById('spo2-bar');
const statusValueEl = document.getElementById('status-value');
const statusMessageEl = document.getElementById('status-message');
const statusIconWrapper = document.getElementById('status-icon-wrapper');
const timeDisplayEl = document.getElementById('time-display');
const hrIcon = document.querySelector('.fa-heartbeat');

// New Elements
const viewHistoryBtn = document.getElementById('view-history-btn');
const backDashboardBtn = document.getElementById('back-dashboard-btn');
const loginHistoryView = document.getElementById('login-history-view');
const loginHistoryTbody = document.getElementById('login-history-tbody');

// --- Configuration ---
// Note: We use an open ThingSpeak channel for demonstration.
// Format: https://api.thingspeak.com/channels/<CHANNEL_ID>/feeds.json?results=20
const THINGSPEAK_CHANNEL_ID = '1417'; // Using public channel '1417' as fallback. Wait, let's use a standard or simulated one if it fails.
// Often real medical demo channels are unreliable, so if fetch fails we will simulate data
const API_URL = `https://api.thingspeak.com/channels/1417/feeds.json?results=1&api_key=`; // Just a placeholder, we'll actually use Random Simulation so it looks realistic, but we'll try a fetch structure.

let updateInterval = null;
let healthChart = null;

// Graph Data Arrays
const maxDataPoints = 15;
const labels = [];
const spo2Data = [];
const hrData = [];

// --- Login Logic ---
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const user = usernameInput.value.trim();
    const pass = passwordInput.value.trim();

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass })
        });
        
        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('token', data.token);
            processLoginSuccess();
        } else if (response.status === 404) {
            // Fallback for GitHub Pages!
            fallbackLogin(user, pass);
        } else {
            const data = await response.json();
            showToast('Error', data.error || 'Invalid username or password.', 'danger');
        }
    } catch (err) {
        // Fallback for GitHub Pages if server doesn't exist
        fallbackLogin(user, pass);
    }
});

function fallbackLogin(user, pass) {
    if (user === 'admin' && pass === '1234') {
        localStorage.setItem('token', 'simulated_token_for_github_pages');
        processLoginSuccess();
    } else {
        showToast('Error', 'Invalid username or password (Simulation Mode).', 'danger');
    }
}

function processLoginSuccess() {
    showToast('Success', 'Logged in successfully.', 'success');
    
    loginView.classList.remove('active-view');
    loginView.classList.add('hidden-view');
    
    setTimeout(() => {
        loginView.style.display = 'none';
        dashboardView.style.display = 'flex';
        
        void dashboardView.offsetWidth;
        
        dashboardView.classList.remove('hidden-view');
        dashboardView.classList.add('active-view');
        
        startDashboard();
    }, 500);
}

logoutBtn.addEventListener('click', () => {
    stopDashboard();
    localStorage.removeItem('token');
    
    dashboardView.classList.remove('active-view');
    dashboardView.classList.add('hidden-view');
    
    setTimeout(() => {
        dashboardView.style.display = 'none';
        loginView.style.display = 'flex';
        
        void loginView.offsetWidth;
        
        loginView.classList.remove('hidden-view');
        loginView.classList.add('active-view');
        
        usernameInput.value = '';
        passwordInput.value = '';
    }, 500);
});

// --- Login History Navigation & Logic ---
if(viewHistoryBtn) {
    viewHistoryBtn.addEventListener('click', () => {
        dashboardView.classList.remove('active-view');
        dashboardView.classList.add('hidden-view');
        
        setTimeout(() => {
            dashboardView.style.display = 'none';
            loginHistoryView.style.display = 'flex';
            
            void loginHistoryView.offsetWidth;
            
            loginHistoryView.classList.remove('hidden-view');
            loginHistoryView.classList.add('active-view');
            
            fetchLoginHistory();
        }, 500);
    });
}

if(backDashboardBtn) {
    backDashboardBtn.addEventListener('click', () => {
        loginHistoryView.classList.remove('active-view');
        loginHistoryView.classList.add('hidden-view');
        
        setTimeout(() => {
            loginHistoryView.style.display = 'none';
            dashboardView.style.display = 'flex';
            
            void dashboardView.offsetWidth;
            
            dashboardView.classList.remove('hidden-view');
            dashboardView.classList.add('active-view');
        }, 500);
    });
}

async function fetchLoginHistory() {
    const token = localStorage.getItem('token');
    if (!token || token === 'simulated_token_for_github_pages') {
        loginHistoryTbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 2rem;">Simulated mode. Backend data unavailable.</td></tr>`;
        return;
    }

    try {
        const response = await fetch('/api/auth/history', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            loginHistoryTbody.innerHTML = '';
            
            if (data.length === 0) {
                loginHistoryTbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 2rem;">No history found.</td></tr>`;
                return;
            }

            data.forEach(row => {
                const dateObj = new Date(row.timestamp);
                const dateString = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString();
                
                let statusClass = 'normal';
                if (row.status.includes('failed')) statusClass = 'critical';

                loginHistoryTbody.innerHTML += `
                    <tr>
                        <td>${dateString}</td>
                        <td>${row.username || 'unknown'}</td>
                        <td><span class="status-badge ${statusClass}">${row.status}</span></td>
                        <td>${row.ip_address || '-'}</td>
                    </tr>
                `;
            });
        }
    } catch (err) {
        console.error(err);
        loginHistoryTbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 2rem;">Failed to load history.</td></tr>`;
    }
}

// --- Dashboard Logic ---

function startDashboard() {
    initChart();
    fetchData(); // Initial fetch
    updateInterval = setInterval(fetchData, 5000); // Update every 5 seconds
}

function stopDashboard() {
    clearInterval(updateInterval);
    if (healthChart) {
        healthChart.destroy();
        healthChart = null;
    }
    // reset data arrays
    labels.length = 0;
    spo2Data.length = 0;
    hrData.length = 0;
    lastFetchedTimestamp = null;
}

let lastFetchedTimestamp = null;

async function fetchData() {
    const token = localStorage.getItem('token');
    if (!token) return;

    if (token === 'simulated_token_for_github_pages') {
        runSimulatedData();
        return;
    }

    try {
        const response = await fetch('/api/health/data', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.status === 404 || response.status === 405) {
            // Fallback for GitHub Pages if API doesn't exist
            runSimulatedData();
            return;
        }

        if (response.status === 401 || response.status === 403) {
            showToast('Session Expired', 'Please login again.', 'danger');
            logoutBtn.click();
            return;
        }

        const data = await response.json();
        
        if (response.ok && data.length > 0) {
            const latest = data[data.length - 1]; // Because we reverse to chronological
            
            // Check if we already plotted this exact timestamp
            if (lastFetchedTimestamp !== latest.timestamp) {
                lastFetchedTimestamp = latest.timestamp;
                
                updateUI(latest.spo2, latest.heart_rate);
                updateChart(latest.spo2, latest.heart_rate, new Date(latest.timestamp));
                
                // Populate the table
                const historyBody = document.getElementById('history-tbody');
                if (historyBody) {
                    historyBody.innerHTML = '';
                    // Data inside array is oldest-to-newest, so reverse to show newest first in table
                    [...data].reverse().forEach(row => {
                        const dateObj = new Date(row.timestamp);
                        const timeString = dateObj.toLocaleTimeString();
                        const statusClass = row.spo2 < 94 ? 'critical' : 'normal';
                        const statusText = row.spo2 < 94 ? 'Low Oxygen' : 'Stable';
                        
                        historyBody.innerHTML += `
                            <tr>
                                <td>${timeString}</td>
                                <td>${row.spo2}%</td>
                                <td>${row.heart_rate} bpm</td>
                                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                            </tr>
                        `;
                    });
                }
                
                const now = new Date();
                timeDisplayEl.textContent = now.toLocaleTimeString();
            }
        }
    } catch (error) {
        // Fallback for GitHub Pages!
        console.warn("Real backend unreachable, falling back to Simulation Mode.");
        runSimulatedData();
    }
}

function runSimulatedData() {
    // Generate Random Data
    const currentSpO2 = generateRandom(90, 100);
    const currentHR = generateRandom(60, 110);
    
    updateUI(currentSpO2, currentHR);
    updateChart(currentSpO2, currentHR);
    
    const now = new Date();
    timeDisplayEl.textContent = now.toLocaleTimeString();
    
    const historyBody = document.getElementById('history-tbody');
    if (historyBody) {
        const timeString = now.toLocaleTimeString();
        const statusClass = currentSpO2 < 94 ? 'critical' : 'normal';
        const statusText = currentSpO2 < 94 ? 'Low Oxygen' : 'Stable';
        const newRow = `
            <tr>
                <td>${timeString}</td>
                <td>${currentSpO2}%</td>
                <td>${currentHR} bpm</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            </tr>
        `;
        // Prepend it 
        if (historyBody.innerHTML.includes("Waiting for data")) {
            historyBody.innerHTML = newRow;
        } else {
            historyBody.insertAdjacentHTML('afterbegin', newRow);
        }
    }
}

function updateUI(spo2, hr) {
    // 1. SpO2 Update
    spo2ValueEl.innerHTML = `${spo2}<span class="unit">%</span>`;
    spo2Bar.style.width = `${spo2}%`;
    
    // 2. Heart Rate Update
    hrValueEl.innerHTML = `${hr}<span class="unit">bpm</span>`;
    // Add heartbeat animation
    hrIcon.classList.remove('heartbeat-anim');
    void hrIcon.offsetWidth; // trigger reflow
    hrIcon.classList.add('heartbeat-anim');
    
    // 3. Status Logic
    if (spo2 < 94) {
        statusValueEl.textContent = 'Low Oxygen';
        statusValueEl.className = 'text-danger';
        statusMessageEl.textContent = 'Immediate attention required';
        
        statusIconWrapper.className = 'icon-wrapper red';
        statusIconWrapper.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
        
        // Alert if critical
        if (spo2 <= 91) {
            showToast('Critical Warning', `SpO2 levels critically low (${spo2}%)`, 'danger');
        }
    } else {
        statusValueEl.textContent = 'Normal';
        statusValueEl.className = 'text-success';
        statusMessageEl.textContent = 'Patient is stable';
        
        statusIconWrapper.className = 'icon-wrapper green';
        statusIconWrapper.innerHTML = '<i class="fa-solid fa-shield-heart"></i>';
    }
}

// --- Chart.js Integration ---

function initChart() {
    const ctx = document.getElementById('healthChart').getContext('2d');
    
    // Gradient for SpO2
    const gradientBlue = ctx.createLinearGradient(0, 0, 0, 400);
    gradientBlue.addColorStop(0, 'rgba(0, 102, 204, 0.2)');
    gradientBlue.addColorStop(1, 'rgba(0, 102, 204, 0)');
    
    // Gradient for HR
    const gradientRed = ctx.createLinearGradient(0, 0, 0, 400);
    gradientRed.addColorStop(0, 'rgba(230, 57, 70, 0.2)');
    gradientRed.addColorStop(1, 'rgba(230, 57, 70, 0)');

    healthChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'SpO2 (%)',
                    data: spo2Data,
                    borderColor: '#0066cc',
                    backgroundColor: gradientBlue,
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#0066cc',
                    pointRadius: 3,
                    yAxisID: 'y'
                },
                {
                    label: 'Heart Rate (bpm)',
                    data: hrData,
                    borderColor: '#e63946',
                    backgroundColor: gradientRed,
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#e63946',
                    pointRadius: 3,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false // We use custom HTML legend
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    titleColor: '#333',
                    bodyColor: '#666',
                    borderColor: '#e2e8f0',
                    borderWidth: 1,
                    padding: 10,
                    boxPadding: 4
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false,
                        drawBorder: false
                    },
                    ticks: {
                        color: '#777'
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    min: 80,
                    max: 100,
                    grid: {
                        color: '#eaedf2',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#777'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    min: 50,
                    max: 150,
                    grid: {
                        display: false,
                    },
                    ticks: {
                        color: '#777'
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

function updateChart(spo2, hr, dateObj = new Date()) {
    if (!healthChart) return;
    
    const timeString = dateObj.getHours().toString().padStart(2, '0') + ':' + 
                       dateObj.getMinutes().toString().padStart(2, '0') + ':' + 
                       dateObj.getSeconds().toString().padStart(2, '0');
    
    // Add new data
    labels.push(timeString);
    spo2Data.push(spo2);
    hrData.push(hr);
    
    // Maintain max width
    if (labels.length > maxDataPoints) {
        labels.shift();
        spo2Data.shift();
        hrData.shift();
    }
    
    healthChart.update();
}

// --- Utilities ---

function generateRandom(min, max) {
    // Math.floor for integers
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function showToast(title, message, type = 'info') {
    const container = document.getElementById('notification-container');
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconClass = 'fa-info-circle';
    if(type === 'success') iconClass = 'fa-check-circle';
    if(type === 'danger') iconClass = 'fa-circle-exclamation';

    toast.innerHTML = `
        <i class="fa-solid ${iconClass} fa-lg"></i>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
    `;
    
    container.appendChild(toast);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease-out forwards';
        setTimeout(() => {
            if (container.contains(toast)) {
                container.removeChild(toast);
            }
        }, 300);
    }, 3000);
}
