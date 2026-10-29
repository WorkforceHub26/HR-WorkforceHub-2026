/* ==========================================================================
   📋 ปุ่ม "ใบลารออนุมัติ" ที่หน้าหลักพนักงาน — แสดงเฉพาะคนที่มีหน้าที่อนุมัติ
   --------------------------------------------------------------------------
   แสดงเมื่อ (ข้อใดข้อหนึ่ง)
     - อยู่ในสายอนุมัติของแผนก/ทีม (approval_chain_steps.approver_ids)
     - เป็นหัวหน้า/ผู้จัดการของแผนก (department_approvers)
     - มีใบลารอตัวเองพิจารณาอยู่ (leave_approval_steps status = pending)
   ป้ายแดง = จำนวนใบลาที่รอตัวเองพิจารณาตอนนี้ (อัปเดตทุก 60 วินาที และเมื่อกลับมาที่หน้า)
   ใส่ <div id="apPendingBtn" hidden></div> ในหน้า แล้วโหลดไฟล์นี้ (script ธรรมดา)
   ========================================================================== */
(function () {
  'use strict';

  const TARGET = '/pages/approver/leave-approvals.html?tab=pending';
  const REFRESH_MS = 60000;

  function injectStyle() {
    if (document.getElementById('apb-style')) return;
    const css = `
      #apPendingBtn{order:3}  /* หน้าหลักจัดเรียงด้วย flex order — ให้อยู่ต่อจากปุ่มยื่นใบลา (order 3) */
      @media (min-width:769px){#apPendingBtn{margin-bottom:20px}}
      .apb-btn{width:100%;display:flex;align-items:center;gap:16px;margin:0;padding:14px 16px;
        background:#fff;border:1.5px solid #fde68a;border-radius:18px;box-shadow:0 1px 3px rgba(15,23,42,.06);
        font-family:inherit;text-align:left;cursor:pointer;-webkit-tap-highlight-color:transparent;
        transition:transform .15s ease,box-shadow .15s ease}
      .apb-btn:hover{transform:translateY(-1px);box-shadow:0 6px 16px rgba(217,119,6,.14)}
      .apb-btn:active{transform:scale(.99)}
      .apb-icon{position:relative;flex-shrink:0;width:46px;height:46px;display:grid;place-items:center;border-radius:14px;
        background:linear-gradient(135deg,#fffbeb,#fef3c7);color:#b45309}
      .apb-icon .material-symbols-outlined{font-size:26px}
      .apb-badge{position:absolute;top:-6px;right:-5px;min-width:22px;height:22px;padding:0 6px;border-radius:999px;
        background:#ef4444;color:#fff;font-size:12px;font-weight:800;line-height:22px;text-align:center;
        border:2px solid #fff;box-shadow:0 2px 6px rgba(239,68,68,.35)}
      .apb-badge[hidden]{display:none}
      .apb-text{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
      .apb-btn .apb-text strong{font-size:15.5px;font-weight:800;color:#0f172a;line-height:1.3}
      .apb-btn .apb-text span{font-size:12.5px;color:#64748b;line-height:1.4}
      .apb-btn.has-pending{border-color:#fca5a5;background:linear-gradient(90deg,#fff,#fff7f7)}
      .apb-btn.has-pending .apb-text span{color:#b91c1c;font-weight:600}
      .apb-arrow{flex-shrink:0;width:34px;height:34px;display:grid;place-items:center;border-radius:50%;
        background:#fffbeb;color:#b45309}
      .apb-arrow .material-symbols-outlined{font-size:20px}
      @media (prefers-color-scheme: dark){
        :root:not([data-theme="light"]) .apb-btn{background:#1e293b;border-color:#78350f}
        :root:not([data-theme="light"]) .apb-text strong{color:#f1f5f9}
        :root:not([data-theme="light"]) .apb-badge{border-color:#1e293b}
      }
    `;
    const st = document.createElement('style');
    st.id = 'apb-style';
    st.textContent = css;
    document.head.appendChild(st);
  }

  const getEmpId = () => {
    try {
      const u = JSON.parse(localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser') || '{}');
      return u.id || u.employee_id || null;
    } catch (e) { return null; }
  };

  async function isApprover(sb, empId) {
    try {
      const { count } = await sb.from('approval_chain_steps')
        .select('id', { count: 'exact', head: true }).contains('approver_ids', [empId]);
      if (count > 0) return true;
    } catch (e) {}
    try {
      const { count } = await sb.from('department_approvers')
        .select('id', { count: 'exact', head: true }).or(`supervisor_id.eq.${empId},manager_id.eq.${empId}`);
      if (count > 0) return true;
    } catch (e) {}
    return false;
  }

  async function pendingCount(sb, empId) {
    try {
      const { data, error } = await sb.from('leave_approval_steps')
        .select('leave_id, leave_requests!inner(status)')
        .eq('status', 'pending')
        .contains('approver_ids', [empId])
        .eq('leave_requests.status', 'pending');
      if (!error && Array.isArray(data)) return new Set(data.map((r) => r.leave_id)).size;
    } catch (e) {}
    // สำรอง: ไม่ join (กรณีความสัมพันธ์ตารางไม่พร้อม)
    try {
      const { count } = await sb.from('leave_approval_steps')
        .select('id', { count: 'exact', head: true }).eq('status', 'pending').contains('approver_ids', [empId]);
      return count || 0;
    } catch (e) { return 0; }
  }

  function render(box, n) {
    if (!box.firstChild) {
      box.innerHTML = `
        <button type="button" class="apb-btn apb-hero" aria-label="ใบลารออนุมัติ">
          <span class="apb-icon"><span class="material-symbols-outlined">fact_check</span><span class="apb-badge" hidden></span></span>
          <span class="apb-text"><strong>ใบลารออนุมัติ</strong><span class="apb-sub"></span></span>
          <span class="apb-arrow"><span class="material-symbols-outlined">arrow_forward</span></span>
        </button>`;
      box.querySelector('.apb-btn').addEventListener('click', () => { window.location.href = TARGET; });
    }
    const btn = box.querySelector('.apb-btn');
    const badge = box.querySelector('.apb-badge');
    const sub = box.querySelector('.apb-sub');
    badge.hidden = !(n > 0);
    badge.textContent = n > 99 ? '99+' : String(n);
    btn.classList.toggle('has-pending', n > 0);
    btn.setAttribute('aria-label', n > 0 ? `ใบลารออนุมัติ ${n} ใบ` : 'ใบลารออนุมัติ');
    sub.textContent = n > 0 ? `มี ${n} ใบรอท่านพิจารณา` : 'ไม่มีใบลารอพิจารณา · แตะเพื่อดูรายการ';
    box.hidden = false;
    // ป้ายบนแถบล่าง (ถ้ามีปุ่ม "อนุมัติ")
    try { window.PVTShell?.setBadge?.('approve', n); } catch (e) {}
  }

  async function start(tries) {
    const box = document.getElementById('apPendingBtn');
    if (!box) return;
    const sb = window.pvtSupabase?.getClient?.() || window.PVTSDK?.client || null;
    const empId = getEmpId();
    if (!sb || !empId) { if ((tries || 0) < 80) setTimeout(() => start((tries || 0) + 1), 150); return; }

    injectStyle();
    let n = await pendingCount(sb, empId);
    if (n === 0 && !(await isApprover(sb, empId))) { box.hidden = true; return; }
    render(box, n);

    const refresh = async () => {
      if (document.visibilityState !== 'visible') return;
      render(box, await pendingCount(sb, empId));
    };
    setInterval(refresh, REFRESH_MS);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('pageshow', (e) => { if (e.persisted) refresh(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => start(0));
  else start(0);
})();
