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
    tbody.innerHTML = '<tr><td colspan="6" style="padding:1.25rem;color:#b91c1c;background:#fee2e2;">Erreur: ' + e.message + '</td></tr>';
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
      '<td><div style="display:flex;gap:.4rem;">' +
        '<button class="btn btn-icon btn-sm" onclick="editProfessor(\'' + p.id + '\')"><i data-lucide="pencil"></i></button>' +
        '<button class="btn btn-icon btn-sm" onclick="printProfCode(\'' + safeName + '\',\'' + safeCode + '\')"><i data-lucide="printer"></i></button>' +
        '<button class="btn btn-icon btn-sm btn-danger" onclick="toggleProfActive(\'' + p.id + '\',' + p.is_active + ')"><i data-lucide="' + ai + '"></i></button>' +
      '</div></td></tr>';
  }).join('') : '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--admin-text-muted);">Aucun professeur</td></tr>';
  lucide.createIcons();
}

function genProfCode() {
  document.getElementById('f-code').value = 'PROF-DS-' + String(allProfs.length + 1).padStart(3, '0');
}

function openAddModal() {
  editingId = null;
  document.getElementById('modal-title').textContent = 'Nouveau professeur';
  ['f-name','f-email','f-bio','f-code'].forEach(function(id) { document.getElementById(id).value = ''; });
  document.getElementById('f-course').value = '';
  document.getElementById('f-active').checked = true;
  genProfCode();
  document.getElementById('modal-add').style.display = 'flex';
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
  document.getElementById('modal-add').style.display = 'flex';
}

function closeModal() { document.getElementById('modal-add').style.display = 'none'; }

async function saveProfessor() {
  var name = document.getElementById('f-name').value.trim();
  var code = document.getElementById('f-code').value.trim().toUpperCase();
  if (!name || !code) { alert('Nom et code requis.'); return; }
  var btn = document.getElementById('btn-save');
  btn.disabled = true; btn.textContent = 'Enregistrement…';
  var payload = { name: name, code_acces: code, email: document.getElementById('f-email').value.trim()||null, bio: document.getElementById('f-bio').value.trim()||null, course_id: document.getElementById('f-course').value||null, is_active: document.getElementById('f-active').checked, updated_at: new Date().toISOString() };
  var r = editingId
    ? await sb.from('dalightschool_professors').update(payload).eq('id', editingId)
    : await sb.from('dalightschool_professors').insert(payload);
  if (r.error) { alert('Erreur: ' + r.error.message); }
  else { closeModal(); initProfessors(); if (window.adminCore) window.adminCore.showToast('Professeur enregistré !'); }
  btn.disabled = false; btn.textContent = 'Enregistrer';
}

async function toggleProfActive(id, cur) {
  await sb.from('dalightschool_professors').update({ is_active: !cur }).eq('id', id);
  initProfessors();
}

function copyProfCode(code) {
  navigator.clipboard.writeText(code).then(function() { if (window.adminCore) window.adminCore.showToast('Code copié: ' + code); });
}

function printProfCode(name, code) {
  var w = window.open('', '_blank', 'width=400,height=300');
  w.document.write('<html><body onload="print()" style="font-family:Inter,sans-serif;text-align:center;padding:2rem;"><h2 style="color:#4f46e5;">DALIGHT SCHOOL</h2><p>Professeur: <strong>' + name + '</strong></p><p style="font-size:1.5rem;font-weight:800;background:#ede9fe;padding:.75rem 1.5rem;border-radius:8px;display:inline-block;">' + code + '</p><p style="font-size:.8rem;color:#666;">Portail: ' + window.location.origin + '/dalight-school/</p></body></html>');
  w.document.close();
}

document.addEventListener('DOMContentLoaded', function() { startSchoolProfessors(); });
