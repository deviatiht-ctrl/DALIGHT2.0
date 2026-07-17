// ============================================
// DALIGHT HEAD SPA - EMPLOYEE PRESENCE SYSTEM
// ============================================

let allEmployees = [];
let allAttendance = [];
let currentEmployee = null;
let currentBadgeEmployee = null;
let scanner = null;
let employeePhotoFile = null;
let photoCropper = null;
let currentTab = 'employees';
let reassignScanner = null;
let scannedQRForReassignment = null;
let currentOwnerOfQR = null;
let selectedNewOwner = null;
let employeesWithScannedQR = [];
let selectedEmployeeForAttendance = null;
let assignScanner = null;
let scannedQRForAssignment = null;
let selectedEmployeeForAssignment = null;

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

  grid.innerHTML = filtered.map(e => {
    const qrModifierBadge = e.qr_modifier 
      ? `<span style="display:inline-block;background:#3b82f6;color:white;padding:0.15rem 0.4rem;border-radius:4px;font-size:0.65rem;font-weight:600;margin-left:0.35rem;">QR-${e.qr_modifier}</span>`
      : '';
    
    return `
      <div class="emp-card">
        <div class="emp-avatar">
          ${e.photo_url ? `<img src="${e.photo_url}" alt="${esc(e.full_name)}">` : getInitials(e.full_name)}
        </div>
        <div class="emp-info">
          <div class="emp-name">${esc(e.full_name)}${qrModifierBadge}</div>
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
    `;
  }).join('');
};

window.onEmployeePhotoSelected = function(input) {
  if (input.files && input.files[0]) {
    employeePhotoFile = input.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
      const preview = document.getElementById('emp-photo-preview');
      const cropperContainer = document.getElementById('emp-photo-cropper-container');
      const cropperImage = document.getElementById('emp-photo-cropper-image');

      preview.querySelector('img').src = e.target.result;
      preview.style.display = 'none'; // Hide small preview while cropping
      cropperImage.src = e.target.result;
      cropperContainer.style.display = 'block';

      if (photoCropper) {
        photoCropper.destroy();
      }
      photoCropper = new Cropper(cropperImage, {
        aspectRatio: 1,
        viewMode: 1,
        autoCropArea: 0.8,
        responsive: true,
        guides: true,
        background: false,
        cropBoxResizable: true,
        cropBoxMovable: true,
      });
    };
    reader.readAsDataURL(input.files[0]);
  }
};

window.rotatePhotoCropper = function(deg) {
  if (photoCropper) photoCropper.rotate(deg);
};

window.resetPhotoCropper = function() {
  if (photoCropper) photoCropper.reset();
};

function getCroppedPhotoFile() {
  return new Promise((resolve) => {
    if (!photoCropper) {
      resolve(employeePhotoFile);
      return;
    }
    photoCropper.getCroppedCanvas({
      width: 400,
      height: 400,
      fillColor: '#fff',
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
    }).toBlob((blob) => {
      const file = new File([blob], employeePhotoFile.name.replace(/\.[^.]+$/, '') + '_cropped.png', { type: 'image/png' });
      resolve(file);
    }, 'image/png');
  });
}

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

  if (photoCropper) {
    photoCropper.destroy();
    photoCropper = null;
  }
  const cropperContainer = document.getElementById('emp-photo-cropper-container');
  const cropperImage = document.getElementById('emp-photo-cropper-image');
  if (cropperContainer) cropperContainer.style.display = 'none';
  if (cropperImage) cropperImage.src = '';

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
  if (photoCropper) {
    photoCropper.destroy();
    photoCropper = null;
  }
  const cropperContainer = document.getElementById('emp-photo-cropper-container');
  if (cropperContainer) cropperContainer.style.display = 'none';
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
        const fileToUpload = await getCroppedPhotoFile();
        photoUrl = await uploadEmployeePhoto(fileToUpload);
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

window.regenerateQRCode = async function() {
  if (!currentBadgeEmployee) return;
  
  const confirmMsg = `Voulez-vous vraiment régénérer le code QR pour ${currentBadgeEmployee.full_name}?\n\nATTENTION: L'ancien code QR ne fonctionnera plus. Un nouveau badge devra être imprimé.`;
  if (!confirm(confirmMsg)) return;

  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    const newQrData = `DALIGHT-EMP-${(crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36))}`;
    
    const { error } = await supabase
      .from('presence_employees')
      .update({ qr_data: newQrData })
      .eq('id', currentBadgeEmployee.id);

    if (error) throw error;

    currentBadgeEmployee.qr_data = newQrData;
    
    const empIndex = allEmployees.findIndex(e => e.id === currentBadgeEmployee.id);
    if (empIndex !== -1) {
      allEmployees[empIndex].qr_data = newQrData;
    }

    await updateQRPreview();
    showToast('Code QR régénéré avec succès', 'success');
  } catch (err) {
    console.error('Error regenerating QR code:', err);
    const msg = err?.message || err?.error?.message || 'Erreur inconnue';
    showToast('Erreur: ' + msg, 'error');
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
  if (qrData === lastScanQrData && (now - lastScanTime) < SCAN_DEBOUNCE_MS) {
    console.log('Ignoring duplicate scan');
    return;
  }

  lastScanTime = now;
  lastScanQrData = qrData;
  await scanner.pause();

  employeesWithScannedQR = allEmployees.filter(e => e.qr_data === qrData && e.is_active);
  const result = document.getElementById('scan-result');

  if (employeesWithScannedQR.length === 0) {
    showScanResultPopup('error', null, 'ERREUR', 'Badge non reconnu', null);
    if (result) result.innerHTML = `<div class="alert alert-error">Badge non reconnu</div>`;
    setTimeout(() => {
      if (scanner) scanner.resume();
    }, 2000);
    return;
  }

  if (employeesWithScannedQR.length > 1) {
    openEmployeeSelectionModal();
    return;
  }

  const employee = employeesWithScannedQR[0];
  await processAttendance(employee);
}

