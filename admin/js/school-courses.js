var allCourses = [], editingId = null, sb;

function getSB() {
  return window.dalightAdminSupabase || (window.adminCore && window.adminCore.supabase) || null;
}

function startSchoolCourses() {
  sb = getSB();
  if (!sb) { setTimeout(startSchoolCourses, 100); return; }
  initCourses();
}

async function initCourses() {
  var grid = document.getElementById('courses-grid');
  try {
    var res = await Promise.all([
      sb.from('dalightschool_courses').select('*').order('name'),
      sb.from('dalightschool_enrollments').select('course_id'),
      sb.from('dalightschool_professors').select('name,course_id').eq('is_active', true)
    ]);
    var err = res[0].error || res[1].error || res[2].error;
    if (err) throw err;
    allCourses = res[0].data || [];
    var enrollments = res[1].data || [];
    var profs = res[2].data || [];

    var uniq = {};
    enrollments.forEach(function(e) { uniq[e.course_id] = true; });
    var uniqueEnr = Object.keys(uniq).length;

    document.getElementById('stats-row').innerHTML =
      '<div class="card" style="padding:1.1rem;display:flex;align-items:center;gap:.8rem;"><div style="width:40px;height:40px;border-radius:10px;background:#e0e7ff;display:flex;align-items:center;justify-content:center;"><i data-lucide="book-open" style="color:#4f46e5;width:20px;height:20px;"></i></div><div><div style="font-size:1.4rem;font-weight:800;">' + allCourses.length + '</div><div style="font-size:.75rem;color:var(--admin-text-muted);">Cours</div></div></div>' +
      '<div class="card" style="padding:1.1rem;display:flex;align-items:center;gap:.8rem;"><div style="width:40px;height:40px;border-radius:10px;background:#dcfce7;display:flex;align-items:center;justify-content:center;"><i data-lucide="users" style="color:#10b981;width:20px;height:20px;"></i></div><div><div style="font-size:1.4rem;font-weight:800;">' + uniqueEnr + '</div><div style="font-size:.75rem;color:var(--admin-text-muted);">Cours avec étudiants</div></div></div>' +
      '<div class="card" style="padding:1.1rem;display:flex;align-items:center;gap:.8rem;"><div style="width:40px;height:40px;border-radius:10px;background:#ede9fe;display:flex;align-items:center;justify-content:center;"><i data-lucide="user" style="color:#8b5cf6;width:20px;height:20px;"></i></div><div><div style="font-size:1.4rem;font-weight:800;">' + profs.length + '</div><div style="font-size:.75rem;color:var(--admin-text-muted);">Professeurs actifs</div></div></div>';

    if (!allCourses.length) {
      grid.innerHTML = '<div class="card" style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--admin-text-muted);"><i data-lucide="book-open" style="width:48px;height:48px;opacity:.3;display:block;margin:0 auto 1rem;"></i><h3 style="margin-bottom:.5rem;">Aucun cours créé</h3><p>Créez votre premier cours pour commencer.</p></div>';
    } else {
      grid.innerHTML = allCourses.map(function(c) {
        var enrolled = enrollments.filter(function(e) { return e.course_id === c.id; }).length;
        var prof = profs.find(function(p) { return p.course_id === c.id; });
        var inactif = c.is_active ? '' : '<span style="background:rgba(0,0,0,.3);color:#fff;font-size:.7rem;padding:.15rem .5rem;border-radius:99px;">Inactif</span>';
        var profName = prof ? prof.name : 'Sans prof';
        var safeName = c.name.replace(/'/g, '\\x27');
        return '<div class="card" style="padding:0;overflow:hidden;">' +
          '<div style="height:80px;background:linear-gradient(135deg,' + c.color + ',' + c.color + 'cc);display:flex;align-items:center;padding:1.25rem;gap:.75rem;">' +
            '<div style="width:44px;height:44px;border-radius:12px;background:rgba(255,255,255,.2);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;"><i data-lucide="book-open" style="width:22px;height:22px;color:white;"></i></div>' +
            '<div style="flex:1;color:#fff;"><div style="font-weight:800;font-size:.95rem;">' + c.name + '</div><div style="font-size:.75rem;opacity:.8;">Code: ' + c.code + '</div></div>' +
            inactif +
          '</div>' +
          '<div style="padding:1rem;">' +
            '<div style="font-size:.85rem;color:var(--admin-text-muted);margin-bottom:.75rem;">' + (c.description||'Aucune description') + '</div>' +
            '<div style="display:flex;gap:.5rem;flex-wrap:wrap;font-size:.78rem;">' +
              '<span style="background:#e0e7ff;color:#4338ca;padding:.2rem .6rem;border-radius:99px;display:inline-flex;align-items:center;gap:.3rem;"><i data-lucide="users" style="width:13px;height:13px;"></i>' + enrolled + ' étudiant(s)</span>' +
              '<span style="background:#ede9fe;color:#5b21b6;padding:.2rem .6rem;border-radius:99px;display:inline-flex;align-items:center;gap:.3rem;"><i data-lucide="user" style="width:13px;height:13px;"></i>' + profName + '</span>' +
            '</div>' +
          '</div>' +
          '<div style="padding:.75rem 1rem;border-top:1px solid var(--admin-border);display:flex;gap:.5rem;">' +
            '<button class="btn btn-secondary btn-sm" onclick="editCourse(\'' + c.id + '\')"><i data-lucide="pencil"></i> Modifier</button>' +
            '<button class="btn btn-danger btn-sm" onclick="deleteCourse(\'' + c.id + '\',\'' + safeName + '\')"><i data-lucide="trash-2"></i></button>' +
          '</div></div>';
      }).join('');
    }
    lucide.createIcons();
  } catch(e) {
    grid.innerHTML = '<div class="card" style="grid-column:1/-1;padding:1.25rem;color:#b91c1c;background:#fee2e2;border:1px solid #fecaca;">Erreur DALIGHT SCHOOL: ' + e.message + '</div>';
    console.error('[DALIGHT SCHOOL courses]', e);
  }
}

function openAddModal() {
  editingId = null;
  document.getElementById('modal-title').textContent = 'Nouveau cours';
  ['f-name','f-desc','f-code'].forEach(function(id) { document.getElementById(id).value = ''; });
  document.getElementById('f-color').value = '#4f46e5';
  document.getElementById('f-active').checked = true;
  document.getElementById('modal-add').style.display = 'flex';
}

function editCourse(id) {
  var c = allCourses.find(function(x) { return x.id === id; });
  if (!c) return;
  editingId = id;
  document.getElementById('modal-title').textContent = 'Modifier le cours';
  document.getElementById('f-name').value  = c.name;
  document.getElementById('f-desc').value  = c.description || '';
  document.getElementById('f-code').value  = c.code;
  document.getElementById('f-color').value = c.color || '#4f46e5';
  document.getElementById('f-active').checked = c.is_active;
  document.getElementById('modal-add').style.display = 'flex';
}

function closeModal() { document.getElementById('modal-add').style.display = 'none'; }

async function saveCourse() {
  var name = document.getElementById('f-name').value.trim();
  var code = document.getElementById('f-code').value.trim().toUpperCase();
  if (!name || !code) { alert('Nom et code requis.'); return; }
  var btn = document.getElementById('btn-save');
  btn.disabled = true; btn.textContent = 'Enregistrement…';
  var payload = { name: name, code: code, description: document.getElementById('f-desc').value.trim()||null, color: document.getElementById('f-color').value, is_active: document.getElementById('f-active').checked, updated_at: new Date().toISOString() };
  var r = editingId
    ? await sb.from('dalightschool_courses').update(payload).eq('id', editingId)
    : await sb.from('dalightschool_courses').insert(payload);
  if (r.error) { alert('Erreur: ' + r.error.message); }
  else { closeModal(); initCourses(); if (window.adminCore) window.adminCore.showToast('Cours enregistré !'); }
  btn.disabled = false; btn.textContent = 'Enregistrer';
}

async function deleteCourse(id, name) {
  if (!confirm('Supprimer le cours "' + name + '" ? Cette action est irréversible.')) return;
  var r = await sb.from('dalightschool_courses').delete().eq('id', id);
  if (r.error) alert('Erreur: ' + r.error.message);
  else { if (window.adminCore) window.adminCore.showToast('Cours supprimé.'); initCourses(); }
}

document.addEventListener('DOMContentLoaded', function() { startSchoolCourses(); });
