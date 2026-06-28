var allStudents = [], allCourses = [], allEnrollments = [], editingId = null, sb;

function getSB() {
  return window.dalightAdminSupabase || (window.adminCore && window.adminCore.supabase) || null;
}

function startSchoolStudents() {
  sb = getSB();
  if (!sb) { setTimeout(startSchoolStudents, 100); return; }
  init();
}

async function init() {
  var tbody = document.getElementById('students-tbody');
  try {
    var res = await Promise.all([
      sb.from('dalightschool_students').select('*').order('name'),
      sb.from('dalightschool_courses').select('*').order('name'),
      sb.from('dalightschool_enrollments').select('*')
    ]);
    var err = res[0].error || res[1].error || res[2].error;
    if (err) throw err;
    allStudents    = res[0].data || [];
    allCourses     = res[1].data || [];
    allEnrollments = res[2].data || [];

    document.getElementById('stats-row').innerHTML =
      '<div class="card" style="padding:1.1rem;display:flex;align-items:center;gap:.8rem;"><div style="width:40px;height:40px;border-radius:10px;background:#e0e7ff;display:flex;align-items:center;justify-content:center;"><i data-lucide="users" style="color:#4f46e5;width:20px;height:20px;"></i></div><div><div style="font-size:1.4rem;font-weight:800;">' + allStudents.length + '</div><div style="font-size:.75rem;color:var(--admin-text-muted);">Total étudiants</div></div></div>' +
      '<div class="card" style="padding:1.1rem;display:flex;align-items:center;gap:.8rem;"><div style="width:40px;height:40px;border-radius:10px;background:#dcfce7;display:flex;align-items:center;justify-content:center;"><i data-lucide="check-circle" style="color:#10b981;width:20px;height:20px;"></i></div><div><div style="font-size:1.4rem;font-weight:800;">' + allStudents.filter(function(s){return s.is_active;}).length + '</div><div style="font-size:.75rem;color:var(--admin-text-muted);">Actifs</div></div></div>' +
      '<div class="card" style="padding:1.1rem;display:flex;align-items:center;gap:.8rem;"><div style="width:40px;height:40px;border-radius:10px;background:#ede9fe;display:flex;align-items:center;justify-content:center;"><i data-lucide="book-open" style="color:#8b5cf6;width:20px;height:20px;"></i></div><div><div style="font-size:1.4rem;font-weight:800;">' + allCourses.length + '</div><div style="font-size:.75rem;color:var(--admin-text-muted);">Cours disponibles</div></div></div>';

    var filter = document.getElementById('filter-course');
    while (filter.options.length > 1) filter.remove(1);
    allCourses.forEach(function(c) { var o = document.createElement('option'); o.value = c.id; o.textContent = c.name; filter.appendChild(o); });

    lucide.createIcons();
    renderTable();
  } catch(e) {
    tbody.innerHTML = '<tr><td colspan="6" style="padding:1.25rem;color:#b91c1c;background:#fee2e2;">Erreur: ' + e.message + '</td></tr>';
    console.error('[DALIGHT SCHOOL students]', e);
  }
}

function renderTable() {
  var q   = document.getElementById('search-input').value.toLowerCase();
  var cId = document.getElementById('filter-course').value;
  var st  = document.getElementById('filter-status').value;
  var list = allStudents.filter(function(s) {
    var mQ = !q || s.name.toLowerCase().indexOf(q) >= 0 || s.code_acces.toLowerCase().indexOf(q) >= 0;
    var mC = !cId || allEnrollments.some(function(e) { return e.student_id === s.id && e.course_id === cId; });
    var mS = !st || (st === 'active' ? s.is_active : !s.is_active);
    return mQ && mC && mS;
  });
  var tbody = document.getElementById('students-tbody');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--admin-text-muted);">Aucun résultat</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(function(s) {
    var enr = allEnrollments.filter(function(e) { return e.student_id === s.id; });
    var courses = enr.map(function(e) { return allCourses.find(function(c) { return c.id === e.course_id; }); }).filter(Boolean);
    var ch  = courses.length ? courses.map(function(c) { return '<span class="school-badge sb-blue">' + c.name + '</span>'; }).join(' ') : '<span style="color:var(--admin-text-muted);font-size:.8rem;">Aucun</span>';
    var sc  = s.is_active ? 'sb-green' : 'sb-red';
    var st2 = s.is_active ? 'Actif' : 'Inactif';
    var ai  = s.is_active ? 'user-x' : 'user-check';
    var at  = s.is_active ? 'Désactiver' : 'Activer';
    var dt  = new Date(s.created_at).toLocaleDateString('fr-FR');
    var safeCode = s.code_acces.replace(/'/g, '\\x27');
    var safeName = s.name.replace(/'/g, '\\x27');
    return '<tr>' +
      '<td><div style="font-weight:600;">' + s.name + '</div><div style="font-size:.75rem;color:var(--admin-text-muted);">' + (s.email||'') + '</div></td>' +
      '<td><span class="code-box" onclick="copyCode(\'' + safeCode + '\')" title="Cliquer pour copier">' + s.code_acces + '</span></td>' +
      '<td>' + ch + '</td>' +
      '<td><span class="school-badge ' + sc + '">' + st2 + '</span></td>' +
      '<td style="font-size:.8rem;color:var(--admin-text-muted);">' + dt + '</td>' +
      '<td><div style="display:flex;gap:.4rem;">' +
        '<button class="btn btn-icon btn-sm" onclick="editStudent(\'' + s.id + '\')" title="Modifier"><i data-lucide="pencil"></i></button>' +
        '<button class="btn btn-icon btn-sm" onclick="printCode(\'' + safeName + '\',\'' + safeCode + '\')" title="Imprimer"><i data-lucide="printer"></i></button>' +
        '<button class="btn btn-icon btn-sm btn-danger" onclick="toggleActive(\'' + s.id + '\',' + s.is_active + ')" title="' + at + '"><i data-lucide="' + ai + '"></i></button>' +
      '</div></td></tr>';
  }).join('');
  lucide.createIcons();
}

