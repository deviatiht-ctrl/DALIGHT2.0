var allProfs = [], allCourses = [], editingId = null, sb;

function getSB() {
  return window.dalightAdminSupabase || (window.adminCore && window.adminCore.supabase) || null;
}

function startSchoolProfessors() {
  sb = getSB();
  if (!sb) { setTimeout(startSchoolProfessors, 100); return; }
  initProfessors();
}

async function initProfessors() {
  var tbody = document.getElementById('profs-tbody');
  try {
    var res = await Promise.all([
      sb.from('dalightschool_professors').select('*, course:dalightschool_courses(name,color)').order('name'),
      sb.from('dalightschool_courses').select('*').order('name')
    ]);
    var err = res[0].error || res[1].error;
    if (err) throw err;
    allProfs   = res[0].data || [];
    allCourses = res[1].data || [];

    var sel = document.getElementById('f-course');
    while (sel.options.length > 1) sel.remove(1);
    allCourses.forEach(function(c) { var o = document.createElement('option'); o.value = c.id; o.textContent = c.name; sel.appendChild(o); });

    lucide.createIcons();
    renderProfsTable();
  } catch(e) {
    tbody.innerHTML = '<tr><td colspan="7" style="padding:1.25rem;color:#b91c1c;background:#fee2e2;">Erreur: ' + e.message + '</td></tr>';
    console.error('[DALIGHT SCHOOL professors]', e);
  }
}

