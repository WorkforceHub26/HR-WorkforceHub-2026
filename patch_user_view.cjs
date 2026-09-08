const fs = require('fs');

const code = fs.readFileSync('js/auth-guard.js', 'utf8');

const newTranslations = {
  deleteBtn: { th: "ลบ", lo: "ລຶບ", my: "ဖျက်မည်", en: "Delete" },
  submitOneClick: { th: "ส่งคำขอลาทันที (1-Click Submit)", lo: "ສົ່ງຄຳຂໍລາທັນທີ (1-Click Submit)", my: "ခွင့်တောင်းခံရန် (1-Click Submit)", en: "Submit Leave Request (1-Click)" },
  leaveBalanceTitle: { th: "สิทธิ์วันลาคงเหลือ", lo: "ສິດວັນລາຄົງເຫຼືອ", my: "ကျန်ရှိသော ခွင့်ရက်များ", en: "Leave Balance" },
  loadingLeaveBalance: { th: "กำลังโหลดข้อมูลสิทธิ์วันลา...", lo: "ກຳລັງໂຫຼດຂໍ້ມູນສິດວັນລາ...", my: "ခွင့်ရက်များအား တင်နေပါသည်...", en: "Loading leave balance..." },
  recentItems: { th: "รายการล่าสุด", lo: "ລາຍການລ່າສຸດ", my: "လတ်တလောစာရင်း", en: "Recent Requests" },
  viewAll: { th: "ดูทั้งหมด", lo: "ເບິ່ງທັງໝົດ", my: "အားလုံးကြည့်မည်", en: "View All" },
  loadingRecentLeaves: { th: "กำลังโหลดรายการลา...", lo: "ກຳລັງໂຫຼດລາຍການລາ...", my: "ခွင့်မှတ်တမ်းများကို တင်နေပါသည်...", en: "Loading recent requests..." },
  teamMembers: { th: "สมาชิกพนักงานในแผนก", lo: "ສະມາຊິກພະນັກງານໃນພະແນກ", my: "ဌာနတွင်း ဝန်ထမ်းများ", en: "Team Members" },
  teamSubTitle: { th: "เพื่อนร่วมงานในแผนกของคุณ", lo: "ເພື່ອນຮ່ວມງານໃນພະແນກຂອງທ່ານ", my: "သင်၏ လုပ်ဖော်ကိုင်ဖက်များ", en: "Your department colleagues" },
  loadingTeam: { th: "กำลังโหลดข้อมูลสมาชิกในแผนก...", lo: "ກຳລັງໂຫຼດຂໍ້ມູນສະມາຊິກໃນພະແນກ...", my: "ဝန်ထမ်းများကို တင်နေပါသည်...", en: "Loading team members..." },
  companyNews: { th: "ข่าวสาร & ประกาศองค์กร", lo: "ຂ່າວສານ & ປະກາດອົງກອນ", my: "ကုမ္ပဏီ သတင်းနှင့် ကြေညာချက်များ", en: "Company Announcements" },
  companyNewsSub: { th: "ข้อมูลอัปเดต สวัสดิการ และข่าวสารล่าสุดจากฝ่ายบุคคล", lo: "ຂໍ້ມູນອັບເດດ ສະຫວັດດີການ ແລະຂ່າວສານລ່າສຸດຈາກຝ່າຍບຸກຄົນ", my: "နောက်ဆုံးရသတင်းများ နှင့် အကျိုးခံစားခွင့်များ", en: "Latest updates, benefits, and HR news" },
  all: { th: "ทั้งหมด", lo: "ທັງໝົດ", my: "အားလုံး", en: "All" },
  urgentNews: { th: "🚨 ด่วน", lo: "🚨 ດ່ວນ", my: "🚨 အရေးကြီး", en: "🚨 Urgent" },
  prNews: { th: "📢 ประชาสัมพันธ์", lo: "📢 ປະຊາສຳພັນ", my: "📢 ကြေညာချက်", en: "📢 Announcement" },
  holidayNews: { th: "📅 วันหยุด", lo: "📅 ວັນພັກ", my: "📅 အားလပ်ရက်", en: "📅 Holiday" },
  welfareNews: { th: "🎁 สวัสดิการ", lo: "🎁 ສະຫວັດດີການ", my: "🎁 အကျိုးခံစားခွင့်", en: "🎁 Welfare" },
  loadingNews: { th: "กำลังโหลดข่าวสารองค์กร...", lo: "ກຳລັງໂຫຼດຂ່າວສານອົງກອນ...", my: "သတင်းများကို တင်နေပါသည်...", en: "Loading announcements..." },
  leaveTracker: { th: "ติดตามสถานะใบลา (Visual Progress Tracker)", lo: "ຕິດຕາມສະຖານະໃບລາ (Visual Progress Tracker)", my: "ခွင့်တောင်းခံမှု အခြေအနေ", en: "Leave Status Tracker" },
  leaveTrackerSub: { th: "ตรวจสอบขั้นตอนการพิจารณาตามลำดับสายงาน", lo: "ກວດສອບຂັ້ນຕອນການພິຈາລະນາຕາມລຳດັບສາຍງານ", my: "အဆင့်ဆင့်အတည်ပြုမှုကို စစ်ဆေးရန်", en: "Track approval progress" },
  loadingTracker: { th: "กำลังโหลดข้อมูลขั้นตอนการอนุมัติ...", lo: "ກຳລັງໂຫຼດຂໍ້ມູນຂັ້ນຕອນການອະນຸມັດ...", my: "အတည်ပြုမှု အဆင့်များကို တင်နေပါသည်...", en: "Loading approval steps..." },
  closeWin: { th: "ปิดหน้าต่าง", lo: "ປິດໜ້າຕ່າງ", my: "ပြတင်းပေါက်ပိတ်ရန်", en: "Close Window" },
  askHr: { th: "ถาม HR AI (24 ชม.)", lo: "ຖາມ HR AI (24 ຊມ.)", my: "HR AI ကို မေးရန် (24/7)", en: "Ask HR AI (24/7)" },
  askHrDesc: { th: "ตอบข้อสงสัยนโยบายและสิทธิประโยชน์ 24 ชม.", lo: "ຕອບຂໍ້ສົງໄສນະໂຍບາຍແລະສິດທິປະໂຫຍດ 24 ຊມ.", my: "မူဝါဒနှင့် အကျိုးခံစားခွင့်များကို 24 နာရီ မေးမြန်းနိုင်သည်", en: "Answer policy questions 24/7" },
  qSick: { th: "🩺 ใบรับรองแพทย์ลาป่วย?", lo: "🩺 ໃບຮັບຮອງແພດລາປ່ວຍ?", my: "🩺 ဆေးလက်မှတ်?", en: "🩺 Sick leave cert?" },
  qAnnual: { th: "🏖️ สะสมวันลาพักร้อน?", lo: "🏖️ ສະສົມວັນລາພັກຮ້ອນ?", my: "🏖️ ခွင့်ရက်စုဆောင်းခြင်း?", en: "🏖️ Roll over annual leave?" },
  qMat: { th: "👶 สิทธิลาคลอดบุตร?", lo: "👶 ສິດລາຄອດບຸດ?", my: "👶 မီးဖွားခွင့်?", en: "👶 Maternity leave rights?" },
  qClaim: { th: "💰 เบิกค่ารักษา & เบี้ยเลี้ยง?", lo: "💰 ເບີກຄ່າຮັກສາ & ເບ້ຍລ້ຽງ?", my: "💰 ဆေးဖိုးနှင့် ထောက်ပံ့ကြေး?", en: "💰 Medical claims & allowance?" },
  hrGreeting: { 
    th: "สวัสดีครับ! ผมเป็นผู้ช่วยตอบคำถามอัตโนมัติประจำฝ่ายทรัพยากรบุคคล ยินดีช่วยเหลือพนักงานทุกท่านเกี่ยวกับ <strong>นโยบายวันลา สิทธิสวัสดิการ กฎระเบียบบริษัท และการเบิกเงิน</strong> สามารถพิมพ์สอบถามได้ตลอด 24 ชั่วโมงเลยครับ 😊",
    lo: "ສະບາຍດີ! ຂ້ອຍແມ່ນຜູ້ຊ່ວຍຕອບຄຳຖາມອັດຕະໂນມັດປະຈຳຝ່າຍຊັບພະຍາກອນບຸກຄົນ ຍິນດີຊ່ວຍເຫຼືອພະນັກງານທຸກທ່ານກ່ຽວກັບ <strong>ນະໂຍບາຍວັນລາ ສິດທິສະຫວັດດີການ ກົດລະບຽບບໍລິສັດ ແລະການເບີກເງິນ</strong> ສາມາດພິມສອບຖາມໄດ້ຕະຫຼອດ 24 ຊົ່ວໂມງເລີຍครับ 😊",
    my: "မင်္ဂလာပါ! ကျွန်ုပ်သည် သင်၏ HR အလိုအလျောက်လက်ထောက်ဖြစ်ပါသည်။ <strong>ခွင့်မူဝါဒများ၊ အကျိုးခံစားခွင့်များ၊ ကုမ္ပဏီစည်းကမ်းများနှင့် ငွေတောင်းခံမှုများ</strong>နှင့် ပတ်သက်၍ အချိန်မရွေး မေးမြန်းနိုင်ပါသည်။ 😊",
    en: "Hello! I am your automated HR assistant. I can help with <strong>leave policies, benefits, company rules, and claims</strong>. You can ask me questions 24/7. 😊"
  },
  bioGuideTitle: { th: "คู่มือความปลอดภัยชีวมาตร", lo: "ຄູ່ມືຄວາມປອດໄພຊີວະມາດ", my: "ဇီဝမက်ထရစ် လုံခြုံရေး လမ်းညွှန်", en: "Biometric Security Guide" },
  bioGuideText: { th: "ท่านสามารถตั้งค่าการลงทะเบียน Face/Fingerprint สแกนเพื่อเข้าใช้งานได้อย่างรวดเร็วในหน้าข้อมูลส่วนตัวค่ะ", lo: "ທ່ານສາມາດຕັ້ງຄ່າການລົງທະບຽນ Face/Fingerprint ສະແກນເພື່ອເຂົ້າໃຊ້ງານໄດ້ຢ່າງວ່ອງໄວໃນໜ້າຂໍ້ມູນສ່ວນຕົວຄ่ะ", my: "သင်၏ ပရိုဖိုင်စာမျက်နှာတွင် လျင်မြန်စွာ ဝင်ရောက်နိုင်ရန် မျက်နှာ/လက်ဗွေ စကင်ဖတ်ခြင်းကို သတ်မှတ်နိုင်သည်။", en: "You can set up Face/Fingerprint login for fast access in your profile page." }
};

