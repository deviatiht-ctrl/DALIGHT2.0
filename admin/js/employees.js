// ============================================
// DALIGHT HEAD SPA - EMPLOYEE PRESENCE SYSTEM
// ============================================

let allEmployees = [];
let allAttendance = [];
let currentEmployee = null;
let currentBadgeEmployee = null;
let scanner = null;
let employeePhotoFile = null;
let currentTab = 'employees';

const PHOTO_BUCKET = 'employees-photos';

function getSupabaseClient() {
  if (window.adminCore?.supabase) return window.adminCore.supabase;
  if (window.dalightAdminSupabase) return window.dalightAdminSupabase;
  if (window.supabaseClient) return window.supabaseClient;
  if (typeof supabase !== 'undefined' && supabase.createClient) return supabase.createClient(
    'https://rbwoiejztrkghfkpxquo.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJid29pZWp6dHJrZ2hma3B4cXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMDI1OTcsImV4cCI6MjA5MTc3ODU5N30.4NnApWYerIEcS8IBixBdsVHSgTUDO4OTTi6fSxdxu_U'
  );
  return null;
}

function showToast(msg, type = 'info') {
  if (window.adminCore?.showToast) window.adminCore.showToast(msg, type);
  else if (window.showToast) window.showToast(msg, type);
  else alert(msg);
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  await new Promise(resolve => setTimeout(resolve, 100));
  const session = await window.adminCore?.checkAdminAuth?.();
  if (!session) return;

  const today = new Date().toISOString().split('T')[0];
  const month = new Date().toISOString().slice(0, 7);
  const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const end = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0];

  document.getElementById('attendance-start').value = start;
  document.getElementById('attendance-end').value = end;
  document.getElementById('attendance-month').value = month;
  attendanceSelectedDate = today;

  await loadEmployees();
  await loadAttendanceRange(start, end);
});

// ============================================
// TAB SWITCHING
// ============================================

window.switchTab = function(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.toggle('active', content.id === `tab-${tab}`));

  if (tab === 'employees') renderEmployees();
  if (tab === 'attendance') renderAttendance();
  if (tab === 'scanner') {
    // scanner is started manually
  }
};

// ============================================
// EMPLOYEES CRUD
// ============================================

async function loadEmployees() {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    const { data, error } = await supabase
      .from('presence_employees')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    allEmployees = data || [];
    renderEmployees();
    updateStats();
  } catch (err) {
    console.error('Error loading employees:', err);
    showToast('Erreur lors du chargement des employés', 'error');
  }
}

window.renderEmployees = function() {
  const grid = document.getElementById('employees-grid');
  const countEl = document.getElementById('employees-count');
  const search = document.getElementById('emp-search')?.value?.toLowerCase() || '';

  let filtered = allEmployees;
  if (search) {
    filtered = filtered.filter(e =>
      (e.full_name && e.full_name.toLowerCase().includes(search)) ||
      (e.position && e.position.toLowerCase().includes(search)) ||
      (e.employee_number && e.employee_number.toLowerCase().includes(search))
    );
  }

  countEl.textContent = `${filtered.length} employé${filtered.length > 1 ? 's' : ''}`;

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="text-center text-muted" style="grid-column:1/-1;padding:3rem;">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" width="48" height="48" style="margin-bottom:1rem;opacity:.5;">
          <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
        <p>Aucun employé trouvé</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(e => `
    <div class="emp-card">
      <div class="emp-avatar">
        ${e.photo_url ? `<img src="${e.photo_url}" alt="${esc(e.full_name)}">` : getInitials(e.full_name)}
      </div>
      <div class="emp-info">
        <div class="emp-name">${esc(e.full_name)}</div>
        <div class="emp-meta">${esc(e.position)} • ${esc(e.employee_number || '')}</div>
        ${e.nif ? `<div class="emp-meta">NIF: ${esc(e.nif)}</div>` : ''}
        <div class="emp-meta">${e.is_active ? 'Actif' : 'Inactif'}</div>
      </div>
      <div class="emp-status ${e.is_active ? '' : 'inactive'}"></div>
      <div class="d-flex gap-1">
        <button class="btn btn-icon btn-secondary btn-sm" onclick="viewBadge('${e.id}')" title="Badge QR">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
        </button>
        <button class="btn btn-icon btn-secondary btn-sm" onclick="editEmployee('${e.id}')" title="Modifier">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
        </button>
        <button class="btn btn-icon btn-danger btn-sm" onclick="deleteEmployee('${e.id}')" title="Supprimer">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      </div>
    </div>
  `).join('');
};

