// app.js - UI interaction, DOM updates, and chart rendering

const UI = {
  dropZone: document.getElementById('drop-zone'),
  fileInput: document.getElementById('file-input'),
  secUpload: document.getElementById('section-upload'),
  secDash: document.getElementById('section-dashboard'),
  statsTableBody: document.querySelector('#stats-table tbody'),
  dataShapeBadge: document.getElementById('data-shape'),
  hypContainer: document.getElementById('hypotheses-container'),
  hypCount: document.getElementById('hypothesis-count'),
  loadingState: document.getElementById('loading-state'),
  btnReset: document.getElementById('btn-reset'),
  btnReanalyze: document.getElementById('btn-reanalyze'),
  selectDemo: document.getElementById('select-demo'),
  txtDomainContext: document.getElementById('domain-context'),
  btnThemeToggle: document.getElementById('btn-theme-toggle'),
  // Chat bindings
  chatInput: document.getElementById('chat-input'),
  btnChatSend: document.getElementById('btn-chat-send'),
  chatMessages: document.getElementById('chat-messages'),
  chartsGrid: document.getElementById('charts-grid')
};

let currentDataset = null;
let currentHypotheses = [];

// --- Init & Events ---
function init() {
  // Theme Toggle Handler
  if (UI.btnThemeToggle) {
    UI.btnThemeToggle.addEventListener('click', () => {
      const isLight = document.body.getAttribute('data-theme') === 'light';
      if (isLight) {
        document.body.removeAttribute('data-theme');
        UI.btnThemeToggle.textContent = '☀️';
      } else {
        document.body.setAttribute('data-theme', 'light');
        UI.btnThemeToggle.textContent = '🌙';
      }
    });
  }

  const btnToggleChat = document.getElementById('btn-toggle-chat');
  const btnCloseChat = document.getElementById('btn-close-chat');
  
  const toggleChatVisibility = () => {
    if (!UI.secDash) return;
    UI.secDash.classList.toggle('chat-hidden');
    const chatCol = document.querySelector('.col-chat');
    if (chatCol.style.display === 'none') {
      chatCol.style.display = 'flex';
    } else {
      chatCol.style.display = 'none';
    }
  };

  if(btnToggleChat) btnToggleChat.addEventListener('click', toggleChatVisibility);
  if(btnCloseChat) btnCloseChat.addEventListener('click', toggleChatVisibility);

  // Home Page Specific Handlers
  if (UI.dropZone) {
    initChat();

    // File Upload Handlers
    UI.dropZone.addEventListener('click', () => UI.fileInput.click());
    UI.fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) processFile(e.target.files[0]);
    });

    UI.dropZone.addEventListener('dragover', (e) => {
      e.preventDefault(); UI.dropZone.classList.add('dragover');
    });
    UI.dropZone.addEventListener('dragleave', () => {
      UI.dropZone.classList.remove('dragover');
    });
    UI.dropZone.addEventListener('drop', (e) => {
      e.preventDefault(); UI.dropZone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) processFile(e.dataTransfer.files[0]);
    });

    // Demo Dataset
    UI.selectDemo.addEventListener('change', (e) => {
      const val = e.target.value;
      if (!val) return;
      const csvContent = window.HypothesisEngine.generateSyntheticDataset(val);
      const domainMapping = {
        'retail': 'Retail Sales data covering regions for 2024. Want to understand ROI and growth patterns.',
        'health': 'Anonymized patient health cardiovascular metrics.',
        'website': 'Daily website traffic metrics over a 100-day period.'
      };
      UI.txtDomainContext.value = domainMapping[val];
      processCSVText(csvContent);
    });

    // Actions
    UI.btnReset.addEventListener('click', resetApp);
    UI.btnReanalyze.addEventListener('click', () => {
      runAnalysisPipeline(currentDataset, UI.txtDomainContext.value);
    });
  }
}

// --- Logic ---
function processFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => processCSVText(e.target.result);
  reader.readAsText(file);
}

function processCSVText(text) {
  try {
    const data = window.HypothesisEngine.parseCSV(text);
    currentDataset = data;

    // Switch UI
    UI.secUpload.classList.add('hidden');
    UI.secDash.classList.remove('hidden');

    runAnalysisPipeline(data, UI.txtDomainContext.value);

  } catch (err) {
    alert("Error parsing CSV: " + err.message);
  }
}