async function processAttendance(employee) {
  const result = document.getElementById('scan-result');
  
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

  setTimeout(() => {
    if (scanner) scanner.resume();
  }, 3000);
}

function onScanError(err) {
  // ignore frequent errors
}

// ============================================
// EMPLOYEE SELECTION FOR SHARED QR CODES
// ============================================

window.openEmployeeSelectionModal = function() {
  if (employeesWithScannedQR.length === 0) return;

  const listDiv = document.getElementById('employee-selection-list');
  listDiv.innerHTML = employeesWithScannedQR.map(emp => {
    const modifier = emp.qr_modifier || 'Principal';
    const modifierBadge = emp.qr_modifier 
      ? `<span style="display:inline-block;background:#3b82f6;color:white;padding:0.25rem 0.5rem;border-radius:6px;font-size:0.75rem;font-weight:700;margin-left:0.5rem;">QR-${emp.qr_modifier}</span>`
      : `<span style="display:inline-block;background:#10b981;color:white;padding:0.25rem 0.5rem;border-radius:6px;font-size:0.75rem;font-weight:700;margin-left:0.5rem;">QR Principal</span>`;
    
    return `
      <div class="emp-card" style="cursor:pointer;transition:all 0.2s;border:2px solid transparent;" onclick="selectEmployeeForAttendance('${emp.id}')" onmouseover="this.style.borderColor='var(--admin-accent)'" onmouseout="this.style.borderColor='transparent'">
        <div class="emp-avatar" style="width:64px;height:64px;font-size:1.5rem;">
          ${emp.photo_url ? `<img src="${emp.photo_url}" alt="${esc(emp.full_name)}">` : getInitials(emp.full_name)}
        </div>
        <div class="emp-info" style="flex:1;">
          <div class="emp-name" style="font-size:1.1rem;display:flex;align-items:center;">
            ${esc(emp.full_name)}
            ${modifierBadge}
          </div>
          <div class="emp-meta">${esc(emp.position)}</div>
          <div class="emp-meta">${esc(emp.employee_number || '')}</div>
        </div>
        <div style="margin-left:auto;">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="24" height="24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
          </svg>
        </div>
      </div>
    `;
  }).join('');

  const modal = document.getElementById('employee-selection-modal');
  modal.classList.add('active');
  modal.style.display = 'flex';
};

window.closeEmployeeSelectionModal = function() {
  const modal = document.getElementById('employee-selection-modal');
  modal.classList.remove('active');
  modal.style.display = 'none';
  
  setTimeout(() => {
    if (scanner) scanner.resume();
  }, 500);
};

