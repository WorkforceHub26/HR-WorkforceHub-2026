/**
 * ============================================================================
 * 🌐 LOGIN PAGE CONNECTIVITY MONITOR & SHORTCUTS - PVT WORKFORCE HUB
 * ============================================================================
 */
(function() {
        const statusContainer = document.getElementById('pvtConnectionStatus');
        const statusText = document.getElementById('pvtStatusText');
        const statusIcon = document.querySelector('#pvtConnectionStatus .status-icon');
        
        async function checkSupabaseConnection() {
          const isOnline = navigator.onLine;
          if (!isOnline) {
            updateUI(false, 'Offline');
            return;
          }

          try {
            let sb = null;
            if (typeof getSbClient === 'function') {
              sb = getSbClient();
            } else {
              const candidate = window.supabaseClient || window.pvtSupabase?.client || window.pvtSupabase?.getClient?.();
              if (candidate && typeof candidate.from === 'function') sb = candidate;
            }
            if (!sb) {
              updateUI(true, 'Ready'); 
              return;
            }
            
            const { error } = await sb.from('employees').select('id').limit(1).maybeSingle();
            if (error) throw error;
            updateUI(true, 'Online');
          } catch (err) {
            console.warn('Supabase connection check failed:', err);
            updateUI(true, 'Limited'); 
          }
        }

        function updateUI(online, label) {
          if (!statusContainer) return;
          
          statusContainer.classList.remove('online', 'offline', 'limited');
          if (!online || label === 'Offline') {
            statusContainer.classList.add('offline');
            if (statusText) statusText.textContent = 'Offline';
            if (statusIcon) statusIcon.textContent = 'cloud_off';
          } else if (label === 'Limited') {
            statusContainer.classList.add('limited');
            if (statusText) statusText.textContent = 'Limited';
            if (statusIcon) statusIcon.textContent = 'cloud_sync';
          } else {
            statusContainer.classList.add('online');
            if (statusText) statusText.textContent = 'Online';
            if (statusIcon) statusIcon.textContent = 'cloud_done';
          }
        }

        window.addEventListener('online', checkSupabaseConnection);
        window.addEventListener('offline', () => updateUI(false, 'Offline'));
        
        setTimeout(checkSupabaseConnection, 1000);
        setInterval(checkSupabaseConnection, 30000);

        // 🛠️ Hidden Troubleshooting Shortcut (Long Press on Header)
        const header = document.getElementById('pvtLoginHeader');
        let pressTimer;

        const startPress = (e) => {
          // Only trigger on left-click or touch
          if (e.type === 'mousedown' && e.button !== 0) return;
          
          // Visual feedback
          header.style.transition = 'all 0.2s ease';
          header.style.opacity = '0.6';
          header.style.transform = 'scale(0.98)';
          
          pressTimer = window.setTimeout(() => {
            header.style.opacity = '1';
            header.style.transform = 'scale(1)';
            
            if (confirm('ระบบตรวจพบการกดค้าง: คุณต้องการล้างข้อมูลแคช (Clear Storage) และออกจากระบบเพื่อแก้ไขปัญหาใช่หรือไม่?\n\n(This will clear all local credentials and reset the login state.)')) {
              localStorage.clear();
              sessionStorage.clear();
              alert('ล้างข้อมูลสำเร็จ (Success): ระบบจะเริ่มใหม่ในขณะนี้');
              window.location.reload();
            }
          }, 2000); // 2 seconds long press
        };

        const cancelPress = () => {
          header.style.opacity = '1';
          header.style.transform = 'scale(1)';
          clearTimeout(pressTimer);
        };

        if (header) {
          // Mouse events
          header.addEventListener('mousedown', startPress);
          header.addEventListener('mouseup', cancelPress);
          header.addEventListener('mouseleave', cancelPress);
          
          // Touch events (Mobile)
          header.addEventListener('touchstart', (e) => {
            // Prevent default context menu on some mobile browsers if possible
            startPress(e);
          }, { passive: true });
          header.addEventListener('touchend', cancelPress);
          header.addEventListener('touchcancel', cancelPress);
          
          header.style.cursor = 'help';
          header.title = 'Hold for troubleshooting options';
        }
      })();