function runAnalysisPipeline(data, context) {
  // 1. Stats
  const stats = window.HypothesisEngine.computeStats(data);

  // Update Table overview
  renderStatsTable(data, stats);

  // Render Dashboard Charts
  renderCharts(stats);

  // Enable Chat
  UI.chatInput.disabled = false;
  UI.btnChatSend.disabled = false;

  // 2. Trends & Hypotheses
  UI.hypContainer.innerHTML = '';
  UI.hypCount.textContent = 'Analyzing and querying Groq LLM...';
  UI.loadingState.classList.remove('hidden');

  setTimeout(async () => {
    try {
      const trends = window.HypothesisEngine.detectTrends(data, stats);
      const hyps = await window.HypothesisEngine.generateHypotheses(stats, trends, context);
      currentHypotheses = hyps;

      UI.loadingState.classList.add('hidden');
      renderHypotheses(hyps);
    } catch (err) {
      alert("Error: " + err.message);
      UI.loadingState.classList.add('hidden');
      UI.hypCount.textContent = 'Generation Failed';
    }
  }, 100);
}

// --- Renderers ---
function renderStatsTable(data, stats) {
  UI.dataShapeBadge.textContent = `${data.rows.length} rows × ${data.headers.length} cols`;
  UI.statsTableBody.innerHTML = '';

  data.headers.forEach(h => {
    const s = stats[h];
    const tr = document.createElement('tr');

    // Column name
    const tdCol = document.createElement('td');
    tdCol.innerHTML = `<strong>${h}</strong>`;

    // Type
    const tdType = document.createElement('td');
    const typeClass = s.type === 'numeric' ? 'type-num' : (s.type === 'date' ? 'type-date' : 'type-cat');
    tdType.innerHTML = `<span class="${typeClass}">${s.type}</span>`;

    // Nulls
    const tdNull = document.createElement('td');
    tdNull.textContent = s.nulls;

    // Mean/Mode
    const tdVal = document.createElement('td');
    if (s.type === 'numeric') tdVal.textContent = s.mean.toFixed(2);
    else tdVal.textContent = s.mode ? `"${s.mode}"` : '-';

    // Trend Sparkline
    const tdTrend = document.createElement('td');
    if (s.type === 'numeric' && s.vals.length > 2) {
      const canvas = document.createElement('canvas');
      canvas.className = 'sparkline';
      canvas.width = 80; canvas.height = 24;
      drawSparkline(canvas, s.vals);
      tdTrend.appendChild(canvas);
    } else {
      tdTrend.textContent = '-';
    }

    tr.append(tdCol, tdType, tdNull, tdVal, tdTrend);
    UI.statsTableBody.appendChild(tr);
  });
}

