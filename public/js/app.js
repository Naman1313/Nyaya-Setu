document.addEventListener('DOMContentLoaded', () => {
  initStars();
  initClock();
  initFileUpload();
});

// --- Stars Animation ---
function initStars() {
  const container = document.getElementById('starsContainer');
  if (!container) return;
  
  // Clear any existing
  container.innerHTML = '';

  for (let i = 0; i < 100; i++) {
    const s = document.createElement('div');
    s.className = 'ns-star';
    s.style.left = Math.random() * 100 + '%';
    s.style.top = Math.random() * 100 + '%';
    s.style.animationDelay = (Math.random() * 3).toFixed(2) + 's';
    const sz = (1 + Math.random() * 2).toFixed(1) + 'px';
    s.style.width = sz;
    s.style.height = sz;
    container.appendChild(s);
  }
}

// --- Digital Clock ---
function initClock() {
  function update() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: true 
    });
    
    // Update all elements with class 'ns-clock'
    document.querySelectorAll('.ns-clock').forEach(el => {
        el.textContent = timeStr;
    });
  }
  
  update();
  setInterval(update, 1000);
}

// --- File Upload Logic (Visual) ---
function initFileUpload() {
  const fileInputs = document.querySelectorAll('input[type="file"]');
  fileInputs.forEach(input => {
    input.addEventListener('change', (e) => {
        const fileName = e.target.files[0]?.name || "No file selected";
        const statusEl = e.target.parentElement.querySelector('.ns-fw-st');
        if (statusEl) {
            statusEl.textContent = fileName;
        }
    });
  });
}

// --- Navigation Logic (SPA-like feel for Landing) ---
function showSection(sectionId) {
    // Hide all main pages
    document.querySelectorAll('.ns-page').forEach(el => el.classList.add('ns-hidden'));
    
    // Show requested
    const target = document.getElementById(sectionId);
    if(target) target.classList.remove('ns-hidden');
    
    // Re-init stars if needed (optional optimization)
}