// 1. Inject into window.globalAppTranslations
let newCode = code;
for (const lang of ['th', 'lo', 'my', 'en']) {
  const blockStartStr = `  ${lang}: {`;
  const blockStartIndex = newCode.indexOf(blockStartStr);
  if (blockStartIndex !== -1) {
    let toInject = '';
    for (const [key, trans] of Object.entries(newTranslations)) {
      toInject += `    ${key}: ${JSON.stringify(trans[lang])},\n`;
    }
    newCode = newCode.substring(0, blockStartIndex + blockStartStr.length + 1) + toInject + newCode.substring(blockStartIndex + blockStartStr.length + 1);
  }
}

// 2. Inject into CANONICAL_PHRASE_MAP
const phraseMapStart = newCode.indexOf('window.CANONICAL_PHRASE_MAP = window.CANONICAL_PHRASE_MAP || {');
const phraseMapBlockStart = newCode.indexOf('{', phraseMapStart);
let toInjectPhrase = '';
for (const [key, trans] of Object.entries(newTranslations)) {
  toInjectPhrase += `  ${JSON.stringify(trans.th)}: "${key}", ${JSON.stringify(trans.lo)}: "${key}", ${JSON.stringify(trans.my)}: "${key}", ${JSON.stringify(trans.en)}: "${key}",\n`;
}
newCode = newCode.substring(0, phraseMapBlockStart + 1) + '\n' + toInjectPhrase + newCode.substring(phraseMapBlockStart + 1);

// 3. Inject attribute translations inside setGlobalLanguage
const topNavTransStart = newCode.indexOf('// 2. Translate Top Navigation');
const attrTranslationCode = `
    // Extra Attribute Translations for User View
    const phInputs = document.querySelectorAll("input[placeholder]");
    phInputs.forEach(input => {
      if (input.placeholder === "พิมพ์คำถามนโยบายหรือสวัสดิการ..." || input.id === "hrChatInput") {
        input.placeholder = t.askHrDesc || "Type policy or benefit question...";
      }
    });
    
    const titleBtns = document.querySelectorAll("[title]");
    titleBtns.forEach(btn => {
      if (btn.title === "ถามผู้ช่วย HR AI เกี่ยวกับนโยบายและสิทธิวันลา" || btn.id === "hrChatbotFab") {
        btn.title = t.askHrDesc || "Ask HR AI about policies and benefits";
      }
    });
`;
newCode = newCode.substring(0, topNavTransStart) + attrTranslationCode + newCode.substring(topNavTransStart);

fs.writeFileSync('js/auth-guard.js', newCode);
console.log('Successfully patched js/auth-guard.js');