function renderProfsTable() {
  document.getElementById('profs-tbody').innerHTML = allProfs.length ? allProfs.map(function(p) {
    var ch = p.course
      ? '<span style="display:inline-flex;align-items:center;gap:.4rem;"><span style="width:8px;height:8px;border-radius:50%;background:' + p.course.color + ';display:inline-block;"></span>' + p.course.name + '</span>'
      : '<span style="color:var(--admin-text-muted);font-size:.8rem;">Aucun</span>';
    var bg  = p.is_active ? '#dcfce7' : '#fee2e2';
    var clr = p.is_active ? '#166534' : '#991b1b';
    var st  = p.is_active ? 'Actif' : 'Inactif';
    var ai  = p.is_active ? 'user-x' : 'user-check';
    var safeCode = p.code_acces.replace(/'/g, '\\x27');
    var safeName = p.name.replace(/'/g, '\\x27');
    return '<tr>' +
      '<td style="font-weight:600;">' + p.name + '</td>' +
      '<td><span class="code-box" onclick="copyProfCode(\'' + safeCode + '\')" title="Copier">' + p.code_acces + '</span></td>' +
      '<td>' + ch + '</td>' +
      '<td style="font-size:.85rem;">' + (p.email||'—') + '</td>' +
      '<td><span style="display:inline-flex;align-items:center;gap:.3rem;padding:.2rem .6rem;border-radius:99px;font-size:.72rem;font-weight:600;background:' + bg + ';color:' + clr + ';">' + st + '</span></td>' +
      '<td><button class="btn btn-icon btn-sm" onclick="copyProfPortalLink()" title="Copier le lien du portail"><i data-lucide="link"></i></button>' +
        (p.email ? '<button class="btn btn-icon btn-sm" onclick="sendProfEmail(\'' + p.id + '\')" title="Envoyer code + lien par email"><i data-lucide="mail"></i></button>' : '') +
      '</td>' +
      '<td><div style="display:flex;gap:.4rem;">' +
        '<button class="btn btn-icon btn-sm" onclick="editProfessor(\'' + p.id + '\')"><i data-lucide="pencil"></i></button>' +
        '<button class="btn btn-icon btn-sm" onclick="printProfCode(\'' + safeName + '\',\'' + safeCode + '\')"><i data-lucide="printer"></i></button>' +
        '<button class="btn btn-icon btn-sm btn-danger" onclick="toggleProfActive(\'' + p.id + '\',' + p.is_active + ')"><i data-lucide="' + ai + '"></i></button>' +
      '</div></td></tr>';
  }).join('') : '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--admin-text-muted);">Aucun professeur</td></tr>';
  lucide.createIcons();
}

function secureRandomBlock(length) {
  var chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // pa gen 0/O/1/I/L pou evite konfizyon
  var arr = new Uint32Array(length);
  (window.crypto || window.msCrypto).getRandomValues(arr);
  var out = '';
  for (var i = 0; i < length; i++) out += chars[arr[i] % chars.length];
  return out;
}

function genProfCode() {
  var code;
  do {
    code = 'PROF-' + secureRandomBlock(4) + '-' + secureRandomBlock(4);
  } while (allProfs.some(function(p) { return p.code_acces === code; }));
  document.getElementById('f-code').value = code;
}

function openAddModal() {
  editingId = null;
  document.getElementById('modal-title').textContent = 'Nouveau professeur';
  ['f-name','f-email','f-bio','f-code'].forEach(function(id) { document.getElementById(id).value = ''; });
  document.getElementById('f-course').value = '';
  document.getElementById('f-active').checked = true;
  genProfCode();
  document.getElementById('modal-add').classList.add('active');
}

function editProfessor(id) {
  var p = allProfs.find(function(x) { return x.id === id; });
  if (!p) return;
  editingId = id;
  document.getElementById('modal-title').textContent = 'Modifier le professeur';
  document.getElementById('f-name').value   = p.name;
  document.getElementById('f-email').value  = p.email || '';
  document.getElementById('f-code').value   = p.code_acces;
  document.getElementById('f-bio').value    = p.bio || '';
  document.getElementById('f-course').value = p.course_id || '';
  document.getElementById('f-active').checked = p.is_active;
  document.getElementById('modal-add').classList.add('active');
}

function closeModal() { document.getElementById('modal-add').classList.remove('active'); }

async function saveProfessor() {
  var name = document.getElementById('f-name').value.trim();
  var code = document.getElementById('f-code').value.trim().toUpperCase();
  if (!name || !code) { alert('Nom et code requis.'); return; }
  var btn = document.getElementById('btn-save');
  btn.disabled = true; btn.textContent = 'Enregistrement…';
  var email = document.getElementById('f-email').value.trim();
  var payload = { name: name, code_acces: code, email: email||null, bio: document.getElementById('f-bio').value.trim()||null, course_id: document.getElementById('f-course').value||null, is_active: document.getElementById('f-active').checked, updated_at: new Date().toISOString() };
  var r = editingId
    ? await sb.from('dalightschool_professors').update(payload).eq('id', editingId)
    : await sb.from('dalightschool_professors').insert(payload);
  if (r.error) { alert('Erreur: ' + r.error.message); }
  else { closeModal(); initProfessors(); if (window.adminCore) window.adminCore.showToast('Professeur enregistré !'); }
  if (email && !r.error) {
    var courseSel = document.getElementById('f-course');
    var courseName = courseSel.selectedIndex > 0 ? courseSel.options[courseSel.selectedIndex].text : '';
    sendProfCredentialsEmail(name, email, code, courseName);
  }
  btn.disabled = false; btn.textContent = 'Enregistrer';
}

async function toggleProfActive(id, cur) {
  await sb.from('dalightschool_professors').update({ is_active: !cur }).eq('id', id);
  initProfessors();
}

function copyProfCode(code) {
  navigator.clipboard.writeText(code).then(function() { if (window.adminCore) window.adminCore.showToast('Code copié: ' + code); });
}

function copyProfPortalLink() {
  var url = 'https://dalightbeauty.com/dalight-school/';
  navigator.clipboard.writeText(url).then(function() { if (window.adminCore) window.adminCore.showToast('Lien copié: ' + url); });
}

function sendProfEmail(id) {
  var p = allProfs.find(function(x) { return x.id === id; });
  if (!p || !p.email) { alert('Ce professeur n\'a pas d\'email.'); return; }
  var courseName = p.course ? p.course.name : '';
  sendProfCredentialsEmail(p.name, p.email, p.code_acces, courseName);
}

async function sendProfCredentialsEmail(name, email, code, courseName) {
  var portalUrl = 'https://dalightbeauty.com/dalight-school/';
  var html = '<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;">' +
    '<h2 style="color:#4f46e5;">DALIGHT SCHOOL</h2>' +
    '<p>Bonjour <strong>' + name + '</strong>,</p>' +
    '<p>Voici vos informations de connexion au portail DALIGHT SCHOOL :</p>' +
    '<div style="background:#f1f5f9;padding:1rem;border-radius:8px;margin:1rem 0;">' +
    '<p style="margin:.2rem 0;font-size:1.1rem;font-weight:700;font-family:monospace;">Code d\'accès : ' + code + '</p>' +
    '</div>' +
    (courseName ? '<p><strong>Cours assigné :</strong> ' + courseName + '</p>' : '') +
    '<p>Pour accéder au portail, cliquez sur le lien suivant :</p>' +
    '<p><a href="' + portalUrl + '" style="color:#4f46e5;font-weight:600;">' + portalUrl + '</a></p>' +
    '<p style="margin-top:1.5rem;color:#777;">— L\'équipe DALIGHT SCHOOL</p>' +
    '</div>';
  try {
    if (window.adminCore) window.adminCore.showToast('Envoi de l\'email à ' + email + '…', 'warning');
    var r = await sb.functions.invoke('send-email', { body: { to: email, subject: 'Vos accès au portail DALIGHT SCHOOL', html: html, isAdmin: false } });
    if (r.error) throw r.error;
    if (r.data && r.data.success === false) throw new Error(r.data.error || 'Échec de l\'envoi');
    if (window.adminCore) window.adminCore.showToast('Email envoyé à ' + email, 'success');
  } catch(err) {
    var errMsg = err.message || err.toString();
    if (window.adminCore) window.adminCore.showToast('Erreur envoi email: ' + errMsg, 'error');
    console.error('[DALIGHT SCHOOL] sendProfEmail', err);
  }
}

function printProfCode(name, code) {
  var w = window.open('', '_blank', 'width=400,height=300');
  w.document.write('<html><body onload="print()" style="font-family:Inter,sans-serif;text-align:center;padding:2rem;"><h2 style="color:#4f46e5;">DALIGHT SCHOOL</h2><p>Professeur: <strong>' + name + '</strong></p><p style="font-size:1.5rem;font-weight:800;background:#ede9fe;padding:.75rem 1.5rem;border-radius:8px;display:inline-block;">' + code + '</p><p style="font-size:.8rem;color:#666;">Portail: https://dalightbeauty.com/dalight-school/</p></body></html>');
  w.document.close();
}

document.addEventListener('DOMContentLoaded', async function() {
  await new Promise(function(r) { setTimeout(r, 150); });
  if (!window.adminCore) { startSchoolProfessors(); return; }
  var session = await window.adminCore.initAdminCore();
  if (!session) return;
  startSchoolProfessors();
});
