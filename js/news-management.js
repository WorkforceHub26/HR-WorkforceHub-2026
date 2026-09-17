// Initial Load
    document.addEventListener("DOMContentLoaded", async () => {
      await loadAdminNews();
    });

    let allAnnouncements = [];

    async function loadAdminNews() {
      try {
        allAnnouncements = await window.CompanyNews.getAnnouncements();
        updateStats();
        filterAndRenderAdminNews();
      } catch (e) {
        console.error("Error loading news:", e);
      }
    }

    function updateStats() {
      const total = allAnnouncements.length;
      const pinned = allAnnouncements.filter(n => n.is_pinned).length;
      const urgent = allAnnouncements.filter(n => n.category === 'urgent').length;
      
      document.getElementById('statTotalNews').textContent = total;
      document.getElementById('statPinnedNews').textContent = pinned;
      document.getElementById('statUrgentNews').textContent = urgent;
    }

    function filterAndRenderAdminNews() {
      const search = (document.getElementById('newsSearchInput')?.value || '').toLowerCase().trim();
      const cat = document.getElementById('newsCategoryFilter')?.value || 'all';
      const pinFilter = document.getElementById('newsPinFilter')?.value || 'all';

      let filtered = allAnnouncements.filter(item => {
        const matchSearch = !search || 
          (item.title && item.title.toLowerCase().includes(search)) ||
          (item.content && item.content.toLowerCase().includes(search)) ||
          (item.author && item.author.toLowerCase().includes(search));

        const matchCat = cat === 'all' || item.category === cat;
        const matchPin = pinFilter === 'all' || 
          (pinFilter === 'pinned' && item.is_pinned) || 
          (pinFilter === 'unpinned' && !item.is_pinned);

        return matchSearch && matchCat && matchPin;
      });

      const container = document.getElementById('adminNewsList');
      if (!container) return;

      if (filtered.length === 0) {
        container.innerHTML = `
          <div class="empty-news-box">
            <span class="material-symbols-outlined" style="font-size: 48px; color: #94a3b8; display: block; margin-bottom: 12px;">campaign</span>
            <h3 style="margin: 0 0 6px 0; color: #334155; font-size: 16px;">ไม่พบรายการข่าวสาร</h3>
            <p style="margin: 0; font-size: 13.5px;">ลองปรับคำค้นหา หรือกดปุ่ม <strong>สร้างประกาศข่าวใหม่</strong> ด้านบน</p>
          </div>
        `;
        return;
      }

      const CATEGORY_MAP = {
        urgent: { label: " ประกาศด่วน", class: "urgent" },
        announcement: { label: " ประชาสัมพันธ์", class: "announcement" },
        holiday: { label: " วันหยุด/ปฏิทิน", class: "holiday" },
        welfare: { label: " สวัสดิการ", class: "welfare" },
        activity: { label: " กิจกรรมองค์กร", class: "activity" }
      };

      container.innerHTML = filtered.map(item => {
        const catInfo = CATEGORY_MAP[item.category] || CATEGORY_MAP.announcement;
        const formattedDate = item.date ? new Date(item.date).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : '-';
        
        return `
          <div class="admin-news-card ${item.is_pinned ? 'pinned' : ''}">
            <div>
              <div class="news-header-meta">
                <span class="news-tag ${catInfo.class}">${catInfo.label}</span>
                ${item.is_pinned ? '<span class="pin-badge"><span class="material-symbols-outlined" style="font-size: 14px;">push_pin</span> ปักหมุด</span>' : ''}
              </div>
              <h3 class="news-item-title">${escapeHtml(item.title)}</h3>
              <div class="news-item-content">${escapeHtml(item.content)}</div>
            </div>

            <div class="news-card-bottom">
              <div class="news-author-time">
                <span><span class="material-symbols-outlined" style="font-size: 13px; vertical-align: -2px;">person</span> ${escapeHtml(item.author || 'HR')}</span>
                <span><span class="material-symbols-outlined" style="font-size: 13px; vertical-align: -2px;">calendar_today</span> ${formattedDate}</span>
              </div>

              <div class="news-actions-wrap">
                <button type="button" class="btn-icon-action ${item.is_pinned ? 'pin-active' : ''}" onclick="togglePinNews('${item.id}', ${!item.is_pinned})" title="${item.is_pinned ? 'ยกเลิกปักหมุด' : 'ปักหมุดข่าวนี้'}">
                  <span class="material-symbols-outlined" style="font-size: 18px;">push_pin</span>
                </button>
                <button type="button" class="btn-icon-action" onclick="openEditNewsModal('${item.id}')" title="แก้ไขข่าวสาร">
                  <span class="material-symbols-outlined" style="font-size: 18px;">edit</span>
                </button>
                <button type="button" class="btn-icon-action" onclick="previewNewsItem('${item.id}')" title="ดูตัวอย่าง">
                  <span class="material-symbols-outlined" style="font-size: 18px;">visibility</span>
                </button>
                <button type="button" class="btn-icon-action delete" onclick="confirmDeleteNews('${item.id}')" title="ลบข่าวนี้">
                  <span class="material-symbols-outlined" style="font-size: 18px;">delete</span>
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }

    // Modal Create / Edit
    async function openCreateNewsModal() {
      openNewsFormModal({
        id: '',
        title: '',
        category: 'announcement',
        content: '',
        author: 'ฝ่ายทรัพยากรบุคคล (HR)',
        date: new Date().toISOString().split('T')[0],
        is_pinned: false,
        link_url: ''
      }, 'สร้างประกาศข่าวสารใหม่');
    }

    async function openEditNewsModal(id) {
      const item = allAnnouncements.find(n => n.id === id);
      if (!item) return;
      openNewsFormModal(item, 'แก้ไขข่าวสารองค์กร');
    }

    function openNewsFormModal(item, title) {
      Swal.fire({
        title: `<div style="display: flex; align-items: center; gap: 8px; font-size: 18px; color: #0f172a;"><span class="material-symbols-outlined" style="color: #0d9488;">edit_document</span> ${title}</div>`,
        html: `
          <div style="text-align: left; display: flex; flex-direction: column; gap: 14px; margin-top: 10px;">
            <div>
              <label style="font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 4px; display: block;">หัวข้อข่าว / ประกาศ <span style="color: #ef4444;">*</span></label>
              <input type="text" id="formNewsTitle" class="swal2-input" style="margin: 0; width: 100%; font-size: 14px;" value="${escapeHtml(item.title || '')}" placeholder="ระบุหัวข้อข่าว..." />
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div>
                <label style="font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 4px; display: block;">หมวดหมู่</label>
                <select id="formNewsCategory" class="swal2-select" style="margin: 0; width: 100%; font-size: 13.5px; height: 42px;">
                  <option value="announcement" ${item.category === 'announcement' ? 'selected' : ''}> ประชาสัมพันธ์</option>
                  <option value="urgent" ${item.category === 'urgent' ? 'selected' : ''}> ประกาศด่วน</option>
                  <option value="holiday" ${item.category === 'holiday' ? 'selected' : ''}> วันหยุด/ปฏิทิน</option>
                  <option value="welfare" ${item.category === 'welfare' ? 'selected' : ''}> สวัสดิการ</option>
                  <option value="activity" ${item.category === 'activity' ? 'selected' : ''}> กิจกรรมองค์กร</option>
                </select>
              </div>

              <div>
                <label style="font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 4px; display: block;">วันที่ประกาศ</label>
                <input type="date" id="formNewsDate" class="swal2-input" style="margin: 0; width: 100%; font-size: 13.5px; height: 42px;" value="${item.date || new Date().toISOString().split('T')[0]}" />
              </div>
            </div>

            <div>
              <label style="font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 4px; display: block;">เนื้อหาข่าว / รายละเอียด <span style="color: #ef4444;">*</span></label>
              <textarea id="formNewsContent" class="swal2-textarea" style="margin: 0; width: 100%; min-height: 120px; font-size: 13.5px; font-family: inherit;" placeholder="พิมพ์ข้อความรายละเอียดข่าวสารที่ต้องการแจ้งพนักงาน...">${escapeHtml(item.content || '')}</textarea>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div>
                <label style="font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 4px; display: block;">ผู้ประกาศ / ฝ่ายงาน</label>
                <input type="text" id="formNewsAuthor" class="swal2-input" style="margin: 0; width: 100%; font-size: 13.5px;" value="${escapeHtml(item.author || 'ฝ่ายทรัพยากรบุคคล (HR)')}" />
              </div>

              <div>
                <label style="font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 4px; display: block;">ลิงก์เอกสาร/ภายนอก (ถ้ามี)</label>
                <input type="url" id="formNewsLink" class="swal2-input" style="margin: 0; width: 100%; font-size: 13.5px;" value="${escapeHtml(item.link_url || '')}" placeholder="https://..." />
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 8px; padding-top: 4px;">
              <input type="checkbox" id="formNewsPinned" style="width: 18px; height: 18px; accent-color: #0d9488; cursor: pointer;" ${item.is_pinned ? 'checked' : ''} />
              <label for="formNewsPinned" style="font-size: 13.5px; font-weight: 600; color: #0f172a; cursor: pointer;"> ปักหมุดเป็นประกาศสำคัญ (แสดงขึ้นด้านบนสุด)</label>
            </div>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: ' บันทึกและเผยแพร่',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#0d9488',
        cancelButtonColor: '#94a3b8',
        width: '640px',
        preConfirm: () => {
          const titleVal = document.getElementById('formNewsTitle').value.trim();
          const contentVal = document.getElementById('formNewsContent').value.trim();
          if (!titleVal) {
            Swal.showValidationMessage('กรุณาระบุหัวข้อข่าวสาร');
            return false;
          }
          if (!contentVal) {
            Swal.showValidationMessage('กรุณาระบุเนื้อหาข่าวสาร');
            return false;
          }
          return {
            id: item.id || undefined,
            title: titleVal,
            category: document.getElementById('formNewsCategory').value,
            date: document.getElementById('formNewsDate').value,
            content: contentVal,
            author: document.getElementById('formNewsAuthor').value.trim() || 'ฝ่ายทรัพยากรบุคคล (HR)',
            link_url: document.getElementById('formNewsLink').value.trim(),
            is_pinned: document.getElementById('formNewsPinned').checked
          };
        }
      }).then(async (result) => {
        if (result.isConfirmed) {
          Swal.fire({
            title: 'กำลังบันทึกข้อมูล...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
          });

          await window.CompanyNews.saveAnnouncement(result.value);
          await loadAdminNews();

          Swal.fire({
            icon: 'success',
            title: 'บันทึกสำเร็จ!',
            text: 'ข่าวสารได้รับการเผยแพร่สู่ระบบเรียบร้อยแล้ว',
            timer: 1600,
            showConfirmButton: false
          });
        }
      });
    }

    async function togglePinNews(id, newStatus) {
      const item = allAnnouncements.find(n => n.id === id);
      if (!item) return;
      item.is_pinned = newStatus;
      await window.CompanyNews.saveAnnouncement(item);
      await loadAdminNews();
    }

    async function confirmDeleteNews(id) {
      const item = allAnnouncements.find(n => n.id === id);
      if (!item) return;

      Swal.fire({
        title: 'ยืนยันการลบข่าวสาร?',
        text: `คุณต้องการลบ "${item.title}" ออกจากระบบใช่หรือไม่?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#94a3b8',
        confirmButtonText: 'ลบข่าวสาร',
        cancelButtonText: 'ยกเลิก'
      }).then(async (result) => {
        if (result.isConfirmed) {
          await window.CompanyNews.deleteAnnouncement(id);
          await loadAdminNews();
          Swal.fire({
            icon: 'success',
            title: 'ลบสำเร็จ',
            timer: 1400,
            showConfirmButton: false
          });
        }
      });
    }

    function previewNewsItem(id) {
      window.CompanyNews.openNewsDetailModal(id);
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function handleLogout() {
      if (window.AuthGuard?.logout) {
        window.AuthGuard.logout();
      } else {
        localStorage.removeItem('pvt_user');
        window.location.href = '/pages/user/index-user.html';
      }
    }

// Expose functions globally for onclick attributes
window.loadAdminNews = loadAdminNews;
window.filterAndRenderAdminNews = filterAndRenderAdminNews;
window.openCreateNewsModal = openCreateNewsModal;
window.openEditNewsModal = openEditNewsModal;
window.closeNewsModal = closeNewsModal;
window.saveNewsArticle = saveNewsArticle;
window.togglePinNews = togglePinNews;
window.confirmDeleteNews = confirmDeleteNews;
window.previewNewsItem = previewNewsItem;
window.closePreviewModal = closePreviewModal;