window.onEmployeePhotoSelected = function(input) {
  if (input.files && input.files[0]) {
    employeePhotoFile = input.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
      const preview = document.getElementById('emp-photo-preview');
      preview.querySelector('img').src = e.target.result;
      preview.style.display = 'block';
    };
    reader.readAsDataURL(input.files[0]);
  }
};

window.openEmployeeModal = function(employee = null) {
  currentEmployee = employee;
  document.getElementById('emp-modal-title').textContent = employee ? 'Modifier employé' : 'Nouvel employé';
  document.getElementById('emp-id').value = employee?.id || '';
  document.getElementById('emp-number').value = employee?.employee_number || '';
  document.getElementById('emp-name').value = employee?.full_name || '';
  document.getElementById('emp-position').value = employee?.position || '';
  document.getElementById('emp-email').value = employee?.email || '';
  document.getElementById('emp-phone').value = employee?.phone || '';
  document.getElementById('emp-nif').value = employee?.nif || '';
  document.getElementById('emp-photo').value = '';
  employeePhotoFile = null;

  const preview = document.getElementById('emp-photo-preview');
  if (employee?.photo_url) {
    preview.querySelector('img').src = employee.photo_url;
    preview.style.display = 'block';
  } else {
    preview.style.display = 'none';
  }

  const modal = document.getElementById('employee-modal');
  modal.classList.add('active');
  modal.style.display = 'flex';
};

window.closeEmployeeModal = function() {
  const modal = document.getElementById('employee-modal');
  modal.classList.remove('active');
  modal.style.display = 'none';
  currentEmployee = null;
};

window.editEmployee = function(id) {
  const e = allEmployees.find(emp => emp.id === id);
  if (e) openEmployeeModal(e);
};

window.deleteEmployee = async function(id) {
  if (!confirm('Supprimer cet employé ?')) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    const { error } = await supabase.from('presence_employees').delete().eq('id', id);
    if (error) throw error;
    await loadEmployees();
    showToast('Employé supprimé', 'success');
  } catch (err) {
    console.error('Error deleting employee:', err);
    showToast('Erreur lors de la suppression', 'error');
  }
};

async function uploadEmployeePhoto(file) {
  if (!file) return null;
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase non connecté');

  const fileName = `employee-${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, '_')}`;
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).upload(fileName, file);
  if (error) throw error;

  const { data: urlData } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(fileName);
  return urlData.publicUrl;
}

window.saveEmployee = async function() {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const id = document.getElementById('emp-id').value;
  let number = document.getElementById('emp-number').value.trim();
  const name = document.getElementById('emp-name').value.trim();
  const position = document.getElementById('emp-position').value.trim();
  const email = document.getElementById('emp-email').value.trim();
  const phone = document.getElementById('emp-phone').value.trim();
  const nif = document.getElementById('emp-nif').value.trim();

  if (!name || !position) {
    showToast('Nom et poste sont requis', 'error');
    return;
  }

  // Auto-generate employee number if empty
  if (!number) {
    const count = allEmployees.length + 1;
    number = `EMP-${String(count).padStart(3, '0')}`;
  }

  const btn = document.querySelector('#employee-modal .btn-primary');
  btn.disabled = true;
  btn.textContent = 'Enregistrement...';

  try {
    let photoUrl = currentEmployee?.photo_url || null;
    if (employeePhotoFile) {
      try {
        photoUrl = await uploadEmployeePhoto(employeePhotoFile);
      } catch (uploadErr) {
        console.error('Photo upload error:', uploadErr);
        const uploadMsg = uploadErr?.message || uploadErr?.error?.message || 'Erreur upload';
        // If upload fails, continue without photo but warn user
        showToast(`Photo non uploadée: ${uploadMsg}. Employé enregistré sans photo.`, 'warning');
      }
    }

    const qrData = currentEmployee?.qr_data || `DALIGHT-EMP-${(crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36))}`;

    const data = {
      employee_number: number,
      full_name: name,
      position,
      email: email || null,
      phone: phone || null,
      nif: nif || null,
      photo_url: photoUrl,
      qr_data: qrData,
      is_active: true,
    };

    if (id) {
      const { error } = await supabase.from('presence_employees').update(data).eq('id', id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('presence_employees').insert(data);
      if (error) throw error;
    }

    closeEmployeeModal();
    await loadEmployees();
    showToast(id ? 'Employé mis à jour' : 'Employé créé', 'success');
  } catch (err) {
    console.error('Error saving employee:', err);
    const msg = err?.message || err?.error?.message || 'Erreur inconnue';
    showToast('Erreur: ' + msg, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Enregistrer';
  }
};

// ============================================
// BADGE & QR CODE
// ============================================

function getQRLibrary() {
  if (typeof qrcode === 'function') return qrcode;
  if (typeof window !== 'undefined' && typeof window.qrcode === 'function') return window.qrcode;
  return null;
}

function getQRStyle() {
  const width = parseInt(document.getElementById('qr-width').value, 10) || 200;
  const margin = parseInt(document.getElementById('qr-margin').value, 10);
  const dark = document.getElementById('qr-color-dark').value || '#4A3728';
  const light = document.getElementById('qr-color-light').value || '#ffffff';
  const shape = document.getElementById('qr-shape').value || 'square';
  return { width, margin: Number.isFinite(margin) ? margin : 2, dark, light, shape };
}

function generateSVG(text, style) {
  const qr = getQRLibrary();
  if (!qr) throw new Error('Librairie QR non chargée');
  const q = qr(0, 'M');
  q.addData(text);
  q.make();
  const count = q.getModuleCount();
  const cellSize = Math.floor(style.width / count);
  const actualWidth = cellSize * count + (style.margin * 2);
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${actualWidth}" height="${actualWidth}" viewBox="0 0 ${actualWidth} ${actualWidth}">`;
  svg += `<rect width="100%" height="100%" fill="${style.light}"/>`;
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (q.isDark(r, c)) {
        const x = style.margin + c * cellSize;
        const y = style.margin + r * cellSize;
        if (style.shape === 'dot') {
          const rDot = cellSize / 2;
          svg += `<circle cx="${x + rDot}" cy="${y + rDot}" r="${rDot}" fill="${style.dark}"/>`;
        } else if (style.shape === 'rounded') {
          const rx = Math.max(1, cellSize * 0.25);
          svg += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="${rx}" ry="${rx}" fill="${style.dark}"/>`;
        } else {
          svg += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="${style.dark}"/>`;
        }
      }
    }
  }
  svg += '</svg>';
  return svg;
}

