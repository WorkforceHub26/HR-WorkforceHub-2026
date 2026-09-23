/* ==========================================================================
   🔒 PVT HR LEAVE - early-auth-guard.js (Synchronous Early Auth Guard & Instant Router)
   Runs in <head> before <body> renders to prevent any flash of unauthorized pages.
   ========================================================================== */
(function earlyAuthGuard() {
  try {
    var raw = localStorage.getItem("currentUser");
    var session = raw ? JSON.parse(raw) : null;
    
    var path = window.location.pathname.toLowerCase();
    var isLoginPage = path === "/" || path === "/index.html" || (path.endsWith("/index.html") && !path.includes("/pages/"));
    var isHrArea = path.includes("/pages/hr/");
    var isApproverArea = path.includes("/pages/approver/");

    function getRoleCat(user) {
      if (!user || (!user.id && !user.employee_code)) return { isAuth: false, category: 'guest' };
      var emp = user.employees || user;
      var role = String(user.role || emp.role || '').toLowerCase().trim();
      var code = String(user.employee_code || emp.employee_code || '').trim();
      var codeLower = code.toLowerCase();
      var pos = String(
        user.position_name || user.position ||
        (user.positions && user.positions.position_name) ||
        emp.position_name || (emp.positions && emp.positions.position_name) || ''
      ).toLowerCase().trim();
      var duty = String(user.duty_name || emp.duty_name || '').toLowerCase().trim();

      var isExplicitAdminOrHr = 
        codeLower === 'admin' || 
        codeLower === 'superadmin' || 
        codeLower.startsWith('hr-') || 
        code === '10001' || 
        role === 'admin' || 
        role === 'superadmin' || 
        role === 'hr' || 
        role === 'hr_manager';

      if (isExplicitAdminOrHr && ['19122', '19072', '19128'].indexOf(code) === -1) {
        return { isAuth: true, category: 'hr_exec', role: role || 'admin' };
      }

      // พนักงานบริการให้คงสิทธิ์พนักงานทั่วไป แม้ชื่อตำแหน่งจะมีคำที่คล้ายหัวหน้า
      var isServiceStaff = pos.includes('แม่บ้าน') || pos.includes('พ่อบ้าน') || pos.includes('คนสวน') ||
                           duty.includes('แม่บ้าน') || duty.includes('พ่อบ้าน') || duty.includes('คนสวน');
      if (isServiceStaff) {
        return { isAuth: true, category: 'employee', role: role };
      }

      // บัญชีพิเศษต้องตรวจให้เสร็จก่อน generic role=user/employee/staff
      if (code === '19122') {
        return { isAuth: true, category: 'leader_manager', role: 'manager' };
      }

      if (['19072', '19128'].indexOf(code) !== -1) {
        return { isAuth: true, category: 'employee', role: 'employee' };
      }

      var isHrOrExec = role === 'hr' || role === 'admin' || role === 'superadmin' || role === 'executive' || role === 'director' || role === 'owner' || role === 'hr_manager' || role.includes('hr') || role.includes('admin') || role.includes('executive') || role.includes('director') || role.includes('owner') || code === '10001' || code.startsWith('HR-');

      if (isHrOrExec) {
        return { isAuth: true, category: 'hr_exec', role: role };
      }

      // สำคัญ: บางบัญชีในฐานข้อมูลยังมี role=user แต่ตำแหน่งจริงเป็นหัวหน้างาน/ผู้จัดการ
      // จึงต้องตรวจ role + position ก่อนตัดสินว่าเป็นพนักงานทั่วไป
      var isLeaderPosition =
        pos.includes('ผู้จัดการ') ||
        (pos.includes('หัวหน้า') && !pos.includes('หัวหน้ากะ') && !pos.includes('หัวหน้าส่วน')) ||
        pos.includes('manager') || pos.includes('leader') || pos.includes('supervisor') || pos.includes('head');

      var isManagerOrLeader =
        role === 'manager' || role === 'leader' || role === 'supervisor' || role === 'head' ||
        role.includes('manager') || role.includes('leader') || role.includes('supervisor');

      if (isManagerOrLeader || isLeaderPosition) {
        return { isAuth: true, category: 'leader_manager', role: role || 'leader' };
      }

      if (role === 'user' || role === 'employee' || role === 'staff') {
        return { isAuth: true, category: 'employee', role: role };
      }

      return { isAuth: true, category: 'employee', role: role };
    }

    var status = getRoleCat(session);
    var currentEmpCode = session ? String(session.employee_code || (session.employees && session.employees.employee_code) || '').toLowerCase().trim() : '';
    var isHrExecUser = status.category === 'hr_exec' || currentEmpCode === 'admin' || currentEmpCode.startsWith('hr-');

    function triggerRedirect(targetUrl) {
      if (document.documentElement) {
        document.documentElement.style.display = "none";
      }
      window.location.replace(targetUrl);
    }

    // 1. Unauthenticated -> Redirect to login
    if (!status.isAuth) {
      if (!isLoginPage) {
        var currentSearch = window.location.search || "";
        var originalPage = encodeURIComponent(window.location.pathname + currentSearch);
        triggerRedirect("/index.html?redirect=" + originalPage);
      }
      return;
    }

    // 2. Authenticated on login page -> Redirect to appropriate dashboard
    if (isLoginPage) {
      var rawRole = String(session.role || (session.employees && session.employees.role) || '').toLowerCase().trim();
      var isHrExec = status.category === 'hr_exec' || currentEmpCode.startsWith('hr-') || currentEmpCode === 'admin' || (['hr', 'admin', 'superadmin', 'executive', 'director', 'owner'].indexOf(rawRole) !== -1 && ['19122', '19072', '19128'].indexOf(currentEmpCode) === -1);

      var urlParams = new URLSearchParams(window.location.search);
      var redirectUrl = urlParams.get("redirect");
      if (redirectUrl) {
        var decodedRedirect = decodeURIComponent(redirectUrl);
        if (decodedRedirect.startsWith("/") && !decodedRedirect.startsWith("//")) {
          var decodedLower = decodedRedirect.toLowerCase();
          var isUserPage = decodedLower.includes("/pages/user/");

          // หัวหน้า/ผู้จัดการห้ามถูกส่งเข้า HR Area จาก redirect เดิม
          if (status.category === 'leader_manager' && decodedLower.includes('/pages/hr/')) {
            triggerRedirect(decodedLower.includes('/pages/hr/hr.html')
              ? '/pages/approver/leave-approvals.html'
              : '/pages/user/index-user.html');
            return;
          }

          if (!isUserPage || !isHrExec) {
            triggerRedirect(decodedRedirect);
            return;
          }
        }
      }

      if (isHrExec) {
        triggerRedirect("/pages/hr/home.html");
      } else {
        triggerRedirect("/pages/user/index-user.html");
      }
      return;
    }

    // 3. HR Home Page
    if (path.includes("home.html") && isHrArea && status.category !== 'hr_exec') {
      triggerRedirect("/pages/user/index-user.html");
      return;
    }

    // 4. Admin Dashboard
    if (path.includes("admin-dashboard")) {
      var emp = session.employees || session || {};
      var rawRole = String(session.role || emp.role || status.role || '').toLowerCase().trim();
      var isTrueAdmin = rawRole === 'admin' || rawRole === 'superadmin' || session.employee_code === 'HR-001' || emp.employee_code === 'HR-001';
      if (!isTrueAdmin) {
        triggerRedirect("/pages/user/index-user.html");
        return;
      }
    }

    // 5. HR Holidays
    if (path.includes("/pages/hr/holidays")) {
      var emp = session.employees || session || {};
      var rawRole = String(session.role || emp.role || status.role || '').toLowerCase().trim();
      var isHolidayAdmin = status.category === 'hr_exec' || ['admin', 'superadmin', 'hr', 'hr_manager'].indexOf(rawRole) !== -1 || Boolean(session.is_admin) || Boolean(session.is_hr) || session.employee_code === 'HR-001' || emp.employee_code === 'HR-001';
      if (!isHolidayAdmin) {
        triggerRedirect("/pages/user/holidays.html");
        return;
      }
    }

    // 6. HR Employee Cards
    if (path.includes("/pages/hr/employee-cards")) {
      var emp = session.employees || session || {};
      var rawRole = String(session.role || emp.role || status.role || '').toLowerCase().trim();
      var isCardAdmin = status.category === 'hr_exec' || ['admin', 'superadmin', 'hr', 'hr_manager', 'executive'].indexOf(rawRole) !== -1 || Boolean(session.is_admin) || Boolean(session.is_hr) || session.employee_code === 'HR-001' || emp.employee_code === 'HR-001';
      if (!isCardAdmin) {
        triggerRedirect("/pages/user/index-user.html");
        return;
      }
    }

    // 7. Employee in HR Area
    if (status.category === 'employee' && isHrArea) {
      triggerRedirect("/pages/user/index-user.html");
      return;
    }

    // 8. Leader/Manager ต้องไม่เข้า HR Area โดยตรง
    // ลิงก์อนุมัติเดิม /pages/hr/hr.html จะถูกส่งไป Approver Portal แยกต่างหาก
    if (status.category === 'leader_manager' && isHrArea) {
      if (path.includes("/pages/hr/hr.html")) {
        triggerRedirect("/pages/approver/leave-approvals.html" + (window.location.search || ""));
      } else if (path.includes("/pages/hr/leave-stats.html")) {
        triggerRedirect("/pages/user/leave-stats.html" + (window.location.search || ""));
      } else {
        triggerRedirect("/pages/user/index-user.html");
      }
      return;
    }

    // 8.1 HR/Admin/Executive ไม่ใช้หน้า Approver Portal ของหัวหน้างาน
    if (isApproverArea && status.category === 'hr_exec') {
      triggerRedirect("/pages/hr/home.html");
      return;
    }

    // หมายเหตุ: employee ที่เปิด Approver Portal จะถูกตรวจสิทธิ์แบบ async ซ้ำใน hr.js
    // เพื่อรองรับกรณีถูกกำหนดเป็น approver ใน department_approvers แต่ role เดิมยังเป็น user

    // 9. HR Exec in User Dashboard Area
    var isUserDashboardArea = 
      path.includes("/pages/user/index-user.html") || 
      path.includes("/pages/user/profile-user.html") || 
      path.includes("/pages/user/leave-user.html") || 
      path.includes("/pages/user/leave-history.html");

    if (isHrExecUser && isUserDashboardArea) {
      triggerRedirect("/pages/hr/home.html");
      return;
    }

    // =========================================================================
    // ⚡ 10. INSTANT NAVIGATION INTERCEPTOR & DOM REWRITER (Zero Bounce)
    // =========================================================================
    
    // Global Click Interceptor (Capture Phase)
    document.addEventListener("click", function (e) {
      var targetEl = e.target ? e.target.closest("a, button, [onclick]") : null;
      if (!targetEl) return;

      var href = targetEl.getAttribute("href");
      var onclickStr = targetEl.getAttribute("onclick") || "";
      
      // Determine destination target path
      var destination = "";
      if (href && href !== "#" && !href.startsWith("javascript:")) {
        try {
          destination = new URL(href, window.location.origin).pathname.toLowerCase();
        } catch (err) {}
      } else if (onclickStr.includes("location.href")) {
        var match = onclickStr.match(/location\.href\s*=\s*['"]([^'"]+)['"]/);
        if (match && match[1]) {
          try {
            destination = new URL(match[1], window.location.origin).pathname.toLowerCase();
          } catch (err) {}
        }
      }

      if (!destination) return;

      // Case A: HR Exec user clicking on user dashboard link -> Route directly to /pages/hr/home.html
      if (isHrExecUser) {
        if (destination.includes("/pages/user/index-user.html") ||
            destination.includes("/pages/user/profile-user.html") ||
            destination.includes("/pages/user/leave-user.html") ||
            destination.includes("/pages/user/leave-history.html")) {
          e.preventDefault();
          e.stopPropagation();
          window.location.href = "/pages/hr/home.html";
          return;
        }
      }

      // Case B: Leader/Manager ห้ามเข้า HR Area ทุกหน้า
      if (status.category === "leader_manager" && destination.includes("/pages/hr/")) {
        e.preventDefault();
        e.stopPropagation();
        if (destination.includes("/pages/hr/hr.html")) {
          window.location.href = "/pages/approver/leave-approvals.html";
        } else if (destination.includes("/pages/hr/leave-stats.html")) {
          window.location.href = "/pages/user/leave-stats.html";
        } else {
          window.location.href = "/pages/user/index-user.html";
        }
        return;
      }

      // Case C: Regular employee clicking on HR link -> Route directly to /pages/user/index-user.html
      if (status.category === "employee") {
        if (destination.includes("/pages/hr/")) {
          e.preventDefault();
          e.stopPropagation();
          window.location.href = "/pages/user/index-user.html";
          return;
        }
      }
    }, true);

    // DOM Link Fixer (Runs immediately when DOM is parsed)
    function fixDomNavLinks() {
      try {
        if (isHrExecUser) {
          // Rewriting links targeting index-user.html to HR Home
          var userHomeLinks = document.querySelectorAll('a[href*="/pages/user/index-user.html"]');
          for (var i = 0; i < userHomeLinks.length; i++) {
            userHomeLinks[i].setAttribute("href", "/pages/hr/home.html");
          }
          var backBtns = document.querySelectorAll(".btn-mobile-back");
          for (var j = 0; j < backBtns.length; j++) {
            backBtns[j].setAttribute("href", "/pages/hr/home.html");
            var spanText = backBtns[j].querySelector("span:not(.material-symbols-outlined)");
            if (spanText) spanText.textContent = "หน้าหลัก";
          }
        } else if (status.category === "leader_manager") {
          var hrHomeLinks = document.querySelectorAll('a[href*="/pages/hr/home.html"]');
          for (var k = 0; k < hrHomeLinks.length; k++) {
            hrHomeLinks[k].setAttribute("href", "/pages/user/index-user.html");
          }
          var oldApprovalLinks = document.querySelectorAll('a[href*="/pages/hr/hr.html"]');
          for (var m = 0; m < oldApprovalLinks.length; m++) {
            oldApprovalLinks[m].setAttribute("href", "/pages/approver/leave-approvals.html");
          }
          var backBtnsLM = document.querySelectorAll(".btn-mobile-back");
          for (var l = 0; l < backBtnsLM.length; l++) {
            backBtnsLM[l].setAttribute("href", "/pages/user/index-user.html");
            var spanTextLM = backBtnsLM[l].querySelector("span:not(.material-symbols-outlined)");
            if (spanTextLM) spanTextLM.textContent = "หน้าพนักงาน";
          }
        }
      } catch (err) {
        console.error("fixDomNavLinks error:", err);
      }
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fixDomNavLinks);
    } else {
      fixDomNavLinks();
    }

    // 🔄 BFCache Re-validation (Handles Browser Back / Forward buttons)
    window.addEventListener("pageshow", function (event) {
      if (event.persisted) {
        var reCheckRaw = localStorage.getItem("currentUser");
        var reCheckSession = reCheckRaw ? JSON.parse(reCheckRaw) : null;
        var reCheckStatus = getRoleCat(reCheckSession);
        var reCheckEmpCode = reCheckSession ? String(reCheckSession.employee_code || (reCheckSession.employees && reCheckSession.employees.employee_code) || '').toLowerCase().trim() : '';
        var reCheckIsHrExec = reCheckStatus.category === 'hr_exec' || reCheckEmpCode === 'admin' || reCheckEmpCode.startsWith('hr-');

        if (!reCheckStatus.isAuth && !isLoginPage) {
          triggerRedirect("/index.html");
          return;
        }

        if (reCheckIsHrExec && isUserDashboardArea) {
          triggerRedirect("/pages/hr/home.html");
          return;
        }

        if (reCheckStatus.category === 'employee' && isHrArea) {
          triggerRedirect("/pages/user/index-user.html");
          return;
        }

        if (reCheckStatus.category === 'leader_manager' && isHrArea) {
          if (path.includes("/pages/hr/hr.html")) {
            triggerRedirect("/pages/approver/leave-approvals.html" + (window.location.search || ""));
          } else if (path.includes("/pages/hr/leave-stats.html")) {
            triggerRedirect("/pages/user/leave-stats.html" + (window.location.search || ""));
          } else {
            triggerRedirect("/pages/user/index-user.html");
          }
          return;
        }

        if (reCheckStatus.category === 'hr_exec' && isApproverArea) {
          triggerRedirect("/pages/hr/home.html");
          return;
        }
      }
    });

  } catch (err) {
    console.error("Early auth guard error:", err);
  }
})();
