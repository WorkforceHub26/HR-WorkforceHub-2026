/* ==========================================================================
   PVT Profile Change Control — ควบคุมการแก้ไขข้อมูลส่วนตัวของพนักงาน
   - ข้อมูลความเสี่ยงต่ำ (รพ.ประกันสังคม, เบอร์โทร): พนักงานแก้เองได้ + บันทึกประวัติ
       · รพ.ประกันสังคม แก้เองได้เดือนละ 1 ครั้ง และถ้า HR "ยืนยันแล้ว (ล็อก)" ต้องส่งคำขอแทน
   - ข้อมูลสำคัญ (คำนำหน้า, ชื่อ-นามสกุล, เลขบัญชี): ส่งคำขอ → HR อนุมัติก่อนจึงเปลี่ยน
   - อื่น ๆ (รหัส, แผนก, ตำแหน่ง, วันเริ่มงาน, สิทธิ์): HR เท่านั้น
   ต้องรัน supabase/migrations/20261019_profile_change_requests.sql ก่อน
   (ถ้ายังไม่รัน: แก้ รพ./เบอร์โทรได้ตามเดิม แต่ไม่มีล็อก/จำกัดเดือน และส่งคำขอไม่ได้)
   ========================================================================== */
(function (global) {
  'use strict';
  if (global.PVTProfileChange) return;

  const SELF_LIMIT_DAYS = 30;
  const FIELDS = {
    hospital: { label: 'โรงพยาบาลประกันสังคม', icon: '🏥', mode: 'self', limitDays: SELF_LIMIT_DAYS, lockable: true,
      placeholder: 'เช่น โรงพยาบาลเปาโล สมุทรปราการ', hint: 'ดูได้จากบัตรรับรองสิทธิ์ หรือแอป SSO+ (เมนู ตรวจสอบสิทธิ)' },
    nickname: { label: 'ชื่อเล่น', icon: '🙂', mode: 'self', placeholder: 'เช่น ต้น', hint: 'ชื่อเล่นที่เพื่อนร่วมงานเรียก (ไม่เกิน 30 ตัวอักษร)' },
    phone: { label: 'เบอร์โทรศัพท์', icon: '📱', mode: 'self', placeholder: 'เช่น 0812345678', hint: 'ตัวเลข 9–10 หลัก · ใช้เข้าระบบแทนรหัสพนักงานได้ จึงห้ามซ้ำกับคนอื่น' },
    email: { label: 'อีเมล', icon: '✉️', mode: 'self', placeholder: 'เช่น name@example.com', hint: 'ใช้เข้าระบบได้ จึงห้ามซ้ำกับคนอื่น' },
    title: { label: 'คำนำหน้า', icon: '🪪', mode: 'request', options: ['นาย', 'นาง', 'นางสาว'] },
    full_name: { label: 'ชื่อ-นามสกุล', icon: '🪪', mode: 'request', placeholder: 'ชื่อ นามสกุล ตามบัตรประชาชน', hint: 'เช่น เปลี่ยนชื่อ/นามสกุล หลังสมรส' },
    // เลขบัญชี: แก้ได้เฉพาะผู้ดูแล (HR/Admin) ในหน้า "ระบบจัดการส่วนกลาง" — พนักงานเห็นแบบปิดบางส่วน ส่งคำขอไม่ได้
    bank_account: { label: 'เลขบัญชีธนาคาร (รับเงินเดือน)', icon: '🏦', mode: 'admin' }
  };

  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clean = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  const sb = () => (global.pvtSupabase && global.pvtSupabase.getClient ? global.pvtSupabase.getClient() : global.supabaseClient);
  const thDate = (iso) => {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d)) return '-';
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear() + 543}`;
  };
  const thDateTime = (iso) => {
    const d = new Date(iso);
    return isNaN(d) ? '-' : `${thDate(iso)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} น.`;
  };
  const metaOf = (emp, field) => ((emp && emp.profile_meta) || {})[field] || {};
  const hasMetaColumn = (emp) => !!emp && Object.prototype.hasOwnProperty.call(emp, 'profile_meta');

  function maskBank(v) {
    const s = String(v || '');
    const digits = s.replace(/\D/g, '');
    if (digits.length < 5) return s ? '••••' : '';
    return s.replace(/\d(?=(?:\D*\d){4})/g, '•');
  }
  function displayValue(field, v) {
    if (!clean(v)) return '';
    return field === 'bank_account' ? maskBank(v) : String(v);
  }

  function validate(field, v) {
    v = clean(v);
    if (!v) return 'กรุณากรอกข้อมูล';
    if (field === 'phone') { const d = v.replace(/[\s-]/g, ''); if (!/^0\d{8,9}$/.test(d)) return 'เบอร์โทรต้องขึ้นต้นด้วย 0 และมี 9–10 หลัก'; }
    if (field === 'hospital' && v.length < 3) return 'ชื่อโรงพยาบาลสั้นเกินไป';
    if (field === 'nickname' && (v.length > 30 || /[<>{}@\d]/.test(v))) return 'ชื่อเล่นไม่เกิน 30 ตัวอักษร และไม่มีตัวเลข/สัญลักษณ์พิเศษ';
    if (field === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'รูปแบบอีเมลไม่ถูกต้อง';
    if (field === 'full_name' && !/\S+\s+\S+/.test(v)) return 'กรุณากรอกทั้งชื่อและนามสกุล';
    if (field === 'bank_account' && (v.replace(/\D/g, '').length < 10)) return 'เลขบัญชีต้องมีอย่างน้อย 10 หลัก';
    if (v.length > 200) return 'ข้อความยาวเกินไป';
    return '';
  }

  async function logAudit(emp, field, before, after, type) {
    try {
      await sb().from('hr_admin_management_logs').insert([{
        actor_id: emp.id, actor_name: emp.full_name || '-', action_category: 'EMPLOYEE', action_type: type,
        target_identifier: emp.employee_code || String(emp.id),
        description: `${(FIELDS[field] || {}).label || field}: ${field === 'bank_account' ? maskBank(before) || '-' : before || '-'} → ${field === 'bank_account' ? maskBank(after) : after}`,
        payload_before: { [field]: field === 'bank_account' ? maskBank(before) : before || null },
        payload_after: { [field]: field === 'bank_account' ? maskBank(after) : after }
      }]);
    } catch (_) {}
  }

  // ------------------------------------------------------------------ ฝั่งพนักงาน
  function selfState(emp, field) {
    const f = FIELDS[field];
    const m = metaOf(emp, field);
    if (f.mode === 'admin') return { kind: 'admin' };
    if (f.mode === 'request') return { kind: 'request' };
    if (f.lockable && m.verified_at) return { kind: 'locked', m };
    if (f.limitDays && m.self_updated_at) {
      const next = new Date(new Date(m.self_updated_at).getTime() + f.limitDays * 86400000);
      if (next > new Date()) return { kind: 'cooldown', next, m };
    }
    return { kind: 'edit', m };
  }

  let myPending = [];
  async function loadMyRequests(emp) {
    try {
      const { data, error } = await sb().from('employee_change_requests').select('*').eq('employee_id', emp.id).order('created_at', { ascending: false }).limit(20);
      if (error) return null;
      myPending = (data || []).filter((r) => r.status === 'pending');
      return data || [];
    } catch (_) { return null; }
  }

  // ------------------------------------------------------------------ การ์ดข้อมูลส่วนตัว (ดู / โหมดแก้ไขด้วยปุ่มปากกา)
  const SELF_ORDER = ['title', 'full_name', 'nickname', 'phone', 'email', 'hospital', 'bank_account'];
  const UI = { editing: false };

  function injectStyles() {
    if (document.getElementById('pvt-pc-style')) return;
    const st = document.createElement('style');
    st.id = 'pvt-pc-style';
    st.textContent = `
      .pc-card{margin:4px 0 16px;padding:16px;border:1px solid #e2e8f0;border-radius:16px;background:#fff}
      .pc-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px}
      .pc-head h4{margin:0;font-size:16px;color:#0f172a}
      .pc-pen{width:40px;height:40px;min-width:40px;border-radius:50%;border:1px solid var(--th-k-200,#bae6fd);background:var(--th-k-50,#f0f9ff);color:var(--th-k-700,#0369a1);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0}
      .pc-pen .material-symbols-outlined{font-size:20px}
      .pc-pen.is-on{background:var(--th-k-600,#0284c7);color:#fff;border-color:transparent}
      .pc-note{margin:0 0 8px;font-size:12.5px;color:#64748b;line-height:1.6}
      .pc-row{display:grid;grid-template-columns:minmax(130px,1fr) 1.6fr;gap:10px;align-items:center;padding:11px 0;border-top:1px dashed #e2e8f0}
      .pc-row:first-of-type{border-top:0}
      .pc-row__label{font-size:14px;color:#64748b}
      .pc-row__value{font-size:15px;font-weight:700;color:#1e293b;text-align:right;word-break:break-word}
      .pc-row.is-missing .pc-row__value{color:#b45309}
      .pc-row.is-ro{background:#f8fafc;margin:0 -16px;padding:11px 16px}
      .pc-row.is-ro .pc-row__label{color:#94a3b8}
      .pc-row.is-ro .pc-row__value{color:#94a3b8;font-weight:600}
      .pc-ro-tag{display:inline-block;margin-left:6px;font-size:11.5px;font-weight:600;color:#94a3b8}
      .pc-input{width:100%;min-height:40px;padding:0 12px;border:1px solid #94a3b8;border-radius:10px;font:inherit;font-size:15px;font-weight:600;color:#0f172a;background:#fff;box-sizing:border-box;text-align:left}
      .pc-input:focus{outline:2px solid var(--th-k-300,#7dd3fc);border-color:var(--th-k-500,#0ea5e9)}
      .pc-field-note{margin-top:4px;font-size:12px;color:#64748b;text-align:left;font-weight:500}
      .pc-badge{display:inline-block;margin-top:4px;padding:2px 8px;border-radius:99px;background:#f1f5f9;color:#475569;font-size:12px;font-weight:600}
      .pc-badge--lock{background:#ecfdf5;color:#047857}
      .pc-badge--wait{background:#fef3c7;color:#92400e}
      .pc-btn{border:1px solid var(--th-k-200,#bae6fd);background:var(--th-k-50,#f0f9ff);color:var(--th-k-700,#0369a1);border-radius:10px;padding:6px 12px;font:inherit;font-size:13.5px;font-weight:700;cursor:pointer;white-space:nowrap}
      .pc-btn--ghost{background:#fff;color:#475569;border-color:#cbd5e1}
      .pc-btn--req{background:#fff7ed;color:#c2410c;border-color:#fed7aa;margin-top:6px}
      .pc-btn--primary{background:var(--th-k-600,#0284c7);color:#fff;border-color:transparent;padding:9px 18px;font-size:14.5px}
      .pc-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px;padding-top:12px;border-top:1px solid #e2e8f0}
      .pc-linkbtn{border:0;background:none;padding:0;color:var(--th-k-700,#0369a1);text-decoration:underline;cursor:pointer;font:inherit;font-size:12px;font-weight:600}
      .pc-hist{margin-top:10px;font-size:13px;color:#475569}
      .pc-hist summary{cursor:pointer;font-weight:700;color:#334155}
      .pc-hist li{margin:4px 0}
      @media (max-width:560px){.pc-row{grid-template-columns:1fr}.pc-row__value{text-align:left}}
    `;
    document.head.appendChild(st);
  }

  function valueBlock(emp, field) {
    const shown = displayValue(field, emp[field]);
    const pending = myPending.find((r) => r.field === field);
    const st = selfState(emp, field);
    let badge = '';
    if (pending) badge = `<div><span class="pc-badge pc-badge--wait">รอ HR อนุมัติ: ${esc(displayValue(field, pending.new_value))}</span> <button type="button" class="pc-btn pc-btn--ghost" data-pc-cancel="${esc(pending.id)}" style="padding:2px 8px;font-size:12px;">ยกเลิกคำขอ</button></div>`;
    else if (st.kind === 'locked') badge = '<div><span class="pc-badge pc-badge--lock">🔒 HR ยืนยันแล้ว</span></div>';
    return `${shown ? esc(shown) : 'ยังไม่ได้ระบุ'}${badge}`;
  }

  function editCell(emp, field, enabled) {
    const f = FIELDS[field];
    const st = selfState(emp, field);
    const pending = myPending.find((r) => r.field === field);
    // แก้เองได้ทันที
    if (st.kind === 'edit' && !pending && field === 'hospital' && UI.hospList && UI.hospList.length) {
      const cur = findInList(UI.hospList, emp.hospital);
      const note = f.limitDays && hasMetaColumn(emp) ? `เลือกจากรายการ · บันทึกแล้วแก้เองได้อีกครั้งใน ${f.limitDays} วัน` : 'เลือกจากรายการของฝ่ายบุคคล';
      return { ro: false, html: `<select class="pc-input" data-pc-field="hospital">
          <option value="">— เลือกโรงพยาบาล —</option>
          ${UI.hospList.map((h) => `<option value="${esc(h)}" ${h === cur ? 'selected' : ''}>${esc(h)}</option>`).join('')}
        </select>
        ${emp.hospital && !cur ? `<div class="pc-field-note" style="color:#b45309;">ข้อมูลเดิม "${esc(emp.hospital)}" ไม่ตรงกับรายการ กรุณาเลือกใหม่</div>` : ''}
        <div class="pc-field-note">${esc(note)} · <button type="button" class="pc-linkbtn" data-pc-request="hospital" data-pc-other="1">ไม่พบ รพ.ของฉันในรายการ</button></div>` };
    }
    if (st.kind === 'edit' && !pending) {
      const note = field === 'hospital' && f.limitDays && hasMetaColumn(emp) ? `บันทึกแล้วแก้เองได้อีกครั้งใน ${f.limitDays} วัน` : (f.hint || '');
      return { ro: false, html: `<input class="pc-input" data-pc-field="${field}" ${field === 'hospital' ? 'list="pcList"' : ''} ${field === 'phone' ? 'inputmode="tel"' : ''} ${field === 'email' ? 'type="email" inputmode="email" autocapitalize="off"' : ''} maxlength="120" placeholder="${esc(f.placeholder || '')}" value="${esc(emp[field] || '')}"><div class="pc-field-note">${esc(note)}</div>` };
    }
    // แก้เองไม่ได้ (สีเทา) — บางช่องส่งคำขอให้ HR ได้
    let why = '';
    if (pending) why = 'มีคำขอรอ HR อยู่';
    else if (st.kind === 'admin') why = 'แก้ได้โดยฝ่ายบุคคลเท่านั้น';
    else if (st.kind === 'locked') why = 'HR ยืนยันแล้ว';
    else if (st.kind === 'cooldown') why = `แก้เองได้อีกครั้ง ${thDate(st.next)}`;
    else if (st.kind === 'request') why = 'ต้องให้ HR อนุมัติ';
    const canRequest = enabled && !pending && st.kind !== 'admin';
    return { ro: true, html: `${valueBlock(emp, field)}<div><span class="pc-ro-tag">${esc(why)}</span></div>${canRequest ? `<button type="button" class="pc-btn pc-btn--req" data-pc-request="${field}">ขอแก้ไข</button>` : ''}` };
  }

  async function renderSelf(container, emp, infoRows) {
    if (!container || !emp) return;
    injectStyles();
    if (infoRows) container.__pcInfo = infoRows;
    const info = container.__pcInfo || [];
    const all = await loadMyRequests(emp);
    const enabled = all !== null;
    const hist = (all || []).filter((r) => r.status !== 'pending').slice(0, 5);
    const stLabel = { approved: '✅ อนุมัติแล้ว', rejected: '❌ ไม่อนุมัติ', cancelled: 'ยกเลิกแล้ว' };
    const editing = UI.editing;
    UI.hospList = editing ? await getHospitalList(true) : UI.hospList;
    const opts = editing && !(UI.hospList && UI.hospList.length) ? await hospitalOptions() : [];
    const fieldRows = SELF_ORDER.map((field) => {
      const f = FIELDS[field];
      if (!editing) {
        const missing = !clean(emp[field]) && (field === 'hospital' || field === 'phone');
        return `<div class="pc-row${missing ? ' is-missing' : ''}"><div class="pc-row__label">${esc(f.label)}</div><div class="pc-row__value">${valueBlock(emp, field)}</div></div>`;
      }
      const c = editCell(emp, field, enabled);
      return `<div class="pc-row${c.ro ? ' is-ro' : ''}"><div class="pc-row__label">${esc(f.label)}</div><div class="pc-row__value">${c.html}</div></div>`;
    }).join('');
    const infoHtml = info.map((r) => `<div class="pc-row${editing ? ' is-ro' : ''}"><div class="pc-row__label">${esc(r.label)}</div><div class="pc-row__value">${esc(r.value || '-')}${editing ? '<div><span class="pc-ro-tag">แก้ได้โดยฝ่ายบุคคลเท่านั้น</span></div>' : ''}</div></div>`).join('');
    container.innerHTML = `<div class="pc-card">
        <div class="pc-head">
          <h4>${editing ? 'แก้ไขข้อมูลส่วนตัว' : 'ข้อมูลส่วนตัว'}</h4>
          <button type="button" class="pc-pen${editing ? ' is-on' : ''}" data-pc-toggle title="${editing ? 'ปิดโหมดแก้ไข' : 'แก้ไขข้อมูล'}" aria-label="${editing ? 'ปิดโหมดแก้ไข' : 'แก้ไขข้อมูล'}"><span class="material-symbols-outlined" aria-hidden="true">${editing ? 'close' : 'edit'}</span></button>
        </div>
        ${editing ? '<p class="pc-note">ช่องสีขาวแก้ได้ทันที · ช่องสีเทาแก้เองไม่ได้ (บางช่องกด <b>ขอแก้ไข</b> เพื่อส่งให้ HR อนุมัติ) · ทุกการแก้ไขถูกบันทึกไว้</p>' : ''}
        ${fieldRows}${infoHtml}
        ${editing && opts.length ? `<datalist id="pcList">${opts.map((o) => `<option value="${esc(o)}"></option>`).join('')}</datalist>` : ''}
        ${editing ? `<div class="pc-actions"><button type="button" class="pc-btn pc-btn--ghost" data-pc-toggle>ยกเลิก</button><button type="button" class="pc-btn pc-btn--primary" data-pc-save>บันทึก</button></div>` : ''}
        ${!editing && hist.length ? `<details class="pc-hist"><summary>ประวัติคำขอ (${hist.length})</summary><ul>${hist.map((r) => `<li>${thDate(r.created_at)} · ${esc((FIELDS[r.field] || {}).label || r.field)} → ${esc(displayValue(r.field, r.new_value))} · ${stLabel[r.status] || r.status}${r.review_note ? ` <span style="color:#64748b;">(${esc(r.review_note)})</span>` : ''}</li>`).join('')}</ul></details>` : ''}
      </div>`;
    container.onclick = async (ev) => {
      if (ev.target.closest('[data-pc-toggle]')) { UI.editing = !UI.editing; return renderSelf(container, emp); }
      if (ev.target.closest('[data-pc-save]')) return saveSelf(emp, container);
      const e2 = ev.target.closest('[data-pc-request]');
      const e3 = ev.target.closest('[data-pc-cancel]');
      if (e2) await requestChange(emp, e2.dataset.pcRequest, container, { other: e2.dataset.pcOther === '1' });
      if (e3) await cancelRequest(emp, e3.dataset.pcCancel, container);
    };
  }

  // บันทึกทุกช่องที่แก้ในโหมดแก้ไข (ตรวจรูปแบบ/ข้อมูลซ้ำ → ยืนยัน → บันทึกครั้งเดียว)
  async function saveSelf(emp, container) {
    const inputs = [...container.querySelectorAll('[data-pc-field]')];
    const changes = [];
    for (const el of inputs) {
      const field = el.dataset.pcField;
      let v = clean(el.value);
      if (field === 'phone') v = v.replace(/[\s-]/g, '');
      if (field === 'email') v = v.toLowerCase();
      if (v === clean(emp[field])) continue;
      if (!v && !clean(emp[field])) continue;
      const err = validate(field, v);
      if (err) { el.focus(); Swal.fire('ตรวจสอบข้อมูล', `${FIELDS[field].label}: ${err}`, 'warning'); return; }
      const dup = await conflictOf(emp, field, v);
      if (dup) { el.focus(); Swal.fire('ตรวจสอบข้อมูล', `${FIELDS[field].label}: ${dup}`, 'warning'); return; }
      changes.push({ field, before: emp[field] || null, value: v });
    }
    if (!changes.length) { UI.editing = false; renderSelf(container, emp); return; }
    const c = await Swal.fire({
      icon: 'question', title: 'ยืนยันบันทึกข้อมูล?',
      html: `<ul style="text-align:left;line-height:1.9;margin:0 auto;max-width:440px;">${changes.map((x) => `<li><b>${esc(FIELDS[x.field].label)}</b>: ${esc(x.before || 'ว่าง')} → <b style="color:#047857;">${esc(x.value)}</b></li>`).join('')}</ul>`,
      showCancelButton: true, confirmButtonText: 'บันทึก', cancelButtonText: 'กลับไปแก้'
    });
    if (!c.isConfirmed) return;
    const patch = {};
    let meta = null;
    changes.forEach((x) => {
      patch[x.field] = x.value;
      const f = FIELDS[x.field];
      if (f.limitDays && hasMetaColumn(emp)) {
        meta = meta || Object.assign({}, emp.profile_meta || {});
        meta[x.field] = Object.assign({}, meta[x.field] || {}, { self_updated_at: new Date().toISOString() });
      }
    });
    if (meta) patch.profile_meta = meta;
    const { error } = await sb().from('employees').update(patch).eq('id', emp.id);
    if (error) { Swal.fire('บันทึกไม่สำเร็จ', error.message, 'error'); return; }
    changes.forEach((x) => { emp[x.field] = x.value; syncSession(x.field, x.value); });
    if (meta) emp.profile_meta = meta;
    for (const x of changes) await logAudit(emp, x.field, x.before, x.value, 'SELF_UPDATE_' + x.field.toUpperCase());
    UI.editing = false;
    Swal.fire({ icon: 'success', title: 'บันทึกแล้ว', timer: 1400, showConfirmButton: false });
    renderSelf(container, emp);
  }

  // ------------------------------------------------------------------ รายชื่อ รพ.ประกันสังคม (HR ดูแล) — system_settings.sso_hospital_list
  const HOSP_KEY = 'sso_hospital_list';
  const hospKey = (n) => String(n || '').replace(/\s+/g, '').toLowerCase().replace(/^(โรงพยาบาล|รพ\.?|ร\.พ\.?)/, '');
  let hospCache = null;
  async function getHospitalList(force) {
    if (hospCache && !force) return hospCache;
    try {
      const { data, error } = await sb().from('system_settings').select('setting_value').eq('setting_key', HOSP_KEY).maybeSingle();
      if (error) return [];
      const v = data && data.setting_value;
      hospCache = Array.isArray(v) ? v.map(clean).filter(Boolean) : [];
    } catch (_) { return hospCache || []; }
    return hospCache;
  }
  async function saveHospitalList(list) {
    const seen = new Set();
    const clean2 = list.map(clean).filter((n) => { const k = hospKey(n); if (!n || seen.has(k)) return false; seen.add(k); return true; })
      .sort((a, b) => a.localeCompare(b, 'th'));
    const { error } = await sb().from('system_settings').upsert({ setting_key: HOSP_KEY, setting_value: clean2, updated_at: new Date().toISOString(), description: 'รายชื่อโรงพยาบาลประกันสังคมให้พนักงานเลือก' }, { onConflict: 'setting_key' });
    if (error) throw error;
    hospCache = clean2;
    return clean2;
  }
  const findInList = (list, name) => list.find((x) => hospKey(x) === hospKey(name)) || '';

  async function hospitalOptions() {
    try {
      const { data } = await sb().from('employees').select('hospital').not('hospital', 'is', null).limit(2000);
      const seen = new Map();
      (data || []).forEach((r) => { const h = clean(r.hospital); if (h && h !== '-') seen.set(h, (seen.get(h) || 0) + 1); });
      return [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([h]) => h).slice(0, 60);
    } catch (_) { return []; }
  }

  function inputHtml(field, value) {
    const f = FIELDS[field];
    if (f.options) {
      return `<select id="pcInput" class="swal2-select" style="width:100%;margin:14px 0 4px;">${f.options.map((o) => `<option ${o === value ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    }
    return `<input id="pcInput" class="swal2-input" ${field === 'hospital' ? 'list="pcList"' : ''} ${field === 'phone' ? 'inputmode="tel"' : ''} ${field === 'email' ? 'type="email" inputmode="email" autocapitalize="off"' : ''} maxlength="120" placeholder="${esc(f.placeholder || '')}" value="${esc(field === 'bank_account' ? '' : value || '')}" style="width:100%;margin:14px 0 4px;box-sizing:border-box;">`;
  }

  // เบอร์โทร/อีเมล ใช้เข้าระบบได้ → ห้ามซ้ำกับพนักงานคนอื่น และเบอร์ห้ามตรงกับรหัสพนักงานของใคร
  async function conflictOf(emp, field, v) {
    if (field !== 'phone' && field !== 'email') return '';
    try {
      const q = field === 'phone'
        ? sb().from('employees').select('id').or(`phone.eq.${v},employee_code.eq.${v}`).neq('id', emp.id).limit(1)
        : sb().from('employees').select('id').ilike('email', v.replace(/[\\%_]/g, (c) => '\\' + c)).neq('id', emp.id).limit(1);
      const { data, error } = await q;
      if (error) return '';
      return (data || []).length ? (field === 'phone' ? 'เบอร์นี้มีในระบบแล้ว (ซ้ำกับพนักงานคนอื่น) กรุณาติดต่อฝ่ายบุคคล' : 'อีเมลนี้มีพนักงานคนอื่นใช้แล้ว') : '';
    } catch (_) { return ''; }
  }

  async function requestChange(emp, field, container, opts) {
    opts = opts || {};
    const f = FIELDS[field];
    if (!f || f.mode === 'admin') { Swal.fire('แก้ไขได้โดยฝ่ายบุคคลเท่านั้น', 'หากต้องการเปลี่ยนเลขบัญชี กรุณาติดต่อฝ่ายบุคคลพร้อมสำเนาหน้าสมุดบัญชี', 'info'); return; }
    const probe = await loadMyRequests(emp);
    if (probe === null) { Swal.fire('ยังส่งคำขอไม่ได้', 'HR ยังไม่ได้เปิดใช้ระบบคำขอแก้ไขข้อมูล กรุณาติดต่อฝ่ายบุคคล', 'info'); return; }
    if (myPending.find((r) => r.field === field)) { Swal.fire('มีคำขอรออยู่แล้ว', 'กรุณารอ HR พิจารณาคำขอเดิมก่อน หรือยกเลิกคำขอเดิม', 'info'); return; }
    if (field === 'hospital') UI.hospList = await getHospitalList();
    const hasList = field === 'hospital' && UI.hospList && UI.hospList.length;
    const notInList = hasList && opts.other;
    // เปลี่ยน รพ. ผ่าน HR: เลือกจากรายการ (หรือเลือก "ไม่มีในรายการ" แล้วพิมพ์เอง)
    const hospPicker = hasList && !notInList ? `<select id="pcHospSel" class="swal2-select" style="width:100%;margin:14px 0 4px;">
        <option value="">— เลือกโรงพยาบาลที่ต้องการเปลี่ยนไป —</option>
        ${UI.hospList.filter((h) => h !== emp.hospital).map((h) => `<option value="${esc(h)}">${esc(h)}</option>`).join('')}
        <option value="__other__">ไม่มีในรายการ (พิมพ์ชื่อเอง)</option>
      </select>
      <input id="pcInput" class="swal2-input" maxlength="120" placeholder="ชื่อโรงพยาบาล + จังหวัด ตามบัตรรับรองสิทธิ์" style="display:none;width:100%;margin:8px 0 4px;box-sizing:border-box;">` : '';
    const res = await Swal.fire({
      title: notInList ? 'แจ้ง รพ.ที่ไม่มีในรายการ' : `ขอแก้ไข${f.label}`,
      html: `<div style="text-align:left;font-size:14.5px;color:#334155;line-height:1.7;">ข้อมูลปัจจุบัน: <b>${esc(displayValue(field, emp[field]) || 'ยังไม่ได้ระบุ')}</b><br><span style="color:#64748b;font-size:13px;">${notInList ? 'พิมพ์ชื่อโรงพยาบาลตามบัตรรับรองสิทธิ์ให้ครบ (ชื่อ + จังหวัด) HR จะตรวจและเพิ่มเข้ารายการให้' : esc(f.hint || 'HR จะตรวจสอบก่อนเปลี่ยนข้อมูลในระบบ')}</span></div>
        ${hospPicker || inputHtml(field, notInList ? '' : emp[field])}
        <textarea id="pcReason" class="swal2-textarea" maxlength="300" placeholder="เหตุผล (จำเป็น) เช่น เปลี่ยนนามสกุลหลังสมรส / ย้าย รพ.ตามที่อยู่ใหม่" style="width:100%;margin:10px 0 0;box-sizing:border-box;min-height:80px;"></textarea>`,
      showCancelButton: true, confirmButtonText: 'ส่งคำขอ', cancelButtonText: 'ยกเลิก', focusConfirm: false,
      didOpen: () => {
        const sel = document.getElementById('pcHospSel');
        if (sel) sel.addEventListener('change', () => { const t = document.getElementById('pcInput'); t.style.display = sel.value === '__other__' ? '' : 'none'; if (sel.value === '__other__') t.focus(); });
      },
      preConfirm: () => {
        const sel = document.getElementById('pcHospSel');
        if (sel && !sel.value) { Swal.showValidationMessage('กรุณาเลือกโรงพยาบาล'); return false; }
        let v = clean(sel && sel.value !== '__other__' ? sel.value : document.getElementById('pcInput')?.value);
        if (field === 'phone') v = v.replace(/[\s-]/g, '');
        if (field === 'email') v = v.toLowerCase();
        const err = validate(field, v);
        if (err) { Swal.showValidationMessage(err); return false; }
        if (v === clean(emp[field])) { Swal.showValidationMessage('ข้อมูลเหมือนเดิม'); return false; }
        const reason = clean(document.getElementById('pcReason')?.value);
        if (reason.length < 4) { Swal.showValidationMessage('กรุณาระบุเหตุผล'); return false; }
        return { v, reason };
      }
    });
    if (!res.isConfirmed) return;
    const ok = await Swal.fire({
      icon: 'question', title: 'ยืนยันส่งคำขอให้ HR?',
      html: `<div style="text-align:left;line-height:1.9;max-width:440px;margin:0 auto;"><b>${esc(f.label)}</b><br>เดิม: ${esc(displayValue(field, emp[field]) || 'ว่าง')}<br>ขอเปลี่ยนเป็น: <b style="color:#047857;">${esc(res.value.v)}</b><br>เหตุผล: ${esc(res.value.reason)}<div style="margin-top:8px;color:#64748b;font-size:13px;">ข้อมูลจะยังไม่เปลี่ยนจนกว่า HR จะอนุมัติ</div></div>`,
      showCancelButton: true, confirmButtonText: 'ยืนยันส่งคำขอ', cancelButtonText: 'ยกเลิก'
    });
    if (!ok.isConfirmed) return;
    const { error } = await sb().from('employee_change_requests').insert([{
      employee_id: emp.id, field, old_value: emp[field] || null, new_value: res.value.v, reason: res.value.reason, status: 'pending'
    }]);
    if (error) {
      const dup = /duplicate|unique/i.test(error.message || '');
      Swal.fire('ส่งคำขอไม่สำเร็จ', dup ? 'มีคำขอของช่องนี้รอ HR อยู่แล้ว' : error.message, 'error');
      return;
    }
    Swal.fire({ icon: 'success', title: 'ส่งคำขอแล้ว', text: 'HR จะตรวจสอบและแจ้งผลในระบบ', timer: 1800, showConfirmButton: false });
    UI.editing = false;
    renderSelf(container, emp);
  }

  async function cancelRequest(emp, id, container) {
    const r = await Swal.fire({ icon: 'question', title: 'ยกเลิกคำขอนี้?', showCancelButton: true, confirmButtonText: 'ยกเลิกคำขอ', cancelButtonText: 'ไม่' });
    if (!r.isConfirmed) return;
    const { error } = await sb().from('employee_change_requests').update({ status: 'cancelled', reviewed_at: new Date().toISOString(), review_note: 'พนักงานยกเลิกเอง' }).eq('id', id).eq('status', 'pending');
    if (error) { Swal.fire('ไม่สำเร็จ', error.message, 'error'); return; }
    renderSelf(container, emp);
  }

  function syncSession(field, value) {
    try {
      const raw = localStorage.getItem('currentUser');
      if (!raw) return;
      const u = JSON.parse(raw);
      if (!u) return;
      u[field] = value;
      if (u.employees) u.employees[field] = value;
      localStorage.setItem('currentUser', JSON.stringify(u));
    } catch (_) {}
  }

  // ------------------------------------------------------------------ ฝั่ง HR
  function hrActor() {
    try {
      const u = JSON.parse(localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser') || '{}') || {};
      const e = u.employees || u;
      return { id: e.id && String(e.id).length > 8 ? e.id : null, name: u.full_name || e.full_name || 'HR' };
    } catch (_) { return { id: null, name: 'HR' }; }
  }

  async function pendingCount() {
    try {
      const { count, error } = await sb().from('employee_change_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending');
      return error ? null : (count || 0);
    } catch (_) { return null; }
  }

  async function openReview(onChanged) {
    const { data, error } = await sb().from('employee_change_requests')
      .select('*, employees!employee_id(id, employee_code, full_name, title, bank_account, hospital, phone, profile_meta, departments!department_id(department_name))')
      .eq('status', 'pending').order('created_at', { ascending: true });
    if (error) {
      Swal.fire('ยังใช้งานไม่ได้', 'กรุณารัน SQL: supabase/migrations/20261019_profile_change_requests.sql ใน Supabase ก่อน', 'info');
      return;
    }
    const rows = data || [];
    const html = rows.length ? `<div style="text-align:left;max-height:60vh;overflow:auto;">${rows.map((r) => {
      const e = r.employees || {};
      const f = FIELDS[r.field] || { label: r.field, icon: '' };
      const cur = e[r.field];
      return `<div style="border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;">
            <b>${esc(e.full_name || '-')} <span style="color:#64748b;font-weight:500;">${esc(e.employee_code || '')} · ${esc(e.departments?.department_name || '-')}</span></b>
            <span style="color:#64748b;font-size:13px;">ส่งเมื่อ ${thDateTime(r.created_at)}</span>
          </div>
          <div style="margin-top:6px;">${f.icon} <b>${esc(f.label)}</b>: <span style="color:#b91c1c;text-decoration:line-through;">${esc(cur || r.old_value || 'ว่าง')}</span> → <span style="color:#047857;font-weight:800;">${esc(r.new_value)}</span></div>
          <div style="margin-top:4px;color:#475569;font-size:13.5px;">เหตุผล: ${esc(r.reason || '-')}</div>
          <div style="margin-top:10px;display:flex;gap:8px;justify-content:flex-end;">
            <button type="button" data-rv="reject" data-id="${esc(r.id)}" style="border:1px solid #fecaca;background:#fff;color:#b91c1c;border-radius:10px;padding:7px 14px;font:inherit;font-weight:700;cursor:pointer;">ไม่อนุมัติ</button>
            <button type="button" data-rv="approve" data-id="${esc(r.id)}" style="border:0;background:#10b981;color:#fff;border-radius:10px;padding:7px 16px;font:inherit;font-weight:700;cursor:pointer;">อนุมัติ & เปลี่ยนข้อมูล</button>
          </div>
        </div>`;
    }).join('')}</div>` : '<p style="color:#64748b;">ไม่มีคำขอที่รอพิจารณา</p>';
    let picked = null;
    await Swal.fire({
      title: `คำขอแก้ไขข้อมูลพนักงาน (${rows.length})`, html, width: 'min(860px, 96vw)', showConfirmButton: false, showCloseButton: true,
      didOpen: (pop) => {
        pop.addEventListener('click', (ev) => {
          const b = ev.target.closest('[data-rv]');
          if (!b) return;
          picked = { req: rows.find((x) => String(x.id) === b.dataset.id), approve: b.dataset.rv === 'approve' };
          Swal.close();
        });
      }
    });
    if (!picked || !picked.req) return;
    const ok = await decide(picked.req, picked.approve);
    if (ok) {
      await Swal.fire({ icon: 'success', title: picked.approve ? 'อนุมัติและเปลี่ยนข้อมูลแล้ว' : 'บันทึกว่าไม่อนุมัติแล้ว', text: 'แจ้งผลให้พนักงานในระบบแล้ว', timer: 1300, showConfirmButton: false });
      if (typeof onChanged === 'function') onChanged();
    }
    return openReview(onChanged); // กลับไปหน้ารายการคำขอที่เหลือ
  }

  async function decide(req, approve) {
    const actor = hrActor();
    let note = '';
    if (!approve) {
      const r = await Swal.fire({ title: 'เหตุผลที่ไม่อนุมัติ', input: 'text', inputPlaceholder: 'เช่น เอกสารไม่ตรงกัน', showCancelButton: true, confirmButtonText: 'ยืนยัน', cancelButtonText: 'กลับ', inputValidator: (v) => (!clean(v) ? 'กรุณาระบุเหตุผล' : undefined) });
      if (!r.isConfirmed) return false;
      note = clean(r.value);
    }
    const sbc = sb();
    const emp = req.employees || {};
    if (approve && (FIELDS[req.field] || {}).mode === 'admin') { Swal.fire('ช่องนี้แก้ได้ในหน้าข้อมูลพนักงานเท่านั้น', 'กรุณาแก้เลขบัญชีที่ปุ่ม "รายละเอียด" ของพนักงาน แล้วกด ไม่อนุมัติ คำขอนี้', 'info'); return false; }
    if (approve && req.field === 'hospital') {
      // ใช้ชื่อมาตรฐานจากรายการ ถ้ายังไม่มีให้ HR ยืนยันชื่อแล้วเพิ่มเข้ารายการ
      const list = await getHospitalList(true);
      const match = findInList(list, req.new_value);
      if (!match) {
        const r = await Swal.fire({ title: 'เพิ่ม รพ.เข้ารายการ', html: '<div style="text-align:left;font-size:14px;color:#475569;">ชื่อนี้ยังไม่มีในรายการ ตรวจ/แก้ชื่อให้เป็นมาตรฐานก่อนเพิ่ม (พนักงานคนอื่นจะเลือกชื่อนี้ได้)</div>', input: 'text', inputValue: req.new_value, showCancelButton: true, confirmButtonText: 'เพิ่มเข้ารายการ & อนุมัติ', cancelButtonText: 'กลับ', inputValidator: (v) => (clean(v).length < 3 ? 'กรุณาระบุชื่อโรงพยาบาล' : undefined) });
        if (!r.isConfirmed) return false;
        req.new_value = clean(r.value);
        try { await saveHospitalList(list.concat([req.new_value])); } catch (e) { Swal.fire('เพิ่มรายการไม่สำเร็จ', e.message, 'error'); return false; }
      } else req.new_value = match;
    }
    if (approve) {
      const patch = { [req.field]: req.new_value };
      if (req.field === 'hospital' && Object.prototype.hasOwnProperty.call(emp, 'profile_meta')) {
        const meta = Object.assign({}, emp.profile_meta || {});
        meta.hospital = Object.assign({}, meta.hospital || {}, { verified_at: new Date().toISOString(), verified_by: actor.name });
        patch.profile_meta = meta;
      }
      const { error } = await sbc.from('employees').update(patch).eq('id', req.employee_id);
      if (error) { Swal.fire('เปลี่ยนข้อมูลไม่สำเร็จ', error.message, 'error'); return false; }
    }
    const { error: e2 } = await sbc.from('employee_change_requests').update({
      status: approve ? 'approved' : 'rejected', reviewed_by: actor.id, reviewed_by_name: actor.name, reviewed_at: new Date().toISOString(), review_note: note || null
    }).eq('id', req.id).eq('status', 'pending');
    if (e2) { Swal.fire('บันทึกผลไม่สำเร็จ', e2.message, 'error'); return false; }
    const f = FIELDS[req.field] || { label: req.field };
    try {
      await sbc.from('hr_admin_management_logs').insert([{
        actor_id: actor.id, actor_name: actor.name, action_category: 'EMPLOYEE', action_type: approve ? 'APPROVE_CHANGE_REQUEST' : 'REJECT_CHANGE_REQUEST',
        target_identifier: emp.employee_code || String(req.employee_id),
        description: `${approve ? 'อนุมัติ' : 'ไม่อนุมัติ'}คำขอแก้${f.label}: ${req.field === 'bank_account' ? maskBank(req.old_value) : req.old_value || '-'} → ${req.field === 'bank_account' ? maskBank(req.new_value) : req.new_value}${note ? ` (${note})` : ''}`
      }]);
    } catch (_) {}
    try {
      await sbc.from('notifications').insert([{
        employee_id: req.employee_id,
        title: approve ? `HR อนุมัติการแก้ไข${f.label}แล้ว` : `HR ไม่อนุมัติการแก้ไข${f.label}`,
        message: approve ? `ข้อมูลใหม่: ${displayValue(req.field, req.new_value)}` : `เหตุผล: ${note}`,
        type: 'profile', link_url: '/pages/user/profile-user.html'
      }]);
    } catch (_) {}
    return true;
  }

  // HR ยืนยัน/ล็อก (หรือปลดล็อก) ช่องที่พนักงานแก้เอง
  async function setVerified(empIds, field, verified) {
    const ids = [...new Set(empIds.map(String))];
    if (!ids.length) return { ok: 0 };
    const actor = hrActor();
    const { data, error } = await sb().from('employees').select('id, profile_meta').in('id', ids);
    if (error) return { error };
    let ok = 0;
    for (const row of data || []) {
      const meta = Object.assign({}, row.profile_meta || {});
      const cur = Object.assign({}, meta[field] || {});
      if (verified) { cur.verified_at = new Date().toISOString(); cur.verified_by = actor.name; } else { delete cur.verified_at; delete cur.verified_by; }
      meta[field] = cur;
      const { error: e } = await sb().from('employees').update({ profile_meta: meta }).eq('id', row.id);
      if (!e) ok++;
    }
    try {
      await sb().from('hr_admin_management_logs').insert([{ actor_id: actor.id, actor_name: actor.name, action_category: 'EMPLOYEE', action_type: verified ? 'VERIFY_LOCK_FIELD' : 'UNLOCK_FIELD', target_identifier: `${ids.length} คน`, description: `${verified ? 'ยืนยันและล็อก' : 'ปลดล็อก'} ${(FIELDS[field] || {}).label || field} ${ok} คน` }]);
    } catch (_) {}
    return { ok };
  }

  async function loadMeta() {
    try {
      const { data, error } = await sb().from('employees').select('id, profile_meta').range(0, 4999);
      if (error) return null;
      const m = {};
      (data || []).forEach((r) => { m[r.id] = r.profile_meta || {}; });
      return m;
    } catch (_) { return null; }
  }

  // HR: จัดการรายชื่อ รพ. (เพิ่ม/ลบ/ดึงจากที่พนักงานพิมพ์ไว้) และปรับข้อมูลพนักงานให้ตรงรายการ
  async function openHospitalListManager(onChanged) {
    let list = (await getHospitalList(true)).slice();
    const { data: emps } = await sb().from('employees').select('id, hospital').not('hospital', 'is', null).limit(5000);
    const used = new Map();
    (emps || []).forEach((e) => { const h = clean(e.hospital); if (!h || h === '-') return; const k = hospKey(h); const g = used.get(k) || { names: new Map(), n: 0 }; g.n++; g.names.set(h, (g.names.get(h) || 0) + 1); used.set(k, g); });
    const suggestions = [...used.values()].map((g) => ({ name: [...g.names.entries()].sort((a, b) => b[1] - a[1])[0][0], n: g.n }))
      .filter((x) => !findInList(list, x.name)).sort((a, b) => b.n - a.n);
    const mismatch = (emps || []).filter((e) => { const m = findInList(list, e.hospital); return m && m !== clean(e.hospital); });
    const notListed = (emps || []).filter((e) => clean(e.hospital) && clean(e.hospital) !== '-' && !findInList(list, e.hospital)).length;
    let act = null;
    await Swal.fire({
      title: 'รายชื่อโรงพยาบาลประกันสังคม',
      width: 'min(820px, 96vw)', showConfirmButton: false, showCloseButton: true,
      html: `<div style="text-align:left;font-size:14px;">
        <p style="margin:0 0 10px;color:#475569;line-height:1.6;">พนักงานเลือก รพ.จากรายการนี้เท่านั้น (ถ้าไม่มี ให้พนักงานกด "ไม่พบ รพ.ของฉัน" แล้ว HR เพิ่มให้ตอนอนุมัติ) · รายการว่าง = พนักงานพิมพ์เองได้เหมือนเดิม</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;"><button type="button" data-hl="import" class="swal2-confirm swal2-styled" style="margin:0;background:#0f766e;">📥 นำเข้าจาก Excel / วางรายชื่อ</button><button type="button" data-hl="tpl" class="swal2-cancel swal2-styled" style="margin:0;">⬇️ ไฟล์ตัวอย่าง</button></div>
        <div style="display:flex;gap:8px;margin-bottom:10px;"><input id="hlNew" class="swal2-input" style="margin:0;flex:1;" placeholder="เพิ่มชื่อ รพ. เช่น โรงพยาบาลเปาโล สมุทรปราการ"><button type="button" data-hl="add" class="swal2-confirm swal2-styled" style="margin:0;">เพิ่ม</button></div>
        <div style="max-height:34vh;overflow:auto;border:1px solid #e2e8f0;border-radius:12px;">${list.length ? list.map((h, i) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-top:${i ? '1px solid #f1f5f9' : '0'};"><span>${esc(h)} <small style="color:#94a3b8;">${(used.get(hospKey(h)) || {}).n || 0} คน</small></span><span><button type="button" data-hl="ren" data-i="${i}" style="border:0;background:none;color:#0369a1;cursor:pointer;font:inherit;margin-right:10px;">แก้ชื่อ</button><button type="button" data-hl="del" data-i="${i}" style="border:0;background:none;color:#b91c1c;cursor:pointer;font:inherit;">ลบ</button></span></div>`).join('') : '<div style="padding:12px;color:#94a3b8;">ยังไม่มีรายการ</div>'}</div>
        ${suggestions.length ? `<div style="margin-top:12px;padding:10px 12px;border-radius:12px;background:#f0f9ff;border:1px solid #bae6fd;"><b>ชื่อที่พนักงานพิมพ์ไว้ (ยังไม่อยู่ในรายการ) ${suggestions.length} ชื่อ</b><div style="margin:6px 0;color:#475569;font-size:13px;">${suggestions.slice(0, 12).map((x) => `${esc(x.name)} (${x.n})`).join(' · ')}${suggestions.length > 12 ? ' …' : ''}</div><button type="button" data-hl="seed" class="swal2-confirm swal2-styled" style="margin:4px 0 0;background:#0369a1;">เพิ่มทั้งหมดเข้ารายการ</button> <span style="font-size:12.5px;color:#64748b;">(ตรวจ/ลบชื่อที่สะกดผิดได้หลังเพิ่ม)</span></div>` : ''}
        ${mismatch.length ? `<div style="margin-top:12px;padding:10px 12px;border-radius:12px;background:#ecfdf5;border:1px solid #a7f3d0;"><b>พนักงาน ${mismatch.length} คน เขียนชื่อ รพ.ต่างจากรายการเล็กน้อย</b> (เช่น รพ. / โรงพยาบาล)<br><button type="button" data-hl="snap" class="swal2-confirm swal2-styled" style="margin:6px 0 0;background:#047857;">ปรับให้ตรงกับรายการ</button></div>` : ''}
        ${notListed ? `<div style="margin-top:10px;font-size:13px;color:#b45309;">มีพนักงาน ${notListed} คนที่ชื่อ รพ.ไม่อยู่ในรายการ — เพิ่มชื่อเข้ารายการ หรือให้พนักงานเลือกใหม่</div>` : ''}
      </div>`,
      didOpen: (pop) => pop.addEventListener('click', (ev) => {
        const b = ev.target.closest('[data-hl]');
        if (!b) return;
        act = { type: b.dataset.hl, i: Number(b.dataset.i), value: clean(document.getElementById('hlNew')?.value) };
        if (act.type === 'add' && act.value.length < 3) { Swal.showValidationMessage('กรุณาพิมพ์ชื่อโรงพยาบาล'); act = null; return; }
        Swal.close();
      })
    });
    if (!act) { if (typeof onChanged === 'function') onChanged(); return; }
    try {
      if (act.type === 'add') { if (findInList(list, act.value)) await Swal.fire('มีในรายการแล้ว', findInList(list, act.value), 'info'); else await saveHospitalList(list.concat([act.value])); }
      if (act.type === 'del') {
        const name = list[act.i];
        const c = await Swal.fire({ icon: 'question', title: `ลบ "${name}" ออกจากรายการ?`, text: 'ข้อมูลของพนักงานที่เลือกไว้แล้วไม่ถูกลบ แต่จะเลือกชื่อนี้ใหม่ไม่ได้', showCancelButton: true, confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#dc2626' });
        if (c.isConfirmed) await saveHospitalList(list.filter((_, i) => i !== act.i));
      }
      if (act.type === 'ren') {
        const old = list[act.i];
        const r = await Swal.fire({ title: 'แก้ชื่อโรงพยาบาล', html: '<div style="text-align:left;font-size:13.5px;color:#475569;">พนักงานที่เลือกชื่อเดิมไว้ จะถูกเปลี่ยนเป็นชื่อใหม่ให้ด้วย</div>', input: 'text', inputValue: old, showCancelButton: true, confirmButtonText: 'บันทึก', cancelButtonText: 'ยกเลิก', inputValidator: (v) => (clean(v).length < 3 ? 'กรุณาระบุชื่อโรงพยาบาล' : undefined) });
        if (r.isConfirmed && clean(r.value) !== old) {
          const nv = clean(r.value);
          await saveHospitalList(list.map((x, i) => (i === act.i ? nv : x)));
          const targets = (emps || []).filter((e) => hospKey(e.hospital) === hospKey(old));
          let ok = 0;
          for (const e of targets) { const { error } = await sb().from('employees').update({ hospital: nv }).eq('id', e.id); if (!error) ok++; }
          try { const a = hrActor(); await sb().from('hr_admin_management_logs').insert([{ actor_id: a.id, actor_name: a.name, action_category: 'EMPLOYEE', action_type: 'RENAME_HOSPITAL', target_identifier: `${ok} คน`, description: `แก้ชื่อ รพ.ประกันสังคม: ${old} → ${nv} (พนักงาน ${ok} คน)` }]); } catch (_) {}
        }
      }
      if (act.type === 'tpl') await downloadHospitalTemplate();
      if (act.type === 'import') await openHospitalImport(list);
      if (act.type === 'seed') await saveHospitalList(list.concat(suggestions.map((x) => x.name)));
      if (act.type === 'snap') {
        let ok = 0;
        for (const e of mismatch) { const { error } = await sb().from('employees').update({ hospital: findInList(list, e.hospital) }).eq('id', e.id); if (!error) ok++; }
        try { const a = hrActor(); await sb().from('hr_admin_management_logs').insert([{ actor_id: a.id, actor_name: a.name, action_category: 'EMPLOYEE', action_type: 'NORMALIZE_HOSPITAL', target_identifier: `${ok} คน`, description: `ปรับชื่อ รพ.ประกันสังคมให้ตรงรายการ ${ok} คน` }]); } catch (_) {}
        await Swal.fire({ icon: 'success', title: `ปรับแล้ว ${ok} คน`, timer: 1200, showConfirmButton: false });
      }
    } catch (e) { await Swal.fire('ไม่สำเร็จ', e.message, 'error'); }
    return openHospitalListManager(onChanged);
  }

  // ------------------------------------------------------------------ นำเข้า รพ. (Excel / CSV / วางข้อความ)
  //  แบบที่ 1: มีแค่ชื่อ รพ. → เพิ่มเข้ารายการให้พนักงานเลือก
  //  แบบที่ 2: มีรหัสพนักงาน + ชื่อ รพ. → ตั้ง รพ.ให้พนักงานแต่ละคน (+ เพิ่มชื่อเข้ารายการ + ล็อกว่า HR ยืนยันแล้ว)
  function parseDelimited(text) {
    const lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const sep = lines.some((l) => l.includes('\t')) ? '\t' : (lines.some((l) => l.includes(',')) ? ',' : null);
    return lines.map((l) => {
      if (!sep) return [l];
      const out = []; let cur = ''; let q = false;
      for (let i = 0; i < l.length; i++) {
        const c = l[i];
        if (c === '"') { if (q && l[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
        else if (c === sep && !q) { out.push(cur); cur = ''; }
        else cur += c;
      }
      out.push(cur);
      return out.map((x) => x.trim());
    });
  }
  async function readExcelRows(file) {
    const name = String(file.name || '').toLowerCase();
    if (name.endsWith('.csv') || name.endsWith('.txt')) return parseDelimited(await file.text());
    const buf = await file.arrayBuffer();
    // ExcelJS อ่านไฟล์ที่สร้างจากบางโปรแกรมไม่ได้ (เช่น ไฟล์จาก Open XML SDK) → สำรองด้วย SheetJS
    const viaSheetJS = async () => {
      if (!global.XLSX) {
        await new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'; sc.onload = res; sc.onerror = () => rej(new Error('โหลดตัวอ่านไฟล์สำรองไม่สำเร็จ')); document.head.appendChild(sc); });
      }
      const wb2 = global.XLSX.read(new Uint8Array(buf), { type: 'array' });
      const sh = wb2.Sheets[wb2.SheetNames[0]];
      return global.XLSX.utils.sheet_to_json(sh, { header: 1, defval: '', raw: false }).map((r) => r.map((v) => clean(v)));
    };
    if (!global.ExcelJS) return viaSheetJS();
    const wb = new global.ExcelJS.Workbook();
    try { await wb.xlsx.load(buf); } catch (_) { return viaSheetJS(); }
    const ws = wb.worksheets[0];
    if (!ws) return viaSheetJS();
    const rows = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const vals = [];
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        let v = cell.value;
        if (v && typeof v === 'object') v = v.text || v.result || (v.richText ? v.richText.map((t) => t.text).join('') : '') || '';
        vals[col - 1] = clean(v);
      });
      rows.push(vals.map((x) => x || ''));
    });
    return rows;
  }
  function analyseRows(rows) {
    if (!rows.length) return { mode: 'none', items: [] };
    // หัวตาราง = ข้อความสั้นที่เป็นชื่อคอลัมน์จริง (กันชื่อ รพ.บรรทัดแรกถูกมองเป็นหัวตาราง)
    // ไฟล์ที่มีบรรทัดชื่อเรื่อง/หมายเหตุด้านบน: หาแถวหัวตารางใน 15 แถวแรก
    const CODE_RE = /^(รหัส(พนักงาน)?|employee_?code|emp_?code|code|id)$/;
    const HOSP_RE = /^((ชื่อ)?(โรงพยาบาล|รพ\.?|สถานพยาบาล)(ประกันสังคม|ตามสิทธิ(ประกันสังคม)?)?|hospital(_?name)?|sso_?hospital)$/;
    const norm = (r) => (r || []).map((h) => String(h || '').toLowerCase().replace(/\s+/g, '').replace(/\(.*?\)/g, ''));
    let hr = rows.slice(0, 15).findIndex((r) => norm(r).some((h) => HOSP_RE.test(h)));
    const head = norm(hr >= 0 ? rows[hr] : rows[0]);
    const find = (re) => head.findIndex((h) => re.test(h));
    let codeCol = find(CODE_RE);
    let hospCol = find(HOSP_RE);
    let provCol = find(/^(จังหวัด|province)$/);
    let start = hr >= 0 ? hr + 1 : ((codeCol >= 0 || hospCol >= 0) ? 1 : 0);
    if (hospCol < 0) {
      // ไม่มีหัวตาราง: 2 คอลัมน์ที่คอลัมน์แรกเป็นตัวเลข = รหัส + รพ. / ไม่งั้นคอลัมน์แรก = ชื่อ รพ.
      const sample = rows.slice(start, start + 10);
      const numFirst = sample.filter((r) => /^[A-Za-z-]*\d+$/.test(r[0] || '') && clean(r[1])).length >= Math.ceil(sample.length / 2);
      if (numFirst) { codeCol = 0; hospCol = 1; } else hospCol = codeCol === 0 ? 1 : 0;
    }
    const body = rows.slice(start);
    const name = (r) => { const h = clean(r[hospCol]); const pv = provCol >= 0 ? clean(r[provCol]) : ''; return h && pv && !h.includes(pv) ? `${h} ${pv}` : h; };
    if (codeCol >= 0) return { mode: 'assign', items: body.map((r) => ({ code: clean(r[codeCol]), hospital: name(r) })).filter((x) => x.code && x.hospital && x.hospital !== '-') };
    return { mode: 'list', items: body.map((r) => name(r)).filter((x) => x && x.length >= 3 && x !== '-') };
  }

  async function downloadHospitalTemplate() {
    if (!global.ExcelJS) { Swal.fire('ยังโหลดไม่เสร็จ', 'กรุณารอสักครู่แล้วลองใหม่', 'info'); return; }
    const wb = new global.ExcelJS.Workbook();
    const a = wb.addWorksheet('รายชื่อ รพ.');
    a.columns = [{ header: 'โรงพยาบาล', key: 'h', width: 44 }, { header: 'จังหวัด', key: 'p', width: 18 }];
    a.addRow({ h: 'โรงพยาบาลเปาโล สมุทรปราการ', p: 'สมุทรปราการ' }); a.addRow({ h: 'โรงพยาบาลบางนา 1', p: 'สมุทรปราการ' });
    const b = wb.addWorksheet('รพ.ของพนักงาน');
    b.columns = [{ header: 'รหัสพนักงาน', key: 'c', width: 16 }, { header: 'ชื่อ-นามสกุล (ไม่บังคับ)', key: 'n', width: 28 }, { header: 'โรงพยาบาล', key: 'h', width: 44 }];
    b.addRow({ c: '19132', n: 'ตัวอย่าง ชื่อ', h: 'โรงพยาบาลเปาโล สมุทรปราการ' });
    [a, b].forEach((ws) => { ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } }; });
    const buf = await wb.xlsx.writeBuffer();
    const link = document.createElement('a');
    link.href = global.URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    link.download = 'PVT_SSO_Hospital_Template.xlsx';
    document.body.appendChild(link); link.click(); link.remove();
    await Swal.fire({ icon: 'info', title: 'ดาวน์โหลดไฟล์ตัวอย่างแล้ว', html: '<div style="text-align:left;line-height:1.8;">ไฟล์มี 2 แผ่นงาน ใช้ <b>แผ่นงานแรก</b> ของไฟล์ที่นำเข้า:<br>• <b>รายชื่อ รพ.</b> = เพิ่มชื่อให้พนักงานเลือก<br>• <b>รพ.ของพนักงาน</b> (มีคอลัมน์รหัสพนักงาน) = ตั้ง รพ.ให้พนักงานแต่ละคนทันที<br>ย้ายแผ่นงานที่ต้องการไว้หน้าแรก หรือลบแผ่นงานที่ไม่ใช้ก่อนนำเข้า</div>' });
  }

  async function openHospitalImport(list) {
    let rows = null;
    const r = await Swal.fire({
      title: 'นำเข้าโรงพยาบาลประกันสังคม', width: 'min(760px, 96vw)',
      html: `<div style="text-align:left;font-size:14px;line-height:1.7;">
          <b>วิธีที่ 1: ไฟล์ Excel (.xlsx) หรือ CSV</b><br>
          <input type="file" id="hiFile" accept=".xlsx,.csv,.txt" style="margin:6px 0 12px;">
          <div style="font-size:12.5px;color:#64748b;margin-top:-6px;margin-bottom:12px;">ระบบอ่านแผ่นงานแรก · มีคอลัมน์ "โรงพยาบาล" = เพิ่มเข้ารายการ · มีคอลัมน์ "รหัสพนักงาน" + "โรงพยาบาล" = ตั้ง รพ.ให้พนักงานแต่ละคน</div>
          <b>วิธีที่ 2: คัดลอกจาก Excel/เว็บ แล้ววาง</b> (บรรทัดละ 1 รพ. หรือ รหัสพนักงาน[Tab]โรงพยาบาล)
          <textarea id="hiPaste" class="swal2-textarea" style="width:100%;margin:6px 0 0;min-height:150px;box-sizing:border-box;font-size:14px;" placeholder="โรงพยาบาลเปาโล สมุทรปราการ&#10;โรงพยาบาลบางนา 1&#10;…"></textarea>
        </div>`,
      showCancelButton: true, confirmButtonText: 'ตรวจข้อมูลก่อนนำเข้า', cancelButtonText: 'ยกเลิก', focusConfirm: false,
      preConfirm: async () => {
        try {
          const f = document.getElementById('hiFile')?.files?.[0];
          const txt = document.getElementById('hiPaste')?.value || '';
          rows = f ? await readExcelRows(f) : parseDelimited(txt);
          if (!rows.length) { Swal.showValidationMessage('กรุณาเลือกไฟล์ หรือวางรายชื่อ'); return false; }
          return true;
        } catch (e) { Swal.showValidationMessage(e.message || 'อ่านไฟล์ไม่สำเร็จ'); return false; }
      }
    });
    if (!r.isConfirmed || !rows) return;
    const a = analyseRows(rows);
    if (!a.items.length) { await Swal.fire('ไม่พบข้อมูลที่นำเข้าได้', 'ตรวจว่ามีคอลัมน์ชื่อโรงพยาบาล (และรหัสพนักงาน ถ้าต้องการตั้งให้รายคน)', 'warning'); return; }

    if (a.mode === 'list') {
      const fresh = []; const dupInFile = new Set();
      a.items.forEach((n) => { const k = hospKey(n); if (findInList(list, n) || dupInFile.has(k)) return; dupInFile.add(k); fresh.push(n); });
      const c = await Swal.fire({ icon: 'question', title: `เพิ่ม ${fresh.length} รพ.เข้ารายการ?`,
        html: `<div style="text-align:left;">อ่านได้ ${a.items.length} บรรทัด · มีในรายการแล้ว/ซ้ำ ${a.items.length - fresh.length} · <b>ใหม่ ${fresh.length}</b><div style="max-height:30vh;overflow:auto;margin-top:8px;font-size:13.5px;color:#334155;">${fresh.slice(0, 200).map((n) => `• ${esc(n)}`).join('<br>')}${fresh.length > 200 ? '<br>…' : ''}</div></div>`,
        showCancelButton: true, confirmButtonText: 'เพิ่มเข้ารายการ', cancelButtonText: 'ยกเลิก' });
      if (!c.isConfirmed || !fresh.length) return;
      await saveHospitalList(list.concat(fresh));
      try { const ac = hrActor(); await sb().from('hr_admin_management_logs').insert([{ actor_id: ac.id, actor_name: ac.name, action_category: 'EMPLOYEE', action_type: 'IMPORT_HOSPITAL_LIST', target_identifier: `${fresh.length} รายการ`, description: `นำเข้ารายชื่อ รพ.ประกันสังคม ${fresh.length} รายการ` }]); } catch (_) {}
      await Swal.fire({ icon: 'success', title: `เพิ่มแล้ว ${fresh.length} รพ.`, timer: 1300, showConfirmButton: false });
      return;
    }

    // แบบตั้ง รพ.ให้พนักงานรายคน
    const { data: emps, error } = await sb().from('employees').select('id, employee_code, full_name, hospital, profile_meta').range(0, 4999);
    if (error) { Swal.fire('โหลดรายชื่อพนักงานไม่สำเร็จ', error.message, 'error'); return; }
    const byCode = new Map((emps || []).map((e) => [String(e.employee_code || '').toLowerCase(), e]));
    const plan = []; const notFound = []; let same = 0;
    a.items.forEach((x) => {
      const e = byCode.get(x.code.toLowerCase());
      if (!e) { notFound.push(x.code); return; }
      const std = findInList(list, x.hospital) || x.hospital;
      if (clean(e.hospital) === std) { same++; return; }
      plan.push({ e, from: e.hospital || '', to: std });
    });
    const newNames = [];
    plan.forEach((p) => { if (!findInList(list, p.to) && !newNames.some((n) => hospKey(n) === hospKey(p.to))) newNames.push(p.to); });
    const c = await Swal.fire({ icon: 'question', title: `ตั้ง รพ.ให้พนักงาน ${plan.length} คน?`, width: 'min(760px, 96vw)',
      html: `<div style="text-align:left;font-size:14px;">อ่านได้ ${a.items.length} แถว · <b>จะเปลี่ยน ${plan.length} คน</b> · เหมือนเดิม ${same} · ไม่พบรหัสพนักงาน ${notFound.length}${notFound.length ? ` <small style="color:#b45309;">(${esc(notFound.slice(0, 15).join(', '))}${notFound.length > 15 ? ' …' : ''})</small>` : ''}
        ${newNames.length ? `<div style="margin-top:6px;color:#0369a1;">ชื่อ รพ.ใหม่ที่จะเพิ่มเข้ารายการ ${newNames.length} ชื่อ</div>` : ''}
        <div style="max-height:32vh;overflow:auto;margin-top:8px;font-size:13px;color:#334155;">${plan.slice(0, 150).map((p) => `• ${esc(p.e.employee_code)} ${esc(p.e.full_name || '')}: ${esc(p.from || 'ว่าง')} → <b>${esc(p.to)}</b>`).join('<br>')}${plan.length > 150 ? '<br>…' : ''}</div>
        <label style="display:flex;gap:8px;align-items:center;margin-top:10px;"><input type="checkbox" id="hiLock" checked> ล็อกว่า HR ยืนยันแล้ว (พนักงานแก้เองไม่ได้ ต้องส่งคำขอ)</label></div>`,
      showCancelButton: true, confirmButtonText: 'นำเข้า', cancelButtonText: 'ยกเลิก',
      preConfirm: () => ({ lock: !!document.getElementById('hiLock')?.checked }) });
    if (!c.isConfirmed || !plan.length) return;
    if (newNames.length) await saveHospitalList(list.concat(newNames));
    const actor = hrActor();
    let ok = 0; let fail = 0;
    Swal.fire({ title: 'กำลังนำเข้า...', html: `0 / ${plan.length}`, allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    for (let i = 0; i < plan.length; i++) {
      const p = plan[i];
      const patch = { hospital: p.to };
      if (c.value.lock && Object.prototype.hasOwnProperty.call(p.e, 'profile_meta')) {
        const meta = Object.assign({}, p.e.profile_meta || {});
        meta.hospital = Object.assign({}, meta.hospital || {}, { verified_at: new Date().toISOString(), verified_by: actor.name });
        patch.profile_meta = meta;
      }
      const { error: e2 } = await sb().from('employees').update(patch).eq('id', p.e.id);
      if (e2) fail++; else ok++;
      if (i % 10 === 0) { const hc = Swal.getHtmlContainer(); if (hc) hc.textContent = `${i + 1} / ${plan.length}`; }
    }
    try { await sb().from('hr_admin_management_logs').insert([{ actor_id: actor.id, actor_name: actor.name, action_category: 'EMPLOYEE', action_type: 'IMPORT_EMPLOYEE_HOSPITAL', target_identifier: `${ok} คน`, description: `นำเข้า รพ.ประกันสังคมของพนักงาน ${ok} คน${fail ? ` (ไม่สำเร็จ ${fail})` : ''}${c.value.lock ? ' · ล็อกแล้ว' : ''}` }]); } catch (_) {}
    await Swal.fire({ icon: fail ? 'warning' : 'success', title: `นำเข้าแล้ว ${ok} คน`, text: fail ? `ไม่สำเร็จ ${fail} คน` : '' });
  }

  // สำหรับฟอร์ม HR (เพิ่ม/แก้พนักงาน): ช่องเลือก รพ. จากรายการ + "อื่น ๆ พิมพ์เอง" — ใช้รายการที่โหลดไว้ (ถ้ายังไม่มีรายการ = ช่องพิมพ์ธรรมดา)
  function hospitalFieldHtml(id, current, cls) {
    const list = hospCache || [];
    const cur = clean(current);
    if (!list.length) return `<input id="${id}" class="${cls || ''}" value="${esc(cur)}" placeholder="เช่น โรงพยาบาลเปาโล สมุทรปราการ">`;
    const inList = findInList(list, cur);
    return `<select id="${id}__sel" class="${cls || ''}" onchange="(function(s){var t=document.getElementById('${id}');t.style.display=s.value==='__other__'?'':'none';if(s.value!=='__other__')t.value=s.value;else{t.value='';t.focus();}})(this)">
        <option value="">— ไม่ระบุ —</option>
        ${list.map((h) => `<option value="${esc(h)}" ${h === inList ? 'selected' : ''}>${esc(h)}</option>`).join('')}
        <option value="__other__" ${cur && !inList ? 'selected' : ''}>อื่น ๆ (พิมพ์ชื่อเอง)</option>
      </select>
      <input id="${id}" class="${cls || ''}" value="${esc(inList || cur)}" placeholder="ชื่อโรงพยาบาล + จังหวัด" style="margin-top:6px;${cur && !inList ? '' : 'display:none;'}">`;
  }
  // โหลดรายการไว้ล่วงหน้า (รอให้ตัวเชื่อมฐานข้อมูลพร้อมก่อน) ให้ฟอร์ม HR ใช้แบบทันที
  (function preload(n) {
    let ok = false;
    try { ok = !!(sb() && sb().from); } catch (_) {}
    if (ok) getHospitalList(true).catch(() => {}); else if (n < 40) setTimeout(() => preload(n + 1), 300);
  })(0);

  global.PVTProfileChange = { FIELDS, hospitalFieldHtml, openHospitalListManager, openHospitalImport, downloadHospitalTemplate, getHospitalList, renderSelf, openReview, pendingCount, setVerified, loadMeta, thDate, maskBank };
})(window);