async function svgToPng(svgString, width) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = width;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, width);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Erreur conversion PNG'));
    };
    img.src = url;
  });
}

window.viewBadge = async function(id) {
  const e = allEmployees.find(emp => emp.id === id);
  if (!e) return;
  currentBadgeEmployee = e;

  const info = document.getElementById('badge-info');
  info.innerHTML = `
    <div style="font-weight:600;font-size:1rem;color:#1f2937;">${esc(e.full_name)}</div>
    <div>${esc(e.position)}${e.employee_number ? ` • ${esc(e.employee_number)}` : ''}</div>
  `;

  const modal = document.getElementById('badge-modal');
  modal.classList.add('active');
  modal.style.display = 'flex';

  await updateQRPreview();
};

window.updateQRPreview = async function() {
  if (!currentBadgeEmployee) return;
  try {
    const style = getQRStyle();
    const svgString = generateSVG(currentBadgeEmployee.qr_data, style);
    const qrContainer = document.getElementById('badge-qr');
    qrContainer.innerHTML = svgString;
    const svg = qrContainer.querySelector('svg');
    if (svg) {
      svg.style.width = '100%';
      svg.style.height = '100%';
    }
  } catch (err) {
    console.error('QR generation error:', err);
    const container = document.getElementById('badge-qr');
    container.innerHTML = '<div class="alert alert-error">' + esc(err.message) + '</div>';
    showToast('Erreur génération QR', 'error');
  }
};

window.closeBadgeModal = function() {
  const modal = document.getElementById('badge-modal');
  modal.classList.remove('active');
  modal.style.display = 'none';
  currentBadgeEmployee = null;
};

