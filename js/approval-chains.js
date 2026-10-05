/* ==========================================================================
   🔗 หน้า HR: สายอนุมัติหลายขั้น + ทีม/กะ  (/pages/hr/approval-chains.html)
   - แผนก: รายการขั้น 1..9 แต่ละขั้นมีผู้อนุมัติได้หลายคน (คนใดคนหนึ่งกดก็ได้)
   - ทีม/กะ: แทนที่เฉพาะขั้นที่ต่างจากแผนก + จัดสมาชิก
   - ใบลาที่ต้องโอนผู้อนุมัติ (ผู้อนุมัติพ้นสภาพ / สายเปลี่ยน)
   - ตั้งค่าทั่วไป: ใบลาของหัวหน้า/ผู้จัดการต้องผ่านผู้บริหาร
   - ทดสอบสายอนุมัติของพนักงานรายคน
   ========================================================================== */
(function () {
  'use strict';

  const S = {
    sb: null,
    depts: [],
    emps: [],
    empById: {},
    teams: [],
    chainRows: [],
    policy: { executive_for_approvers: true },
    executiveId: '',
    reassign: [],
    showAllReassign: false,
    editor: null
  };
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uniq = (a) => Array.from(new Set((a || []).filter(Boolean).map(String)));
  const isActive = (e) => e && (!e.status || String(e.status).toLowerCase() === 'active');
  const empName = (id) => S.empById[String(id)]?.full_name || 'ไม่พบชื่อ';
  const toast = (title, icon = 'success') => Swal.fire({ toast: true, position: 'top-end', icon, title, showConfirmButton: false, timer: 2200 });

  function client() {
    return window.pvtSupabase?.getClient?.() || window.PVTSDK?.client || window.pvtSupabase?.client || null;
  }

  // ------------------------------------------------------------------ load
  async function loadAll() {
    S.sb = client();
    if (!S.sb) { setTimeout(loadAll, 300); return; }
    const ready = window.PVTApproval ? await window.PVTApproval.isReady() : false;
    $('#acSetupNotice').hidden = ready;
    $('#acMain').hidden = !ready;
    if (!ready) return;

    const [d, e, t, c, p, x] = await Promise.all([
      S.sb.from('departments').select('id, department_name, status').order('department_name'),
      S.sb.from('employees').select('id, full_name, employee_code, role, status, department_id, team_id, l1_approver_id, l2_approver_id, l3_approver_id, positions!position_id(position_name)').order('full_name'),
      S.sb.from('approval_teams').select('*').order('team_name'),
      S.sb.from('approval_chain_steps').select('*').order('step_no'),
      S.sb.from('system_settings').select('setting_value').eq('setting_key', 'approval_policy').maybeSingle(),
      S.sb.from('system_settings').select('employee_id').eq('setting_key', 'leave_executive_approver').maybeSingle()
    ]);
    S.depts = (d.data || []).filter((x) => !x.status || x.status === 'active');
    S.emps = e.data || [];
    S.empById = {};
    S.emps.forEach((x) => { S.empById[String(x.id)] = x; });
    S.teams = t.data || [];
    S.chainRows = c.data || [];
    S.policy = Object.assign({ executive_for_approvers: true }, p.data?.setting_value || {});
    S.executiveId = x.data?.employee_id ? String(x.data.employee_id) : '';
    renderDepts();
    renderPolicy();
    const sel = $('#acPreviewSelect');
    const keep = sel.value;
    sel.innerHTML = '<option value="">— เลือกพนักงาน —</option>' + S.emps.filter(isActive).map((e) => `<option value="${e.id}">${esc(e.full_name)} (${esc(e.employee_code)})</option>`).join('');
    sel.value = keep;
    await loadReassign();
  }

  const stepsOf = (scopeType, scopeId) => S.chainRows
    .filter((r) => r.scope_type === scopeType && String(r.scope_id) === String(scopeId))
    .sort((a, b) => a.step_no - b.step_no);

  // ------------------------------------------------------------------ departments
  function chainChipsHtml(steps, deptSteps) {
    if (!steps.length) return '<span class="ac-empty">ยังไม่ได้ตั้งผู้อนุมัติ — ใบลาจะไปที่ HR</span>';
    return steps.map((s, i) => {
      const names = (s.approver_ids || []).map((id) => {
        const p = S.empById[String(id)];
        return `<span class="ac-person${isActive(p) ? '' : ' is-inactive'}" title="${isActive(p) ? '' : 'พ้นสภาพ/ไม่ใช้งาน'}">${esc(p?.full_name || 'ไม่พบชื่อ')}</span>`;
      }).join('<span class="ac-or">หรือ</span>');
      const inherited = deptSteps && s.__inherited ? ' is-inherited' : '';
      return `${i ? '<span class="material-symbols-outlined ac-arrow" aria-hidden="true">arrow_forward</span>' : ''}
        <span class="ac-step${inherited}"><b>${s.step_no}</b><span class="ac-step__label">${esc(s.step_label || `ขั้นที่ ${s.step_no}`)}</span>${names || '<span class="ac-empty">ว่าง</span>'}</span>`;
    }).join('');
  }

  function teamEffectiveSteps(team) {
    const dept = stepsOf('department', team.department_id).map((s) => Object.assign({}, s, { __inherited: true }));
    const own = stepsOf('team', team.id);
    const byNo = {};
    dept.forEach((s) => { byNo[s.step_no] = s; });
    own.forEach((s) => { byNo[s.step_no] = s; });
    return Object.keys(byNo).map(Number).sort((a, b) => a - b).map((n) => byNo[n]);
  }

  function renderDepts() {
    const q = String($('#acSearch')?.value || '').trim().toLowerCase();
    const wrap = $('#acDeptList');
    const cards = S.depts.filter((d) => !q || d.department_name.toLowerCase().includes(q)).map((d) => {
      const steps = stepsOf('department', d.id);
      const members = S.emps.filter((e) => String(e.department_id) === String(d.id) && isActive(e));
      const teams = S.teams.filter((t) => String(t.department_id) === String(d.id));
      const personal = members.filter((e) => e.l1_approver_id || e.l2_approver_id || e.l3_approver_id).length;
      const noApprover = !steps.some((s) => (s.approver_ids || []).some((id) => isActive(S.empById[String(id)])));
      const teamHtml = teams.map((t) => {
        const count = members.filter((e) => String(e.team_id) === String(t.id)).length;
        return `<div class="ac-team">
          <div class="ac-team__head">
            <span class="material-symbols-outlined" aria-hidden="true">groups</span>
            <strong>${esc(t.team_name)}</strong><span class="ac-muted">${count} คน</span>
            <button type="button" class="ac-link" data-act="edit-team" data-id="${t.id}">แก้ไข</button>
          </div>
          <div class="ac-chain">${chainChipsHtml(teamEffectiveSteps(t), true)}</div>
        </div>`;
      }).join('');
      return `<article class="ac-card${noApprover ? ' is-warn' : ''}">
        <header class="ac-card__head">
          <div>
            <h3>${esc(d.department_name)}</h3>
            <p class="ac-muted">${members.length} คน${teams.length ? ` · ${teams.length} ทีม/กะ` : ''}${personal ? ` · ตั้งรายบุคคล ${personal} คน` : ''}</p>
          </div>
          <div class="ac-card__actions">
            <button type="button" class="ac-btn ac-btn--ghost" data-act="add-team" data-id="${d.id}"><span class="material-symbols-outlined" aria-hidden="true">group_add</span>ทีม/กะ</button>
            <button type="button" class="ac-btn" data-act="edit-dept" data-id="${d.id}"><span class="material-symbols-outlined" aria-hidden="true">edit</span>แก้สายอนุมัติ</button>
          </div>
        </header>
        <div class="ac-chain">${chainChipsHtml(steps)}<span class="material-symbols-outlined ac-arrow" aria-hidden="true">arrow_forward</span><span class="ac-step ac-step--hr"><span class="ac-step__label">ผลถึง HR</span></span></div>
        ${teamHtml ? `<div class="ac-teams">${teamHtml}</div>` : ''}
      </article>`;
    });
    wrap.innerHTML = cards.join('') || '<p class="ac-muted">ไม่พบแผนก</p>';
    const noApproverCount = S.depts.filter((d) => !stepsOf('department', d.id).some((s) => (s.approver_ids || []).some((id) => isActive(S.empById[String(id)])))).length;
    $('#acStatDepts').textContent = S.depts.length;
    $('#acStatNoApprover').textContent = noApproverCount;
    $('#acStatTeams').textContent = S.teams.length;
  }

  // ------------------------------------------------------------------ editor
  function openEditor(kind, id, deptIdForNewTeam) {
    let title, steps, team = null, dept;
    if (kind === 'dept') {
      dept = S.depts.find((d) => String(d.id) === String(id));
      title = `สายอนุมัติ: ${dept.department_name}`;
      steps = stepsOf('department', id).map((s) => ({ label: s.step_label || '', ids: uniq(s.approver_ids) }));
      if (!steps.length) steps = [{ label: 'หัวหน้างาน', ids: [] }];
    } else {
      team = id ? S.teams.find((t) => String(t.id) === String(id)) : { id: null, team_name: '', department_id: deptIdForNewTeam };
      dept = S.depts.find((d) => String(d.id) === String(team.department_id));
      title = id ? `ทีม/กะ: ${team.team_name}` : `เพิ่มทีม/กะ ใน ${dept.department_name}`;
      const deptSteps = stepsOf('department', team.department_id);
      const own = id ? stepsOf('team', id) : [];
      const maxNo = Math.max(deptSteps.length ? deptSteps[deptSteps.length - 1].step_no : 0, own.length ? own[own.length - 1].step_no : 0, 1);
      steps = [];
      for (let n = 1; n <= maxNo; n++) {
        const d = deptSteps.find((s) => s.step_no === n);
        const o = own.find((s) => s.step_no === n);
        steps.push({ label: (o || d)?.step_label || '', ids: uniq((o || d)?.approver_ids), override: Boolean(o) || !d, deptLabel: d?.step_label || '', deptIds: uniq(d?.approver_ids) });
      }
    }
    S.editor = { kind, id, dept, team, steps, members: team ? new Set(S.emps.filter((e) => team.id && String(e.team_id) === String(team.id)).map((e) => String(e.id))) : null };
    $('#acEditorTitle').textContent = title;
    renderEditor();
    $('#acEditor').classList.add('is-open');
    $('#acEditor').setAttribute('aria-hidden', 'false');
  }

  function closeEditor() {
    $('#acEditor').classList.remove('is-open');
    $('#acEditor').setAttribute('aria-hidden', 'true');
    S.editor = null;
  }

  function personChips(ids, stepIdx, readonly) {
    return ids.map((id) => {
      const p = S.empById[id];
      return `<span class="ac-chip${isActive(p) ? '' : ' is-inactive'}">${esc(p?.full_name || 'ไม่พบชื่อ')}${p?.employee_code ? `<small>${esc(p.employee_code)}</small>` : ''}${readonly ? '' : `<button type="button" aria-label="เอาออก" data-act="rm-person" data-step="${stepIdx}" data-id="${id}">×</button>`}</span>`;
    }).join('');
  }

  function renderEditor() {
    const ed = S.editor;
    const body = $('#acEditorBody');
    let html = '';
    if (ed.kind === 'team') {
      const deptMembers = S.emps.filter((e) => String(e.department_id) === String(ed.team.department_id) && isActive(e));
      html += `<label class="ac-field"><span>ชื่อทีม/กะ</span>
        <input type="text" id="acTeamName" value="${esc(ed.team.team_name)}" placeholder="เช่น กะเช้า, กะดึก, ทีม A" maxlength="60" /></label>
        <details class="ac-members" ${ed.team.id ? '' : 'open'}>
          <summary>สมาชิกทีม <span class="ac-muted" id="acMemberCount">(${ed.members.size} คน)</span></summary>
          <input type="search" class="ac-input" id="acMemberSearch" placeholder="ค้นหาชื่อ/รหัส" />
          <div class="ac-member-list" id="acMemberList">${deptMembers.map((e) => {
            const other = e.team_id && String(e.team_id) !== String(ed.team.id) ? S.teams.find((t) => String(t.id) === String(e.team_id)) : null;
            return `<label class="ac-member" data-q="${esc((e.full_name + ' ' + e.employee_code).toLowerCase())}">
              <input type="checkbox" value="${e.id}" ${ed.members.has(String(e.id)) ? 'checked' : ''} />
              <span>${esc(e.full_name)} <small>${esc(e.employee_code)}</small>${other ? ` <em>(อยู่ ${esc(other.team_name)})</em>` : ''}</span></label>`;
          }).join('') || '<p class="ac-muted">แผนกนี้ยังไม่มีพนักงาน</p>'}</div>
        </details>
        <p class="ac-hint">ขั้นที่ไม่ได้ติ๊ก "ใช้เฉพาะทีมนี้" จะใช้ผู้อนุมัติของแผนก (เปลี่ยนที่แผนกแล้วทีมเปลี่ยนตาม)</p>`;
    } else {
      html += `<p class="ac-hint">ใบลาจะส่งตามลำดับขั้นจากบนลงล่าง แต่ละขั้นใส่ผู้อนุมัติได้หลายคน "คนใดคนหนึ่งกดก็ได้"<br>
        ผู้ยื่นที่เป็นผู้อนุมัติขั้นไหนจะข้ามขั้นนั้นอัตโนมัติ · คนเดียวกันหลายขั้นติดกันจะรวมเป็นขั้นเดียว · จบแล้วผลถึง HR เสมอ</p>`;
    }
    html += '<ol class="ac-steps">';
    ed.steps.forEach((s, i) => {
      const locked = ed.kind === 'team' && !s.override;
      html += `<li class="ac-step-edit${locked ? ' is-locked' : ''}">
        <div class="ac-step-edit__head">
          <span class="ac-step-edit__no">${i + 1}</span>
          <input type="text" class="ac-input" data-act="label" data-step="${i}" value="${esc(locked ? s.deptLabel : s.label)}" placeholder="ชื่อขั้น เช่น หัวหน้างาน" ${locked ? 'disabled' : ''} maxlength="40" />
          ${ed.kind === 'team' ? `<label class="ac-override"><input type="checkbox" data-act="override" data-step="${i}" ${s.override ? 'checked' : ''} ${s.deptIds && !s.deptIds.length && !s.deptLabel ? 'disabled checked' : ''}/> ใช้เฉพาะทีมนี้</label>` : ''}
          <div class="ac-step-edit__tools">
            <button type="button" class="ac-icon" data-act="up" data-step="${i}" ${i === 0 ? 'disabled' : ''} aria-label="เลื่อนขึ้น"><span class="material-symbols-outlined">arrow_upward</span></button>
            <button type="button" class="ac-icon" data-act="down" data-step="${i}" ${i === ed.steps.length - 1 ? 'disabled' : ''} aria-label="เลื่อนลง"><span class="material-symbols-outlined">arrow_downward</span></button>
            <button type="button" class="ac-icon ac-icon--danger" data-act="del-step" data-step="${i}" aria-label="ลบขั้น"><span class="material-symbols-outlined">delete</span></button>
          </div>
        </div>
        <div class="ac-chips">${personChips(locked ? s.deptIds : s.ids, i, locked) || '<span class="ac-muted">ยังไม่มีผู้อนุมัติ</span>'}</div>
        ${locked ? '<p class="ac-muted ac-small">ใช้ผู้อนุมัติของแผนก</p>' : `<div class="ac-picker">
          <input type="search" class="ac-input" data-act="pick" data-step="${i}" placeholder="+ เพิ่มผู้อนุมัติ (พิมพ์ชื่อ/รหัส)" autocomplete="off" />
          <div class="ac-picker__list" data-list="${i}" hidden></div>
        </div>`}
      </li>`;
    });
    html += `</ol>
      <button type="button" class="ac-btn ac-btn--ghost ac-add-step" data-act="add-step" ${ed.steps.length >= 9 ? 'disabled' : ''}>
        <span class="material-symbols-outlined" aria-hidden="true">add</span>เพิ่มขั้น</button>`;
    body.innerHTML = html;
    $('#acEditorDelete').hidden = !(ed.kind === 'team' && ed.team.id);
  }

  function pickerResults(q, stepIdx) {
    const ed = S.editor;
    const taken = new Set(ed.steps[stepIdx].ids);
    const qq = q.trim().toLowerCase();
    const list = S.emps.filter((e) => isActive(e) && !taken.has(String(e.id)) &&
      (!qq || (e.full_name || '').toLowerCase().includes(qq) || String(e.employee_code || '').toLowerCase().includes(qq)));
    // คนในแผนกเดียวกันขึ้นก่อน
    const deptId = String(ed.dept?.id || '');
    list.sort((a, b) => (String(b.department_id) === deptId) - (String(a.department_id) === deptId));
    return list.slice(0, 30);
  }

  function showPicker(input) {
    const i = +input.dataset.step;
    const box = $(`[data-list="${i}"]`, $('#acEditorBody'));
    const res = pickerResults(input.value, i);
    box.innerHTML = res.map((e) => {
      const dn = S.depts.find((d) => String(d.id) === String(e.department_id))?.department_name || '';
      return `<button type="button" data-act="add-person" data-step="${i}" data-id="${e.id}">
        <strong>${esc(e.full_name)}</strong><small>${esc(e.employee_code)}${dn ? ` · ${esc(dn)}` : ''}${e.positions?.position_name ? ` · ${esc(e.positions.position_name)}` : ''}</small></button>`;
    }).join('') || '<p class="ac-muted">ไม่พบพนักงาน</p>';
    box.hidden = false;
  }

  function onEditorClick(ev) {
    const btn = ev.target.closest('[data-act]');
    if (!btn || !S.editor) return;
    const ed = S.editor;
    const i = +btn.dataset.step;
    switch (btn.dataset.act) {
      case 'rm-person': ed.steps[i].ids = ed.steps[i].ids.filter((x) => x !== btn.dataset.id); break;
      case 'add-person': ed.steps[i].ids = uniq([...ed.steps[i].ids, btn.dataset.id]); break;
      case 'up': [ed.steps[i - 1], ed.steps[i]] = [ed.steps[i], ed.steps[i - 1]]; break;
      case 'down': [ed.steps[i + 1], ed.steps[i]] = [ed.steps[i], ed.steps[i + 1]]; break;
      case 'del-step': ed.steps.splice(i, 1); break;
      case 'add-step': ed.steps.push({ label: '', ids: [], override: true, deptLabel: '', deptIds: [] }); break;
      default: return;
    }
    renderEditor();
    if (btn.dataset.act === 'add-person') {
      const inp = $(`input[data-act="pick"][data-step="${i}"]`, $('#acEditorBody'));
      if (inp) inp.focus();
    }
  }

  function onEditorInput(ev) {
    const el = ev.target;
    if (!S.editor) return;
    if (el.dataset.act === 'label') S.editor.steps[+el.dataset.step].label = el.value;
    if (el.id === 'acTeamName') S.editor.team.team_name = el.value;
    if (el.dataset.act === 'pick') showPicker(el);
    if (el.id === 'acMemberSearch') {
      const q = el.value.trim().toLowerCase();
      $('#acMemberList').querySelectorAll('.ac-member').forEach((m) => { m.hidden = q && !m.dataset.q.includes(q); });
    }
  }

  function onEditorChange(ev) {
    const el = ev.target;
    if (!S.editor) return;
    if (el.dataset.act === 'override') {
      const s = S.editor.steps[+el.dataset.step];
      s.override = el.checked;
      if (s.override && !s.ids.length) { s.ids = s.deptIds.slice(); s.label = s.deptLabel; }
      renderEditor();
    }
    if (el.closest('#acMemberList') && el.type === 'checkbox') {
      if (el.checked) S.editor.members.add(el.value); else S.editor.members.delete(el.value);
      $('#acMemberCount').textContent = `(${S.editor.members.size} คน)`;
    }
  }

  async function saveEditor() {
    const ed = S.editor;
    if (!ed) return;
    const btn = $('#acEditorSave');
    // เก็บข้อความจากช่องชื่อขั้น (กรณีกำลังพิมพ์อยู่)
    $('#acEditorBody').querySelectorAll('input[data-act="label"]').forEach((inp) => { if (!inp.disabled) ed.steps[+inp.dataset.step].label = inp.value; });

    const steps = ed.kind === 'dept' ? ed.steps : ed.steps.filter((s) => s.override);
    const cleaned = steps.map((s) => ({ label: s.label.trim(), ids: uniq(s.ids) }));
    if (ed.kind === 'dept' && cleaned.some((s) => !s.ids.length)) {
      const r = await Swal.fire({ icon: 'warning', title: 'มีขั้นที่ยังไม่มีผู้อนุมัติ', text: 'ขั้นที่ว่างจะถูกข้ามตอนยื่นใบลา ต้องการบันทึกต่อหรือไม่?', showCancelButton: true, confirmButtonText: 'บันทึก', cancelButtonText: 'กลับไปแก้' });
      if (!r.isConfirmed) return;
    }
    btn.disabled = true;
    try {
      let scopeId = ed.kind === 'dept' ? ed.dept.id : ed.team.id;
      if (ed.kind === 'team') {
        const name = ($('#acTeamName')?.value || '').trim();
        if (!name) { Swal.fire('กรุณาตั้งชื่อทีม/กะ', '', 'warning'); return; }
        if (!scopeId) {
          const { data, error } = await S.sb.from('approval_teams').insert({ department_id: ed.team.department_id, team_name: name }).select().single();
          if (error) throw error;
          scopeId = data.id;
        } else {
          const { error } = await S.sb.from('approval_teams').update({ team_name: name, updated_at: new Date().toISOString() }).eq('id', scopeId);
          if (error) throw error;
        }
        // สมาชิก
        const before = S.emps.filter((e) => String(e.team_id) === String(scopeId)).map((e) => String(e.id));
        const add = [...ed.members].filter((x) => !before.includes(x));
        const remove = before.filter((x) => !ed.members.has(x));
        if (add.length) { const { error } = await S.sb.from('employees').update({ team_id: scopeId }).in('id', add); if (error) throw error; }
        if (remove.length) { const { error } = await S.sb.from('employees').update({ team_id: null }).in('id', remove); if (error) throw error; }
      }

      // ขั้น: แทนที่ทั้งชุด
      const scopeType = ed.kind === 'dept' ? 'department' : 'team';
      const { error: delErr } = await S.sb.from('approval_chain_steps').delete().eq('scope_type', scopeType).eq('scope_id', scopeId);
      if (delErr) throw delErr;
      const rows = ed.kind === 'dept'
        ? cleaned.map((s, i) => ({ scope_type: scopeType, scope_id: scopeId, step_no: i + 1, step_label: s.label || `ขั้นที่ ${i + 1}`, approver_ids: s.ids }))
        : ed.steps.map((s, i) => (s.override ? { scope_type: scopeType, scope_id: scopeId, step_no: i + 1, step_label: (s.label || '').trim() || `ขั้นที่ ${i + 1}`, approver_ids: uniq(s.ids) } : null)).filter(Boolean);
      if (rows.length) { const { error } = await S.sb.from('approval_chain_steps').insert(rows); if (error) throw error; }

      if (ed.kind === 'dept') await syncLegacyDepartment(scopeId, cleaned);
      await promoteApproverRoles(uniq(cleaned.flatMap((s) => s.ids)));

      closeEditor();
      toast('บันทึกสายอนุมัติแล้ว');
      await loadAll();
    } catch (err) {
      console.error(err);
      Swal.fire('บันทึกไม่สำเร็จ', err.message || 'กรุณาลองใหม่', 'error');
    } finally {
      btn.disabled = false;
    }
  }

  // ให้ระบบเดิม (หน้าตั้งค่าเดิม / ตรวจสิทธิ์ LINE / ใบลาเก่า) เห็นหัวหน้า-ผู้จัดการของแผนกด้วย
  async function syncLegacyDepartment(deptId, steps) {
    // ขั้น 1 = หัวหน้า, ขั้น 2 = ผู้จัดการ (ขั้นเดียว = ผู้จัดการ) — ขั้น 3+ ไม่มีในตารางเดิม
    const withPeople = steps.filter((s) => s.ids.length);
    const supervisor = withPeople.length >= 2 ? withPeople[0].ids[0] : null;
    const manager = withPeople.length >= 2 ? withPeople[1].ids[0] : (withPeople[0]?.ids[0] || null);
    try {
      await S.sb.from('department_approvers').upsert({ department_id: deptId, supervisor_id: supervisor, manager_id: manager, updated_at: new Date().toISOString() }, { onConflict: 'department_id' });
    } catch (e) { console.warn('sync department_approvers:', e); }
  }

  // ผู้อนุมัติที่ยังเป็น "พนักงานทั่วไป" → ให้สิทธิ์หัวหน้างาน เพื่อเข้าหน้าอนุมัติได้
  async function promoteApproverRoles(ids) {
    const targets = ids.filter((id) => ['user', 'employee', ''].includes(String(S.empById[id]?.role || '').toLowerCase()));
    if (targets.length) {
      try { await S.sb.from('employees').update({ role: 'leader' }).in('id', targets).in('role', ['user', 'employee']); } catch (e) {}
    }
  }

  async function deleteTeam() {
    const ed = S.editor;
    if (!ed?.team?.id) return;
    const r = await Swal.fire({ icon: 'warning', title: `ลบทีม/กะ "${ed.team.team_name}"?`, text: 'สมาชิกจะกลับไปใช้สายอนุมัติของแผนก (ใบลาที่ยื่นไปแล้วไม่เปลี่ยน)', showCancelButton: true, confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#dc2626' });
    if (!r.isConfirmed) return;
    try {
      await S.sb.from('employees').update({ team_id: null }).eq('team_id', ed.team.id);
      await S.sb.from('approval_chain_steps').delete().eq('scope_type', 'team').eq('scope_id', ed.team.id);
      const { error } = await S.sb.from('approval_teams').delete().eq('id', ed.team.id);
      if (error) throw error;
      closeEditor();
      toast('ลบทีม/กะแล้ว');
      await loadAll();
    } catch (err) {
      Swal.fire('ลบไม่สำเร็จ', err.message, 'error');
    }
  }

  // ------------------------------------------------------------------ policy
  function renderPolicy() {
    $('#acPolicyExec').checked = S.policy.executive_for_approvers !== false;
    const sel = $('#acExecSelect');
    sel.innerHTML = '<option value="">— ไม่กำหนด —</option>' + S.emps.filter(isActive).map((e) =>
      `<option value="${e.id}" ${String(e.id) === S.executiveId ? 'selected' : ''}>${esc(e.full_name)} (${esc(e.employee_code)})</option>`).join('');
  }

  async function savePolicy() {
    try {
      const policy = Object.assign({}, S.policy, { executive_for_approvers: $('#acPolicyExec').checked });
      const execId = $('#acExecSelect').value || null;
      const [a, b] = await Promise.all([
        S.sb.from('system_settings').upsert({ setting_key: 'approval_policy', setting_value: policy, updated_at: new Date().toISOString() }, { onConflict: 'setting_key' }),
        S.sb.from('system_settings').upsert({ setting_key: 'leave_executive_approver', employee_id: execId, setting_value: { employee_id: execId }, updated_at: new Date().toISOString() }, { onConflict: 'setting_key' })
      ]);
      if (a.error) throw a.error;
      if (b.error) throw b.error;
      S.policy = policy;
      S.executiveId = execId ? String(execId) : '';
      toast('บันทึกการตั้งค่าแล้ว');
    } catch (err) {
      Swal.fire('บันทึกไม่สำเร็จ', err.message, 'error');
    }
  }

  // ------------------------------------------------------------------ preview
  async function previewEmployee(empId) {
    const out = $('#acPreviewResult');
    if (!empId) { out.innerHTML = ''; return; }
    out.innerHTML = '<p class="ac-muted">กำลังคำนวณ...</p>';
    try {
      const chain = await window.PVTApproval.resolveChain(empId);
      const emp = S.empById[String(empId)];
      const team = emp?.team_id ? S.teams.find((t) => String(t.id) === String(emp.team_id)) : null;
      const src = { department: 'ของแผนก', team: 'ของทีม/กะ', personal: 'ตั้งรายบุคคล', executive: 'นโยบายผู้บริหาร', hr: 'ไม่มีผู้อนุมัติ → HR' };
      out.innerHTML = `<p class="ac-muted">${esc(emp?.full_name || '')}${team ? ` · ทีม/กะ: ${esc(team.team_name)}` : ''}</p>
        <ol class="ac-preview">${chain.map((s) => `<li class="${s.status === 'skipped' ? 'is-skipped' : ''}">
          <strong>${esc(s.step_label)}</strong>
          <span>${s.hr_any ? 'HR/Admin คนใดก็ได้' : esc(s.approver_names.join(' หรือ ') || '—')}</span>
          <small>${s.status === 'skipped' ? `ข้าม: ${esc(s.skip_reason)}` : esc(src[s.source] || '')}</small>
        </li>`).join('')}<li class="is-hr"><strong>ผลถึง HR</strong><span>บันทึกหลักฐาน + แจ้งเตือนในระบบ</span></li></ol>`;
    } catch (err) {
      out.innerHTML = `<p class="ac-error">${esc(err.message)}</p>`;
    }
  }

  // ------------------------------------------------------------------ reassign
  async function loadReassign() {
    const wrap = $('#acReassignList');
    wrap.innerHTML = '<p class="ac-muted">กำลังตรวจสอบใบลาที่รอพิจารณา...</p>';
    const { data: steps, error } = await S.sb.from('leave_approval_steps').select('*').eq('status', 'pending');
    if (error) { wrap.innerHTML = `<p class="ac-error">${esc(error.message)}</p>`; return; }
    const leaveIds = uniq((steps || []).map((s) => s.leave_id));
    let leaves = [];
    if (leaveIds.length) {
      const { data } = await S.sb.from('leave_requests')
        .select('id, employee_id, start_date, end_date, status, created_at, leave_types!leave_type_id(leave_name)')
        .in('id', leaveIds);
      leaves = (data || []).filter((l) => String(l.status) === 'pending');
    }
    const rows = [];
    for (const st of steps || []) {
      const lv = leaves.find((l) => String(l.id) === String(st.leave_id));
      if (!lv) continue;
      const cur = uniq(st.approver_ids);
      const inactive = cur.filter((id) => !isActive(S.empById[id]));
      let suggest = null;
      try {
        const chain = await window.PVTApproval.resolveChain(lv.employee_id);
        const active = chain.filter((c) => c.status !== 'skipped');
        suggest = chain.find((c) => c.step_no === st.step_no && c.status !== 'skipped') || active.find((c) => c.step_no >= st.step_no) || active[active.length - 1] || null;
      } catch (e) {}
      const sugIds = suggest ? uniq(suggest.approver_ids) : [];
      const differs = suggest && !(sugIds.length === cur.length && sugIds.every((x) => cur.includes(x))) && !(suggest.hr_any && st.hr_any);
      rows.push({ st, lv, cur, inactive, suggest, sugIds, flagged: inactive.length > 0 || differs });
    }
    S.reassign = rows;
    renderReassign();
  }

  function renderReassign() {
    const wrap = $('#acReassignList');
    const list = S.reassign.filter((r) => S.showAllReassign || r.flagged);
    const flaggedCount = S.reassign.filter((r) => r.flagged).length;
    $('#acReassignBadge').textContent = flaggedCount;
    $('#acReassignBadge').hidden = !flaggedCount;
    $('#acReassignAll').disabled = !flaggedCount;
    if (!list.length) {
      wrap.innerHTML = `<div class="ac-ok"><span class="material-symbols-outlined" aria-hidden="true">task_alt</span>${S.showAllReassign ? 'ไม่มีใบลารอพิจารณา' : 'ไม่มีใบลาที่ต้องโอนผู้อนุมัติ'}</div>`;
      return;
    }
    wrap.innerHTML = list.map((r, idx) => {
      const name = empName(r.lv.employee_id);
      const curNames = r.cur.length ? r.cur.map((id) => `<span class="ac-person${r.inactive.includes(id) ? ' is-inactive' : ''}">${esc(empName(id))}</span>`).join('<span class="ac-or">หรือ</span>') : '<span class="ac-person">HR</span>';
      const sugNames = r.suggest ? (r.suggest.hr_any ? 'HR' : r.sugIds.map((id) => esc(empName(id))).join(' หรือ ')) : '—';
      const reason = r.inactive.length ? 'ผู้อนุมัติพ้นสภาพ/ไม่ใช้งาน' : (r.flagged ? 'สายอนุมัติปัจจุบันเปลี่ยนไปแล้ว' : 'ปกติ');
      return `<div class="ac-ra${r.flagged ? ' is-flagged' : ''}">
        <div class="ac-ra__main">
          <strong>${esc(name)}</strong>
          <span class="ac-muted">${esc(r.lv.leave_types?.leave_name || 'ใบลา')} · ${esc(r.lv.start_date)}${r.lv.end_date !== r.lv.start_date ? ` ถึง ${esc(r.lv.end_date)}` : ''}</span>
          <div class="ac-ra__flow">
            <span class="ac-tag">${esc(r.st.step_label || `ขั้นที่ ${r.st.step_no}`)}</span> ${curNames}
            ${r.flagged ? `<span class="material-symbols-outlined ac-arrow" aria-hidden="true">arrow_forward</span> <span class="ac-person is-new">${sugNames}</span>` : ''}
          </div>
          <span class="ac-reason${r.flagged ? ' is-flagged' : ''}">${reason}</span>
        </div>
        <div class="ac-ra__actions">
          ${r.flagged && r.suggest ? `<button type="button" class="ac-btn" data-ra="apply" data-i="${S.reassign.indexOf(r)}">โอนตามสายปัจจุบัน</button>` : ''}
          <button type="button" class="ac-btn ac-btn--ghost" data-ra="pick" data-i="${S.reassign.indexOf(r)}">เลือกเอง</button>
        </div>
      </div>`;
    }).join('');
  }

  async function doReassign(row, ids, reason) {
    const res = await window.PVTApproval.reassignStep(row.st.id, ids, { reason });
    if (!res.ok) throw new Error(res.reason);
    return res;
  }

  async function onReassignClick(ev) {
    const btn = ev.target.closest('[data-ra]');
    if (!btn) return;
    const row = S.reassign[+btn.dataset.i];
    if (!row) return;
    try {
      if (btn.dataset.ra === 'apply') {
        await doReassign(row, row.suggest.hr_any ? [] : row.sugIds, 'ตามสายอนุมัติปัจจุบัน');
        toast('โอนผู้อนุมัติแล้ว');
      } else {
        const options = S.emps.filter(isActive).map((e) => `<option value="${e.id}">${esc(e.full_name)} (${esc(e.employee_code)})</option>`).join('');
        const r = await Swal.fire({
          title: 'โอนให้ผู้อนุมัติ',
          html: `<p style="font-size:13px;color:#64748b;margin:0 0 8px;">เลือกได้หลายคน (คนใดคนหนึ่งกดก็ได้) · ไม่เลือก = ส่ง HR</p>
            <select id="acPickMany" multiple size="8" style="width:100%;font:inherit;border:1px solid #cbd5e1;border-radius:10px;padding:6px;">${options}</select>
            <input id="acPickReason" placeholder="เหตุผล (ไม่บังคับ)" style="width:100%;margin-top:8px;font:inherit;border:1px solid #cbd5e1;border-radius:10px;padding:8px;" />`,
          showCancelButton: true,
          confirmButtonText: 'โอน',
          cancelButtonText: 'ยกเลิก',
          preConfirm: () => ({ ids: Array.from(document.getElementById('acPickMany').selectedOptions).map((o) => o.value), reason: document.getElementById('acPickReason').value.trim() })
        });
        if (!r.isConfirmed) return;
        await doReassign(row, r.value.ids, r.value.reason || 'HR เลือกผู้อนุมัติใหม่');
        toast('โอนผู้อนุมัติแล้ว');
      }
      await loadReassign();
    } catch (err) {
      Swal.fire('โอนไม่สำเร็จ', err.message, 'error');
    }
  }

  async function reassignAll() {
    const rows = S.reassign.filter((r) => r.flagged && r.suggest);
    if (!rows.length) return;
    const r = await Swal.fire({ icon: 'question', title: `โอนใบลา ${rows.length} รายการตามสายปัจจุบัน?`, text: 'ผู้อนุมัติใหม่จะได้รับแจ้งเตือนทันที และบันทึกเป็นหลักฐาน', showCancelButton: true, confirmButtonText: 'โอนทั้งหมด', cancelButtonText: 'ยกเลิก' });
    if (!r.isConfirmed) return;
    let ok = 0, fail = 0;
    for (const row of rows) {
      try { await doReassign(row, row.suggest.hr_any ? [] : row.sugIds, 'ตามสายอนุมัติปัจจุบัน (โอนทั้งหมด)'); ok++; } catch (e) { fail++; }
    }
    toast(`โอนแล้ว ${ok} รายการ${fail ? ` · ไม่สำเร็จ ${fail}` : ''}`, fail ? 'warning' : 'success');
    await loadReassign();
  }

  // ------------------------------------------------------------------ tabs + init
  function setTab(name) {
    document.querySelectorAll('.ac-tab').forEach((t) => {
      const on = t.dataset.tab === name;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', String(on));
    });
    document.querySelectorAll('.ac-panel').forEach((p) => { p.hidden = p.dataset.panel !== name; });
  }

  function init() {
    document.querySelectorAll('.ac-tab').forEach((t) => t.addEventListener('click', () => setTab(t.dataset.tab)));
    $('#acSearch').addEventListener('input', renderDepts);
    $('#acDeptList').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'edit-dept') openEditor('dept', b.dataset.id);
      if (b.dataset.act === 'edit-team') openEditor('team', b.dataset.id);
      if (b.dataset.act === 'add-team') openEditor('team', null, b.dataset.id);
    });
    const body = $('#acEditorBody');
    body.addEventListener('click', onEditorClick);
    body.addEventListener('input', onEditorInput);
    body.addEventListener('change', onEditorChange);
    body.addEventListener('click', (ev) => { if (ev.target.dataset && ev.target.dataset.act === 'pick') showPicker(ev.target); });
    document.addEventListener('click', (ev) => {
      if (!ev.target.closest('.ac-picker')) document.querySelectorAll('.ac-picker__list').forEach((l) => { l.hidden = true; });
    });
    $('#acEditorSave').addEventListener('click', saveEditor);
    $('#acEditorDelete').addEventListener('click', deleteTeam);
    document.querySelectorAll('[data-close-editor]').forEach((b) => b.addEventListener('click', closeEditor));
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && S.editor) closeEditor(); });
    $('#acPolicySave').addEventListener('click', savePolicy);
    $('#acReassignList').addEventListener('click', onReassignClick);
    $('#acReassignAll').addEventListener('click', reassignAll);
    $('#acReassignShowAll').addEventListener('change', (ev) => { S.showAllReassign = ev.target.checked; renderReassign(); });
    $('#acReassignRefresh').addEventListener('click', loadReassign);
    $('#acPreviewBtn').addEventListener('click', () => {
      setTab('preview');
      $('#acPreviewSelect').focus();
    });
    $('#acPreviewSelect').addEventListener('change', (ev) => previewEmployee(ev.target.value));
    loadAll();
  }

  window.PVTApprovalChains = { reload: loadAll };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
