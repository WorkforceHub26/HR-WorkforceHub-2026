/* ==========================================================================
   🔁 ประกาศข้อตกลงวันหยุดพิเศษ (ฝั่งพนักงาน) — แสดงที่หน้าหลักพนักงาน
   --------------------------------------------------------------------------
   พนักงานไม่ต้องตอบ
   - ใช้วันลาแลกวันหยุด / ทำงานวันหยุดแลกวันหยุด: แสดงเฉพาะคนที่อยู่ในรายชื่อ (holiday_swap_items)
     บอกวัน + วิธีหักของแต่ละวัน + หักจากสิทธิ์ปีไหน
   - ย้ายวันหยุดนักขัตฤกษ์ / เพิ่มวันหยุด: แสดงทุกคน (ข้อตกลงที่บันทึกแล้ว)
   ใส่ <div id="hsNotice"></div> ในหน้า แล้วโหลดไฟล์นี้ (script ธรรมดา)
   ========================================================================== */
(function () {
  'use strict';

  const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const TH_D = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const thDate = (d) => {
    const [y, m, dd] = String(d).slice(0, 10).split('-').map(Number);
    const wd = new Date(y, m - 1, dd).getDay();
    return `${TH_D[wd]} ${dd} ${TH_M[m - 1]} ${y + 543}`;
  };
  const localToday = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`; };
  const addDays = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); const t = new Date(y, m - 1, d + n); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };

  const describe = (it, round) => {
    const y = it.charge_year ? it.charge_year + 543 : '';
    if (it.method === 'attend') {
      const off = (Array.isArray(round?.pairs) ? round.pairs : []).find((p) => p.work_date === it.swap_date)?.off_date;
      return { text: off ? `มาทำงาน · หยุดแทน ${thDate(off)}` : 'มาทำงาน', tone: 'teal' };
    }
    switch (it.method) {
      case 'vacation_current': return { text: `หักวันพักร้อน${y ? ` ปี ${y}` : ''}`, tone: 'teal' };
      case 'vacation_next':    return { text: `หักวันพักร้อนปี ${y || 'หน้า'} (ยืมล่วงหน้า)`, tone: 'violet' };
      case 'personal':         return { text: 'หักวันลากิจ', tone: 'blue' };
      case 'unpaid':           return { text: 'ลาไม่รับค่าจ้าง', tone: 'amber' };
      case 'exempt':           return { text: 'ไม่หักวันลา', tone: 'gray' };
      default:                 return { text: it.method, tone: 'gray' };
    }
  };

  function injectStyle() {
    if (document.getElementById('hsn-style')) return;
    const css = `
      .hsn-card{margin:0 0 20px;padding:16px 18px;background:#fff;border:1.5px solid var(--th-b-200,#bfdbfe);border-radius:18px;box-shadow:0 1px 3px rgba(15,23,42,.05);font-family:inherit}
      .hsn-head{display:flex;align-items:flex-start;gap:12px}
      .hsn-icon{flex-shrink:0;width:40px;height:40px;display:grid;place-items:center;border-radius:12px;background:linear-gradient(135deg,var(--th-b-50,#eff6ff),var(--th-b-100,#dbeafe));color:var(--th-b-700,#1d4ed8);font-size:22px}
      .hsn-head h3{margin:0;font-size:15.5px;font-weight:800;color:#0f172a;line-height:1.35}
      .hsn-head p{margin:3px 0 0;font-size:12.5px;color:#64748b;line-height:1.5}
      .hsn-note{margin:12px 0 0;padding:10px 12px;border-radius:12px;background:var(--th-b-50,#eff6ff);color:#334155;font-size:13.5px;line-height:1.6;white-space:pre-line}
      .hsn-days{list-style:none;margin:12px 0 0;padding:0;display:flex;flex-direction:column;gap:6px}
      .hsn-day{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:9px 12px;border:1px solid #e2e8f0;border-radius:12px}
      .hsn-day b{font-size:14px;color:#0f172a}
      .hsn-chip{display:inline-flex;align-items:center;padding:3px 10px;border-radius:999px;font-size:12.5px;font-weight:700;border:1px solid transparent}
      .hsn-chip--teal{background:#f0fdfa;color:#0f766e;border-color:#99f6e4}
      .hsn-chip--violet{background:#f5f3ff;color:#6d28d9;border-color:#ddd6fe}
      .hsn-chip--blue{background:#eff6ff;color:#1d4ed8;border-color:#bfdbfe}
      .hsn-chip--amber{background:#fffbeb;color:#b45309;border-color:#fde68a}
      .hsn-chip--gray{background:#f8fafc;color:#475569;border-color:#e2e8f0}
      .hsn-foot{margin:10px 0 0;font-size:12px;color:#94a3b8;line-height:1.5}
      .hsn-card + .hsn-card{margin-top:-8px}
    `;
    const el = document.createElement('style');
    el.id = 'hsn-style';
    el.textContent = css;
    document.head.appendChild(el);
  }

  function currentEmployeeId() {
    try {
      const u = JSON.parse(localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser') || '{}');
      return u.id || u.employee_id || null;
    } catch (e) { return null; }
  }

  async function load(sb, empId) {
    const since = addDays(localToday(), -14); // แสดงจนถึง 14 วันหลังวันหยุดวันสุดท้าย
    const { data, error } = await sb.from('holiday_swap_items')
      .select('id, swap_date, method, charge_year, status, round_id, holiday_swap_rounds!round_id(id, kind, title, note, agreement_ref, status, swap_dates, pairs)')
      .eq('employee_id', empId)
      .in('status', ['pending', 'applied'])
      .gte('swap_date', since)
      .order('swap_date', { ascending: true });
    if (error) throw error;
    const rounds = {};
    (data || []).forEach((it) => {
      const r = it.holiday_swap_rounds;
      if (!r || r.status === 'cancelled') return;
      (rounds[r.id] = rounds[r.id] || { round: r, items: [] }).items.push(it);
    });
    // ทำงานวันหยุดแลกวันหยุด: เติมวันหยุดแทนให้เห็นคู่กัน
    Object.values(rounds).forEach((g) => {
      if (g.round.kind !== 'work_swap') return;
      (g.round.pairs || []).forEach((p) => { if (p.off_date >= since) g.items.push({ swap_date: p.off_date, text: `หยุดแทนวันที่ ${thDate(p.work_date)}`, tone: 'amber' }); });
      g.items.sort((a, b) => a.swap_date.localeCompare(b.swap_date));
    });

    // ย้ายวันหยุด / เพิ่มวันหยุด: ทุกคนเห็น (ไม่มีรายการรายคน)
    try {
      const { data: cal } = await sb.from('holiday_swap_rounds').select('id, kind, title, note, agreement_ref, status, swap_dates, pairs')
        .eq('status', 'applied').in('kind', ['move_holiday', 'extra_holiday']);
      (cal || []).forEach((r) => {
        const days = r.kind === 'move_holiday'
          ? (r.pairs || []).filter((p) => p.to_date >= since || p.from_date >= since).map((p) => ({ swap_date: p.to_date, text: `${p.label || 'วันหยุด'} ย้ายมาหยุดวันนี้ (วันที่ ${thDate(p.from_date)} เป็นวันทำงาน)`, tone: 'blue' }))
          : (r.swap_dates || []).filter((d) => d >= since).map((d) => ({ swap_date: d, text: 'วันหยุด (ไม่หักวันลา)', tone: 'amber' }));
        if (days.length) rounds[r.id] = { round: r, items: days.sort((a, b) => a.swap_date.localeCompare(b.swap_date)) };
      });
    } catch (e) { /* ยังไม่ได้รัน migration ส่วนประเภทข้อตกลง */ }
    return Object.values(rounds);
  }

  function render(box, groups) {
    if (!groups.length) { box.innerHTML = ''; box.hidden = true; return; }
    injectStyle();
    box.hidden = false;
    box.innerHTML = groups.map(({ round, items }) => {
      const draft = round.status === 'draft';
      const kind = round.kind || 'leave_swap';
      const heading = kind === 'work_swap' ? 'วันทำงานพิเศษ' : kind === 'move_holiday' ? 'ย้ายวันหยุด' : 'ประกาศวันหยุดพิเศษ';
      const done = kind === 'leave_swap' ? 'บันทึกการหักวันลาเรียบร้อยแล้ว' : 'บันทึกในปฏิทินวันหยุดแล้ว';
      const foot = kind === 'leave_swap' ? 'ไม่ต้องยื่นใบลาเอง — ระบบหักให้ตามข้อตกลง หากรายการไม่ถูกต้อง กรุณาติดต่อฝ่ายบุคคล'
        : kind === 'work_swap' ? 'ไม่ต้องยื่นใบลาเอง — หากมาทำงานไม่ได้ กรุณาแจ้งฝ่ายบุคคล'
        : 'ปฏิทินวันหยุดปรับให้อัตโนมัติแล้ว';
      return `
      <section class="hsn-card" aria-label="ประกาศข้อตกลงวันหยุดพิเศษ">
        <div class="hsn-head">
          <span class="hsn-icon material-symbols-outlined">${kind === 'work_swap' ? 'swap_horiz' : kind === 'move_holiday' ? 'move_down' : 'event_repeat'}</span>
          <div>
            <h3>${heading}: ${esc(round.title)}</h3>
            <p>${round.agreement_ref ? `ตาม${esc(round.agreement_ref)} · ` : ''}${draft ? 'HR กำลังจัดเตรียมรายการ (อาจมีการปรับ)' : done}</p>
          </div>
        </div>
        ${round.note ? `<div class="hsn-note">${esc(round.note)}</div>` : ''}
        <ul class="hsn-days">
          ${items.map((it) => { let d = it.text ? it : describe(it, round); if (kind === 'work_swap' && !it.text && !['attend', 'exempt'].includes(it.method)) d = { text: `ไม่ได้มาทำงาน · ${d.text}`, tone: d.tone }; return `<li class="hsn-day"><b>${thDate(it.swap_date)}</b><span class="hsn-chip hsn-chip--${d.tone}">${esc(d.text)}</span></li>`; }).join('')}
        </ul>
        <p class="hsn-foot">${foot}</p>
      </section>`;
    }).join('');
  }

  async function start(tries) {
    const box = document.getElementById('hsNotice');
    if (!box) return;
    const sb = window.pvtSupabase?.getClient?.() || window.PVTSDK?.client || null;
    const empId = currentEmployeeId();
    if (!sb || !empId) { if ((tries || 0) < 80) setTimeout(() => start((tries || 0) + 1), 150); return; }
    try { render(box, await load(sb, empId)); }
    catch (e) { box.hidden = true; console.info('[holiday-swap-notice] ข้าม:', e?.message || e); } // ยังไม่ได้รัน migration → ไม่แสดง
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', () => start(0)) : start(0);
  window.PVTHolidaySwapNotice = { refresh: () => start(0), _render: render, _describe: describe };
})();