window.downloadQR = async function(format) {
  if (!currentBadgeEmployee) return;
  const fileName = `qr-${esc(currentBadgeEmployee.full_name).replace(/\s+/g, '-').toLowerCase()}-${currentBadgeEmployee.employee_number || currentBadgeEmployee.id}`;
  try {
    const style = { ...getQRStyle(), width: 800 };
    const svgString = generateSVG(currentBadgeEmployee.qr_data, style);

    if (format === 'svg') {
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else if (format === 'png') {
      const dataUrl = await svgToPng(svgString, 800);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${fileName}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  } catch (err) {
    console.error('QR download error:', err);
    showToast('Erreur téléchargement QR', 'error');
  }
};

// ============================================
// QR SCANNER & ATTENDANCE
// ============================================

let lastScanTime = 0;
let lastScanQrData = null;
const SCAN_DEBOUNCE_MS = 2000; // Ignore same QR scan within 2 seconds

window.startScanner = function() {
  const btnStart = document.getElementById('btn-start-scan');
  const btnStop = document.getElementById('btn-stop-scan');
  const result = document.getElementById('scan-result');

  if (!window.Html5Qrcode) {
    result.innerHTML = '<div class="alert alert-error">Scanner QR non disponible. Vérifiez votre connexion.</div>';
    return;
  }

  scanner = new Html5Qrcode('qr-reader');
  scanner.start(
    { facingMode: 'environment' },
    { fps: 10, qrbox: { width: 250, height: 250 } },
    onScanSuccess,
    onScanError
  ).then(() => {
    btnStart.style.display = 'none';
    btnStop.style.display = 'inline-flex';
    result.innerHTML = '<div class="text-muted">Scannez un badge employé...</div>';
  }).catch(err => {
    console.error('Scanner error:', err);
    result.innerHTML = `<div class="alert alert-error">Erreur caméra: ${err.message || err}</div>`;
  });
};

window.stopScanner = function() {
  if (!scanner) return;
  scanner.stop().then(() => {
    scanner.clear();
    scanner = null;
    document.getElementById('btn-start-scan').style.display = 'inline-flex';
    document.getElementById('btn-stop-scan').style.display = 'none';
  }).catch(err => console.error('Stop scanner error:', err));
};

// ============================================
// MANUAL ENTRY (BADGE LOST)
// ============================================

let selectedManualEmployee = null;

window.searchEmployeeForManualEntry = function() {
  const query = document.getElementById('manual-employee-search').value.trim().toLowerCase();
  const resultsDiv = document.getElementById('manual-employee-results');
  const btn = document.getElementById('btn-manual-entry');

  if (!query) {
    resultsDiv.innerHTML = '';
    selectedManualEmployee = null;
    btn.disabled = true;
    return;
  }

  const matches = allEmployees.filter(e =>
    e.full_name?.toLowerCase().includes(query) ||
    e.employee_number?.toLowerCase().includes(query) ||
    e.nif?.toLowerCase().includes(query)
  );

  if (matches.length === 0) {
    resultsDiv.innerHTML = '<div class="text-muted" style="padding:0.5rem;">Aucun employé trouvé</div>';
    selectedManualEmployee = null;
    btn.disabled = true;
    return;
  }

  resultsDiv.innerHTML = matches.map(e => `
    <div class="emp-card" style="cursor:pointer;margin-bottom:0.5rem;" onclick="selectManualEmployee('${e.id}')">
      <div class="emp-avatar">${esc(e.full_name?.charAt(0) || '?')}</div>
      <div class="emp-info">
        <div class="emp-name">${esc(e.full_name)}</div>
        <div class="emp-meta">${esc(e.position)} • ${esc(e.employee_number || '')}</div>
        ${e.nif ? `<div class="emp-meta">NIF: ${esc(e.nif)}</div>` : ''}
      </div>
    </div>
  `).join('');
};

window.selectManualEmployee = function(id) {
  selectedManualEmployee = allEmployees.find(e => e.id === id);
  const resultsDiv = document.getElementById('manual-employee-results');
  const btn = document.getElementById('btn-manual-entry');

  if (!selectedManualEmployee) return;

  resultsDiv.innerHTML = `
    <div class="emp-card" style="background:#e0f2fe;border-color:#0ea5e9;">
      <div class="emp-avatar">${esc(selectedManualEmployee.full_name?.charAt(0) || '?')}</div>
      <div class="emp-info">
        <div class="emp-name">${esc(selectedManualEmployee.full_name)}</div>
        <div class="emp-meta">${esc(selectedManualEmployee.position)} • ${esc(selectedManualEmployee.employee_number || '')}</div>
        ${selectedManualEmployee.nif ? `<div class="emp-meta">NIF: ${esc(selectedManualEmployee.nif)}</div>` : ''}
      </div>
    </div>
  `;
  btn.disabled = false;
};

window.submitManualEntry = async function() {
  if (!selectedManualEmployee) return;

  const action = document.getElementById('manual-action').value;
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();

  try {
    if (action === 'entry') {
      const { data: existing } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('employee_id', selectedManualEmployee.id)
        .eq('date', today)
        .eq('type', 'entry')
        .maybeSingle();

      if (existing) {
        showToast('Entrée déjà enregistrée aujourd\'hui', 'warning');
        return;
      }

      const { error } = await supabase.from('attendance_logs').insert({
        employee_id: selectedManualEmployee.id,
        date: today,
        type: 'entry',
        timestamp: now,
        method: 'manual'
      });

      if (error) throw error;
      showToast(`Entrée enregistrée pour ${esc(selectedManualEmployee.full_name)}`, 'success');
    } else {
      const { data: entry } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('employee_id', selectedManualEmployee.id)
        .eq('date', today)
        .eq('type', 'entry')
        .maybeSingle();

      if (!entry) {
        showToast('Aucune entrée trouvée pour aujourd\'hui', 'error');
        return;
      }

      const { data: existingExit } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('employee_id', selectedManualEmployee.id)
        .eq('date', today)
        .eq('type', 'exit')
        .maybeSingle();

      if (existingExit) {
        showToast('Sortie déjà enregistrée aujourd\'hui', 'warning');
        return;
      }

      const { error } = await supabase.from('attendance_logs').insert({
        employee_id: selectedManualEmployee.id,
        date: today,
        type: 'exit',
        timestamp: now,
        method: 'manual'
      });

      if (error) throw error;
      showToast(`Sortie enregistrée pour ${esc(selectedManualEmployee.full_name)}`, 'success');
    }

    document.getElementById('manual-employee-search').value = '';
    document.getElementById('manual-employee-results').innerHTML = '';
    document.getElementById('btn-manual-entry').disabled = true;
    selectedManualEmployee = null;
    await loadAttendance();
  } catch (err) {
    console.error('Manual entry error:', err);
    showToast('Erreur: ' + (err?.message || err), 'error');
  }
};

async function onScanSuccess(qrData) {
  if (!scanner) return;

  const now = Date.now();
  // Debounce: ignore same QR scan within 2 seconds
  if (qrData === lastScanQrData && (now - lastScanTime) < SCAN_DEBOUNCE_MS) {
    console.log('Ignoring duplicate scan');
    return;
  }

  lastScanTime = now;
  lastScanQrData = qrData;
  await scanner.pause();

  const employee = allEmployees.find(e => e.qr_data === qrData);
  const result = document.getElementById('scan-result');

  if (!employee) {
    showScanResultPopup('error', null, 'ERREUR', 'Badge non reconnu', null);
    if (result) result.innerHTML = `<div class="alert alert-error">Badge non reconnu</div>`;
    setTimeout(() => {
      if (scanner) scanner.resume();
    }, 2000);
    return;
  }

  try {
    const log = await recordAttendance(employee);
    const action = log.exit_time ? 'sortie' : 'entrée';
    const time = log.exit_time || log.entry_time;
    const title = action === 'entrée' ? 'BONJOUR' : 'AU REVOIR';
    const message = action === 'entrée' ? 'Bienvenue au travail' : 'Bonne journée';

    showScanResultPopup('success', employee, title, message, time);

    if (result) result.innerHTML = `
      <div class="alert alert-success" style="display:flex;align-items:center;gap:1rem;justify-content:center;">
        <div class="emp-avatar" style="width:56px;height:56px;">
          ${employee.photo_url ? `<img src="${employee.photo_url}" alt="${esc(employee.full_name)}">` : getInitials(employee.full_name)}
        </div>
        <div style="text-align:left;">
          <div style="font-weight:700;font-size:1.1rem;">${esc(employee.full_name)}</div>
          <div style="font-size:.85rem;color:#6b7280;">${action === 'entrée' ? '✅ Entrée enregistrée' : '✅ Sortie enregistrée'} à ${time}</div>
        </div>
      </div>
    `;
    await loadTodayAttendance();
  } catch (err) {
    console.error('Attendance error:', err);
    if (err.code === 'DAY_COMPLETED') {
      showScanResultPopup('warning', employee, 'JOURNÉE TERMINÉE', err.message, null);
      if (result) result.innerHTML = `
        <div class="alert alert-warning" style="display:flex;align-items:center;gap:1rem;justify-content:center;">
          <div class="emp-avatar" style="width:56px;height:56px;">
            ${employee.photo_url ? `<img src="${employee.photo_url}" alt="${esc(employee.full_name)}">` : getInitials(employee.full_name)}
          </div>
          <div style="text-align:left;">
            <div style="font-weight:700;font-size:1.1rem;">${esc(employee.full_name)}</div>
            <div style="font-size:.85rem;color:#6b7280;">⚠️ ${esc(err.message)}</div>
          </div>
        </div>
      `;
    } else {
      showScanResultPopup('error', employee, 'ERREUR', err.message, null);
      if (result) result.innerHTML = `<div class="alert alert-error">Erreur: ${esc(err.message)}</div>`;
    }
  }

  // Auto-restart scanner after 3 seconds
  setTimeout(() => {
    if (scanner) scanner.resume();
  }, 3000);
}

function onScanError(err) {
  // ignore frequent errors
}

function showScanResultPopup(type, employee, title, message, time) {
  // Remove existing popup if any
  const existing = document.getElementById('scan-result-popup');
  const existingBackdrop = document.getElementById('scan-popup-backdrop');
  if (existing) existing.remove();
  if (existingBackdrop) existingBackdrop.remove();

  const isSuccess = type === 'success';
  const isWarning = type === 'warning';
  const isError = type === 'error';

  // Backdrop overlay
  const backdrop = document.createElement('div');
  backdrop.id = 'scan-popup-backdrop';
  backdrop.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    z-index: 99998;
    animation: scanBackdropFadeIn 0.3s ease-out;
  `;

  const popup = document.createElement('div');
  popup.id = 'scan-result-popup';
  popup.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: ${isSuccess ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : isWarning ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'};
    color: white;
    padding: 2.5rem 2rem;
    border-radius: 24px;
    box-shadow: 0 25px 80px rgba(0,0,0,0.5);
    z-index: 99999;
    text-align: center;
    min-width: 340px;
    max-width: 90vw;
    animation: scanPopupSlideIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    font-family: 'Inter', sans-serif;
    cursor: pointer;
  `;

  let bodyHtml = '';
  if (employee) {
    bodyHtml = `
      <div class="emp-avatar" style="width:90px;height:90px;margin:0 auto 1rem;font-size:1.8rem;background:rgba(255,255,255,0.25);border:3px solid rgba(255,255,255,0.6);">
        ${employee.photo_url ? `<img src="${employee.photo_url}" alt="${esc(employee.full_name)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : getInitials(employee.full_name)}
      </div>
      <div style="font-weight:700;font-size:1.5rem;margin-bottom:0.25rem;">${esc(employee.full_name || 'Employé')}</div>
      ${employee.position ? `<div style="font-size:0.95rem;opacity:0.9;margin-bottom:0.25rem;">${esc(employee.position)}</div>` : ''}
      ${employee.employee_number ? `<div style="font-size:0.85rem;opacity:0.8;">#${esc(employee.employee_number)}</div>` : ''}
    `;
  }

  popup.innerHTML = `
    <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">${isSuccess ? '👋' : isWarning ? '⚠️' : '❌'}</div>
    <div style="font-weight:800;font-size:1.8rem;margin-bottom:0.5rem;">${esc(title)}</div>
    ${bodyHtml}
    <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid rgba(255,255,255,0.3);">
      <div style="font-size:1rem;opacity:0.95;">${esc(message)}</div>
      ${time ? `<div style="font-size:1.3rem;font-weight:700;margin-top:0.5rem;">${esc(time)}</div>` : ''}
    </div>
    <div style="margin-top:1rem;font-size:0.75rem;opacity:0.7;">Cliquez pour fermer</div>
  `;

  // Add animation keyframes
  if (!document.getElementById('scan-popup-styles')) {
    const style = document.createElement('style');
    style.id = 'scan-popup-styles';
    style.textContent = `
      @keyframes scanBackdropFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes scanBackdropFadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }
      @keyframes scanPopupSlideIn {
        from { opacity: 0; transform: translate(-50%, -45%) scale(0.9); }
        to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      }
      @keyframes scanPopupSlideOut {
        from { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        to { opacity: 0; transform: translate(-50%, -45%) scale(0.9); }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(backdrop);
  document.body.appendChild(popup);

  let dismissed = false;
  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    popup.style.animation = 'scanPopupSlideOut 0.3s ease-in forwards';
    backdrop.style.animation = 'scanBackdropFadeOut 0.3s ease-in forwards';
    setTimeout(() => {
      popup.remove();
      backdrop.remove();
    }, 300);
  }

  popup.addEventListener('click', dismiss);
  backdrop.addEventListener('click', dismiss);

  // Auto-remove after 2.5 seconds (or 3.5 seconds for errors to read them)
  const displayMs = isError ? 3500 : 2500;
  setTimeout(() => {
    if (!dismissed) dismiss();
  }, displayMs);
}

async function recordAttendance(employee) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase non connecté');

  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const time = now.toTimeString().slice(0, 5);
  const scannedBy = window.adminCore?.currentUser?.email || 'admin';

  // Find existing log for today
  const { data: existing, error: fetchError } = await supabase
    .from('attendance_logs')
    .select('*')
    .eq('employee_id', employee.id)
    .eq('log_date', today)
    .maybeSingle();

  if (fetchError) throw fetchError;

  if (existing) {
    // If already has both entry and exit, block re-scanning for the day
    if (existing.entry_time && existing.exit_time) {
      const err = new Error(`Journée terminée pour ${employee.full_name}. Badge déjà scanné (entrée ${existing.entry_time} / sortie ${existing.exit_time}).`);
      err.code = 'DAY_COMPLETED';
      throw err;
    }

    // If only entry exists, record exit
    const data = {
      exit_time: time,
      exit_method: 'qr_scan',
      exit_scanned_by: scannedBy,
      status: 'present',
    };
    const { data: updated, error } = await supabase
      .from('attendance_logs')
      .update(data)
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return updated;
  } else {
    // Create entry log
    const { data: created, error } = await supabase
      .from('attendance_logs')
      .insert({
        employee_id: employee.id,
        log_date: today,
        entry_time: time,
        entry_method: 'qr_scan',
        entry_scanned_by: scannedBy,
        status: 'present',
      })
      .select()
      .single();
    if (error) throw error;
    return created;
  }
}

async function loadTodayAttendance() {
  const today = new Date().toISOString().split('T')[0];
  await loadAttendanceRange(today, today);
}

async function loadAttendanceRange(start, end) {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    const { data, error } = await supabase
      .from('attendance_logs')
      .select('*, presence_employees:employee_id(full_name, photo_url, position, employee_number, nif)')
      .gte('log_date', start)
      .lte('log_date', end)
      .order('entry_time', { ascending: true });

    if (error) throw error;
    allAttendance = data || [];
    renderAttendance();
    updateStats();
  } catch (err) {
    console.error('Error loading attendance:', err);
  }
}

function getAttendanceFilters() {
  const start = document.getElementById('attendance-start')?.value;
  const end = document.getElementById('attendance-end')?.value;
  const search = document.getElementById('attendance-search')?.value?.toLowerCase() || '';
  return { start, end, search };
}

function getFilteredAttendance() {
  const { search } = getAttendanceFilters();
  if (!search) return allAttendance;
  return allAttendance.filter(log => {
    const emp = log.presence_employees || {};
    return (emp.full_name && emp.full_name.toLowerCase().includes(search)) ||
           (emp.position && emp.position.toLowerCase().includes(search));
  });
}

window.onAttendanceRangeChange = function() {
  const { start, end } = getAttendanceFilters();
  if (start && end) {
    loadAttendanceRange(start, end);
  }
};

window.changeMonth = function(delta) {
  const input = document.getElementById('attendance-month');
  const current = input.value ? new Date(input.value + '-01') : new Date();
  current.setMonth(current.getMonth() + delta);
  input.value = current.toISOString().slice(0, 7);
  renderAttendanceCalendar();
};

let attendanceSelectedDate = null;

window.renderAttendanceCalendar = function() {
  const monthInput = document.getElementById('attendance-month');
  let month = monthInput.value ? new Date(monthInput.value + '-01') : new Date();
  monthInput.value = month.toISOString().slice(0, 7);

  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0);
  const startDate = new Date(year, monthIndex, 1 - firstDay.getDay());
  const endDate = new Date(year, monthIndex + 1, 6 - lastDay.getDay());

  // Load all attendance for this month range
  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];
  loadAttendanceRange(startStr, endStr);
};