window.selectEmployeeForAttendance = async function(employeeId) {
  const employee = employeesWithScannedQR.find(e => e.id === employeeId);
  if (!employee) return;

  closeEmployeeSelectionModal();
  await processAttendance(employee);
};

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
        <td onclick="openEmployeeAttendanceModal('${log.employee_id}', '${log.log_date}')" style="cursor:pointer;">
          <div class="user-cell">
            <div class="user-avatar" style="width:28px;height:28px;font-size:.65rem;flex-shrink:0;">
              ${emp.photo_url ? `<img src="${emp.photo_url}" alt="${esc(emp.full_name)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : getInitials(emp.full_name)}
            </div>
            <div>
              <div style="font-weight:500;font-size:.85rem;">${esc(emp.full_name || 'Employé')}</div>
              <div class="text-muted" style="font-size:.75rem;">${esc(emp.position || '')}</div>
              ${emp.employee_number ? `<div class="text-muted" style="font-size:.75rem;">#${esc(emp.employee_number)}</div>` : ''}
              ${emp.nif ? `<div class="text-muted" style="font-size:.75rem;">NIF: ${esc(emp.nif)}</div>` : ''}
            </div>
          </div>
        </td>
        <td onclick="openEmployeeAttendanceModal('${log.employee_id}', '${log.log_date}')" style="cursor:pointer;">${log.entry_time || '—'}</td>
        <td onclick="openEmployeeAttendanceModal('${log.employee_id}', '${log.log_date}')" style="cursor:pointer;">${log.exit_time || '—'}</td>
        <td onclick="openEmployeeAttendanceModal('${log.employee_id}', '${log.log_date}')" style="cursor:pointer;">${duration}</td>
        <td onclick="openEmployeeAttendanceModal('${log.employee_id}', '${log.log_date}')" style="cursor:pointer;"><span class="badge ${badgeClass}">${status}</span></td>
        <td style="text-align:center;">
          <button class="btn btn-icon btn-danger btn-sm" onclick="deleteAttendanceLog('${log.id}', event)" title="Supprimer cet enregistrement">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </td>
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

let currentEmployeeAttendanceId = null;

window.openEmployeeAttendanceModal = function(employeeId, selectedDate) {
  const employee = allEmployees.find(e => e.id === employeeId);
  if (!employee) return;
  currentEmployeeAttendanceId = employeeId;

  const modal = document.getElementById('employee-attendance-modal');
  const name = document.getElementById('employee-attendance-name');
  const meta = document.getElementById('employee-attendance-meta');
  const avatar = document.getElementById('employee-attendance-avatar');
  const title = document.getElementById('employee-attendance-title');
  const tbody = document.getElementById('employee-attendance-table');

  title.textContent = `Détails de ${esc(employee.full_name)}`;
  name.textContent = employee.full_name || 'Employé';
  meta.innerHTML = `
    ${employee.position ? `<div>${esc(employee.position)}</div>` : ''}
    ${employee.employee_number ? `<div>#${esc(employee.employee_number)}</div>` : ''}
    ${employee.nif ? `<div>NIF: ${esc(employee.nif)}</div>` : ''}
    ${employee.email ? `<div>${esc(employee.email)}</div>` : ''}
    ${employee.phone ? `<div>${esc(employee.phone)}</div>` : ''}
  `;
  avatar.innerHTML = employee.photo_url
    ? `<img src="${employee.photo_url}" alt="${esc(employee.full_name)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
    : getInitials(employee.full_name);

  const { start, end } = getAttendanceFilters();
  let employeeLogs = allAttendance.filter(l => l.employee_id === employeeId);
  if (start && end) {
    employeeLogs = employeeLogs.filter(l => l.log_date >= start && l.log_date <= end);
  }
  employeeLogs.sort((a, b) => (a.log_date > b.log_date ? -1 : 1));

  if (employeeLogs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted" style="padding:2rem;">Aucune présence trouvée</td></tr>`;
  } else {
    tbody.innerHTML = employeeLogs.map(log => {
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
      const isSelected = selectedDate && log.log_date === selectedDate;
      return `
        <tr style="${isSelected ? 'background:#f0f9ff;' : ''}">
          <td>${new Date(log.log_date).toLocaleDateString('fr-FR')}</td>
          <td>${log.entry_time || '—'}</td>
          <td>${log.exit_time || '—'}</td>
          <td>${duration}</td>
          <td><span class="badge ${badgeClass}">${status}</span></td>
        </tr>
      `;
    }).join('');
  }

  modal.classList.add('active');
  modal.style.display = 'flex';
};

window.closeEmployeeAttendanceModal = function() {
  const modal = document.getElementById('employee-attendance-modal');
  modal.classList.remove('active');
  modal.style.display = 'none';
  currentEmployeeAttendanceId = null;
};

window.exportEmployeeAttendanceReport = function() {
  if (!currentEmployeeAttendanceId) return;
  const employee = allEmployees.find(e => e.id === currentEmployeeAttendanceId);
  if (!employee) return;

  const { start, end } = getAttendanceFilters();
  let employeeLogs = allAttendance.filter(l => l.employee_id === currentEmployeeAttendanceId);
  if (start && end) {
    employeeLogs = employeeLogs.filter(l => l.log_date >= start && l.log_date <= end);
  }
  employeeLogs.sort((a, b) => (a.log_date > b.log_date ? -1 : 1));

  const headers = ['Date', 'Entrée', 'Sortie', 'Durée', 'Statut'];
  const rows = employeeLogs.map(log => {
    const duration = calculateDuration(log.entry_time, log.exit_time);
    const status = log.entry_time && log.exit_time ? 'Journée complète' : log.entry_time ? 'Présent' : '—';
    return [log.log_date, log.entry_time || '', log.exit_time || '', duration, status];
  });

  const csv = [
    ['Rapport de présence'],
    ['Employé', employee.full_name || ''],
    ['Poste', employee.position || ''],
    ['Numéro', employee.employee_number || ''],
    ['NIF', employee.nif || ''],
    ['Email', employee.email || ''],
    ['Téléphone', employee.phone || ''],
    [],
    headers,
    ...rows
  ]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const fileName = `rapport_${esc(employee.full_name).replace(/\s+/g, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Rapport exporté', 'success');
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

// ============================================
// QR CODE REASSIGNMENT
// ============================================

window.startReassignScanner = function() {
  const btnStart = document.getElementById('btn-start-reassign-scan');
  const btnStop = document.getElementById('btn-stop-reassign-scan');
  const result = document.getElementById('reassign-scan-result');

  if (!window.Html5Qrcode) {
    result.innerHTML = '<div class="alert alert-error">Scanner QR non disponible. Vérifiez votre connexion.</div>';
    return;
  }

  if (scanner) {
    stopScanner();
  }

  reassignScanner = new Html5Qrcode('qr-reader');
  reassignScanner.start(
    { facingMode: 'environment' },
    { fps: 10, qrbox: { width: 250, height: 250 } },
    onReassignScanSuccess,
    () => {}
  ).then(() => {
    btnStart.style.display = 'none';
    btnStop.style.display = 'inline-flex';
    result.innerHTML = '<div class="alert alert-warning">Scannez le badge à réattribuer...</div>';
  }).catch(err => {
    console.error('Reassign scanner error:', err);
    result.innerHTML = `<div class="alert alert-error">Erreur caméra: ${err.message || err}</div>`;
  });
};

window.stopReassignScanner = function() {
  if (!reassignScanner) return;
  reassignScanner.stop().then(() => {
    reassignScanner.clear();
    reassignScanner = null;
    document.getElementById('btn-start-reassign-scan').style.display = 'inline-flex';
    document.getElementById('btn-stop-reassign-scan').style.display = 'none';
    document.getElementById('reassign-scan-result').innerHTML = '';
  }).catch(err => console.error('Stop reassign scanner error:', err));
};

async function onReassignScanSuccess(qrData) {
  if (!reassignScanner) return;
  
  await reassignScanner.pause();
  stopReassignScanner();

  scannedQRForReassignment = qrData;
  
  const employeesWithThisQR = allEmployees.filter(e => e.qr_data === qrData);

  if (employeesWithThisQR.length === 0) {
    const result = document.getElementById('reassign-scan-result');
    result.innerHTML = '<div class="alert alert-error">Code QR non trouvé dans le système</div>';
    setTimeout(() => {
      result.innerHTML = '';
    }, 3000);
    return;
  }

  if (employeesWithThisQR.length > 1) {
    const result = document.getElementById('reassign-scan-result');
    result.innerHTML = `<div class="alert alert-warning">⚠️ DOUBLON DÉTECTÉ: ${employeesWithThisQR.length} employés ont ce même QR code!</div>`;
  }

  currentOwnerOfQR = employeesWithThisQR[0];
  openQRReassignModal();
}

window.openQRReassignModal = function() {
  if (!currentOwnerOfQR || !scannedQRForReassignment) return;

  document.getElementById('reassign-qr-data').textContent = scannedQRForReassignment.substring(0, 30) + '...';
  
  const employeesWithThisQR = allEmployees.filter(e => e.qr_data === scannedQRForReassignment);
  
  const ownerDiv = document.getElementById('reassign-current-owner');
  
  if (employeesWithThisQR.length > 1) {
    ownerDiv.innerHTML = `
      <div class="alert alert-error" style="margin-bottom:1rem;">
        <strong>⚠️ PROBLÈME DE DOUBLON DÉTECTÉ!</strong><br>
        ${employeesWithThisQR.length} employés ont le même code QR. Tous sauf un recevront un nouveau code QR.
      </div>
      <div style="font-weight:600;margin-bottom:0.5rem;">Employés concernés par ce doublon:</div>
      ${employeesWithThisQR.map(emp => `
        <div class="emp-card" style="background:#fee2e2;border-color:#ef4444;margin-bottom:0.5rem;">
          <div class="emp-avatar" style="width:48px;height:48px;">
            ${emp.photo_url ? `<img src="${emp.photo_url}" alt="${esc(emp.full_name)}">` : getInitials(emp.full_name)}
          </div>
          <div class="emp-info">
            <div class="emp-name">${esc(emp.full_name)}</div>
            <div class="emp-meta">${esc(emp.position)} • ${esc(emp.employee_number || '')}</div>
          </div>
        </div>
      `).join('')}
    `;
  } else {
    ownerDiv.innerHTML = `
      <div class="emp-card" style="background:#fef3c7;border-color:#fbbf24;">
        <div class="emp-avatar" style="width:56px;height:56px;font-size:1.3rem;">
          ${currentOwnerOfQR.photo_url ? `<img src="${currentOwnerOfQR.photo_url}" alt="${esc(currentOwnerOfQR.full_name)}">` : getInitials(currentOwnerOfQR.full_name)}
        </div>
        <div class="emp-info">
          <div style="font-weight:600;margin-bottom:0.25rem;">Actuellement attribué à:</div>
          <div class="emp-name">${esc(currentOwnerOfQR.full_name)}</div>
          <div class="emp-meta">${esc(currentOwnerOfQR.position)} • ${esc(currentOwnerOfQR.employee_number || '')}</div>
        </div>
      </div>
    `;
  }

  document.getElementById('reassign-employee-search').value = '';
  document.getElementById('reassign-employee-results').innerHTML = '<div class="text-muted" style="padding:1rem;text-align:center;">Recherchez un employé ci-dessus</div>';
  document.getElementById('btn-confirm-reassign').disabled = true;
  selectedNewOwner = null;

  const modal = document.getElementById('qr-reassign-modal');
  modal.classList.add('active');
  modal.style.display = 'flex';
};

window.closeQRReassignModal = function() {
  const modal = document.getElementById('qr-reassign-modal');
  modal.classList.remove('active');
  modal.style.display = 'none';
  scannedQRForReassignment = null;
  currentOwnerOfQR = null;
  selectedNewOwner = null;
};

window.searchEmployeeForReassignment = function() {
  const query = document.getElementById('reassign-employee-search').value.trim().toLowerCase();
  const resultsDiv = document.getElementById('reassign-employee-results');
  const btn = document.getElementById('btn-confirm-reassign');

  if (!query) {
    resultsDiv.innerHTML = '<div class="text-muted" style="padding:1rem;text-align:center;">Recherchez un employé ci-dessus</div>';
    selectedNewOwner = null;
    btn.disabled = true;
    return;
  }

  const matches = allEmployees.filter(e =>
    e.id !== currentOwnerOfQR.id && (
      e.full_name?.toLowerCase().includes(query) ||
      e.employee_number?.toLowerCase().includes(query) ||
      e.nif?.toLowerCase().includes(query)
    )
  );

  if (matches.length === 0) {
    resultsDiv.innerHTML = '<div class="text-muted" style="padding:1rem;text-align:center;">Aucun employé trouvé</div>';
    selectedNewOwner = null;
    btn.disabled = true;
    return;
  }

  resultsDiv.innerHTML = matches.map(e => `
    <div class="emp-card" style="cursor:pointer;margin-bottom:0.5rem;" onclick="selectNewOwner('${e.id}')">
      <div class="emp-avatar">
        ${e.photo_url ? `<img src="${e.photo_url}" alt="${esc(e.full_name)}">` : getInitials(e.full_name)}
      </div>
      <div class="emp-info">
        <div class="emp-name">${esc(e.full_name)}</div>
        <div class="emp-meta">${esc(e.position)} • ${esc(e.employee_number || '')}</div>
        ${e.nif ? `<div class="emp-meta">NIF: ${esc(e.nif)}</div>` : ''}
      </div>
    </div>
  `).join('');
};

window.selectNewOwner = function(id) {
  selectedNewOwner = allEmployees.find(e => e.id === id);
  const resultsDiv = document.getElementById('reassign-employee-results');
  const btn = document.getElementById('btn-confirm-reassign');

  if (!selectedNewOwner) return;

  resultsDiv.innerHTML = `
    <div class="emp-card" style="background:#d1fae5;border-color:#10b981;">
      <div class="emp-avatar">
        ${selectedNewOwner.photo_url ? `<img src="${selectedNewOwner.photo_url}" alt="${esc(selectedNewOwner.full_name)}">` : getInitials(selectedNewOwner.full_name)}
      </div>
      <div class="emp-info">
        <div style="font-weight:600;margin-bottom:0.25rem;color:#065f46;">✓ Sélectionné</div>
        <div class="emp-name">${esc(selectedNewOwner.full_name)}</div>
        <div class="emp-meta">${esc(selectedNewOwner.position)} • ${esc(selectedNewOwner.employee_number || '')}</div>
        ${selectedNewOwner.nif ? `<div class="emp-meta">NIF: ${esc(selectedNewOwner.nif)}</div>` : ''}
      </div>
    </div>
  `;
  btn.disabled = false;
};

window.confirmQRReassignment = async function() {
  if (!currentOwnerOfQR || !selectedNewOwner || !scannedQRForReassignment) return;

  const employeesWithThisQR = allEmployees.filter(e => e.qr_data === scannedQRForReassignment);
  
  let confirmMsg = `Confirmer la réattribution?\n\nVers: ${selectedNewOwner.full_name}\n\n`;
  
  if (employeesWithThisQR.length > 1) {
    confirmMsg += `⚠️ ATTENTION: ${employeesWithThisQR.length} employés ont ce QR code!\n`;
    confirmMsg += `Tous sauf ${selectedNewOwner.full_name} recevront un nouveau QR code.\n\n`;
    confirmMsg += `Employés concernés:\n${employeesWithThisQR.map(e => `- ${e.full_name}`).join('\n')}`;
  } else {
    confirmMsg += `Le badge de ${currentOwnerOfQR.full_name} ne fonctionnera plus.`;
  }
  
  if (!confirm(confirmMsg)) return;

  const supabase = getSupabaseClient();
  if (!supabase) return;

  const btn = document.getElementById('btn-confirm-reassign');
  btn.disabled = true;
  btn.textContent = 'Réattribution...';

  try {
    const oldQrData = scannedQRForReassignment;
    
    for (const emp of employeesWithThisQR) {
      if (emp.id === selectedNewOwner.id) continue;
      
      const newQrData = `DALIGHT-EMP-${(crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36))}`;
      
      const { error } = await supabase
        .from('presence_employees')
        .update({ qr_data: newQrData })
        .eq('id', emp.id);

      if (error) throw error;

      const empIndex = allEmployees.findIndex(e => e.id === emp.id);
      if (empIndex !== -1) {
        allEmployees[empIndex].qr_data = newQrData;
      }
    }

    const { error: error2 } = await supabase
      .from('presence_employees')
      .update({ qr_data: oldQrData })
      .eq('id', selectedNewOwner.id);

    if (error2) throw error2;

    const newOwnerIndex = allEmployees.findIndex(e => e.id === selectedNewOwner.id);
    if (newOwnerIndex !== -1) {
      allEmployees[newOwnerIndex].qr_data = oldQrData;
    }

    const fixedCount = employeesWithThisQR.length - 1;
    const msg = fixedCount > 0 
      ? `Code QR réattribué à ${selectedNewOwner.full_name}. ${fixedCount} doublon(s) corrigé(s).`
      : `Code QR réattribué à ${selectedNewOwner.full_name}`;
    
    showToast(msg, 'success');
    closeQRReassignModal();
  } catch (err) {
    console.error('Error reassigning QR code:', err);
    const msg = err?.message || err?.error?.message || 'Erreur inconnue';
    showToast('Erreur: ' + msg, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Confirmer réattribution';
  }
};

// ============================================
// QR CODE ASSIGNMENT
// ============================================

window.startAssignScanner = function() {
  const btnStart = document.getElementById('btn-start-assign-scan');
  const btnStop = document.getElementById('btn-stop-assign-scan');
  const result = document.getElementById('assign-scan-result');

  if (!window.Html5Qrcode) {
    result.innerHTML = '<div class="alert alert-error">Scanner QR non disponible.</div>';
    return;
  }

  if (scanner) stopScanner();
  if (reassignScanner) stopReassignScanner();

  assignScanner = new Html5Qrcode('qr-reader');
  assignScanner.start(
    { facingMode: 'environment' },
    { fps: 10, qrbox: { width: 250, height: 250 } },
    onAssignScanSuccess,
    () => {}
  ).then(() => {
    btnStart.style.display = 'none';
    btnStop.style.display = 'inline-flex';
    result.innerHTML = '<div class="alert alert-info">Scannez le badge à attribuer...</div>';
  }).catch(err => {
    console.error('Assign scanner error:', err);
    result.innerHTML = `<div class="alert alert-error">Erreur caméra: ${err.message || err}</div>`;
  });
};

window.stopAssignScanner = function() {
  if (!assignScanner) return;
  assignScanner.stop().then(() => {
    assignScanner.clear();
    assignScanner = null;
    document.getElementById('btn-start-assign-scan').style.display = 'inline-flex';
    document.getElementById('btn-stop-assign-scan').style.display = 'none';
    document.getElementById('assign-scan-result').innerHTML = '';
  }).catch(err => console.error('Stop assign scanner error:', err));
};

async function onAssignScanSuccess(qrData) {
  if (!assignScanner) return;
  
  await assignScanner.pause();
  stopAssignScanner();

  scannedQRForAssignment = qrData;
  openQRAssignModal();
}

window.openQRAssignModal = function() {
  if (!scannedQRForAssignment) return;

  document.getElementById('assign-qr-data').textContent = scannedQRForAssignment.substring(0, 40) + '...';
  
  const existingOwners = allEmployees.filter(e => e.qr_data === scannedQRForAssignment);
  const ownersDiv = document.getElementById('assign-existing-owners');
  
  if (existingOwners.length > 0) {
    ownersDiv.innerHTML = `
      <div style="font-weight:600;margin-bottom:0.5rem;">Employés ayant déjà ce QR code:</div>
      ${existingOwners.map(emp => {
        const modifierBadge = emp.qr_modifier 
          ? `<span style="display:inline-block;background:#3b82f6;color:white;padding:0.15rem 0.4rem;border-radius:4px;font-size:0.65rem;font-weight:600;margin-left:0.35rem;">QR-${emp.qr_modifier}</span>`
          : `<span style="display:inline-block;background:#10b981;color:white;padding:0.15rem 0.4rem;border-radius:4px;font-size:0.65rem;font-weight:600;margin-left:0.35rem;">QR Principal</span>`;
        
        return `
          <div class="emp-card" style="background:#f3f4f6;margin-bottom:0.5rem;">
            <div class="emp-avatar" style="width:48px;height:48px;">
              ${emp.photo_url ? `<img src="${emp.photo_url}" alt="${esc(emp.full_name)}">` : getInitials(emp.full_name)}
            </div>
            <div class="emp-info">
              <div class="emp-name">${esc(emp.full_name)}${modifierBadge}</div>
              <div class="emp-meta">${esc(emp.position)} • ${esc(emp.employee_number || '')}</div>
            </div>
          </div>
        `;
      }).join('')}
    `;
  } else {
    ownersDiv.innerHTML = '<div class="alert alert-info">Ce QR code n\'est attribué à aucun employé pour le moment.</div>';
  }

  document.getElementById('assign-employee-search').value = '';
  document.getElementById('assign-employee-results').innerHTML = '<div class="text-muted" style="padding:1rem;text-align:center;">Recherchez un employé ci-dessus</div>';
  document.getElementById('btn-confirm-assign').disabled = true;
  selectedEmployeeForAssignment = null;

  const modal = document.getElementById('qr-assign-modal');
  modal.classList.add('active');
  modal.style.display = 'flex';
};

window.closeQRAssignModal = function() {
  const modal = document.getElementById('qr-assign-modal');
  modal.classList.remove('active');
  modal.style.display = 'none';
  scannedQRForAssignment = null;
  selectedEmployeeForAssignment = null;
};

window.searchEmployeeForAssignment = function() {
  const query = document.getElementById('assign-employee-search').value.trim().toLowerCase();
  const resultsDiv = document.getElementById('assign-employee-results');
  const btn = document.getElementById('btn-confirm-assign');

  if (!query) {
    resultsDiv.innerHTML = '<div class="text-muted" style="padding:1rem;text-align:center;">Recherchez un employé ci-dessus</div>';
    selectedEmployeeForAssignment = null;
    btn.disabled = true;
    return;
  }

  const matches = allEmployees.filter(e =>
    e.full_name?.toLowerCase().includes(query) ||
    e.employee_number?.toLowerCase().includes(query) ||
    e.nif?.toLowerCase().includes(query)
  );

  if (matches.length === 0) {
    resultsDiv.innerHTML = '<div class="text-muted" style="padding:1rem;text-align:center;">Aucun employé trouvé</div>';
    selectedEmployeeForAssignment = null;
    btn.disabled = true;
    return;
  }

  resultsDiv.innerHTML = matches.map(e => `
    <div class="emp-card" style="cursor:pointer;margin-bottom:0.5rem;" onclick="selectEmployeeForAssignment('${e.id}')">
      <div class="emp-avatar">
        ${e.photo_url ? `<img src="${e.photo_url}" alt="${esc(e.full_name)}">` : getInitials(e.full_name)}
      </div>
      <div class="emp-info">
        <div class="emp-name">${esc(e.full_name)}</div>
        <div class="emp-meta">${esc(e.position)} • ${esc(e.employee_number || '')}</div>
        ${e.nif ? `<div class="emp-meta">NIF: ${esc(e.nif)}</div>` : ''}
      </div>
    </div>
  `).join('');
};

window.selectEmployeeForAssignment = function(id) {
  selectedEmployeeForAssignment = allEmployees.find(e => e.id === id);
  const resultsDiv = document.getElementById('assign-employee-results');
  const btn = document.getElementById('btn-confirm-assign');

  if (!selectedEmployeeForAssignment) return;

  resultsDiv.innerHTML = `
    <div class="emp-card" style="background:#d1fae5;border-color:#10b981;">
      <div class="emp-avatar">
        ${selectedEmployeeForAssignment.photo_url ? `<img src="${selectedEmployeeForAssignment.photo_url}" alt="${esc(selectedEmployeeForAssignment.full_name)}">` : getInitials(selectedEmployeeForAssignment.full_name)}
      </div>
      <div class="emp-info">
        <div style="font-weight:600;margin-bottom:0.25rem;color:#065f46;">✓ Sélectionné</div>
        <div class="emp-name">${esc(selectedEmployeeForAssignment.full_name)}</div>
        <div class="emp-meta">${esc(selectedEmployeeForAssignment.position)} • ${esc(selectedEmployeeForAssignment.employee_number || '')}</div>
      </div>
    </div>
  `;
  btn.disabled = false;
};

window.confirmQRAssignment = async function() {
  if (!selectedEmployeeForAssignment || !scannedQRForAssignment) return;

  const existingOwners = allEmployees.filter(e => e.qr_data === scannedQRForAssignment);
  const alreadyHasIt = existingOwners.find(e => e.id === selectedEmployeeForAssignment.id);

  if (alreadyHasIt) {
    showToast('Cet employé a déjà ce code QR', 'warning');
    return;
  }

  const confirmMsg = `Attribuer ce QR code à ${selectedEmployeeForAssignment.full_name}?\n\n${existingOwners.length > 0 ? `Ce QR est déjà partagé avec ${existingOwners.length} employé(s).` : 'Ce sera le premier employé avec ce QR.'}`;
  
  if (!confirm(confirmMsg)) return;

  const supabase = getSupabaseClient();
  if (!supabase) return;

  const btn = document.getElementById('btn-confirm-assign');
  btn.disabled = true;
  btn.textContent = 'Attribution...';

  try {
    // Déterminer le modificateur à assigner
    let qrModifier = null;
    
    if (existingOwners.length > 0) {
      // Il y a déjà des employés avec ce QR, trouver le prochain modificateur disponible
      const modifiers = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
      const usedModifiers = existingOwners.map(e => e.qr_modifier).filter(m => m !== null);
      
      // Trouver le premier modificateur non utilisé
      for (const mod of modifiers) {
        if (!usedModifiers.includes(mod)) {
          qrModifier = mod;
          break;
        }
      }
      
      // Si tous les modificateurs sont utilisés, utiliser un numéro
      if (!qrModifier) {
        qrModifier = 'Z' + (existingOwners.length + 1);
      }
    }
    // Sinon, le premier employé garde qr_modifier = NULL (Principal)

    const { error } = await supabase
      .from('presence_employees')
      .update({ 
        qr_data: scannedQRForAssignment,
        qr_modifier: qrModifier
      })
      .eq('id', selectedEmployeeForAssignment.id);

    if (error) throw error;

    const empIndex = allEmployees.findIndex(e => e.id === selectedEmployeeForAssignment.id);
    if (empIndex !== -1) {
      allEmployees[empIndex].qr_data = scannedQRForAssignment;
      allEmployees[empIndex].qr_modifier = qrModifier;
    }

    await loadEmployees();
    
    const modifierMsg = qrModifier ? ` (QR-${qrModifier})` : ' (QR Principal)';
    showToast(`Code QR attribué à ${selectedEmployeeForAssignment.full_name}${modifierMsg}`, 'success');
    closeQRAssignModal();
  } catch (err) {
    console.error('Error assigning QR code:', err);
    const msg = err?.message || err?.error?.message || 'Erreur inconnue';
    showToast('Erreur: ' + msg, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Confirmer attribution';
  }
};

// ============================================
// ATTENDANCE CORRECTION
// ============================================

let attendanceToDelete = null;

window.deleteAttendanceLog = async function(logId, event) {
  if (event) event.stopPropagation();
  
  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    // Récupérer les infos de l'enregistrement avant de le supprimer
    const { data, error } = await supabase
      .from('attendance_logs')
      .select(`
        *,
        presence_employees (
          id,
          full_name,
          employee_number,
          position,
          photo_url
        )
      `)
      .eq('id', logId)
      .single();

    if (error) throw error;
    if (!data) {
      showToast('Enregistrement introuvable', 'error');
      return;
    }

    attendanceToDelete = data;
    openDeleteAttendanceModal();
  } catch (err) {
    console.error('Error fetching attendance log:', err);
    const msg = err?.message || err?.error?.message || 'Erreur inconnue';
    showToast('Erreur: ' + msg, 'error');
  }
};

window.openDeleteAttendanceModal = function() {
  if (!attendanceToDelete) return;

  const emp = attendanceToDelete.presence_employees || {};
  const infoDiv = document.getElementById('delete-attendance-info');
  
  infoDiv.innerHTML = `
    <div style="display:flex;align-items:center;gap:1rem;margin-bottom:0.75rem;">
      <div style="width:48px;height:48px;border-radius:50%;overflow:hidden;background:#e5e7eb;">
        ${emp.photo_url ? `<img src="${emp.photo_url}" alt="${esc(emp.full_name)}" style="width:100%;height:100%;object-fit:cover;">` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-weight:600;color:#6b7280;">${getInitials(emp.full_name)}</div>`}
      </div>
      <div>
        <div style="font-weight:600;font-size:1rem;">${esc(emp.full_name || 'Employé')}</div>
        <div style="font-size:0.85rem;color:#6b7280;">${esc(emp.position || '')} • ${esc(emp.employee_number || '')}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;font-size:0.9rem;">
      <div><strong>Date:</strong> ${attendanceToDelete.log_date}</div>
      <div><strong>Entrée:</strong> ${attendanceToDelete.entry_time || '—'}</div>
      <div><strong>Sortie:</strong> ${attendanceToDelete.exit_time || '—'}</div>
      <div><strong>Statut:</strong> ${attendanceToDelete.entry_time && attendanceToDelete.exit_time ? 'Journée complète' : 'Présent'}</div>
    </div>
  `;

  document.getElementById('delete-by-name').value = '';
  document.getElementById('delete-reason').value = '';

  const modal = document.getElementById('delete-attendance-modal');
  modal.classList.add('active');
  modal.style.display = 'flex';
};

window.closeDeleteAttendanceModal = function() {
  const modal = document.getElementById('delete-attendance-modal');
  modal.classList.remove('active');
  modal.style.display = 'none';
  attendanceToDelete = null;
};

window.confirmAttendanceDeletion = async function() {
  if (!attendanceToDelete) return;

  const deletedBy = document.getElementById('delete-by-name').value.trim();
  const reason = document.getElementById('delete-reason').value.trim();

  if (!deletedBy) {
    showToast('Veuillez entrer votre nom', 'error');
    document.getElementById('delete-by-name').focus();
    return;
  }

  if (!reason) {
    showToast('Veuillez entrer un motif de suppression', 'error');
    document.getElementById('delete-reason').focus();
    return;
  }

  const supabase = getSupabaseClient();
  if (!supabase) return;

  const btn = document.getElementById('btn-confirm-delete');
  btn.disabled = true;
  btn.textContent = 'Suppression...';

  try {
    const emp = attendanceToDelete.presence_employees || {};
    
    // 1. Enregistrer dans l'audit log
    const { error: auditError } = await supabase
      .from('attendance_audit_log')
      .insert({
        action_type: 'DELETE',
        employee_id: attendanceToDelete.employee_id,
        employee_name: emp.full_name || 'Employé inconnu',
        log_date: attendanceToDelete.log_date,
        entry_time: attendanceToDelete.entry_time,
        exit_time: attendanceToDelete.exit_time,
        deleted_by: deletedBy,
        deletion_reason: reason,
        original_data: attendanceToDelete
      });

    if (auditError) throw auditError;

    // 2. Supprimer l'enregistrement
    const { error: deleteError } = await supabase
      .from('attendance_logs')
      .delete()
      .eq('id', attendanceToDelete.id);

    if (deleteError) throw deleteError;

    showToast('Enregistrement supprimé et archivé avec succès', 'success');
    closeDeleteAttendanceModal();
    await loadTodayAttendance();
    renderAttendanceCalendar();
  } catch (err) {
    console.error('Error deleting attendance log:', err);
    const msg = err?.message || err?.error?.message || 'Erreur inconnue';
    showToast('Erreur: ' + msg, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Confirmer la suppression';
  }
};