function drawSparkline(canvas, vals) {
  const ctx = canvas.getContext('2d');
  const d_max = Math.max(...vals); const d_min = Math.min(...vals);
  const w = canvas.width; const h = canvas.height;
  const padding = 2;

  // Downsample to max width pixels
  const step = Math.max(1, Math.floor(vals.length / w));
  const points = [];
  for (let i = 0; i < vals.length; i += step) points.push(vals[i]);

  ctx.strokeStyle = '#8b5cf6';
  ctx.lineWidth = 1.5;
  ctx.beginPath();

  points.forEach((p, i) => {
    const x = (i / (points.length - 1)) * (w - padding * 2) + padding;
    const normalizedY = (p - d_min) / (d_max - d_min || 1);
    const y = h - padding - (normalizedY * (h - padding * 2));
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function renderHypotheses(hyps) {
  UI.hypCount.textContent = `${hyps.length} hypotheses`;

  hyps.forEach((h, idx) => {
    const card = document.createElement('div');
    card.className = 'hypothesis-card';
    card.style.animationDelay = `${idx * 0.15}s`;

    // SVG Circle mapping
    const circ = 188; // 2 * pi * radius(30)
    const offset = circ - (h.confidence / 100) * circ;
    const gaugeClass = h.severity === 'high' ? 'gauge-high' : (h.severity === 'med' ? 'gauge-med' : 'gauge-low');

    card.innerHTML = `
        <div class="hyp-gauge-col ${gaugeClass}">
          <div class="gauge-wrapper">
             <svg class="gauge-svg" viewBox="0 0 70 70">
                <circle class="gauge-bg" cx="35" cy="35" r="30"/>
                <circle class="gauge-fill" cx="35" cy="35" r="30" data-offset="${offset}"/>
             </svg>
             <div class="gauge-val">${h.confidence}%</div>
          </div>
          <div class="gauge-label">Confidence</div>
        </div>
        <div class="hyp-content">
          <h3>${h.title}</h3>
          <p>${h.explanation}</p>
          
          <div class="evidence-box">
             <div class="box-title">Supporting Evidence</div>
             <ul class="evidence-list">
                ${h.evidence.map(e => `<li>${e}</li>`).join('')}
             </ul>
          </div>
          
          <div class="next-steps">
             ${h.nextSteps.map(step => `<span class="step-tag">${step}</span>`).join('')}
          </div>

          <div class="hyp-feedback">
             <button class="feedback-btn fb-up" onclick="toggleFeedback(this)">👍</button>
             <button class="feedback-btn fb-down" onclick="toggleFeedback(this)">👎</button>
             <input type="text" class="feedback-input" placeholder="Add analyst notes..." onkeydown="if(event.key==='Enter') saveNoteUI(this.nextElementSibling)">
             <button class="btn btn-ghost btn-save-note" style="padding: 4px 8px; font-size: 0.8rem;" onclick="saveNoteUI(this)">Save</button>
          </div>
        </div>
      `;
    UI.hypContainer.appendChild(card);
  });

  // Animate gauges after DOM append
  setTimeout(() => {
    document.querySelectorAll('.gauge-fill').forEach(circle => {
      circle.style.strokeDashoffset = circle.getAttribute('data-offset');
    });
  }, 100);
}

// --- Utils ---
window.toggleFeedback = function (btn) {
  const parent = btn.parentElement;
  parent.querySelectorAll('.feedback-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
};

window.saveNoteUI = function (btn) {
  const input = btn.previousElementSibling;
  if (!input.value.trim()) return; // Don't save empty
  input.blur();
  const orig = btn.innerText;
  btn.innerText = "✓ Saved";
  btn.style.color = "var(--teal)";
  setTimeout(() => {
    btn.innerText = orig;
    btn.style.color = "";
  }, 2000);
};

function resetApp() {
  currentDataset = null; currentHypotheses = [];
  UI.selectDemo.value = ''; UI.fileInput.value = ''; UI.txtDomainContext.value = '';
  UI.secUpload.classList.remove('hidden');
  UI.secDash.classList.add('hidden');
}

// --- Visualizations ---
function renderCharts(stats) {
  UI.chartsGrid.innerHTML = '';
  // Plot up to 2 numeric columns
  const numCols = Object.keys(stats).filter(k => stats[k].type === 'numeric').slice(0, 2);
  
  numCols.forEach((col, i) => {
     const wrapper = document.createElement('div');
     wrapper.className = 'chart-card';
     const canvas = document.createElement('canvas');
     wrapper.appendChild(canvas);
     UI.chartsGrid.appendChild(wrapper);
     
     // Sample down to max 20 points
     const rawVals = stats[col].vals;
     const step = Math.max(1, Math.floor(rawVals.length / 20));
     const plotData = []; const labels = [];
     for(let j=0; j<rawVals.length; j+=step) {
         plotData.push(rawVals[j]);
         labels.push(`P${j}`);
     }

     new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
           labels: labels,
           datasets: [{
              label: col,
              data: plotData,
              borderColor: i === 0 ? '#8b5cf6' : '#14b8a6',
              backgroundColor: i === 0 ? 'rgba(139, 92, 246, 0.1)' : 'rgba(20, 184, 166, 0.1)',
              tension: 0.4,
              borderWidth: 2,
              fill: true,
              pointRadius: 0
           }]
        },
        options: {
           responsive: true, maintainAspectRatio: false,
           plugins: { legend: { display: true, labels: { color: '#94a3b8' } } },
           scales: { 
             x: { ticks: { display: false }, grid: { display: false } },
             y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.05)' } }
           }
        }
     });
  });
}

// --- Chat Logic ---
function initChat() {
   UI.btnChatSend.addEventListener('click', handleChatSubmit);
   UI.chatInput.addEventListener('keydown', (e) => {
      if(e.key === 'Enter') handleChatSubmit();
   });
}

async function handleChatSubmit() {
   const q = UI.chatInput.value.trim();
   if(!q || !currentDataset) return;
   
   UI.chatInput.value = '';
   appendChatMessage(q, 'msg-user');
   
   const loadingId = appendChatMessage('...', 'msg-llm');
   
   try {
     const stats = window.HypothesisEngine.computeStats(currentDataset);
     const reply = await window.HypothesisEngine.askQuestion(stats, q);
     document.getElementById(loadingId).innerText = reply;
   } catch(e) {
     document.getElementById(loadingId).innerText = 'Error: ' + e.message;
   }
}

function appendChatMessage(text, className) {
   const div = document.createElement('div');
   div.className = `chat-msg ${className}`;
   div.innerText = text;
   const id = 'msg-' + Date.now();
   div.id = id;
   UI.chatMessages.appendChild(div);
   UI.chatMessages.scrollTop = UI.chatMessages.scrollHeight;
   return id;
}

init();