window.renderAttendance = function() {
  const { start, end } = getAttendanceFilters();

  // If explicit date range is set but different from loaded range, reload
  if (start && end && (!allAttendance.length || allAttendance[0].log_date < start || allAttendance[allAttendance.length - 1].log_date > end)) {
    loadAttendanceRange(start, end);
    return;
  }

  renderCalendar();
  renderAttendanceTable(attendanceSelectedDate);
};

function renderCalendar() {
  const container = document.getElementById('attendance-calendar');
  const monthInput = document.getElementById('attendance-month');
  const month = monthInput.value ? new Date(monthInput.value + '-01') : new Date();
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const today = new Date().toISOString().split('T')[0];

  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0);
  const startDate = new Date(year, monthIndex, 1 - firstDay.getDay());
  const endDate = new Date(year, monthIndex + 1, 6 - lastDay.getDay());

  const days = [];
  const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  let d = new Date(startDate);
  while (d <= endDate) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }

  const filteredLogs = getFilteredAttendance();

  container.innerHTML = `
    <div class="calendar-header">
      ${dayNames.map(name => `<div>${name}</div>`).join('')}
    </div>
    ${days.map(day => {
      const dateStr = day.toISOString().split('T')[0];
      const isToday = dateStr === today;
      const isCurrentMonth = day.getMonth() === monthIndex;
      const isSelected = dateStr === attendanceSelectedDate;
      const dayLogs = filteredLogs.filter(l => l.log_date === dateStr);
      const entries = dayLogs.filter(l => l.entry_time).length;
      const completed = dayLogs.filter(l => l.entry_time && l.exit_time).length;
      const exits = dayLogs.filter(l => l.exit_time).length;
      const dots = [];
      if (entries) dots.push('<span class="calendar-dot entry" title="Entrées"></span>');
      if (exits) dots.push('<span class="calendar-dot exit" title="Sorties"></span>');
      if (completed) dots.push('<span class="calendar-dot completed" title="Journées complètes"></span>');

      return `
        <div class="calendar-day ${isToday ? 'today' : ''} ${isCurrentMonth ? '' : 'other-month'} ${isSelected ? 'selected' : ''}" onclick="selectAttendanceDate('${dateStr}')">
          <div class="calendar-day-number">${day.getDate()}</div>
          <div class="calendar-day-dots">${dots.join('')}</div>
          ${dayLogs.length ? `<div class="calendar-summary">${completed} complet${completed > 1 ? 's' : ''}</div>` : ''}
        </div>
      `;
    }).join('')}
  `;
}