function generateCode() {
  document.getElementById('f-code').value = 'ETU-' + new Date().getFullYear() + '-' + String(allStudents.length + 1).padStart(4, '0');
}

function openAddModal() {
  editingId = null;
  document.getElementById('modal-title').textContent = 'Nouvel étudiant';
  ['f-name','f-email','f-code','f-notes'].forEach(function(id) { document.getElementById(id).value = ''; });
  document.getElementById('f-active').checked = true;
  generateCode();
  renderCourseCheckboxes([]);
  document.getElementById('modal-add').classList.add('active');
}

function editStudent(id) {
  var s = allStudents.find(function(x) { return x.id === id; });
  if (!s) return;
  editingId = id;
  document.getElementById('modal-title').textContent = "Modifier l'étudiant";
  document.getElementById('f-name').value  = s.name;
  document.getElementById('f-email').value = s.email || '';
  document.getElementById('f-code').value  = s.code_acces;
  document.getElementById('f-notes').value = s.notes || '';
  document.getElementById('f-active').checked = s.is_active;
  renderCourseCheckboxes(allEnrollments.filter(function(e) { return e.student_id === id; }).map(function(e) { return e.course_id; }));
  document.getElementById('modal-add').classList.add('active');
}

function renderCourseCheckboxes(checkedIds) {
  document.getElementById('course-checkboxes').innerHTML = allCourses.length ? allCourses.map(function(c) {
    return '<label style="display:flex;align-items:center;gap:.5rem;font-size:.875rem;cursor:pointer;">' +
      '<input type="checkbox" value="' + c.id + '" ' + (checkedIds.indexOf(c.id) >= 0 ? 'checked' : '') + ' style="width:15px;height:15px;">' +
      '<span style="width:10px;height:10px;border-radius:50%;background:' + c.color + ';display:inline-block;"></span>' +
      c.name + '</label>';
  }).join('') : '<div style="font-size:.8rem;color:var(--admin-text-muted);">Aucun cours créé</div>';
}

function closeModal() { document.getElementById('modal-add').classList.remove('active'); }

async function saveStudent() {
  var name = document.getElementById('f-name').value.trim();
  var code = document.getElementById('f-code').value.trim().toUpperCase();
  if (!name || !code) { alert('Nom et code requis.'); return; }
  var btn = document.getElementById('btn-save');
  btn.disabled = true; btn.textContent = 'Enregistrement…';
  var payload = { name: name, code_acces: code, email: document.getElementById('f-email').value.trim()||null, notes: document.getElementById('f-notes').value.trim()||null, is_active: document.getElementById('f-active').checked, updated_at: new Date().toISOString() };
  var studentId = editingId, error;
  if (editingId) {
    var r = await sb.from('dalightschool_students').update(payload).eq('id', editingId);
    error = r.error;
  } else {
    var r2 = await sb.from('dalightschool_students').insert(payload).select().single();
    error = r2.error; studentId = r2.data && r2.data.id;
  }
  if (error) { alert('Erreur: ' + error.message); btn.disabled = false; btn.textContent = 'Enregistrer'; return; }
  if (studentId) {
    var checked = Array.from(document.querySelectorAll('#course-checkboxes input:checked')).map(function(i) { return i.value; });
    await sb.from('dalightschool_enrollments').delete().eq('student_id', studentId);
    if (checked.length) await sb.from('dalightschool_enrollments').insert(checked.map(function(cId) { return { student_id: studentId, course_id: cId }; }));
  }
  closeModal();
  init();
}

async function toggleActive(id, cur) {
  await sb.from('dalightschool_students').update({ is_active: !cur }).eq('id', id);
  init();
}

function copyCode(code) {
  navigator.clipboard.writeText(code).then(function() { if (window.adminCore) window.adminCore.showToast('Code copié: ' + code); });
}

function printCode(name, code) {
  var w = window.open('', '_blank', 'width=400,height=300');
  w.document.write('<html><body onload="print()" style="font-family:Inter,sans-serif;text-align:center;padding:2rem;"><h2 style="color:#4f46e5;">DALIGHT SCHOOL</h2><p>Étudiant: <strong>' + name + '</strong></p><p style="font-size:1.5rem;font-weight:800;background:#e0e7ff;padding:.75rem 1.5rem;border-radius:8px;display:inline-block;">' + code + '</p><p style="font-size:.8rem;color:#666;">Portail: ' + window.location.origin + '/dalight-school/</p></body></html>');
  w.document.close();
}

function exportCSV() {
  var rows = [['Nom',"Code d'accès",'Email','Actif','Créé le']];
  allStudents.forEach(function(s) { rows.push([s.name, s.code_acces, s.email||'', s.is_active?'Oui':'Non', new Date(s.created_at).toLocaleDateString('fr-FR')]); });
  var csv = rows.map(function(r) { return r.join(','); }).join('\n');
  var a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv); a.download = 'etudiants.csv'; a.click();
}

document.addEventListener('DOMContentLoaded', function() { startSchoolStudents(); });

console.log('[DALIGHT SCHOOL] school-students.js loaded OK');
