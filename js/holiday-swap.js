/* ==========================================================================
   🔁 ข้อตกลงวันหยุดพิเศษ — /pages/hr/holiday-swap.html
   --------------------------------------------------------------------------
   ประเภทข้อตกลง (ตามมติที่ประชุมสวัสดิการ · พนักงานไม่ต้องตอบ เห็นเป็นประกาศที่หน้าหลัก)
     leave_swap    ใช้วันลาแลกวันหยุด       → หักวันลารายคน/รายวัน (รายละเอียดด้านล่าง)
     work_swap     ทำงานวันหยุดแลกวันหยุด   → วันทำงานพิเศษ + วันหยุดแทน · ใครไม่มา HR เลือกวิธีหักรายคน
     move_holiday  ย้ายวันหยุดนักขัตฤกษ์     → วันเดิมเป็นวันทำงาน · วันใหม่เป็นวันหยุด
     extra_holiday เพิ่มวันหยุด              → เพิ่มวันหยุด ไม่หักวันลา
   ผลต่อปฏิทิน: แถวใน holidays ผูก agreement_id (is_working_day = วันทำงานพิเศษ ทับวันอาทิตย์/วันหยุดเดิม)

   ใช้วันลาแลกวันหยุด: ระบบเสนอวิธีหักรายคน/รายวัน:
       พักร้อนปีนี้ → (ไม่พอ) ยืมพักร้อนปีหน้า (ไม่เกินเพดาน) → (ไม่มีสิทธิ์) ลาไม่รับค่าจ้าง
   HR แก้รายคนได้: พักร้อนปีนี้ / ยืมปีหน้า / ลากิจ / ลาไม่รับค่าจ้าง / ไม่หัก (ไม่อยู่ในข้อตกลง)
   กด "หักวันลาตามรายการ" → ตรวจทีละรายการว่ายังอยู่ในรอบจริง (สถานะใช้งาน, เริ่มงานก่อนวันหยุด,
   ไม่มีใบลาวันนั้นอยู่แล้ว) แล้วจึงสร้างใบลา (อนุมัติโดยระบบ) + ตัดยอดตามปีที่หัก (charge_year)
   ใช้พักร้อนล่วงหน้าแล้วสิ้นสุดการทำงาน → HR สรุปรายคน: ปรับในค่าจ้างงวดสุดท้าย / ไม่เรียกคืน
   ต้องรัน supabase/migrations/20261015_holiday_swap.sql ก่อน
   ========================================================================== */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const sb = () => window.pvtSupabase?.getClient?.() || window.PVTSDK?.client || null;
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const BLOCKED = ['inactive', 'resigned', 'terminated', 'suspended'];
  const isActiveEmp = (e) => !BLOCKED.includes(String(e?.status || '').toLowerCase().trim());
  const me = () => { try { return JSON.parse(localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser') || '{}'); } catch (e) { return {}; } };
  const nowIso = () => new Date().toISOString();
  const pad = (n) => String(n).padStart(2, '0');
  const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const thDate = (d) => { if (!d) return '-'; const [y, m, dd] = String(d).slice(0, 10).split('-').map(Number); return `${dd} ${TH_M[m - 1]} ${y + 543}`; };
  const thYear = (y) => (y ? y + 543 : '-');
  const leaveYear = (d) => (typeof window.getADYear === 'function' ? window.getADYear(d) : (() => { const [y, m] = String(d).split('-').map(Number); return y + (m === 12 ? 1 : 0); })());

  const KINDS = {
    leave_swap:    { label: 'ใช้วันลาแลกวันหยุด', icon: 'event_repeat', tone: 'teal', hint: 'หยุดยาวเพิ่ม โดยหักพักร้อนปีนี้ → ยืมพักร้อนปีหน้า → ลาไม่รับค่าจ้าง' },
    work_swap:     { label: 'ทำงานวันหยุดแลกวันหยุด', icon: 'swap_horiz', tone: 'violet', hint: 'เช่น มาทำงานวันอาทิตย์ แล้วหยุดวันจันทร์แทน · ไม่หักวันลา (ใครไม่มา HR เลือกวิธีหัก)' },
    move_holiday:  { label: 'ย้ายวันหยุดนักขัตฤกษ์', icon: 'move_down', tone: 'blue', hint: 'ย้ายวันหยุดไปวันอื่น เพื่อรวมเป็นวันหยุดยาว · วันเดิมกลายเป็นวันทำงาน' },
    extra_holiday: { label: 'เพิ่มวันหยุด', icon: 'celebration', tone: 'amber', hint: 'บริษัทให้หยุดเพิ่ม ไม่หักวันลา' }
  };
  const kindOf = (r) => (r && KINDS[r.kind] ? r.kind : 'leave_swap');
  const hasItems = (r) => ['leave_swap', 'work_swap'].includes(kindOf(r));

  const METHODS = {
    attend:           { label: 'มาทำงาน (ไม่หัก)', tone: 'teal' },
    vacation_current: { label: 'พักร้อนปีนี้', tone: 'teal' },
    vacation_next:    { label: 'ยืมพักร้อนปีหน้า', tone: 'violet' },
    personal:         { label: 'ลากิจ', tone: 'blue' },
    unpaid:           { label: 'ลาไม่รับค่าจ้าง', tone: 'amber' },
    exempt:           { label: 'ไม่หัก (ไม่อยู่ในข้อตกลง)', tone: 'gray' }
  };
  const STATUS = { pending: 'รอหัก', applied: 'หักแล้ว', skipped: 'ข้าม', cancelled: 'ยกเลิก' };
  const methodsFor = (r) => Object.keys(METHODS).filter((m) => (kindOf(r) === 'work_swap' ? true : m !== 'attend'));
  const pairsOf = (r) => (Array.isArray(r?.pairs) ? r.pairs : []);

  const state = { rounds: [], round: null, items: [], emps: {}, types: {}, ctx: null, selected: new Set(), filter: { q: '', dept: '', method: '' }, tab: 'rounds' };

  // ---------------------------------------------------------------------
  // ข้อมูลพื้นฐาน
  // ---------------------------------------------------------------------
  async function loadTypes() {
    const { data, error } = await sb().from('leave_types').select('*');
    if (error) throw error;
    const list = data || [];
    const find = (fn) => list.find(fn) || null;
    const code = (t) => String(t.leave_code || '').toUpperCase();
    const name = (t) => String(t.leave_name || '');
    state.types = {
      vacation: find((t) => ['VACATION', '03'].includes(code(t)) || code(t).includes('VACATION') || /พักร้อน|พักผ่อน/.test(name(t))),
      personal: find((t) => ['PERSONAL', '02'].includes(code(t)) || code(t).includes('PERSONAL') || /กิจ/.test(name(t))),
      unpaid: find((t) => t.paid_leave === false || code(t) === 'UNPAID' || /ไม่รับค่าจ้าง/.test(name(t)))
    };
  }
  const typeFor = (method) => (method === 'vacation_current' || method === 'vacation_next') ? state.types.vacation
    : method === 'personal' ? state.types.personal : method === 'unpaid' ? state.types.unpaid : null;

  async function loadEmployees() {
    const { data, error } = await sb().from('employees')
      .select('id, employee_code, full_name, status, role, start_date, created_at, department_id, departments!department_id(department_name)')
      .order('employee_code');
    if (error) throw error;
    state.emps = {};
    (data || []).forEach((e) => { state.emps[e.id] = e; });
  }

  // บริบทคำนวณ: ยอดพักร้อน ยอดยืมจากรอบอื่น และใบลาที่ชนวันหยุด
  async function loadContext(dates, roundId) {
    const years = new Set();
    dates.forEach((d) => { const y = leaveYear(d); years.add(y); years.add(y + 1); });
    const yearList = [...years];
    const bal = {};
    for (let from = 0; from < 20000; from += 1000) {
      const { data, error } = await sb().from('employee_leave_balances').select('employee_id, year, vacation_total, vacation_used, personal_total, personal_used').in('year', yearList).range(from, from + 999);
      if (error) throw error;
      (data || []).forEach((r) => { bal[`${r.employee_id}|${r.year}`] = r; });
      if (!data || data.length < 1000) break;
    }
    // ยืมปีหน้าจากรอบอื่นที่หักแล้ว
    const borrowed = {};
    const { data: other } = await sb().from('holiday_swap_items').select('employee_id, charge_year, round_id, status, method').eq('method', 'vacation_next').eq('status', 'applied');
    (other || []).filter((i) => i.round_id !== roundId).forEach((i) => { const k = `${i.employee_id}|${i.charge_year}`; borrowed[k] = (borrowed[k] || 0) + 1; });
    // ใบลาที่มีอยู่แล้วในวันหยุด
    const sorted = [...dates].sort();
    const conflicts = {};
    const { data: leaves } = await sb().from('leave_requests')
      .select('id, employee_id, start_date, end_date, status, swap_round_id, leave_types!leave_type_id(leave_name)')
      .lte('start_date', sorted[sorted.length - 1]).gte('end_date', sorted[0]).in('status', ['pending', 'approved', 'cancel_requested']);
    (leaves || []).forEach((l) => {
      if (roundId && l.swap_round_id === roundId) return;
      dates.forEach((d) => { if (l.start_date <= d && l.end_date >= d) conflicts[`${l.employee_id}|${d}`] = l.leave_types?.leave_name || 'ใบลา'; });
    });
    state.ctx = { bal, borrowed, conflicts };
    return state.ctx;
  }

  // สิทธิ์พักร้อนทั้งปี: มีแถวในตารางใช้ค่าจริง ไม่มีก็ประมาณตามกติกาเดิม (อายุงานครบ 1 ปีก่อนเริ่มรอบปี → 6 วัน)
  function vacationOf(emp, year) {
    const row = state.ctx.bal[`${emp.id}|${year}`];
    if (row) return { total: Number(row.vacation_total) || 0, used: Number(row.vacation_used) || 0, real: true };
    const start = new Date(emp.start_date || emp.created_at || Date.now());
    const yearStart = new Date(`${year - 1}-12-01T00:00:00`);
    return { total: (yearStart - start) / 864e5 >= 365 ? 6 : 0, used: 0, real: false };
  }

  function chargeYearOf(method, date) {
    const y = leaveYear(date);
    if (method === 'exempt' || method === 'attend') return null;
    return method === 'vacation_next' ? y + 1 : y;
  }

  // แผนเริ่มต้นตามประเภทข้อตกลง
  function planFor(r, emp, dates) {
    if (kindOf(r) !== 'work_swap') return autoPlan(emp, dates, Number(r.max_borrow) || 0);
    const out = {};
    const startDate = String(emp.start_date || '').slice(0, 10);
    dates.forEach((d) => { out[d] = startDate && startDate > d ? { method: 'exempt', reason: 'เริ่มงานหลังวันทำงานพิเศษ' } : { method: 'attend', reason: null }; });
    return out;
  }

  // เสนอวิธีหักของพนักงาน 1 คน สำหรับทุกวันในรอบ
  function autoPlan(emp, dates, maxBorrow) {
    const out = {};
    const curLeft = {}, nextLeft = {};
    [...dates].sort().forEach((d) => {
      const y = leaveYear(d);
      if (curLeft[y] == null) { const v = vacationOf(emp, y); curLeft[y] = Math.max(0, v.total - v.used); }
      if (nextLeft[y + 1] == null) {
        const v = vacationOf(emp, y + 1);
        const already = state.ctx.borrowed[`${emp.id}|${y + 1}`] || 0;
        nextLeft[y + 1] = Math.max(0, Math.min(v.total - v.used - already, maxBorrow - already));
      }
      const startDate = String(emp.start_date || '').slice(0, 10);
      let method, reason = null;
      if (startDate && startDate > d) { method = 'exempt'; reason = 'เริ่มงานหลังวันหยุด'; }
      else if (curLeft[y] >= 1) { method = 'vacation_current'; curLeft[y] -= 1; }
      else if (nextLeft[y + 1] >= 1) { method = 'vacation_next'; nextLeft[y + 1] -= 1; }
      else { method = 'unpaid'; }
      out[d] = { method, reason };
    });
    return out;
  }

  // ---------------------------------------------------------------------
  // รอบ
  // ---------------------------------------------------------------------
  async function loadRounds() {
    const { data, error } = await sb().from('holiday_swap_rounds').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    state.rounds = data || [];
  }

  async function loadItems(roundId) {
    const rows = [];
    for (let from = 0; from < 50000; from += 1000) {
      const { data, error } = await sb().from('holiday_swap_items').select('*').eq('round_id', roundId).range(from, from + 999);
      if (error) throw error;
      rows.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    state.items = rows;
  }

  // ---------------------------------------------------------------------
  // เพิ่มข้อตกลง: เลือกประเภท → กรอกวัน → สร้าง (ร่าง)
  // ---------------------------------------------------------------------
  async function pickKind() {
    let picked = null;
    await Swal.fire({
      title: 'เพิ่มข้อตกลงวันหยุดพิเศษ', width: 640, showConfirmButton: false, showCancelButton: true, cancelButtonText: 'ยกเลิก',
      html: `<p class="hs-form-lead">เลือกประเภทตามมติที่ประชุม</p><div class="hs-kinds">${Object.keys(KINDS).map((k) => `
        <button type="button" class="hs-kind hs-kind--${KINDS[k].tone}" data-kind="${k}">
          <span class="material-symbols-outlined">${KINDS[k].icon}</span>
          <span><b>${KINDS[k].label}</b><small>${KINDS[k].hint}</small></span>
        </button>`).join('')}</div>`,
      didOpen: (el) => el.querySelectorAll('[data-kind]').forEach((b) => { b.onclick = () => { picked = b.dataset.kind; Swal.close(); }; })
    });
    return picked;
  }

  const dateInputs = (cls, n, values) => [...Array(n).keys()].map((i) => `<span class="hsf-slot" ${i >= Math.max(2, values.length) ? 'style="display:none"' : ''}><input type="date" class="swal2-input ${cls}" value="${esc(values[i] || '')}"></span>`).join('');

  // ช่องวันที่แสดง วัน/เดือน/ปี พ.ศ. ด้วย js/thai-date.js (ทั้งระบบ) — ค่าใน input ยังเป็น YYYY-MM-DD
  const NOT_ALT = ':not(.pvt-thdate-alt):not(.hsf-alt)';
  const pairInputs = (n, aLabel, bLabel, values) => [...Array(n).keys()].map((i) => `
    <div class="hs-pair" ${i >= Math.max(1, values.length) ? 'style="display:none"' : ''}>
      <span><small>${aLabel}</small><input type="date" class="swal2-input hsf-a" value="${esc(values[i]?.a || '')}"></span>
      <span class="material-symbols-outlined">arrow_forward</span>
      <span><small>${bLabel}</small><input type="date" class="swal2-input hsf-b" value="${esc(values[i]?.b || '')}"></span>
    </div>`).join('');

  // ฟอร์มข้อตกลง (ใช้ทั้งเพิ่มและแก้ไข) — init = ข้อตกลงเดิม (ถ้าเป็นการแก้ไข)
  async function agreementForm(kind, init) {
    const K = KINDS[kind];
    const isPairs = kind === 'work_swap' || kind === 'move_holiday';
    const oldPairs = init ? pairsOf(init).map((p) => (kind === 'work_swap' ? { a: p.work_date, b: p.off_date } : { a: p.from_date, b: p.to_date })) : [];
    const oldDates = init && !isPairs ? [...(init.swap_dates || [])].sort() : [];
    const datesBlock = isPairs
      ? `<label>${kind === 'work_swap' ? 'วันทำงานพิเศษ → วันหยุดแทน' : 'วันหยุดเดิม → ย้ายไปหยุดวันที่'}
          <div class="hs-pairs">${kind === 'work_swap' ? pairInputs(4, 'มาทำงานวันที่', 'หยุดแทนวันที่', oldPairs) : pairInputs(4, 'วันหยุดเดิม', 'ย้ายไปหยุดวันที่', oldPairs)}</div>
          <button type="button" id="hsf-more" class="hs-link">+ เพิ่มอีกคู่</button></label>`
      : `<label>${kind === 'leave_swap' ? 'วันหยุดที่เพิ่ม (หักวันลา)' : 'วันหยุดที่เพิ่ม'}
          <div class="hs-form-dates">${dateInputs('hsf-date', 5, oldDates)}</div>
          <button type="button" id="hsf-more" class="hs-link">+ เพิ่มวัน</button></label>`;
    const placeholders = {
      leave_swap: ['เช่น หยุดยาวปีใหม่ 2570', 'เช่น ตามมติที่ประชุม บริษัทเพิ่มวันหยุดยาว โดยใช้วันพักร้อนแลก'],
      work_swap: ['เช่น ทำงานวันอาทิตย์แลกหยุดยาวปีใหม่', 'เช่น ขอให้ทุกคนมาทำงานวันอาทิตย์ที่ 7 ธ.ค. และหยุดวันจันทร์ที่ 29 ธ.ค. แทน'],
      move_holiday: ['เช่น ย้ายวันหยุดรวมหยุดยาวสงกรานต์', 'เช่น ย้ายวันหยุดวันจักรีไปรวมกับสงกรานต์ เป็นหยุดยาว 4 วัน'],
      extra_holiday: ['เช่น วันหยุดพิเศษครบรอบบริษัท', 'เช่น บริษัทให้หยุดเพิ่ม 1 วัน ไม่หักวันลา']
    }[kind];
    const applied = init?.status === 'applied';
    const { value } = await Swal.fire({
      title: init ? `แก้ไข: ${K.label}` : K.label, width: 640,
      html: `
        <div class="hs-form">
          <p class="hs-form-lead">${K.hint}</p>
          ${applied ? '<p class="hs-form-warn">ข้อตกลงนี้บันทึกแล้ว — ถ้าแก้วันที่ ระบบจะปรับปฏิทินให้ใหม่ ยกเลิกใบลาของวันที่ตัดออก (คืนวันลา) และหักวันลาของวันที่เพิ่มเข้ามาให้อัตโนมัติ</p>' : ''}
          <label>ชื่อข้อตกลง<input id="hsf-title" class="swal2-input" placeholder="${placeholders[0]}" value="${esc(init?.title || '')}"></label>
          ${datesBlock}
          <label>อ้างอิงข้อตกลง<input id="hsf-ref" class="swal2-input" placeholder="เช่น มติที่ประชุมสวัสดิการ ครั้งที่ 2/2569" value="${esc(init?.agreement_ref || '')}"></label>
          <label>ข้อความที่แสดงให้พนักงาน<textarea id="hsf-note" class="swal2-textarea" placeholder="${placeholders[1]}">${esc(init?.note || '')}</textarea></label>
          ${kind === 'leave_swap' ? `<label>ยืมพักร้อนปีหน้าได้ไม่เกิน (วัน/คน)<input id="hsf-max" type="number" min="0" max="10" step="1" value="${init ? Number(init.max_borrow) || 0 : 2}" class="swal2-input"></label>` : ''}
        </div>`,
      didOpen: () => {
        $('hsf-more').onclick = () => { const hidden = [...document.querySelectorAll(isPairs ? '.hs-pair' : '.hsf-slot')].find((i) => i.style.display === 'none'); if (hidden) hidden.style.display = ''; };
      },
      showCancelButton: true,
      confirmButtonText: init ? 'บันทึกการแก้ไข' : (hasItems({ kind }) ? 'สร้างและคำนวณรายชื่อ' : 'สร้างข้อตกลง'),
      cancelButtonText: 'ยกเลิก', focusConfirm: false,
      preConfirm: async () => {
        const title = $('hsf-title').value.trim();
        if (!title) return Swal.showValidationMessage('กรุณาตั้งชื่อข้อตกลง');
        let dates = [], pairs = null;
        if (isPairs) {
          const rows = [...document.querySelectorAll('.hs-pair')].map((row) => ({ a: row.querySelector('.hsf-a' + NOT_ALT).value, b: row.querySelector('.hsf-b' + NOT_ALT).value })).filter((x) => x.a || x.b);
          if (!rows.length) return Swal.showValidationMessage('กรุณาเลือกวันอย่างน้อย 1 คู่');
          if (rows.some((x) => !x.a || !x.b)) return Swal.showValidationMessage('กรุณาเลือกวันให้ครบทั้ง 2 ช่องของแต่ละคู่');
          if (rows.some((x) => x.a === x.b)) return Swal.showValidationMessage('วันทั้ง 2 ช่องต้องไม่ใช่วันเดียวกัน');
          if (kind === 'work_swap') {
            pairs = rows.map((x) => ({ work_date: x.a, off_date: x.b }));
            dates = [...new Set(pairs.map((x) => x.work_date))].sort();
          } else {
            // ชื่อวันหยุดเดิม (ต้องมีในปฏิทิน) — ไม่นับแถวที่ข้อตกลงนี้สร้างเอง
            const { data: hol } = await sb().from('holidays').select('holiday_date, holiday_name, is_working_day, agreement_id').in('holiday_date', rows.map((x) => x.a));
            const nameOf = (d) => (hol || []).find((h) => String(h.holiday_date).slice(0, 10) === d && !h.is_working_day && (!init || h.agreement_id !== init.id))?.holiday_name || '';
            const missing = rows.filter((x) => !nameOf(x.a));
            if (missing.length) {
              Swal.showValidationMessage(`ไม่พบวันหยุดในปฏิทินวันที่ ${missing.map((x) => thDate(x.a)).join(', ')} — ตรวจวันที่อีกครั้ง หรือเพิ่มวันหยุดนั้นในปฏิทินก่อน`);
              return false;
            }
            pairs = rows.map((x) => ({ from_date: x.a, to_date: x.b, label: nameOf(x.a) }));
            dates = [...new Set(pairs.map((x) => x.to_date))].sort();
          }
        } else {
          dates = [...new Set([...document.querySelectorAll('.hsf-date' + NOT_ALT)].map((i) => i.value).filter(Boolean))].sort();
          if (!dates.length) return Swal.showValidationMessage('กรุณาเลือกวันอย่างน้อย 1 วัน');
        }
        const maxBorrow = kind === 'leave_swap' ? Math.max(0, Number($('hsf-max').value) || 0) : 0;
        return { title, dates, pairs, ref: $('hsf-ref').value.trim(), note: $('hsf-note').value.trim(), maxBorrow };
      }
    });
    return value || null;
  }

  // สร้างรายการรายคนของวันที่กำหนด (ใช้ตอนสร้าง / ตอนแก้ไขแล้วมีวันเพิ่ม)
  async function insertItemsFor(round, dates) {
    if (!dates.length) return [];
    await loadEmployees();
    await loadContext(round.swap_dates, round.id);
    const rows = [];
    Object.values(state.emps).filter(isActiveEmp).forEach((emp) => {
      const plan = planFor(round, emp, round.swap_dates);
      dates.forEach((d) => rows.push({
        round_id: round.id, employee_id: emp.id, swap_date: d, method: plan[d].method, method_source: 'auto',
        charge_year: chargeYearOf(plan[d].method, d), status: 'pending', skip_reason: plan[d].reason
      }));
    });
    const out = [];
    for (let i = 0; i < rows.length; i += 500) {
      const { data, error } = await sb().from('holiday_swap_items').insert(rows.slice(i, i + 500)).select();
      if (error) throw error;
      out.push(...(data || []));
    }
    return out;
  }

  async function createRound() {
    const kind = await pickKind();
    if (!kind) return;
    const value = await agreementForm(kind, null);
    if (!value) return;
    Swal.fire({ title: hasItems({ kind }) ? 'กำลังคำนวณรายชื่อ...' : 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
      const u = me();
      const { data: round, error } = await sb().from('holiday_swap_rounds').insert([{
        kind, title: value.title, swap_dates: value.dates, pairs: value.pairs, agreement_ref: value.ref || null, note: value.note || null,
        max_borrow: value.maxBorrow, status: 'draft', created_by: u.id || null, created_by_name: u.full_name || u.employee_code || null
      }]).select().single();
      if (error) throw error;
      if (hasItems(round)) await insertItemsFor(round, value.dates);
      Swal.close();
      await openRound(round.id);
    } catch (err) {
      Swal.fire('บันทึกไม่สำเร็จ', migrationHint(err), 'error');
    }
  }

  // แก้ไขข้อตกลง (ร่าง / บันทึกแล้ว) — ประเภทเปลี่ยนไม่ได้ (ถ้าเลือกผิด: ลบร่างแล้วสร้างใหม่)
  async function editRound() {
    const r = state.round;
    if (!r || r.status === 'cancelled') return;
    const value = await agreementForm(kindOf(r), r);
    if (!value) return;
    Swal.fire({ title: 'กำลังบันทึกการแก้ไข...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
      const oldDates = [...(r.swap_dates || [])];
      const removed = oldDates.filter((d) => !value.dates.includes(d));
      const added = value.dates.filter((d) => !oldDates.includes(d));
      const patch = { title: value.title, swap_dates: value.dates, pairs: value.pairs, agreement_ref: value.ref || null, note: value.note || null, max_borrow: value.maxBorrow, updated_at: nowIso() };
      const { error } = await sb().from('holiday_swap_rounds').update(patch).eq('id', r.id);
      if (error) throw error;
      const nr = Object.assign({}, r, patch);
      if (hasItems(nr)) {
        // วันที่ตัดออก: ยกเลิกใบลาที่หักไปแล้ว (คืนวันลา) แล้วลบรายการ
        const gone = state.items.filter((i) => removed.includes(i.swap_date));
        for (const it of gone.filter((i) => i.status === 'applied')) await cancelItem(it, `แก้ไขข้อตกลง "${nr.title}": ตัดวันที่ ${thDate(it.swap_date)} ออก`);
        if (removed.length) await sb().from('holiday_swap_items').delete().eq('round_id', r.id).in('swap_date', removed);
        // วันที่เพิ่มเข้ามา: สร้างรายการรายคน (ถ้าบันทึกแล้ว หักให้ทันที)
        const fresh = await insertItemsFor(nr, added);
        if (nr.status === 'applied') { for (const it of fresh) { try { await applyItem(it, nr); } catch (e) { console.warn('[Holiday agreement] edit apply', it, e); } } }
      }
      if (nr.status === 'applied') await applyCalendar(nr);
      Swal.hideLoading();
      Swal.fire({ icon: 'success', title: 'บันทึกการแก้ไขแล้ว', didOpen: () => Swal.hideLoading(),
        html: removed.length || added.length ? `<small>${added.length ? `เพิ่ม ${added.map(thDate).join(', ')}` : ''}${added.length && removed.length ? ' · ' : ''}${removed.length ? `ตัดออก ${removed.map(thDate).join(', ')}` : ''}</small>` : '' });
      await openRound(r.id);
    } catch (err) { Swal.fire('แก้ไขไม่สำเร็จ', migrationHint(err), 'error'); await openRound(r.id); }
  }

  // ลบร่าง (ยังไม่เคยบันทึก → ไม่มีใบลา/ปฏิทินให้คืน)
  async function deleteDraft() {
    const r = state.round;
    if (!r || r.status !== 'draft') return;
    const ok = await Swal.fire({ icon: 'warning', title: `ลบร่าง "${r.title}"?`, text: 'ใช้เมื่อกรอกผิดหรือเลือกประเภทผิด — ร่างและรายชื่อในร่างจะถูกลบ', showCancelButton: true, confirmButtonText: 'ลบร่าง', confirmButtonColor: '#dc2626', cancelButtonText: 'ไม่ลบ' });
    if (!ok.isConfirmed) return;
    const { error } = await sb().from('holiday_swap_rounds').delete().eq('id', r.id).eq('status', 'draft');
    if (error) { Swal.fire('ลบไม่สำเร็จ', error.message, 'error'); return; }
    toast('ลบร่างแล้ว');
    state.tab = 'rounds'; setTab(); renderRounds();
  }

  // ---------------------------------------------------------------------
  // ผลต่อปฏิทินวันหยุด (ทุกประเภท) — ผูก agreement_id เพื่อลบคืนได้ตอนยกเลิก
  // ---------------------------------------------------------------------
  function calendarRows(r) {
    const k = kindOf(r);
    const ref = r.agreement_ref ? ` (${r.agreement_ref})` : '';
    const row = (date, name, extra) => Object.assign({ holiday_date: date, holiday_name: name, category: 'company', holiday_type: 'swap_day', is_paid: true, is_working_day: false, agreement_id: r.id, description: null }, extra);
    if (k === 'leave_swap') return r.swap_dates.map((d) => row(d, r.title, { description: `ใช้วันลาแลกวันหยุด${ref}` }));
    if (k === 'extra_holiday') return r.swap_dates.map((d) => row(d, r.title, { holiday_type: 'company_holiday', description: `วันหยุดพิเศษ${ref}` }));
    if (k === 'work_swap') {
      return pairsOf(r).flatMap((p) => [
        row(p.work_date, `วันทำงานพิเศษ: ${r.title}`, { holiday_type: 'working_day', is_working_day: true, description: `มาทำงานแลกกับหยุดวันที่ ${thDate(p.off_date)}${ref}` }),
        row(p.off_date, `${r.title} (หยุดแทนวันที่ ${thDate(p.work_date)})`, { description: `ทำงานวันหยุดแลกวันหยุด${ref}` })
      ]);
    }
    return pairsOf(r).flatMap((p) => [
      row(p.from_date, `ย้ายวันหยุด: ${p.label || 'วันหยุด'} → ${thDate(p.to_date)}`, { holiday_type: 'working_day', is_working_day: true, description: `วันหยุดเดิมย้ายไปวันที่ ${thDate(p.to_date)} · วันนี้เป็นวันทำงาน${ref}` }),
      row(p.to_date, `${p.label || r.title} (ย้ายจาก ${thDate(p.from_date)})`, { category: 'official', holiday_type: 'public_holiday', description: `ย้ายวันหยุดนักขัตฤกษ์${ref}` })
    ]);
  }

  async function removeCalendar(r) {
    await sb().from('holidays').delete().eq('agreement_id', r.id);
    // แถวรุ่นแรก (ก่อนมี agreement_id)
    if (kindOf(r) === 'leave_swap') await sb().from('holidays').delete().eq('holiday_type', 'swap_day').eq('holiday_name', r.title).in('holiday_date', r.swap_dates);
  }

  async function applyCalendar(r) {
    await removeCalendar(r);
    const { error } = await sb().from('holidays').insert(calendarRows(r));
    if (error) throw error;
  }

  // คำอธิบายผลต่อปฏิทิน (ใช้ในหน้ายืนยัน / หน้ารายละเอียด)
  function calendarSummary(r) {
    const k = kindOf(r);
    if (k === 'work_swap') return pairsOf(r).map((p) => ({ a: `มาทำงาน ${thDate(p.work_date)}`, b: `หยุดแทน ${thDate(p.off_date)}` }));
    if (k === 'move_holiday') return pairsOf(r).map((p) => ({ a: `${esc(p.label || 'วันหยุด')} ${thDate(p.from_date)} (กลายเป็นวันทำงาน)`, b: `ย้ายไปหยุด ${thDate(p.to_date)}` }));
    return r.swap_dates.map((d) => ({ a: thDate(d), b: k === 'leave_swap' ? 'วันหยุด (หักวันลา)' : 'วันหยุด (ไม่หักวันลา)' }));
  }

  function migrationHint(err) {
    const msg = err?.message || String(err);
    return /does not exist|PGRST205|42P01|Could not find the table|column .* does not exist/i.test(`${err?.code} ${msg}`)
      ? 'ยังไม่ได้สร้างตารางในฐานข้อมูล กรุณารัน supabase/migrations/20261015_holiday_swap.sql ก่อน'
      : msg;
  }

  // คำนวณใหม่ (เฉพาะรอบร่าง) — คงรายการที่ HR แก้เองไว้ + เติมพนักงานที่ยังไม่อยู่ในรอบ
  async function recalcRound() {
    const r = state.round;
    if (!r || r.status !== 'draft') return;
    Swal.fire({ title: 'กำลังคำนวณใหม่...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
      await loadEmployees();
      await loadContext(r.swap_dates, r.id);
      const byEmp = {};
      state.items.forEach((i) => { (byEmp[i.employee_id] = byEmp[i.employee_id] || {})[i.swap_date] = i; });
      const inserts = [], updates = [];
      Object.values(state.emps).filter(isActiveEmp).forEach((emp) => {
        const plan = planFor(r, emp, r.swap_dates);
        r.swap_dates.forEach((d) => {
          const it = byEmp[emp.id]?.[d];
          if (!it) inserts.push({ round_id: r.id, employee_id: emp.id, swap_date: d, method: plan[d].method, method_source: 'auto', charge_year: chargeYearOf(plan[d].method, d), status: 'pending', skip_reason: plan[d].reason });
          else if (it.method_source === 'auto' && it.status === 'pending' && it.method !== plan[d].method) updates.push({ id: it.id, method: plan[d].method, charge_year: chargeYearOf(plan[d].method, d), skip_reason: plan[d].reason });
        });
      });
      for (let i = 0; i < inserts.length; i += 500) { const { error } = await sb().from('holiday_swap_items').insert(inserts.slice(i, i + 500)); if (error) throw error; }
      for (const u of updates) await sb().from('holiday_swap_items').update({ method: u.method, charge_year: u.charge_year, skip_reason: u.skip_reason, updated_at: nowIso() }).eq('id', u.id).eq('status', 'pending');
      Swal.close();
      await openRound(r.id);
      toast(`คำนวณใหม่แล้ว · เพิ่ม ${inserts.length} รายการ · ปรับ ${updates.length} รายการ`);
    } catch (err) { Swal.fire('คำนวณไม่สำเร็จ', migrationHint(err), 'error'); }
  }

  // ---------------------------------------------------------------------
  // หักวันลา / ยกเลิก (ทีละรายการ)
  // ---------------------------------------------------------------------
  async function applyItem(item, round) {
    const emp = state.emps[item.employee_id];
    const setItem = async (patch) => {
      const { error } = await sb().from('holiday_swap_items').update(Object.assign({ updated_at: nowIso() }, patch)).eq('id', item.id);
      if (error) throw error;
      Object.assign(item, patch);
    };
    if (item.method === 'exempt' || item.method === 'attend') { await setItem({ status: 'applied', leave_request_id: null, charge_year: null }); return 'exempt'; }

    // ✅ ตรวจว่ายังอยู่ในรอบนี้จริงก่อนหัก
    const { data: fresh } = await sb().from('employees').select('id, status, start_date').eq('id', item.employee_id).maybeSingle();
    if (!fresh || !isActiveEmp(fresh)) { await setItem({ status: 'skipped', skip_reason: 'พนักงานไม่อยู่ในสถานะใช้งาน' }); return 'skipped'; }
    if (fresh.start_date && String(fresh.start_date).slice(0, 10) > item.swap_date) { await setItem({ status: 'skipped', skip_reason: 'เริ่มงานหลังวันหยุด' }); return 'skipped'; }
    const { data: clash } = await sb().from('leave_requests').select('id, swap_round_id, leave_types!leave_type_id(leave_name)')
      .eq('employee_id', item.employee_id).lte('start_date', item.swap_date).gte('end_date', item.swap_date)
      .in('status', ['pending', 'approved', 'cancel_requested']);
    const other = (clash || []).find((l) => l.swap_round_id !== round.id);
    if (other) { await setItem({ status: 'skipped', skip_reason: `มีใบลาวันนี้อยู่แล้ว (${other.leave_types?.leave_name || 'ใบลา'})` }); return 'skipped'; }

    const type = typeFor(item.method);
    if (!type) { await setItem({ status: 'skipped', skip_reason: `ไม่พบประเภทลาสำหรับ "${METHODS[item.method].label}"` }); return 'skipped'; }
    const chargeYear = chargeYearOf(item.method, item.swap_date);
    const paid = type.paid_leave !== false;
    if (paid && window.PVTSDK?.user?.ensureLeaveBalances) { try { await window.PVTSDK.user.ensureLeaveBalances(item.employee_id, chargeYear); } catch (e) {} }

    const u = me(); const t = nowIso();
    const reason = `${kindOf(round) === 'work_swap' ? 'ไม่ได้มาทำงานวันทำงานพิเศษ' : 'แลกวันหยุด'}: ${round.title}${round.agreement_ref ? ` (${round.agreement_ref})` : ''}${item.method === 'vacation_next' ? ` · หักจากสิทธิ์พักร้อนปี ${thYear(chargeYear)}` : ''}`;
    const { data: leave, error } = await sb().from('leave_requests').insert([{
      employee_id: item.employee_id, leave_type_id: type.id, start_date: item.swap_date, end_date: item.swap_date,
      total_days: 1, leave_hours: 0, start_period: 'full_day', end_period: 'full_day', reason,
      status: 'approved', manager_status: 'approved', director_status: 'approved', executive_status: 'approved',
      approved_at: t, approved_by: u.id || null, approval_comment: 'หักอัตโนมัติจากข้อตกลงวันหยุดพิเศษ (ตามมติที่ประชุมสวัสดิการ)',
      charge_year: chargeYear, swap_round_id: round.id
    }]).select().single();
    if (error) { await setItem({ status: 'skipped', skip_reason: `สร้างใบลาไม่สำเร็จ: ${error.message}` }); return 'skipped'; }

    if (paid && window.PVTSDK?.user?.updateLeaveBalance) {
      await window.PVTSDK.user.updateLeaveBalance(item.employee_id, type.id, type.leave_code || null, chargeYear, 1);
    }
    await setItem({ status: 'applied', leave_request_id: leave.id, charge_year: chargeYear, skip_reason: null });
    if (window.PVTLeaveAudit) {
      try {
        await window.PVTLeaveAudit.log(Object.assign({}, leave, { employees: emp, leave_types: type }), 'approved', {
          system: true, stepLevel: 'SWAP', stepLabel: `ข้อตกลงวันหยุดพิเศษ: ${round.title}`, comment: `${METHODS[item.method].label}${item.method === 'vacation_next' ? ` (ปี ${thYear(chargeYear)})` : ''}`, statusBefore: null, statusAfter: 'approved'
        });
      } catch (e) {}
    }
    return 'applied';
  }

  async function cancelItem(item, why) {
    if (item.leave_request_id) {
      const { data: leave } = await sb().from('leave_requests').select('*').eq('id', item.leave_request_id).maybeSingle();
      if (leave && leave.status !== 'cancelled') {
        const { data: changed, error } = await sb().from('leave_requests').update({ status: 'cancelled', cancel_reason: why, approval_comment: `[ยกเลิกจากข้อตกลงวันหยุดพิเศษ] ${why}` }).eq('id', leave.id).neq('status', 'cancelled').select('id');
        if (error) throw error;
        const type = Object.values(state.types).find((t) => t && String(t.id) === String(leave.leave_type_id));
        if (changed && changed.length && type && type.paid_leave !== false && window.PVTSDK?.user?.updateLeaveBalance) {
          const year = typeof window.getLeaveChargeYear === 'function' ? window.getLeaveChargeYear(leave) : leaveYear(leave.start_date);
          await window.PVTSDK.user.updateLeaveBalance(leave.employee_id, leave.leave_type_id, type.leave_code || null, year, -(Number(leave.total_days) || 1));
        }
      }
    }
  }

  async function applyRound() {
    const r = state.round;
    const items = hasItems(r);
    const todo = state.items.filter((i) => i.status === 'pending');
    const count = (m) => todo.filter((i) => i.method === m).length;
    const cal = calendarSummary(r).map((x) => `• ${x.a} → <b>${x.b}</b>`).join('<br>');
    const ok = await Swal.fire({
      icon: 'question', title: items ? 'บันทึกข้อตกลงและหักวันลาตามรายการ?' : 'บันทึกข้อตกลงลงปฏิทิน?', width: 580,
      html: `<div style="text-align:left; font-size:14px; line-height:1.8">
        <b>${esc(r.title)}</b> · ${KINDS[kindOf(r)].label}<br>
        <span style="color:#475569">ปฏิทินวันหยุดของทุกคน</span><br>${cal}
        ${items ? `<hr style="margin:10px 0">${methodsFor(r).map((m) => `${METHODS[m].label}: <b>${count(m)}</b> รายการ`).join('<br>')}
        <hr style="margin:10px 0"><small style="color:#64748b">ระบบจะตรวจทีละรายการก่อนหัก: ยังเป็นพนักงานอยู่ · เริ่มงานก่อนวันนั้น · ไม่มีใบลาวันนั้นอยู่แล้ว (รายการที่ไม่ผ่านจะถูก "ข้าม" พร้อมเหตุผล ให้ HR ตัดสินใจต่อ)</small>` : ''}
        <br><small style="color:#64748b">พนักงานจะเห็นประกาศที่หน้าหลัก</small></div>`,
      showCancelButton: true, confirmButtonText: 'บันทึก', cancelButtonText: 'ยกเลิก'
    });
    if (!ok.isConfirmed) return;
    Swal.fire({ title: 'กำลังบันทึก...', html: items ? '<span id="hs-prog">0</span> / ' + todo.length : '', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    // ปฏิทินก่อน (ถ้าล้มเหลว จะไม่หักวันลา)
    try { await applyCalendar(r); } catch (err) {
      Swal.hideLoading(); Swal.fire({ icon: 'error', title: 'บันทึกปฏิทินไม่สำเร็จ', text: migrationHint(err), didOpen: () => Swal.hideLoading() });
      return;
    }
    const res = { applied: 0, exempt: 0, skipped: 0, error: 0 };
    let n = 0;
    if (items) {
      try { await loadEmployees(); } catch (e) {}
      for (const it of todo) {
        try { res[await applyItem(it, r)] += 1; } catch (e) { res.error += 1; console.warn('[Holiday agreement] apply', it, e); }
        n += 1; const p = $('hs-prog'); if (p) p.textContent = n;
      }
    }
    await sb().from('holiday_swap_rounds').update({ status: 'applied', applied_at: nowIso(), applied_by_name: me().full_name || me().employee_code || null, updated_at: nowIso() }).eq('id', r.id);
    Swal.hideLoading();
    Swal.fire({
      icon: res.error ? 'warning' : 'success', title: 'บันทึกข้อตกลงเรียบร้อย', didOpen: () => Swal.hideLoading(),
      html: items
        ? `หักวันลา <b>${res.applied}</b> · ไม่หัก <b>${res.exempt}</b> · ข้าม <b>${res.skipped}</b>${res.error ? ` · ผิดพลาด <b>${res.error}</b>` : ''}<br><small>รายการที่ "ข้าม" แก้วิธีหักแล้วกดหักรายการนั้นใหม่ได้${kindOf(r) === 'work_swap' ? ' · ใครไม่มาทำงาน เปลี่ยนวิธีหักภายหลังได้' : ''}</small>`
        : 'ปรับปฏิทินวันหยุดของทุกคนแล้ว'
    });
    await openRound(r.id);
  }

  async function cancelRound() {
    const r = state.round;
    const { value: why } = await Swal.fire({
      icon: 'warning', title: `ยกเลิกข้อตกลง "${r.title}"?`,
      text: r.status === 'applied' ? 'ปฏิทินกลับเป็นแบบเดิม · ใบลาที่ระบบสร้างจะถูกยกเลิก และคืนวันลาให้ทุกคน' : 'รายการทั้งหมดในข้อตกลงนี้จะถูกยกเลิก',
      input: 'text', inputPlaceholder: 'เหตุผล เช่น ที่ประชุมเปลี่ยนมติ', showCancelButton: true,
      confirmButtonText: 'ยกเลิกข้อตกลง', confirmButtonColor: '#dc2626', cancelButtonText: 'ปิด',
      inputValidator: (v) => (!v || !v.trim() ? 'กรุณาระบุเหตุผล' : undefined)
    });
    if (!why) return;
    Swal.fire({ title: 'กำลังยกเลิก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
      for (const it of state.items.filter((i) => i.status === 'applied')) {
        await cancelItem(it, why.trim());
        await sb().from('holiday_swap_items').update({ status: 'cancelled', updated_at: nowIso() }).eq('id', it.id);
      }
      await sb().from('holiday_swap_items').update({ status: 'cancelled', updated_at: nowIso() }).eq('round_id', r.id).in('status', ['pending', 'skipped']);
      await sb().from('holiday_swap_rounds').update({ status: 'cancelled', cancelled_at: nowIso(), note: `${r.note || ''}\n[ยกเลิก] ${why.trim()}`.trim(), updated_at: nowIso() }).eq('id', r.id);
      await removeCalendar(r);
      Swal.fire({ icon: 'success', title: 'ยกเลิกข้อตกลงแล้ว', didOpen: () => Swal.hideLoading(), timer: 1600, showConfirmButton: false });
      await openRound(r.id);
    } catch (err) { Swal.fire('ยกเลิกไม่สำเร็จ', err.message || String(err), 'error'); }
  }

  // เปลี่ยนวิธีหัก (รายการเดียวหรือหลายรายการ)
  async function changeMethod(items, method) {
    const r = state.round;
    if (!items.length || r.status === 'cancelled') return;
    const applied = items.filter((i) => i.status === 'applied');
    if (applied.length) {
      const ok = await Swal.fire({ icon: 'question', title: 'เปลี่ยนวิธีหักของรายการที่หักแล้ว?', text: `${applied.length} รายการ: ระบบจะยกเลิกใบลาเดิม คืนวันลา แล้วหักใหม่เป็น "${METHODS[method].label}"`, showCancelButton: true, confirmButtonText: 'เปลี่ยน', cancelButtonText: 'ยกเลิก' });
      if (!ok.isConfirmed) { renderDetail(); return; }
    }
    Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
      for (const it of items) {
        if (it.status === 'applied') await cancelItem(it, `HR เปลี่ยนวิธีหักเป็น ${METHODS[method].label}`);
        const patch = { method, method_source: 'hr', charge_year: chargeYearOf(method, it.swap_date), skip_reason: null, updated_at: nowIso(), status: 'pending', leave_request_id: null };
        await sb().from('holiday_swap_items').update(patch).eq('id', it.id);
        Object.assign(it, patch);
        if (r.status === 'applied') await applyItem(it, r);
      }
      Swal.close();
      state.selected.clear();
      renderDetail();
      toast(`เปลี่ยน ${items.length} รายการเป็น "${METHODS[method].label}" แล้ว`);
    } catch (err) { Swal.fire('บันทึกไม่สำเร็จ', err.message || String(err), 'error'); await openRound(r.id); }
  }

  async function retryItem(item) {
    Swal.fire({ title: 'กำลังหัก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
      await sb().from('holiday_swap_items').update({ status: 'pending', skip_reason: null, updated_at: nowIso() }).eq('id', item.id);
      item.status = 'pending';
      const out = await applyItem(item, state.round);
      Swal.close();
      renderDetail();
      toast(out === 'applied' ? 'หักแล้ว' : out === 'exempt' ? 'บันทึกว่าไม่หัก' : `ข้าม: ${item.skip_reason}`);
    } catch (err) { Swal.fire('ไม่สำเร็จ', err.message || String(err), 'error'); }
  }

  // ---------------------------------------------------------------------
  // สรุปวันพักร้อนที่ใช้ล่วงหน้า (พนักงานสิ้นสุดการทำงาน)
  // ---------------------------------------------------------------------
  async function loadSettlements() {
    const { data, error } = await sb().from('holiday_swap_items')
      .select('*, holiday_swap_rounds!round_id(title, agreement_ref, status), employees!employee_id(id, employee_code, full_name, status, departments!department_id(department_name))')
      .eq('method', 'vacation_next').eq('status', 'applied').order('swap_date', { ascending: false });
    if (error) throw error;
    return (data || []).filter((i) => !isActiveEmp(i.employees) || i.settlement);
  }

  async function settle(id, kind) {
    const label = kind === 'deduct_pay' ? 'ปรับในค่าจ้างงวดสุดท้าย' : 'ไม่เรียกคืน';
    const { value: note, isConfirmed } = await Swal.fire({ title: label, input: 'text', inputPlaceholder: 'หมายเหตุ (ถ้ามี) เช่น แจ้งฝ่ายเงินเดือนแล้ว', showCancelButton: true, confirmButtonText: 'บันทึก', cancelButtonText: 'ยกเลิก' });
    if (!isConfirmed) return;
    const u = me();
    const { error } = await sb().from('holiday_swap_items').update({ settlement: kind, settlement_note: note || null, settled_by_name: u.full_name || u.employee_code || null, settled_at: nowIso(), updated_at: nowIso() }).eq('id', id);
    if (error) { Swal.fire('บันทึกไม่สำเร็จ', error.message, 'error'); return; }
    toast('บันทึกการสรุปแล้ว');
    renderSettlements();
  }

  // ---------------------------------------------------------------------
  // แสดงผล
  // ---------------------------------------------------------------------
  function toast(msg) {
    if (window.Swal) Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: msg, showConfirmButton: false, timer: 2200 });
  }
  const chip = (m) => `<span class="hs-chip hs-chip--${METHODS[m]?.tone || 'gray'}">${esc(METHODS[m]?.label || m)}</span>`;

  async function renderRounds() {
    const box = $('hsBody');
    box.innerHTML = '<div class="hs-empty">กำลังโหลด...</div>';
    try { await loadRounds(); } catch (err) { box.innerHTML = `<div class="hs-empty hs-warn">${esc(migrationHint(err))}</div>`; return; }
    if (!state.rounds.length) {
      box.innerHTML = `<div class="hs-empty"><span class="material-symbols-outlined">event_repeat</span><b>ยังไม่มีข้อตกลงวันหยุดพิเศษ</b><small>กด "เพิ่มข้อตกลง" หลังได้มติจากที่ประชุมสวัสดิการ</small></div>`;
      return;
    }
    const st = { draft: ['ร่าง (ยังไม่บันทึก)', 'amber'], applied: ['บันทึกแล้ว', 'teal'], cancelled: ['ยกเลิก', 'gray'] };
    box.innerHTML = `<div class="hs-rounds">${state.rounds.map((r) => { const K = KINDS[kindOf(r)]; return `
      <button type="button" class="hs-round" data-open="${r.id}">
        <div class="hs-round__kind hs-round__kind--${K.tone}"><span class="material-symbols-outlined">${K.icon}</span>${K.label}</div>
        <div class="hs-round__top"><b>${esc(r.title)}</b><span class="hs-chip hs-chip--${st[r.status][1]}">${st[r.status][0]}</span></div>
        <div class="hs-round__dates">${calendarSummary(r).map((x) => `${x.a} → ${x.b}`).join('<br>')}</div>
        <small>${esc(r.agreement_ref || 'ไม่ได้ระบุมติที่ประชุม')}${kindOf(r) === 'leave_swap' ? ` · ยืมปีหน้าได้ไม่เกิน ${Number(r.max_borrow) || 0} วัน` : ''}</small>
      </button>`; }).join('')}</div>`;
  }

  async function openRound(id) {
    state.tab = 'detail';
    setTab();
    const box = $('hsBody');
    box.innerHTML = '<div class="hs-empty">กำลังโหลด...</div>';
    try {
      await loadRounds();
      state.round = state.rounds.find((r) => r.id === id);
      if (!state.round) { renderRounds(); return; }
      if (!Object.keys(state.emps).length) await loadEmployees();
      await loadItems(id);
      await loadContext(state.round.swap_dates, id);
      state.selected.clear();
      renderDetail();
    } catch (err) { box.innerHTML = `<div class="hs-empty hs-warn">${esc(migrationHint(err))}</div>`; }
  }

  function filteredEmployees() {
    const f = state.filter;
    const q = f.q.trim().toLowerCase();
    const byEmp = {};
    state.items.forEach((i) => { (byEmp[i.employee_id] = byEmp[i.employee_id] || []).push(i); });
    return Object.keys(byEmp).map((id) => ({ emp: state.emps[id] || { id, full_name: '(ไม่พบพนักงาน)' }, items: byEmp[id] }))
      .filter(({ emp, items }) => (!q || [emp.employee_code, emp.full_name, emp.departments?.department_name].some((v) => String(v || '').toLowerCase().includes(q)))
        && (!f.dept || emp.departments?.department_name === f.dept)
        && (!f.method || items.some((i) => (f.method === 'skipped' ? i.status === 'skipped' : i.method === f.method))))
      .sort((a, b) => String(a.emp.employee_code || '').localeCompare(String(b.emp.employee_code || '')));
  }

  function renderDetail() {
    const r = state.round;
    const box = $('hsBody');
    const dates = [...r.swap_dates].sort();
    const y0 = leaveYear(dates[0]);
    const locked = r.status === 'cancelled';
    const counts = {};
    state.items.forEach((i) => { const k = i.status === 'skipped' ? 'skipped' : i.method; counts[k] = (counts[k] || 0) + 1; });
    const depts = [...new Set(Object.values(state.emps).map((e) => e.departments?.department_name).filter(Boolean))].sort();
    const rows = filteredEmployees();
    const K = KINDS[kindOf(r)];
    const items = hasItems(r);
    const st = { draft: `ร่าง — ยังไม่ได้บันทึก${items ? 'และยังไม่ได้หักวันลา' : 'ลงปฏิทิน'}`, applied: `บันทึกแล้ว ${r.applied_at ? `(${thDate(r.applied_at.slice(0, 10))}${r.applied_by_name ? ` โดย ${esc(r.applied_by_name)}` : ''})` : ''}`, cancelled: 'ยกเลิกแล้ว' };
    const head = `
      <div class="hs-detail-head">
        <button type="button" class="hs-back" data-act="back"><span class="material-symbols-outlined">arrow_back</span> ข้อตกลงทั้งหมด</button>
        <div class="hs-detail-title">
          <div class="hs-round__kind hs-round__kind--${K.tone}"><span class="material-symbols-outlined">${K.icon}</span>${K.label}</div>
          <h2>${esc(r.title)}</h2>
          <p>${esc(r.agreement_ref || 'ไม่ได้ระบุมติที่ประชุม')}${kindOf(r) === 'leave_swap' ? ` · ยืมปีหน้าได้ไม่เกิน ${Number(r.max_borrow) || 0} วัน/คน` : ''}</p>
          <p class="hs-state hs-state--${r.status}">${st[r.status]}</p>
        </div>
        <div class="hs-actions">
          ${r.status === 'draft' && items ? '<button type="button" class="hs-btn hs-btn--light" data-act="recalc"><span class="material-symbols-outlined">refresh</span> คำนวณใหม่</button>' : ''}
          ${r.status === 'draft' ? `<button type="button" class="hs-btn hs-btn--primary" data-act="apply"><span class="material-symbols-outlined">task_alt</span> ${items ? 'บันทึกและหักวันลา' : 'บันทึกลงปฏิทิน'}</button>` : ''}
          ${items ? '<button type="button" class="hs-btn hs-btn--light" data-act="export"><span class="material-symbols-outlined">download</span> CSV</button>' : ''}
          ${!locked ? '<button type="button" class="hs-btn hs-btn--light" data-act="edit"><span class="material-symbols-outlined">edit</span> แก้ไข</button>' : ''}
          ${r.status === 'draft' ? '<button type="button" class="hs-btn hs-btn--danger" data-act="delete-draft"><span class="material-symbols-outlined">delete</span> ลบร่าง</button>' : ''}
          ${r.status === 'applied' ? '<button type="button" class="hs-btn hs-btn--danger" data-act="cancel-round"><span class="material-symbols-outlined">block</span> ยกเลิกข้อตกลง</button>' : ''}
        </div>
      </div>
      <div class="hs-cal">
        <b><span class="material-symbols-outlined">calendar_month</span> ผลต่อปฏิทินวันหยุดของทุกคน</b>
        <ul>${calendarSummary(r).map((x) => `<li><span>${x.a}</span><span class="material-symbols-outlined">arrow_forward</span><b>${x.b}</b></li>`).join('')}</ul>
      </div>
      ${r.note ? `<div class="hs-note"><span class="material-symbols-outlined">campaign</span><div><b>ข้อความที่พนักงานเห็น</b><br>${esc(r.note)}</div></div>` : ''}`;
    if (!items) { box.innerHTML = head; return; }
    const offOf = (d) => pairsOf(r).find((p) => p.work_date === d)?.off_date;

    box.innerHTML = `${head}
      ${kindOf(r) === 'work_swap' ? '<p class="hs-hint">ทุกคนตั้งต้นเป็น "มาทำงาน" — ใครไม่มาทำงานวันนั้น ให้เปลี่ยนเป็นวิธีหักที่ตกลงไว้ (เปลี่ยนได้ทั้งก่อนและหลังบันทึก)</p>' : ''}

      <div class="hs-kpis">
        ${methodsFor(r).map((m) => `<button type="button" class="hs-kpi ${state.filter.method === m ? 'is-on' : ''}" data-fmethod="${m}"><span>${METHODS[m].label}</span><b>${counts[m] || 0}</b></button>`).join('')}
        <button type="button" class="hs-kpi hs-kpi--warn ${state.filter.method === 'skipped' ? 'is-on' : ''}" data-fmethod="skipped"><span>ข้าม (ต้องตัดสินใจ)</span><b>${counts.skipped || 0}</b></button>
      </div>

      <div class="hs-toolbar">
        <div class="hs-search"><span class="material-symbols-outlined">search</span><input id="hsQ" placeholder="ค้นหารหัส ชื่อ แผนก" value="${esc(state.filter.q)}"></div>
        <select id="hsDept"><option value="">ทุกแผนก</option>${depts.map((d) => `<option ${state.filter.dept === d ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select>
        ${!locked ? `<div class="hs-bulk ${state.selected.size ? '' : 'is-off'}">
          <span>เลือก ${state.selected.size} คน →</span>
          <select id="hsBulk"><option value="">ตั้งวิธีหักทุกวันเป็น...</option>${methodsFor(r).map((m) => `<option value="${m}">${METHODS[m].label}</option>`).join('')}</select>
        </div>` : ''}
      </div>

      <div class="hs-table-wrap">
        <table class="hs-table">
          <thead><tr>
            ${!locked ? '<th class="hs-col-check"><input type="checkbox" id="hsAll"></th>' : ''}
            <th>พนักงาน</th><th class="num">พักร้อนปี ${thYear(y0)}<br><small>ใช้แล้ว / สิทธิ์</small></th>
            ${dates.map((d) => `<th>${kindOf(r) === 'work_swap' ? `มาทำงาน ${thDate(d)}${offOf(d) ? `<br><small>หยุดแทน ${thDate(offOf(d))}</small>` : ''}` : thDate(d)}</th>`).join('')}
          </tr></thead>
          <tbody>
            ${rows.map(({ emp, items }) => {
              const v = vacationOf(emp, y0);
              const byDate = {}; items.forEach((i) => { byDate[i.swap_date] = i; });
              return `<tr class="${isActiveEmp(emp) ? '' : 'is-inactive'}">
                ${!locked ? `<td class="hs-col-check"><input type="checkbox" data-sel="${emp.id}" ${state.selected.has(emp.id) ? 'checked' : ''}></td>` : ''}
                <td><b>${esc(emp.full_name)}</b><small>${esc(emp.employee_code || '')}${emp.departments?.department_name ? ` · ${esc(emp.departments.department_name)}` : ''}${isActiveEmp(emp) ? '' : ' · <span class="hs-red">ไม่อยู่ในสถานะใช้งาน</span>'}</small></td>
                <td class="num">${v.used} / ${v.total}${v.real ? '' : '<small>ประมาณ</small>'}</td>
                ${dates.map((d) => {
                  const it = byDate[d];
                  if (!it) return '<td>-</td>';
                  const conflict = state.ctx.conflicts[`${emp.id}|${d}`];
                  const select = locked ? chip(it.method) : `<select data-item="${it.id}" class="hs-sel hs-sel--${METHODS[it.method].tone}">${methodsFor(r).map((m) => `<option value="${m}" ${m === it.method ? 'selected' : ''}>${METHODS[m].label}</option>`).join('')}</select>`;
                  const meta = [
                    `<span class="hs-status hs-status--${it.status}">${STATUS[it.status]}</span>`,
                    it.method === 'vacation_next' && it.charge_year ? `<span>หักปี ${thYear(it.charge_year)}</span>` : '',
                    it.method_source === 'hr' ? '<span>HR แก้</span>' : '',
                    it.settlement ? `<span>${it.settlement === 'deduct_pay' ? 'ปรับในค่าจ้างงวดสุดท้าย' : 'ไม่เรียกคืน'}</span>` : ''
                  ].filter(Boolean).join(' · ');
                  return `<td>${select}<div class="hs-meta">${meta}</div>
                    ${it.skip_reason ? `<div class="hs-reason">${esc(it.skip_reason)}</div>` : ''}
                    ${conflict && it.status === 'pending' ? `<div class="hs-reason">มีใบลาวันนี้: ${esc(conflict)}</div>` : ''}
                    ${it.status === 'skipped' && r.status === 'applied' ? `<button type="button" class="hs-link" data-retry="${it.id}">หักรายการนี้อีกครั้ง</button>` : ''}
                  </td>`;
                }).join('')}
              </tr>`;
            }).join('') || `<tr><td colspan="${dates.length + 3}" class="hs-empty">ไม่พบรายการ</td></tr>`}
          </tbody>
        </table>
      </div>`;
  }

  async function renderSettlements() {
    const box = $('hsBody');
    box.innerHTML = '<div class="hs-empty">กำลังโหลด...</div>';
    let rows;
    try { rows = await loadSettlements(); } catch (err) { box.innerHTML = `<div class="hs-empty hs-warn">${esc(migrationHint(err))}</div>`; return; }
    const curYear = typeof window.getCurrentLeaveYear === 'function' ? window.getCurrentLeaveYear() : new Date().getFullYear();
    box.innerHTML = `
      <p class="hs-hint">รายการวันพักร้อนของปีหน้าที่พนักงานใช้ล่วงหน้าในข้อตกลงวันหยุดพิเศษ แล้วสิ้นสุดการทำงานก่อนถึงปีนั้น — HR เลือกได้รายคนว่าจะปรับในค่าจ้างงวดสุดท้าย หรือไม่เรียกคืน ระบบบันทึกผู้สรุปและวันที่ไว้ให้</p>
      ${rows.length ? `<div class="hs-table-wrap"><table class="hs-table">
        <thead><tr><th>พนักงาน</th><th>ข้อตกลง</th><th>วันหยุด</th><th>ใช้สิทธิ์ของปี</th><th>การสรุป</th></tr></thead>
        <tbody>${rows.map((i) => `<tr>
          <td><b>${esc(i.employees?.full_name || '-')}</b><small>${esc(i.employees?.employee_code || '')} · สิ้นสุดการทำงานแล้ว</small></td>
          <td>${esc(i.holiday_swap_rounds?.title || '-')}</td>
          <td>${thDate(i.swap_date)}</td>
          <td>${thYear(i.charge_year)}${i.charge_year && i.charge_year <= curYear ? '<small>ถึงรอบปีนี้แล้ว</small>' : ''}</td>
          <td>${i.settlement
            ? `<b>${i.settlement === 'deduct_pay' ? 'ปรับในค่าจ้างงวดสุดท้าย' : 'ไม่เรียกคืน'}</b><small>${esc(i.settled_by_name || '')}${i.settled_at ? ` · ${thDate(i.settled_at.slice(0, 10))}` : ''}${i.settlement_note ? ` · ${esc(i.settlement_note)}` : ''}</small>`
            : `<div class="hs-settle"><button type="button" class="hs-btn hs-btn--light" data-settle="${i.id}" data-kind="deduct_pay">ปรับในค่าจ้างงวดสุดท้าย</button><button type="button" class="hs-btn hs-btn--light" data-settle="${i.id}" data-kind="waive">ไม่เรียกคืน</button></div>`}</td>
        </tr>`).join('')}</tbody></table></div>`
        : '<div class="hs-empty"><span class="material-symbols-outlined">verified</span><b>ไม่มีรายการที่ต้องสรุป</b></div>'}`;
  }

  function exportCsv() {
    const r = state.round;
    const head = ['ข้อตกลง', 'วันที่', 'รหัสพนักงาน', 'ชื่อ', 'แผนก', 'สถานะพนักงาน', 'วิธีหัก', 'หักจากสิทธิ์ปี (พ.ศ.)', 'สถานะรายการ', 'เหตุผลที่ข้าม', 'ผู้กำหนด', 'สรุปวันใช้ล่วงหน้า'];
    const lines = [head];
    state.items.slice().sort((a, b) => String(state.emps[a.employee_id]?.employee_code || '').localeCompare(String(state.emps[b.employee_id]?.employee_code || '')) || a.swap_date.localeCompare(b.swap_date)).forEach((i) => {
      const e = state.emps[i.employee_id] || {};
      lines.push([r.title, i.swap_date, e.employee_code, e.full_name, e.departments?.department_name, e.status, METHODS[i.method]?.label, i.charge_year ? i.charge_year + 543 : '', STATUS[i.status], i.skip_reason, i.method_source === 'hr' ? 'HR' : 'ระบบ', i.settlement === 'deduct_pay' ? 'ปรับในค่าจ้างงวดสุดท้าย' : i.settlement === 'waive' ? 'ไม่เรียกคืน' : '']);
    });
    const csv = '﻿' + lines.map((l) => l.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `ข้อตกลงวันหยุด_${r.title}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
  }

  function setTab() {
    document.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('is-on', b.dataset.tab === (state.tab === 'detail' ? 'rounds' : state.tab)));
  }

  // ---------------------------------------------------------------------
  // เหตุการณ์
  // ---------------------------------------------------------------------
  function bind() {
    document.addEventListener('click', async (e) => {
      const t = e.target.closest('[data-tab],[data-open],[data-act],[data-fmethod],[data-retry],[data-settle],#hsNewRound');
      if (!t) return;
      if (t.id === 'hsNewRound') return createRound();
      if (t.dataset.tab) { state.tab = t.dataset.tab; setTab(); return t.dataset.tab === 'settle' ? renderSettlements() : renderRounds(); }
      if (t.dataset.open) return openRound(t.dataset.open);
      if (t.dataset.fmethod) { state.filter.method = state.filter.method === t.dataset.fmethod ? '' : t.dataset.fmethod; return renderDetail(); }
      if (t.dataset.retry) { const it = state.items.find((i) => i.id === t.dataset.retry); if (it) retryItem(it); return; }
      if (t.dataset.settle) return settle(t.dataset.settle, t.dataset.kind);
      const act = t.dataset.act;
      if (act === 'back') { state.tab = 'rounds'; setTab(); return renderRounds(); }
      if (act === 'apply') return applyRound();
      if (act === 'recalc') return recalcRound();
      if (act === 'cancel-round') return cancelRound();
      if (act === 'edit') return editRound();
      if (act === 'delete-draft') return deleteDraft();
      if (act === 'export') return exportCsv();
    });
    document.addEventListener('change', (e) => {
      const el = e.target;
      if (el.dataset?.item) { const it = state.items.find((i) => i.id === el.dataset.item); if (it && el.value !== it.method) changeMethod([it], el.value); return; }
      if (el.dataset?.sel) { el.checked ? state.selected.add(el.dataset.sel) : state.selected.delete(el.dataset.sel); return renderDetail(); }
      if (el.id === 'hsAll') { filteredEmployees().forEach(({ emp }) => (el.checked ? state.selected.add(emp.id) : state.selected.delete(emp.id))); return renderDetail(); }
      if (el.id === 'hsDept') { state.filter.dept = el.value; return renderDetail(); }
      if (el.id === 'hsBulk' && el.value) {
        const items = state.items.filter((i) => state.selected.has(i.employee_id) && i.method !== el.value);
        changeMethod(items, el.value);
      }
    });
    document.addEventListener('input', (e) => {
      if (e.target.id !== 'hsQ') return;
      state.filter.q = e.target.value;
      const pos = e.target.selectionStart;
      renderDetail();
      const q = $('hsQ'); if (q) { q.focus(); try { q.setSelectionRange(pos, pos); } catch (x) {} }
    });
  }

  async function start(tries) {
    if (!sb()) { if ((tries || 0) < 100) return setTimeout(() => start((tries || 0) + 1), 100); $('hsBody').innerHTML = '<div class="hs-empty hs-warn">เชื่อมต่อฐานข้อมูลไม่ได้</div>'; return; }
    try { await loadTypes(); } catch (e) { console.warn(e); }
    bind();
    const params = new URLSearchParams(location.search);
    if (params.get('tab') === 'settle' || location.hash === '#settle') { state.tab = 'settle'; setTab(); renderSettlements(); }
    else renderRounds();
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', () => start(0)) : start(0);

  window.PVTHolidaySwap = { _state: state, autoPlan, vacationOf, chargeYearOf };
})();