window.selectAttendanceDate = function(dateStr) {
  attendanceSelectedDate = dateStr;
  renderCalendar();
  renderAttendanceTable(dateStr);
};

function renderAttendanceTable(dateStr) {
  const tbody = document.getElementById('attendance-table');
  const title = document.getElementById('attendance-day-title');
  const filteredLogs = getFilteredAttendance();

  let dayLogs = filteredLogs;
  if (dateStr) {
    dayLogs = filteredLogs.filter(l => l.log_date === dateStr);
  }

  if (dateStr) {
    title.textContent = `Présences du ${new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
  } else {
    title.textContent = 'Toutes les présences du mois';
  }

  if (dayLogs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted" style="padding:2rem;">Aucune présence pour cette période</td></tr>`;
    return;
  }

  tbody.innerHTML = dayLogs.map(log => {
    const emp = log.presence_employees || {};
    const duration = calculateDuration(log.entry_time, log.exit_time);
    let status = '—';
    let badgeClass = 'badge-secondary';
    if (log.entry_time && log.exit_time) {
      status = 'Journée complète';
      badgeClass = 'badge-success';
    } else if (log.entry_time) {
      status = 'Présent';
      badgeClass = 'badge-warning';
    }
    return `
      <tr>
        <td>
          <div class="user-cell">
            <div class="user-avatar" style="width:32px;height:32px;font-size:.75rem;">
              ${emp.photo_url ? `<img src="${emp.photo_url}" alt="${esc(emp.full_name)}">` : getInitials(emp.full_name)}
            </div>
            <div>
              <div style="font-weight:500;font-size:.85rem;">${esc(emp.full_name || 'Employé')}</div>
              <div class="text-muted" style="font-size:.75rem;">${esc(emp.position || '')}</div>
              ${emp.employee_number ? `<div class="text-muted" style="font-size:.75rem;">#${esc(emp.employee_number)}</div>` : ''}
              ${emp.nif ? `<div class="text-muted" style="font-size:.75rem;">NIF: ${esc(emp.nif)}</div>` : ''}
            </div>
          </div>
        </td>
        <td>${log.entry_time || '—'}</td>
        <td>${log.exit_time || '—'}</td>
        <td>${duration}</td>
        <td><span class="badge ${badgeClass}">${status}</span></td>
      </tr>
    `;
  }).join('');
}

function calculateDuration(start, end) {
  if (!start || !end) return '—';
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff < 0) diff += 24 * 60;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return `${h}h${m.toString().padStart(2, '0')}`;
}

window.exportAttendance = function() {
  const filteredLogs = getFilteredAttendance();
  const headers = ['Date', 'Employé', 'Poste', 'Entrée', 'Sortie', 'Durée', 'Statut'];
  const rows = filteredLogs.map(log => {
    const emp = log.presence_employees || {};
    const duration = calculateDuration(log.entry_time, log.exit_time);
    const status = log.entry_time && log.exit_time ? 'Journée complète' : log.entry_time ? 'Présent' : '—';
    return [log.log_date, emp.full_name || '', emp.position || '', log.entry_time || '', log.exit_time || '', duration, status];
  });

  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `presences_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

function updateStats() {
  const today = new Date().toISOString().split('T')[0];
  const todayLogs = allAttendance.filter(a => a.log_date === today);
  const present = todayLogs.filter(a => a.entry_time && !a.exit_time).length;
  const entries = todayLogs.filter(a => a.entry_time).length;
  const exits = todayLogs.filter(a => a.exit_time).length;

  document.getElementById('stat-total').textContent = allEmployees.length;
  document.getElementById('stat-present').textContent = present;
  document.getElementById('stat-entries').textContent = entries;
  document.getElementById('stat-exits').textContent = exits;
}

function esc(str) {
  if (!str) return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(str).replace(/[&<>"']/g, m => map[m]);
}
