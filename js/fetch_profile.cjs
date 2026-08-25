const fs = require('fs');
let code = fs.readFileSync('js/auth-guard.js', 'utf8');

const newRenderFn = `
async function renderGlobalUserProfile() {
  const sessionUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
  if (!sessionUser || !sessionUser.id) return;
  
  let profileData = window.currentProfile || window.currentUserProfile || sessionUser;
  
  // พยายามดึงข้อมูลฉบับเต็มจาก DB ถ้าขาดรูปหรือแผนก
  if (!profileData.image_url || !profileData.department_name) {
    const sb = getSbClient();
    if (sb) {
      try {
         const { data, error } = await sb.from('employees').select('*, departments(*), positions(*)').eq('id', sessionUser.id).single();
         if (data) {
           profileData = data;
           window.currentUserProfile = data; // Cache
           
           // อัปเดต localStorage ให้มีข้อมูลมากขึ้น
           const updatedSession = { ...sessionUser, image_url: data.image_url, department_name: data.departments?.department_name || data.department_name, position_name: data.positions?.position_name || data.position_name };
           localStorage.setItem("currentUser", JSON.stringify(updatedSession));
         }
      } catch (e) {}
    }
  }

  const fullName = profileData.full_name || sessionUser.full_name || "ผู้ใช้งาน";
  
  // ตำแหน่งและแผนก
  let rawRole = (profileData.role || sessionUser.role || "user").toLowerCase();
  let roleName = "พนักงาน";
  if (rawRole === "admin" || rawRole === "hr") roleName = "ผู้ดูแลระบบ";
  else if (rawRole === "manager") roleName = "ผู้จัดการฝ่าย";
  else if (rawRole === "leader") roleName = "หัวหน้างาน";
  else if (rawRole === "executive" || rawRole === "director" || rawRole === "owner") roleName = "ผู้บริหาร";

  let deptName = profileData.department_name || profileData.departments?.department_name || sessionUser.department_name || "PVT Group";
  if (profileData.position_name) roleName = profileData.position_name;
  else if (profileData.positions?.position_name) roleName = profileData.positions.position_name;
  
  // ดึงรูปโปรไฟล์ (ถ้ามี)
  let avatarUrl = profileData.image_url || profileData.avatar_url || profileData.employees?.image_url || sessionUser.image_url || null;
  if (avatarUrl && window.PVTSDK?.storage?.getAvatarUrl) {
    avatarUrl = window.PVTSDK.storage.getAvatarUrl(avatarUrl);
  } else if (avatarUrl && !avatarUrl.startsWith('http') && !avatarUrl.startsWith('data:')) {
     const sb = getSbClient();
     if (sb) {
       const { data: { publicUrl } } = sb.storage.from('avatars').getPublicUrl(avatarUrl);
       if (publicUrl) avatarUrl = publicUrl;
     }
  }
  
  // จัดการ Avatar ทุกจุดบนหน้าเว็บ
  document.querySelectorAll('.user-profile').forEach(container => {
    let html = "";
    
    // รูปภาพ
    if (avatarUrl) {
      html += \`<img src="\${avatarUrl}" class="avatar" style="object-fit: cover;" onerror="this.onerror=null;this.src='/assets/img/default-avatar.jpg';this.outerHTML='<div class=\\'avatar avatar-badge\\'>\${fullName.substring(0,2)}</div>';">\`;
    } else {
      let initials = "U";
      if (rawRole === "admin" || rawRole === "hr") initials = "HR";
      else initials = fullName.substring(0, 2);
      html += \`<div class="avatar avatar-badge">\${initials}</div>\`;
    }
    
    html += \`
      <div class="info" style="display: flex; flex-direction: column; text-align: left; margin-left: 10px;">
        <strong style="font-size: 0.9rem; color: var(--text-main); white-space: nowrap;">\${fullName}</strong>
        <span style="font-size: 0.75rem; color: var(--text-muted); white-space: nowrap;">\${roleName} | \${deptName}</span>
      </div>
    \`;
    
    container.innerHTML = html;
    container.style.display = "flex";
    container.style.alignItems = "center";
  });
}
`;

code = code.replace(/function renderGlobalUserProfile\(\) \{[\s\S]*?\}\n/m, newRenderFn);
fs.writeFileSync('js/auth-guard.js', code);
