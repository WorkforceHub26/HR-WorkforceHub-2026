/* ==========================================================================
   🛡️ ประกาศความเป็นส่วนตัว (PDPA) — supabase/migrations/20261026_privacy_notice.sql
   --------------------------------------------------------------------------
   • ทุกหน้าในระบบ (โหลดผ่าน js/auth-guard.js): ถ้ายังไม่ได้ยอมรับฉบับล่าสุด → แสดงประกาศเต็มจอ
     ต้องติ๊ก "อ่านและยอมรับ" แล้วกดยอมรับก่อนใช้งาน (หรือออกจากระบบ)
   • ตั้งค่า > ความเป็นส่วนตัว > อ่านประกาศความเป็นส่วนตัว (ดูย้อนหลัง + วันที่ยอมรับ)
   • คอนโซลผู้ดูแลระบบ (#privacyNoticeAdmin): สรุปผู้ยอมรับ · รายชื่อที่ยังไม่ยอมรับ · ส่งออก CSV · แก้ข้อความออกฉบับใหม่
   ยังไม่ได้รัน SQL → ไม่แสดงอะไร (ระบบใช้งานได้ตามปกติ)
   ========================================================================== */
(function (global) {
  'use strict';
  if (global.PVTPrivacy) return;

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const client = () => { try { return global.pvtSupabase?.getClient?.() || global.pvtSupabase?.client || global.PVTSDK?.client || null; } catch (e) { return null; } };
  const token = () => (global.PVTAuth && global.PVTAuth.token ? global.PVTAuth.token() : '');
  const me = () => { try { return JSON.parse(localStorage.getItem('currentUser') || 'null'); } catch (e) { return null; } };
  const isMissing = (err) => !!err && (err.code === 'PGRST202' || err.code === '42883' || /Could not find the function|does not exist|schema cache/i.test(String(err.message || '')));
  const fmtDate = (iso) => { try { return new Date(iso).toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' }); } catch (e) { return iso || '-'; } };

  async function rpc(name, args) {
    const sb = client();
    if (!sb || typeof sb.rpc !== 'function') return { error: { message: 'no_client' } };
    try { return await sb.rpc(name, args); } catch (e) { return { error: e }; }
  }

  // ข้อความประกาศ → HTML: "## " หัวข้อ · "- " รายการ · บรรทัดว่าง = ย่อหน้าใหม่
  function render(body) {
    const out = [];
    let list = null, para = [];
    const flushPara = () => { if (para.length) { out.push(`<p>${para.map(esc).join('<br>')}</p>`); para = []; } };
    const flushList = () => { if (list) { out.push(`<ul>${list.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`); list = null; } };
    String(body || '').replace(/\r/g, '').split('\n').forEach((raw) => {
      const line = raw.trim();
      if (!line) { flushPara(); flushList(); return; }
      if (line.startsWith('## ')) { flushPara(); flushList(); out.push(`<h3>${esc(line.slice(3))}</h3>`); return; }
      if (line.startsWith('- ')) { flushPara(); (list = list || []).push(line.slice(2)); return; }
      flushList(); para.push(line);
    });
    flushPara(); flushList();
    return out.join('');
  }

  function injectCss() {
    if (document.getElementById('pvtPrivacyCss')) return;
    const css = document.createElement('style');
    css.id = 'pvtPrivacyCss';
    css.textContent = `
      .pvt-pn{position:fixed;inset:0;z-index:99990;background:rgba(15,23,42,.6);display:flex;align-items:center;justify-content:center;padding:16px;font-family:Sarabun,system-ui,sans-serif}
      .pvt-pn__card{background:#fff;width:min(760px,100%);max-height:min(92vh,900px);display:flex;flex-direction:column;border-radius:8px;box-shadow:0 20px 50px rgba(15,23,42,.35);overflow:hidden}
      .pvt-pn__head{padding:16px 20px;border-bottom:1px solid #e2e8f0;display:flex;gap:12px;align-items:flex-start}
      .pvt-pn__icon{flex:0 0 40px;height:40px;border-radius:6px;background:var(--th-p-50,#f0fdfa);color:var(--th-p-700,#0f766e);display:flex;align-items:center;justify-content:center;font-size:22px}
      .pvt-pn__head h2{margin:0;font-size:19px;color:#0f172a;line-height:1.35}
      .pvt-pn__head small{display:block;margin-top:2px;color:#64748b;font-size:13px}
      .pvt-pn__close{margin-left:auto;border:0;background:none;font-size:26px;line-height:1;color:#64748b;cursor:pointer;padding:0 4px}
      .pvt-pn__body{padding:6px 22px 16px;overflow-y:auto;font-size:15.5px;line-height:1.75;color:#334155;-webkit-overflow-scrolling:touch}
      .pvt-pn__body h3{font-size:16px;color:#0f172a;margin:18px 0 4px}
      .pvt-pn__body ul{margin:4px 0 8px;padding-left:22px}
      .pvt-pn__body li{margin:2px 0}
      .pvt-pn__body p{margin:10px 0}
      .pvt-pn__foot{padding:14px 20px calc(14px + env(safe-area-inset-bottom,0px));border-top:1px solid #e2e8f0;background:#f8fafc;display:flex;flex-direction:column;gap:10px}
      .pvt-pn__check{display:flex;gap:10px;align-items:flex-start;font-size:15.5px;color:#0f172a;font-weight:600;cursor:pointer}
      .pvt-pn__check input{width:22px;height:22px;margin-top:2px;flex:0 0 auto;accent-color:var(--th-p-600,#0d9488)}
      .pvt-pn__actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
      .pvt-pn__ok{flex:1 1 240px;min-height:48px;border:0;border-radius:4px;background:var(--th-p-700,#0f766e);color:#fff;font:700 16.5px Sarabun,system-ui,sans-serif;cursor:pointer}
      .pvt-pn__ok:disabled{opacity:.45;cursor:not-allowed}
      .pvt-pn__out{min-height:48px;padding:0 16px;border:1px solid #cbd5e1;border-radius:4px;background:#fff;color:#475569;font:600 14.5px Sarabun,system-ui,sans-serif;cursor:pointer}
      .pvt-pn__hint{font-size:12.5px;color:#64748b}
      .pvt-pn__accepted{font-size:13.5px;color:#15803d;font-weight:600}
      @media (max-width:560px){.pvt-pn{padding:0;align-items:stretch}.pvt-pn__card{max-height:none;height:100%;border-radius:0}}
    `;
    document.head.appendChild(css);
  }

  // แสดงประกาศ: viewOnly = ดูย้อนหลัง (มีปุ่มปิด) · ไม่ใช่ = ต้องยอมรับก่อนใช้งาน
  function openModal(st, viewOnly) {
    injectCss();
    document.getElementById('pvtPrivacyModal')?.remove();
    const wrap = document.createElement('div');
    wrap.className = 'pvt-pn';
    wrap.id = 'pvtPrivacyModal';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-labelledby', 'pvtPnTitle');
    wrap.innerHTML = `
      <div class="pvt-pn__card">
        <div class="pvt-pn__head">
          <div class="pvt-pn__icon" aria-hidden="true">🛡️</div>
          <div>
            <h2 id="pvtPnTitle">${esc(st.title || 'ประกาศความเป็นส่วนตัว')}</h2>
            <small>ฉบับที่ ${esc(st.version)} · มีผลตั้งแต่ ${esc(fmtDate(st.effective_at))}</small>
          </div>
          ${viewOnly ? '<button type="button" class="pvt-pn__close" data-pn="close" aria-label="ปิด">×</button>' : ''}
        </div>
        <div class="pvt-pn__body" tabindex="0">${render(st.body)}</div>
        <div class="pvt-pn__foot">
          ${viewOnly
            ? (st.accepted_at ? `<div class="pvt-pn__accepted">✓ คุณยอมรับประกาศฉบับนี้เมื่อ ${esc(fmtDate(st.accepted_at))}</div>` : '<div class="pvt-pn__hint">ยังไม่ได้ยอมรับประกาศฉบับนี้</div>')
              + '<div class="pvt-pn__actions"><button type="button" class="pvt-pn__out" data-pn="close">ปิด</button></div>'
            : `<label class="pvt-pn__check"><input type="checkbox" id="pvtPnAgree"> ข้าพเจ้าได้อ่านและเข้าใจประกาศความเป็นส่วนตัวนี้ และยอมรับการเก็บและใช้ข้อมูลตามที่ระบุ รวมถึงข้อมูลสุขภาพจากใบรับรองแพทย์เพื่อการพิจารณาการลา</label>
               <div class="pvt-pn__actions">
                 <button type="button" class="pvt-pn__ok" data-pn="accept" disabled>ยอมรับและเริ่มใช้งาน</button>
                 <button type="button" class="pvt-pn__out" data-pn="logout">ออกจากระบบ</button>
               </div>
               <div class="pvt-pn__hint">ต้องยอมรับก่อนใช้งานระบบ · อ่านย้อนหลังได้ที่ ตั้งค่า > ความเป็นส่วนตัว</div>`}
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    const close = () => { wrap.remove(); document.documentElement.style.overflow = prevOverflow; };

    const agree = wrap.querySelector('#pvtPnAgree');
    const ok = wrap.querySelector('[data-pn="accept"]');
    if (agree && ok) agree.addEventListener('change', () => { ok.disabled = !agree.checked; });
    wrap.addEventListener('click', async (ev) => {
      const b = ev.target.closest('[data-pn]');
      if (!b) { if (viewOnly && ev.target === wrap) close(); return; }
      const act = b.dataset.pn;
      if (act === 'close') close();
      if (act === 'logout') {
        if (typeof global.executePvtLogout === 'function') global.executePvtLogout();
        else { try { localStorage.removeItem('currentUser'); } catch (e) {} location.replace('/index.html?logout=true'); }
      }
      if (act === 'accept' && agree && agree.checked) {
        ok.disabled = true; ok.textContent = 'กำลังบันทึก...';
        const u = me() || {};
        const { data, error } = await rpc('pvt_privacy_accept', {
          p_token: token() || null, p_employee_id: u.id || null, p_version: st.version,
          p_user_agent: (navigator.userAgent || '').slice(0, 300)
        });
        if (!error && data && data.ok) {
          try { sessionStorage.setItem(`pvt_privacy_ok_${u.id}`, String(st.version)); } catch (e) {}
          close();
          return;
        }
        if (data && data.reason === 'outdated') { close(); PVTPrivacy.check(true); return; }
        ok.disabled = false; ok.textContent = 'ยอมรับและเริ่มใช้งาน';
        alert('บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' + (error && error.message ? `\n(${error.message})` : ''));
      }
    });
    setTimeout(() => (agree || wrap.querySelector('[data-pn="close"]'))?.focus(), 50);
  }

  async function fetchStatus() {
    const u = me();
    if (!u || !u.id) return null;
    const { data, error } = await rpc('pvt_privacy_status', { p_token: token() || null, p_employee_id: u.id });
    if (error) return isMissing(error) ? { legacy: true } : null;
    return data;
  }

  const PVTPrivacy = {
    render,
    // ตรวจแล้วแสดงประกาศถ้ายังไม่ยอมรับฉบับล่าสุด (force = ไม่ใช้ค่าที่จำไว้ในแท็บนี้)
    async check(force) {
      const u = me();
      if (!u || !u.id) return;
      if (/\/(index\.html)?$/.test(location.pathname) && document.getElementById('loginForm')) return; // หน้าเข้าระบบ
      if (!force) { try { if (sessionStorage.getItem(`pvt_privacy_ok_${u.id}`)) return; } catch (e) {} }
      const st = await fetchStatus();
      if (!st || st.legacy || !st.ok) return;
      if (!st.needs) { try { sessionStorage.setItem(`pvt_privacy_ok_${u.id}`, String(st.version || 0)); } catch (e) {} return; }
      openModal(st, false);
    },
    // ตั้งค่า > ความเป็นส่วนตัว > อ่านประกาศ
    async view() {
      const st = await fetchStatus();
      if (!st || st.legacy) { alert('ยังไม่มีประกาศความเป็นส่วนตัวในระบบ'); return; }
      if (!st.ok || !st.version) { alert('ยังไม่มีประกาศความเป็นส่วนตัวในระบบ'); return; }
      if (st.needs) openModal(st, false); else openModal(st, true);
    },

    // ---------------------------------------------------------------- คอนโซลผู้ดูแลระบบ
    async renderAdmin(el) {
      if (!el) return;
      el.innerHTML = '<p style="color:#64748b;">กำลังโหลด...</p>';
      const { data, error } = await rpc('pvt_privacy_report', { p_token: token() || null });
      if (error) {
        el.innerHTML = isMissing(error)
          ? '<p style="color:#b45309;">ยังไม่ได้ติดตั้ง — รัน <code>supabase/migrations/20261026_privacy_notice.sql</code> ใน SQL Editor</p>'
          : `<p style="color:#dc2626;">โหลดไม่สำเร็จ: ${esc(error.message)}</p>`;
        return;
      }
      if (!data || !data.ok) {
        el.innerHTML = `<p style="color:#dc2626;">${esc(data && data.reason === 'expired' ? 'การเข้าสู่ระบบหมดอายุ กรุณาออกจากระบบแล้วเข้าใหม่' : 'ไม่มีสิทธิ์ดูข้อมูลนี้')}</p>`;
        return;
      }
      const st = await fetchStatus();
      const people = data.people || [];
      const pending = people.filter((p) => !p.accepted_at);
      const pct = data.total ? Math.round((data.accepted / data.total) * 100) : 0;
      el.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:0;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;margin-bottom:14px;">
          ${[['ฉบับปัจจุบัน', data.version ? `ฉบับที่ ${data.version}` : '-'], ['ยอมรับแล้ว', `${data.accepted} / ${data.total} คน (${pct}%)`], ['ยังไม่ยอมรับ', `${pending.length} คน`], ['ยืนยันตัวตนไม่ได้', `${data.unverified || 0} คน`]]
            .map(([k, v]) => `<div style="padding:12px 14px;border-left:1px solid #eef2f6;"><div style="font-size:12.5px;color:#64748b;font-weight:700;">${k}</div><div style="font-size:18px;font-weight:800;color:#0f172a;">${esc(v)}</div></div>`).join('')}
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
          <button type="button" class="secondary" data-pna="view" style="width:auto;padding:7px 12px;font-size:13px;">อ่านประกาศฉบับปัจจุบัน</button>
          <button type="button" class="secondary" data-pna="csv" style="width:auto;padding:7px 12px;font-size:13px;">ส่งออกรายชื่อ (CSV)</button>
          <button type="button" class="secondary" data-pna="edit" style="width:auto;padding:7px 12px;font-size:13px;">แก้ข้อความ / ออกฉบับใหม่</button>
        </div>
        <details ${pending.length ? 'open' : ''} style="border:1px solid #e2e8f0;border-radius:6px;padding:8px 12px;">
          <summary style="cursor:pointer;font-weight:700;">ยังไม่ยอมรับ ${pending.length} คน</summary>
          <div style="max-height:260px;overflow:auto;margin-top:8px;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
              <thead><tr style="text-align:left;color:#64748b;"><th style="padding:4px 6px;">รหัส</th><th style="padding:4px 6px;">ชื่อ</th><th style="padding:4px 6px;">แผนก</th></tr></thead>
              <tbody>${pending.map((p) => `<tr style="border-top:1px solid #f1f5f9;"><td style="padding:4px 6px;">${esc(p.code)}</td><td style="padding:4px 6px;">${esc(p.name)}</td><td style="padding:4px 6px;">${esc(p.dept || '-')}</td></tr>`).join('') || '<tr><td colspan="3" style="padding:8px;color:#16a34a;">ทุกคนยอมรับแล้ว</td></tr>'}</tbody>
            </table>
          </div>
        </details>
        <div data-pna-editor hidden style="margin-top:12px;border:1px solid #e2e8f0;border-radius:6px;padding:12px;">
          <p style="margin:0 0 8px;font-size:12.5px;color:#64748b;">รูปแบบ: บรรทัดขึ้นต้น <b>## </b> = หัวข้อ · <b>- </b> = รายการ · บรรทัดว่าง = ย่อหน้าใหม่ · ⚠️ ออกฉบับใหม่แล้ว <b>ทุกคนต้องกดยอมรับใหม่</b></p>
          <input type="text" data-pna-title value="${esc(st && st.title || 'ประกาศความเป็นส่วนตัวสำหรับพนักงาน')}" style="width:100%;margin-bottom:8px;" />
          <textarea data-pna-body rows="16" style="width:100%;font-family:inherit;font-size:13.5px;line-height:1.6;">${esc(st && st.body || '')}</textarea>
          <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">
            <button type="button" class="secondary" data-pna="preview" style="width:auto;padding:7px 12px;font-size:13px;">ดูตัวอย่าง</button>
            <button type="button" data-pna="publish" style="width:auto;padding:7px 14px;font-size:13px;">ออกเป็นฉบับที่ ${esc((data.version || 0) + 1)}</button>
          </div>
        </div>
        <p style="margin:10px 0 0;font-size:12px;color:#94a3b8;">ประวัติ: ${(data.versions || []).map((v) => `ฉบับที่ ${esc(v.version)} (${esc(fmtDate(v.effective_at))}${v.by ? ' · ' + esc(v.by) : ''})`).join(' · ') || '-'}</p>`;

      el.onclick = async (ev) => {
        const b = ev.target.closest('[data-pna]');
        if (!b) return;
        const act = b.dataset.pna;
        if (act === 'view' && st) openModal(Object.assign({}, st), true);
        if (act === 'edit') { const ed = el.querySelector('[data-pna-editor]'); ed.hidden = !ed.hidden; }
        if (act === 'preview') {
          openModal({ title: el.querySelector('[data-pna-title]').value, body: el.querySelector('[data-pna-body]').value, version: (data.version || 0) + 1, effective_at: new Date().toISOString(), accepted_at: null }, true);
        }
        if (act === 'csv') {
          const rows = [['รหัส', 'ชื่อ', 'แผนก', 'ยอมรับเมื่อ', 'ยืนยันตัวตน']].concat(people.map((p) => [p.code, p.name, p.dept || '', p.accepted_at ? fmtDate(p.accepted_at) : 'ยังไม่ยอมรับ', p.accepted_at ? (p.verified ? 'ได้' : 'ไม่ได้') : '']));
          const csv = '﻿' + rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
          const a = document.createElement('a');
          a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
          a.download = `privacy-acceptance-v${data.version || 0}.csv`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        }
        if (act === 'publish') {
          const title = el.querySelector('[data-pna-title]').value.trim();
          const body = el.querySelector('[data-pna-body]').value.trim();
          const go = global.Swal
            ? (await global.Swal.fire({ icon: 'warning', title: `ออกประกาศฉบับที่ ${(data.version || 0) + 1}?`, text: 'พนักงานทุกคนจะต้องอ่านและกดยอมรับใหม่ก่อนใช้งานระบบ', showCancelButton: true, confirmButtonText: 'ออกฉบับใหม่', cancelButtonText: 'ยกเลิก' })).isConfirmed
            : confirm('ออกฉบับใหม่? พนักงานทุกคนต้องกดยอมรับใหม่');
          if (!go) return;
          const { data: r, error: e2 } = await rpc('pvt_privacy_publish', { p_token: token() || null, p_title: title, p_body: body });
          if (e2 || !r || !r.ok) {
            const why = r && r.reason === 'too_short' ? 'ข้อความสั้นเกินไป' : r && r.reason === 'forbidden' ? 'ไม่มีสิทธิ์' : r && r.reason === 'expired' ? 'การเข้าสู่ระบบหมดอายุ กรุณาเข้าใหม่' : (e2 && e2.message) || 'ไม่สำเร็จ';
            global.Swal ? global.Swal.fire('ออกฉบับใหม่ไม่สำเร็จ', why, 'error') : alert(why);
            return;
          }
          try { Object.keys(sessionStorage).forEach((k) => { if (k.startsWith('pvt_privacy_ok_')) sessionStorage.removeItem(k); }); } catch (e) {}
          global.Swal && global.Swal.fire({ icon: 'success', title: `ออกฉบับที่ ${r.version} แล้ว`, timer: 1800, showConfirmButton: false });
          PVTPrivacy.renderAdmin(el);
        }
      };
    }
  };

  global.PVTPrivacy = PVTPrivacy;

  const start = () => {
    setTimeout(() => PVTPrivacy.check(false), 600);
    const adm = document.getElementById('privacyNoticeAdmin');
    if (adm) setTimeout(() => PVTPrivacy.renderAdmin(adm), 900);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})(typeof window !== 'undefined' ? window : globalThis);
