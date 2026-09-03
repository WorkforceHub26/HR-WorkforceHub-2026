/**
 * ==========================================================================
 * 🤍 PVT WORKFORCE HUB - Holidays Management Module (holidays.js)
 * Supports Multi-Language Localization (TH, LO, MY)
 * ==========================================================================
 */

let currentYear = 2026;
let holidaysData = [];
let currentView = 'grid';
let currentUserProfile = null;

// Default Holidays Data for 2026
const defaultHolidays2026 = [
  { id: 'def-1', holiday_date: '2026-01-01', holiday_name: 'วันขึ้นปีใหม่', holiday_type: 'official', description: 'วันหยุดต้อนรับปีใหม่ พ.ศ. 2569' },
  { id: 'def-2', holiday_date: '2026-03-03', holiday_name: 'วันมาฆบูชา', holiday_type: 'official', description: 'วันสำคัญทางศาสนาพุทธ' },
  { id: 'def-3', holiday_date: '2026-04-06', holiday_name: 'วันจักรี', holiday_type: 'official', description: 'วันระลึกมหาจักรีบรมราชวงศ์' },
  { id: 'def-4', holiday_date: '2026-04-13', holiday_name: 'วันสงกรานต์', holiday_type: 'official', description: 'วันขึ้นปีใหม่ไทย' },
  { id: 'def-5', holiday_date: '2026-04-14', holiday_name: 'วันสงกรานต์', holiday_type: 'official', description: 'วันครอบครัว' },
  { id: 'def-6', holiday_date: '2026-04-15', holiday_name: 'วันสงกรานต์', holiday_type: 'official', description: 'วันผู้สูงอายุแห่งชาติ' },
  { id: 'def-7', holiday_date: '2026-05-01', holiday_name: 'วันแรงงานแห่งชาติ', holiday_type: 'company', description: 'วันหยุดพิเศษประจำปีของพนักงาน' },
  { id: 'def-8', holiday_date: '2026-05-04', holiday_name: 'วันฉัตรมงคล', holiday_type: 'official', description: 'วันรอยพระบาทสมเด็จพระเจ้าอยู่หัวเสด็จบรมราชาภิเษก' },
  { id: 'def-9', holiday_date: '2026-05-31', holiday_name: 'วันวิสาขบูชา', holiday_type: 'official', description: 'วันสำคัญทางศาสนาพุทธ' },
  { id: 'def-10', holiday_date: '2026-06-03', holiday_name: 'วันเฉลิมพระชนมพรรษา สมเด็จพระนางเจ้าฯ พระบรมราชินี', holiday_type: 'official', description: 'วันเฉลิมพระชนมพรรษา' },
  { id: 'def-11', holiday_date: '2026-07-28', holiday_name: 'วันเฉลิมพระชนมพรรษา พระบาทสมเด็จพระเจ้าอยู่หัว', holiday_type: 'official', description: 'วันเฉลิมพระชนมพรรษา ร.10' },
  { id: 'def-12', holiday_date: '2026-07-29', holiday_name: 'วันอาสาฬหบูชา', holiday_type: 'official', description: 'วันสำคัญทางศาสนาพุทธ' },
  { id: 'def-13', holiday_date: '2026-08-12', holiday_name: 'วันแม่แห่งชาติ', holiday_type: 'official', description: 'วันเฉลิมพระชนมพรรษา สมเด็จพระบรมราชชนนีพันปีหลวง' },
  { id: 'def-14', holiday_date: '2026-10-13', holiday_name: 'วันนวมินทรมหาราช', holiday_type: 'official', description: 'วันคล้ายวันสวรรคต ร.9' },
  { id: 'def-15', holiday_date: '2026-10-23', holiday_name: 'วันปิยมหาราช', holiday_type: 'official', description: 'วันคล้ายวันสวรรคต ร.5' },
  { id: 'def-16', holiday_date: '2026-12-05', holiday_name: 'วันพ่อแห่งชาติ', holiday_type: 'official', description: 'วันคล้ายวันพระบรมราชสมภพ ร.9' },
  { id: 'def-17', holiday_date: '2026-12-10', holiday_name: 'วันรัฐธรรมนูญ', holiday_type: 'official', description: 'วันระลึกการมีรัฐธรรมนูญฉบับแรก' },
  { id: 'def-18', holiday_date: '2026-12-31', holiday_name: 'วันสิ้นปี', holiday_type: 'official', description: 'วันหยุดส่งท้ายปีเก่า' }
];

// Localization dictionaries
const HOLIDAY_NAME_MAP = {
  'วันขึ้นปีใหม่': { lo: 'ວັນຂຶ້ນປີໃໝ່', my: 'နှစ်သစ်ကူးနေ့' },
  'วันมาฆบูชา': { lo: 'ວັນມາຄະບູຊາ', my: 'မာဃပူဇာနေ့' },
  'วันจักรี': { lo: 'ວັນຈັກກີ', my: 'ချက်ကရီနေ့' },
  'วันสงกรานต์': { lo: 'ວັນບຸນປີໃໝ່ (ສົງການ)', my: 'သင်္ကြန်ပွဲတော်' },
  'วันแรงงานแห่งชาติ': { lo: 'ວັນກຳມະກອນສາກົນ', my: 'အလုပ်သမားနေ့' },
  'วันฉัตรมงคล': { lo: 'ວັນສັດມຸງຄຸນ', my: 'ဘိသိက်ခံနေ့' },
  'วันวิสาขบูชา': { lo: 'ວັນວິສາຂະບູຊາ', my: 'ကဆုန်လပြည့် ဗုဒ္ဓနေ့' },
  'วันเฉลิมพระชนมพรรษา สมเด็จพระนางเจ้าฯ พระบรมราชินี': { lo: 'ວັນສະເຫຼີມສະຫຼອງພະລາຊິນີ', my: 'မိဖုရားကြီး မွေးနေ့' },
  'วันเฉลิมพระชนมพรรษา พระบาทสมเด็จพระเจ้าอยู่หัว': { lo: 'ວັນສະເຫຼີມສະຫຼອງພະເຈົ້າມະຫາຊີວິດ', my: 'ဘုရင်မင်းမြတ် မွေးနေ့' },
  'วันอาสาฬหบูชา': { lo: 'ວັນອາສາລະຫະບູຊາ', my: 'ဝါဆိုလပြည့်နေ့' },
  'วันแม่แห่งชาติ': { lo: 'ວັນແມ່ແຫ່ງຊາດ', my: 'မိခင်များနေ့' },
  'วันนวมินทรมหาราช': { lo: 'ວັນນະວະມິນມະຫາລາດ', my: 'ဘုရင်မင်းမြတ် ရာမ ၉ အောက်မေ့ဖွယ်နေ့' },
  'วันปิยมหาราช': { lo: 'ວັນປີຍະມະຫາລາດ', my: 'ချူလာလောင်ကွန်းနေ့' },
  'วันพ่อแห่งชาติ': { lo: 'ວັນພໍ່ແຫ່ງຊາດ', my: 'ဖခင်များနေ့' },
  'วันรัฐธรรมนูญ': { lo: 'ວັນລັດຖະທຳມະນູນ', my: 'ဖွဲ့စည်းပုံအခြေခံဥပဒေနေ့' },
  'วันสิ้นปี': { lo: 'ວັນສົ່ງທ້າຍປີເກົ່າ', my: 'နှစ်ကုန်ရက်' }
};

const HOLIDAY_DESC_MAP = {
  'วันหยุดต้อนรับปีใหม่ พ.ศ. 2569': { lo: 'ວັນພັກຕ້ອນຮັບປີໃໝ່', my: 'နှစ်သစ်ကူး အားလပ်ရက်' },
  'วันสำคัญทางศาสนาพุทธ': { lo: 'ວັນສຳຄັນທາງພຸດທະສາດສະໜາ', my: 'ဗုဒ္ဓဘာသာ နေ့ထူးနေ့မြတ်' },
  'วันระลึกมหาจักรีบรมราชวงศ์': { lo: 'ວັນລະນຶກມະຫາຈັກກີ', my: 'ချက်ကရီ မင်းဆက် အောက်မေ့ဖွယ်နေ့' },
  'วันขึ้นปีใหม่ไทย': { lo: 'ວັນຂຶ້ນປີໃໝ່ໄທ (ສົງການ)', my: 'ထိုင်းနှစ်သစ်ကူးနေ့' },
  'วันครอบครัว': { lo: 'ວັນຄອບຄົວ', my: 'မိသားစုနေ့' },
  'วันผู้สูงอายุแห่งชาติ': { lo: 'ວັນຜູ້ສູງອາຍຸແຫ່ງຊາດ', my: 'သက်ကြီးရွယ်အိုများနေ့' },
  'วันหยุดพิเศษประจำปีของพนักงาน': { lo: 'ວັນພັກພິເສດປະຈຳປີຂອງພະນັກງານ', my: 'ဝန်ထမ်းများအတွက် အထူးနှစ်ပတ်လည် အားလပ်ရက်' },
  'วันรอยพระบาทสมเด็จพระเจ้าอยู่หัวเสด็จบรมราชาภิเษก': { lo: 'ວັນສະເຫຼີມສະຫຼອງບໍລົມລາຊາພິເສກ', my: 'ဘိသိက်မင်္ဂလာ အထိမ်းအမှတ်နေ့' },
  'วันเฉลิมพระชนมพรรษา': { lo: 'ວັນສະເຫຼີມສະຫຼອງວັນເກີດ', my: 'မွေးနေ့တော် အထိမ်းအမှတ်' },
  'วันเฉลิมพระชนมพรรษา ร.10': { lo: 'ວັນສະເຫຼີມສະຫຼອງ ຣ.10', my: 'ဘုရင် ရာမ ၁၀ မွေးနေ့' },
  'วันเฉลิมพระชนมพรรษา สมเด็จพระบรมราชชนนีพันปีหลวง': { lo: 'ວັນສະເຫຼີມສະຫຼອງພະລາຊະຊົນນະນີ', my: 'မိဖုရားကြီး မွေးနေ့တော်' },
  'วันคล้ายวันสวรรคต ร.9': { lo: 'ວັນຄ້າຍວັນສະຫວັນນະຄົດ ຣ.9', my: 'ဘုရင် ရာမ ၉ ကွယ်လွန်ခြင်း အောက်မေ့ဖွယ်နေ့' },
  'วันคล้ายวันสวรรคต ร.5': { lo: 'ວັນຄ້ายວັນສະຫວັນນະຄົດ ຣ.5', my: 'ဘုရင် ရာမ ၅ ကွယ်လွန်ခြင်း အောက်မေ့ဖွယ်နေ့' },
  'วันคล้ายวันพระบรมราชสมภพ ร.9': { lo: 'ວັນຄ້າຍວັນພະລາຊະສົມພົບ ຣ.9', my: 'ဘုရင် ရာမ ၉ မွေးနေ့တော်' },
  'วันระลึกการมีรัฐธรรมนูญฉบับแรก': { lo: 'ວັນລະນຶກລັດຖະທຳມະນູນສະບັບທຳອິດ', my: 'ပထမဆုံး ဖွဲ့စည်းပုံအခြေခံဥပဒေ အောက်မေ့ဖွယ်နေ့' },
  'วันหยุดส่งท้ายปีเก่า': { lo: 'ວັນພັກສົ່ງທ້າຍປີເກົ່າ', my: 'နှစ်ဟောင်းကုန် အားလပ်ရက်' }
};

const LANG_CONFIG = {
  th: {
    monthsShort: ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'],
    monthsFull: ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'],
    days: ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'],
    daysShort: ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'],
    dayPrefix: 'วัน',
    tagOfficial: 'นักขัตฤกษ์',
    tagCompany: 'วันหยุดบริษัท',
    tagSubstitution: 'หยุดชดเชย',
    statusToday: '📌 วันนี้',
    statusTomorrow: '⏰ พรุ่งนี้',
    statusPast: 'ผ่านมาแล้ว',
    statusUpcoming: 'กำลังจะถึง',
    daysLeftText: (d) => `อีก ${d} วัน`,
    daysUnit: 'วัน',
    yearPrefix: 'ปี ',
    yearSuffix: (y) => ` (${y + 543})`,
    formatYear: (y) => (y + 543).toString(),
    emptyHolidays: 'ไม่พบข้อมูลวันหยุด',
    noNextHoliday: 'ไม่มีวันหยุดถัดไป',
    noNextHolidayYear: 'ไม่มีวันหยุดถัดไปในปีนี้',
    allPassedDesc: 'ผ่านพ้นวันหยุดทั้งหมดของปีนี้เรียบร้อยแล้ว',
    summaryMonthTitle: (m, y) => `วันหยุดเดือน${m} ${y}`,
    summaryYearTitle: (y) => `สรุปวันหยุดปี ${y}`,
    summaryDayTitle: (d) => `ประจำวันที่ ${d}`,
    totalDaysLabel: (n) => `รวม ${n} วัน`,
    btnViewWholeYear: 'ดูทั้งปี',
    btnBack: 'ย้อนกลับ',
    noHolidaysSection: 'ไม่มีวันหยุดในส่วนนี้',
    teamMonthlyTitle: (m, y) => `ผู้ลาเดือน${m} ${y}`,
    teamDayTitle: (d) => `วันที่ ${d}`,
    btnViewWholeMonth: 'ดูทั้งเดือน',
    noTeamLeaves: 'ไม่มีรายการในส่วนนี้',
    approved: 'อนุมัติ',
    pending: 'รออนุมัติ',
    edit: 'แก้ไข',
    delete: 'ลบ',
    btnEditHoliday: 'แก้ไขวันหยุด',
    btnDeleteHoliday: 'ลบวันหยุด'
  },
  lo: {
    monthsShort: ['ມ.ກ.', 'ກ.ພ.', 'ມ.ນ.', 'ມ.ສ.', 'ພ.ພ.', 'ມິ.ຖ.', 'ກ.ລ.', 'ສ.ຫ.', 'ກ.ຍ.', 'ຕ.ລ.', 'ພ.ຈ.', 'ທ.ວ.'],
    monthsFull: ['ມັງກອນ', 'ກຸມພາ', 'ມີນາ', 'ເມສາ', 'ພຶດສະພາ', 'ມິຖຸນາ', 'ກໍລະກົດ', 'ສິງຫາ', 'ກັນຍາ', 'ຕຸລາ', 'ພະຈິກ', 'ທັນວາ'],
    days: ['ວັນອາທິດ', 'ວັນຈັນ', 'ວັນອັງຄານ', 'ວັນພຸດ', 'ວັນພະຫັດ', 'ວັນສຸກ', 'ວັນເສົາ'],
    daysShort: ['ອາ.', 'ຈ.', 'ອ.', 'ພ.', 'ພຫ.', 'ສຸ.', 'ສ.'],
    dayPrefix: 'ວັນ',
    tagOfficial: 'ວັນພັກລັດຖະການ',
    tagCompany: 'ວັນພັກບໍລິສັດ',
    tagSubstitution: 'ວັນພັກຊົດເຊີຍ',
    statusToday: '📌 ມື້ນີ້',
    statusTomorrow: '⏰ ມື້ອື່ນ',
    statusPast: 'ຜ່ານມາແລ້ວ',
    statusUpcoming: 'ກຳລັງຈະມາຮອດ',
    daysLeftText: (d) => `ອີກ ${d} ວັນ`,
    daysUnit: 'ວັນ',
    yearPrefix: 'ປີ ',
    yearSuffix: () => '',
    formatYear: (y) => y.toString(),
    emptyHolidays: 'ບໍ່ພົບຂໍ້ມູນວັນພັກ',
    noNextHoliday: 'ບໍ່ມີວັນພັກຖັດໄປ',
    noNextHolidayYear: 'ບໍ່ມີວັນພັກຖັດໄປໃນປີນີ້',
    allPassedDesc: 'ຜ່ານພົ້ນວັນພັກທັງໝົດຂອງປີນີ້ແລ້ວ',
    summaryMonthTitle: (m, y) => `ວັນພັກເດືອນ${m} ${y}`,
    summaryYearTitle: (y) => `ສະຫຼຸບວັນພັກປີ ${y}`,
    summaryDayTitle: (d) => `ປະຈຳວັນທີ ${d}`,
    totalDaysLabel: (n) => `ລວມ ${n} ວັນ`,
    btnViewWholeYear: 'ເບິ່ງທັງປີ',
    btnBack: 'ຍ້ອນກັບ',
    noHolidaysSection: 'ບໍ່ມີວັນພັກໃນສ່ວນນີ້',
    teamMonthlyTitle: (m, y) => `ຜູ້ລາພັກເດືອນ${m} ${y}`,
    teamDayTitle: (d) => `ວັນທີ ${d}`,
    btnViewWholeMonth: 'ເບິ່ງທັງເດືອນ',
    noTeamLeaves: 'ບໍ່ມີລາຍການໃນສ່ວນນີ້',
    approved: 'ອະນຸມັດ',
    pending: 'ຖ້າອະນຸມັດ',
    edit: 'ແກ້ໄຂ',
    delete: 'ລຶບ',
    btnEditHoliday: 'ແກ້ໄຂວັນພັກ',
    btnDeleteHoliday: 'ລຶບວັນພັກ'
  },
  my: {
    monthsShort: ['ဇန်', 'ဖေ', 'မတ်', 'ဧပြီ', 'မေ', 'ဇွန်', 'ဇူ', 'သြ', 'စက်', 'အောက်', 'နို', 'ဒီ'],
    monthsFull: ['ဇန်နဝါရီ', 'ဖေဖော်ဝါရီ', 'မတ်', 'ဧပြီ', 'မေ', 'ဇွန်', 'ဇူလိုင်', 'သြဂုတ်', 'စက်တင်ဘာ', 'အောက်တိုဘာ', 'နိုဝင်ဘာ', 'ဒီဇင်ဘာ'],
    days: ['တနင်္ဂနွေနေ့', 'တနင်္လာနေ့', 'အင်္ဂါနေ့', 'ဗုဒ္ဓဟူးနေ့', 'ကြာသပတေးနေ့', 'သောကြာနေ့', 'စနေနေ့'],
    daysShort: ['နွေ', 'လာ', 'ဂါ', 'ဟူး', 'တေး', 'ကြာ', 'နေ'],
    dayPrefix: '',
    tagOfficial: 'ရုံးပိတ်ရက်',
    tagCompany: 'ကုမ္ပဏီ အားလပ်ရက်',
    tagSubstitution: 'အစားထိုး အားလပ်ရက်',
    statusToday: '📌 ယနေ့',
    statusTomorrow: '⏰ မနက်ဖြန်',
    statusPast: 'ပြီးဆုံးခဲ့ပြီ',
    statusUpcoming: 'မကြာမီ ရောက်ရှိမည်',
    daysLeftText: (d) => `နောက်ထပ် ${d} ရက်`,
    daysUnit: 'ရက်',
    yearPrefix: '',
    yearSuffix: () => ' ခုနှစ်',
    formatYear: (y) => `${y} ခုနှစ်`,
    emptyHolidays: 'ရုံးပိတ်ရက် အချက်အလက် မရှိပါ',
    noNextHoliday: 'နောက်ထပ် ရုံးပိတ်ရက် မရှိပါ',
    noNextHolidayYear: 'ယခုနှစ်အတွက် နောက်ထပ် ရုံးပိတ်ရက် မရှိပါ',
    allPassedDesc: 'ယခုနှစ်၏ ရုံးပိတ်ရက်များ အားလုံး ပြီးဆုံးသွားပါပြီ',
    summaryMonthTitle: (m, y) => `${m} ${y} ရုံးပိတ်ရက်များ`,
    summaryYearTitle: (y) => `${y} တစ်နှစ်တာ ရုံးပိတ်ရက် အကျဉ်းချုပ်`,
    summaryDayTitle: (d) => `${d} ရက်နေ့`,
    totalDaysLabel: (n) => `စုစုပေါင်း ${n} ရက်`,
    btnViewWholeYear: 'တစ်နှစ်လုံး ကြည့်မည်',
    btnBack: 'နောက်သို့',
    noHolidaysSection: 'ဤအပိုင်းတွင် ရုံးပိတ်ရက် မရှိပါ',
    teamMonthlyTitle: (m, y) => `${m} ${y} ခွင့်ယူသူများ`,
    teamDayTitle: (d) => `${d} ရက်နေ့`,
    btnViewWholeMonth: 'တစ်လလုံး ကြည့်မည်',
    noTeamLeaves: 'ဤအပိုင်းတွင် အချက်အလက် မရှိပါ',
    approved: 'အတည်ပြုပြီး',
    pending: 'စောင့်ဆိုင်းဆဲ',
    edit: 'ပြင်ဆင်ရန်',
    delete: 'ဖျက်ရန်',
    btnEditHoliday: 'ရုံးပိတ်ရက် ပြင်ဆင်ရန်',
    btnDeleteHoliday: 'ရုံးပိတ်ရက် ဖျက်ရန်'
  }
};

function getActiveLang() {
  if (typeof window.getGlobalLanguage === 'function') {
    return window.getGlobalLanguage();
  }
  return localStorage.getItem('pvt_language') || 'th';
}

function getLangStrings() {
  const lang = getActiveLang();
  return LANG_CONFIG[lang] || LANG_CONFIG.th;
}

function getLocalizedHolidayName(name) {
  if (!name) return '';
  const lang = getActiveLang();
  if (lang === 'th') return name;
  return HOLIDAY_NAME_MAP[name]?.[lang] || name;
}

function getLocalizedHolidayDesc(desc) {
  if (!desc) return '';
  const lang = getActiveLang();
  if (lang === 'th') return desc;
  return HOLIDAY_DESC_MAP[desc]?.[lang] || desc;
}

// 🚀 INITIALIZATION
document.addEventListener('DOMContentLoaded', async () => {
  await loadUserProfile();
  initNotificationBell();
  await fetchHolidays();
});

// 🛠️ HELPER: แปลงสตริง วันที่ ป้องกัน Timezone Offset และรองรับ ISO String
function parseLocalDate(dateStr) {
  if (!dateStr) return new Date();
  const cleanStr = dateStr.toString().split('T')[0];
  const parts = cleanStr.split('-').map(Number);
  if (parts.length < 3 || parts.some(isNaN)) {
    return new Date();
  }
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

// 👤 ดึงข้อมูลโปรไฟล์ผู้ใช้ และตั้งค่าการแสดงผล UI ตามสิทธิ์ (Role)
async function loadUserProfile() {
  try {
    const rawSession = localStorage.getItem("currentUser");
    if (!rawSession) return;
    
    const sessionUser = JSON.parse(rawSession);
    currentUserProfile = sessionUser;
    
    const elName = document.getElementById('userName');
    const elRole = document.getElementById('userRole');
    const elAvatar = document.getElementById('userAvatar');
    const btnAdd = document.getElementById('btnAddHoliday');

    if (elName) elName.innerText = sessionUser.full_name || 'เจ้าหน้าที่';
    if (elRole) elRole.innerText = sessionUser.role ? sessionUser.role.toUpperCase() : 'PVT USER';
    if (elAvatar) elAvatar.innerText = (sessionUser.full_name || 'HR').substring(0, 2).toUpperCase();

    const role = sessionUser.role ? sessionUser.role.toLowerCase() : '';
    const isPowerUser = ['admin', 'hr', 'executive', 'director'].includes(role);
    
    // Show team leaves tab for non-normal users (leader, manager, hr, executive, admin, etc.)
    if (role !== 'user' && role !== '') {
      const tabTeamLeaves = document.getElementById('tabTeamLeaves');
      if (tabTeamLeaves) tabTeamLeaves.style.display = 'inline-block';
    }

    if (btnAdd) {
      btnAdd.style.display = isPowerUser ? 'inline-flex' : 'none';
    }

    document.querySelectorAll('.hr-only').forEach(el => {
      el.style.display = isPowerUser ? 'flex' : 'none';
    });
  } catch (err) {
    console.warn('Profile error:', err.message);
  }
}

// 📥 โหลดข้อมูลวันหยุดจาก Supabase
async function fetchHolidays() {
  const yearSelect = document.getElementById('yearSelect');
  currentYear = yearSelect ? parseInt(yearSelect.value) : 2026;

  try {
    const supabase = window.pvtSupabase ? window.pvtSupabase.getClient() : null;
    let dataFromDb = [];

    if (supabase) {
      const { data, error } = await supabase
        .from('holidays')
        .select('*')
        .gte('holiday_date', `${currentYear}-01-01`)
        .lte('holiday_date', `${currentYear}-12-31`)
        .order('holiday_date', { ascending: true });

      if (!error && data && data.length > 0) {
        dataFromDb = data;
      }
    }

    if (dataFromDb.length === 0) {
      holidaysData = defaultHolidays2026.map((item, idx) => ({
        ...item,
        id: `def-${currentYear}-${idx}`,
        holiday_date: item.holiday_date.replace('2026', currentYear.toString())
      }));
    } else {
      holidaysData = dataFromDb;
    }

    holidaysData.sort((a, b) => parseLocalDate(a.holiday_date) - parseLocalDate(b.holiday_date));
    updateStatsAndHero();
    filterHolidays();
  } catch (err) {
    console.error('Error fetching holidays:', err);
    holidaysData = defaultHolidays2026.map((item, idx) => ({
      ...item,
      id: `def-${currentYear}-${idx}`,
      holiday_date: item.holiday_date.replace('2026', currentYear.toString())
    }));
    updateStatsAndHero();
    filterHolidays();
  }
}

// 📊 อัปเดต Banner และ KPI Cards
function updateStatsAndHero() {
  const strings = getLangStrings();
  const total = holidaysData.length;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // กรองเฉพาะวันหยุดที่ตั้งแต่วันนี้เป็นต้นไป
  let upcomingList = holidaysData.filter(h => {
    const hDate = parseLocalDate(h.holiday_date);
    hDate.setHours(0, 0, 0, 0);
    return hDate >= today;
  });

  // เรียงลำดับวันที่จากใกล้ไปไกล
  upcomingList.sort((a, b) => parseLocalDate(a.holiday_date) - parseLocalDate(b.holiday_date));

  const elStatTotal = document.getElementById('statTotalHolidays');
  const elStatRemaining = document.getElementById('statRemainingHolidays');
  if (elStatTotal) elStatTotal.innerText = `${total} ${strings.daysUnit}`;
  if (elStatRemaining) elStatRemaining.innerText = `${upcomingList.length} ${strings.daysUnit}`;

  const nextHoliday = upcomingList.length > 0 ? upcomingList[0] : null;

  const elNextName = document.getElementById('statNextHolidayName');
  const elNextDate = document.getElementById('statNextHolidayDate');
  const elHeroTitle = document.getElementById('heroHolidayTitle');
  const elHeroDetails = document.getElementById('heroHolidayDateDetails');
  const elHeroCountdown = document.getElementById('heroCountdownDays');

  if (nextHoliday) {
    const hDate = parseLocalDate(nextHoliday.holiday_date);
    hDate.setHours(0, 0, 0, 0);
    
    const diffTime = hDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const locName = getLocalizedHolidayName(nextHoliday.holiday_name);
    const locDesc = getLocalizedHolidayDesc(nextHoliday.description) || locName;

    if (elNextName) elNextName.innerText = locName;
    if (elNextDate) elNextDate.innerText = formatLocalDateShort(nextHoliday.holiday_date);
    if (elHeroTitle) elHeroTitle.innerText = locName;
    if (elHeroDetails) elHeroDetails.innerText = `${formatLocalDateFull(nextHoliday.holiday_date)} (${locDesc})`;
    if (elHeroCountdown) elHeroCountdown.innerText = diffDays === 0 ? strings.statusToday : diffDays;
  } else {
    // Fallback กรณีไม่มีวันหยุดถัดไปในปีนี้แล้ว
    if (elNextName) elNextName.innerText = strings.noNextHoliday;
    if (elNextDate) elNextDate.innerText = '-';
    if (elHeroTitle) elHeroTitle.innerText = strings.noNextHolidayYear;
    if (elHeroDetails) elHeroDetails.innerText = strings.allPassedDesc;
    if (elHeroCountdown) elHeroCountdown.innerText = '0';
  }
}

// 🔍 ระบบกรองและค้นหา
function filterHolidays() {
  const strings = getLangStrings();
  const searchInput = document.getElementById('holidaySearchInput'); 
  const categorySelect = document.getElementById('categorySelect'); 
  const monthSelect = document.getElementById('monthSelect');
  const yearSelect = document.getElementById('yearSelect');

  const searchTxt = searchInput ? searchInput.value.toLowerCase().trim() : ''; 
  const category = categorySelect ? categorySelect.value : 'all'; 
  const selectedMonthVal = monthSelect ? monthSelect.value : 'all';

  const filtered = holidaysData.filter(h => { 
    const matchCategory = category === 'all' || h.holiday_type === category; 
    const locName = getLocalizedHolidayName(h.holiday_name).toLowerCase();
    const locDesc = getLocalizedHolidayDesc(h.description).toLowerCase();
    const matchSearch = h.holiday_name.toLowerCase().includes(searchTxt) ||
                        locName.includes(searchTxt) ||
                        (h.description && h.description.toLowerCase().includes(searchTxt)) || 
                        locDesc.includes(searchTxt) ||
                        h.holiday_date.includes(searchTxt); 
    return matchCategory && matchSearch; 
  });

  const month = companyCalCurrentDate.getMonth();
  const year = companyCalCurrentDate.getFullYear();
  const titleEl = document.getElementById('companyCalMonthYear');

  if (yearSelect && yearSelect.value !== year.toString()) {
    yearSelect.value = year.toString();
  }

  if (selectedMonthVal === 'all') {
    if (titleEl) titleEl.innerText = strings.summaryYearTitle(strings.formatYear(year));
    if (monthSelect) monthSelect.value = 'all';

    if (window.renderCompanyCalendarGrid) {
      window.renderCompanyCalendarGrid(year, month, filtered);
      window.renderCompanySummarySidebar(filtered, null, true);
    }
  } else {
    if (monthSelect && monthSelect.value !== month.toString()) {
      monthSelect.value = month.toString();
    }
    if (titleEl) titleEl.innerText = `${strings.monthsFull[month]} ${strings.formatYear(year)}`;

    if (window.renderCompanyCalendarGrid) {
      window.renderCompanyCalendarGrid(year, month, filtered);
      const monthHolidays = filtered.filter(h => h.holiday_date.startsWith(`${year}-${String(month+1).padStart(2,'0')}`));
      window.renderCompanySummarySidebar(monthHolidays);
    }
  }

  if (currentView === 'grid') {
    renderGrid(filtered);
  } else {
    renderTable(filtered);
  }
}

// 🎴 แสดงผลแบบ Card Grid
function renderGrid(list) {
  const container = document.getElementById('holidayGridContainer');
  if (!container) return;

  const strings = getLangStrings();

  // ไม่มีข้อมูล
  if (!list || list.length === 0) {
    container.innerHTML = `
      <div class="loading-state-box" style="grid-column: 1 / -1;">
        <span class="material-symbols-outlined" style="font-size:42px; color:#94a3b8;">
          event_busy
        </span>
        <p style="color:#64748b; margin-top:10px;">
          ${strings.emptyHolidays}
        </p>
      </div>
    `;
    return;
  }

  // วันนี้
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // ตรวจสอบสิทธิ์ HR / Admin
  const isPowerUser = currentUserProfile
    ? ['admin', 'hr'].includes(
        currentUserProfile.role
          ? currentUserProfile.role.toLowerCase()
          : ''
      )
    : false;

  const searchInput = document.getElementById('holidaySearchInput');
  const searchTxt = searchInput ? searchInput.value.trim() : '';

  const highlightMatch = (text, term) => {
    if (!term || !text) return text || "-";
    const cleanText = String(text);
    const idx = cleanText.toLowerCase().indexOf(term.toLowerCase());
    if (idx === -1) return cleanText;
    const before = cleanText.slice(0, idx);
    const matched = cleanText.slice(idx, idx + term.length);
    const after = cleanText.slice(idx + term.length);
    return `${before}<mark class="text-highlight">${matched}</mark>${after}`;
  };

  container.innerHTML = list.map(item => {
    const hDate = parseLocalDate(item.holiday_date);
    const dayNumber = hDate.getDate();
    const monthShort = strings.monthsShort[hDate.getMonth()];
    const dayName = strings.days[hDate.getDay()];

    const holidayDateOnly = new Date(hDate);
    holidayDateOnly.setHours(0, 0, 0, 0);

    const diffTime = holidayDateOnly.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const isPast = holidayDateOnly < today;
    const isToday = diffDays === 0;

    let tagClass = 'official';
    let tagText = strings.tagOfficial;

    if (item.holiday_type === 'company') {
      tagClass = 'company';
      tagText = strings.tagCompany;
    } else if (item.holiday_type === 'substitution') {
      tagClass = 'substitution';
      tagText = strings.tagSubstitution;
    }

    let daysText = '';
    if (isToday) {
      daysText = strings.statusToday;
    } else if (isPast) {
      daysText = strings.statusPast;
    } else if (diffDays === 1) {
      daysText = strings.statusTomorrow;
    } else {
      daysText = strings.daysLeftText(diffDays);
    }

    const locHolidayName = getLocalizedHolidayName(item.holiday_name);
    const locHolidayDesc = getLocalizedHolidayDesc(item.description);

    const displayHolidayName = highlightMatch(locHolidayName || item.holiday_name || '-', searchTxt);
    const displayHolidayDesc = highlightMatch(locHolidayDesc || item.description || '-', searchTxt);

    const actionButtons = isPowerUser
      ? `
        <div class="card-action-btns">
          <button
            type="button"
            class="btn-icon-action"
            onclick="openEditHolidayModal('${item.id}')"
            title="${strings.btnEditHoliday}"
          >
            <span class="material-symbols-outlined">edit</span>
          </button>

          <button
            type="button"
            class="btn-icon-action"
            onclick="deleteHoliday('${item.id}')"
            title="${strings.btnDeleteHoliday}"
          >
            <span class="material-symbols-outlined">delete</span>
          </button>
        </div>
      `
      : '';

    return `
      <div class="holiday-card ${isPast ? 'past-holiday' : ''}">
        <div class="card-top">
          <div class="date-badge-box">
            <span class="date-badge-day">${dayNumber}</span>
            <span class="date-badge-month">${monthShort}</span>
          </div>
          <span class="tag-badge ${tagClass}">
            ${tagText}
          </span>
        </div>

        <div class="card-body-content">
          <div class="day-name">${dayName}</div>
          <h3>${displayHolidayName}</h3>
          <p class="description-text">${displayHolidayDesc}</p>
        </div>

        <div class="card-footer-action">
          <span class="days-left-text">${daysText}</span>
          ${actionButtons}
        </div>
      </div>
    `;
  }).join('');
}

// 📋 แสดงผลแบบ Table
function renderTable(list) {
  const tbody = document.getElementById('holidayTableBody');
  if (!tbody) return;

  const strings = getLangStrings();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="table-empty-state">${strings.emptyHolidays}</td></tr>`;
    return;
  }

  const isPowerUser = currentUserProfile ? ['admin', 'hr'].includes(currentUserProfile.role ? currentUserProfile.role.toLowerCase() : '') : false;

  const searchInput = document.getElementById('holidaySearchInput');
  const searchTxt = searchInput ? searchInput.value.trim() : '';

  const highlightMatch = (text, term) => {
    if (!term || !text) return text || "-";
    const cleanText = String(text);
    const idx = cleanText.toLowerCase().indexOf(term.toLowerCase());
    if (idx === -1) return cleanText;
    const before = cleanText.slice(0, idx);
    const matched = cleanText.slice(idx, idx + term.length);
    const after = cleanText.slice(idx + term.length);
    return `${before}<mark class="text-highlight">${matched}</mark>${after}`;
  };

  tbody.innerHTML = list.map((item, index) => {
    const hDate = parseLocalDate(item.holiday_date);
    const dayName = strings.days[hDate.getDay()];
    const isPast = hDate < today;

    let tagText = item.holiday_type === 'company' ? strings.tagCompany : (item.holiday_type === 'substitution' ? strings.tagSubstitution : strings.tagOfficial);
    const locHolidayName = getLocalizedHolidayName(item.holiday_name);
    const locHolidayDesc = getLocalizedHolidayDesc(item.description);

    const displayHolidayName = highlightMatch(locHolidayName || item.holiday_name, searchTxt);
    const displayHolidayDesc = highlightMatch(locHolidayDesc || item.description || '-', searchTxt);

    return `
      <tr style="${isPast ? 'opacity: 0.6; background: #f8fafc;' : ''}">
        <td style="text-align: center;">${index + 1}</td>
        <td><strong>${formatLocalDateShort(item.holiday_date)}</strong></td>
        <td>${dayName}</td>
        <td><strong>${displayHolidayName}</strong></td>
        <td>${tagText}</td>
        <td>${isPast ? strings.statusPast : strings.statusUpcoming}</td>
        <td>${displayHolidayDesc}</td>
        <td style="text-align: center;">
          ${isPowerUser ? `
            <div class="table-action-btns">
              <button type="button" class="btn-table-edit" onclick="openEditHolidayModal('${item.id}')">${strings.edit}</button>
              <button type="button" class="btn-table-delete" onclick="deleteHoliday('${item.id}')">${strings.delete}</button>
            </div>
          ` : '-'}
        </td>
      </tr>`;
  }).join('');
}

// 👁️ สลับมุมมอง (Card Grid / Table)
function switchView(view) {
  currentView = view;
  const btnGrid = document.getElementById('btnViewGrid');
  const btnTable = document.getElementById('btnViewTable');
  const gridContainer = document.getElementById('holidayGridContainer');
  const tableContainer = document.getElementById('holidayTableContainer');

  if (btnGrid) btnGrid.classList.toggle('active', view === 'grid');
  if (btnTable) btnTable.classList.toggle('active', view === 'table');
  if (gridContainer) gridContainer.style.display = view === 'grid' ? 'grid' : 'none';
  if (tableContainer) tableContainer.style.display = view === 'table' ? 'block' : 'none';

  filterHolidays();
}

function changeYearOrMonth() {
  const yearSelect = document.getElementById('yearSelect');
  const monthSelect = document.getElementById('monthSelect');
  const year = yearSelect ? parseInt(yearSelect.value, 10) : new Date().getFullYear();
  const monthVal = monthSelect ? monthSelect.value : 'all';
  
  if (window.companyCalCurrentDate) {
    companyCalCurrentDate.setFullYear(year);
    if (monthVal !== 'all') {
      const m = parseInt(monthVal, 10);
      if (!isNaN(m)) {
        companyCalCurrentDate.setMonth(m);
      }
    }
  }
  fetchHolidays();
}

window.showYearlySummary = function() {
  const monthSelect = document.getElementById('monthSelect');
  if (monthSelect) monthSelect.value = 'all';
  filterHolidays();
};

// 🪟 MODAL MANAGEMENT
function openHolidayModal() {
  const role = currentUserProfile?.role ? currentUserProfile.role.toLowerCase() : '';
  const isPowerUser = ['admin', 'hr'].includes(role);

  if (!isPowerUser) {
    Swal.fire({
      icon: 'error',
      title: 'ไม่มีสิทธิ์เข้าถึง',
      text: 'เฉพาะ HR และ Admin เท่านั้นที่สามารถเพิ่มวันหยุดได้'
    });
    return;
  }

  const overlay = document.getElementById('holidayModalOverlay');
  const form = document.getElementById('holidayForm');
  const titleText = document.getElementById('modalTitleText');
  const holidayIdInput = document.getElementById('holidayId');

  if (form) form.reset();
  if (holidayIdInput) holidayIdInput.value = '';
  if (titleText) titleText.innerText = 'เพิ่มวันหยุดใหม่';
  if (overlay) overlay.style.display = 'flex';
}

function openEditHolidayModal(id) {
  const item = holidaysData.find(h => h.id.toString() === id.toString());
  if (!item) return;

  const overlay = document.getElementById('holidayModalOverlay');
  const titleText = document.getElementById('modalTitleText');
  
  document.getElementById('holidayId').value = item.id;
  document.getElementById('holidayDate').value = item.holiday_date;
  document.getElementById('holidayName').value = item.holiday_name;
  document.getElementById('holidayCategory').value = item.holiday_type || 'official';
  document.getElementById('holidayDescription').value = item.description || '';

  if (titleText) titleText.innerText = 'แก้ไขข้อมูลวันหยุด';
  if (overlay) overlay.style.display = 'flex';
}

function closeHolidayModal() {
  const overlay = document.getElementById('holidayModalOverlay');
  if (overlay) overlay.style.display = 'none';
}

async function handleSaveHoliday(event) {
  event.preventDefault();

  const id = document.getElementById('holidayId').value;
  const holidayDate = document.getElementById('holidayDate').value;
  const holidayName = document.getElementById('holidayName').value.trim();
  const holidayType = document.getElementById('holidayCategory').value;
  const description = document.getElementById('holidayDescription').value.trim();

  const supabase = window.pvtSupabase ? window.pvtSupabase.getClient() : null;

  try {
    if (supabase) {
      const payload = {
        holiday_name: holidayName,
        holiday_date: holidayDate,
        holiday_type: holidayType,
        description: description
      };

      if (id && !id.startsWith('def-') && !id.startsWith('local-')) {
        await supabase.from('holidays').update(payload).eq('id', id);
      } else {
        await supabase.from('holidays').insert([payload]);
      }
    }

    Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ!', timer: 1500, showConfirmButton: false });
    closeHolidayModal();
    await fetchHolidays();
  } catch (err) {
    Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: err.message });
  }
}

async function deleteHoliday(id) {
  const res = await Swal.fire({
    title: 'ยืนยันการลบ?',
    text: 'คุณต้องการลบรายการวันหยุดนี้ใช่หรือไม่',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    confirmButtonText: 'ลบรายการ',
    cancelButtonText: 'ยกเลิก'
  });

  if (res.isConfirmed) {
    try {
      const supabase = window.pvtSupabase ? window.pvtSupabase.getClient() : null;
      if (supabase && !id.startsWith('def-') && !id.startsWith('local-')) {
        const { error } = await supabase.from('holidays').delete().eq('id', id);
        if (error) throw error;
      } else {
        holidaysData = holidaysData.filter(h => h.id !== id);
      }

      Swal.fire({ icon: 'success', title: 'ลบข้อมูลเรียบร้อยแล้ว', timer: 1200, showConfirmButton: false });
      await fetchHolidays();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: err.message });
    }
  }
}

// 🗓️ DATE FORMATTING UTILITIES (Localized)
function formatLocalDateShort(dateStr) {
  if (!dateStr) return '-';
  const strings = getLangStrings();
  const d = parseLocalDate(dateStr);
  return `${d.getDate()} ${strings.monthsShort[d.getMonth()]} ${strings.formatYear(d.getFullYear())}`;
}

function formatLocalDateFull(dateStr) {
  if (!dateStr) return '-';
  const strings = getLangStrings();
  const d = parseLocalDate(dateStr);
  const lang = getActiveLang();
  if (lang === 'th') {
    return `วัน${strings.days[d.getDay()]}ที่ ${d.getDate()} ${strings.monthsFull[d.getMonth()]} พ.ศ. ${d.getFullYear() + 543}`;
  } else if (lang === 'lo') {
    return `${strings.days[d.getDay()]} ວັນທີ ${d.getDate()} ${strings.monthsFull[d.getMonth()]} ${d.getFullYear()}`;
  } else {
    return `${d.getFullYear()} ${strings.monthsFull[d.getMonth()]} ${d.getDate()} ရက် (${strings.days[d.getDay()]})`;
  }
}

// Retain backwards compatibility aliases
function formatThaiDateShort(dateStr) { return formatLocalDateShort(dateStr); }
function formatThaiDateFull(dateStr) { return formatLocalDateFull(dateStr); }

// 🔔 NOTIFICATION & NAVIGATION
function initNotificationBell() {
  const notifBtn = document.getElementById('notifBellBtn');
  const notifDropdown = document.getElementById('notifDropdown');
  if (notifBtn && notifDropdown) {
    notifBtn.addEventListener('click', (e) => { 
      e.stopPropagation(); 
      notifDropdown.classList.toggle('show'); 
    });
    document.addEventListener('click', (e) => {
      if (!notifDropdown.contains(e.target) && !notifBtn.contains(e.target)) {
        notifDropdown.classList.remove('show');
      }
    });
  }
}

function smartGoBack(defaultUrl = '/pages/user/index-user.html') {
  if (document.referrer && document.referrer.includes(window.location.host)) {
    history.back();
  } else {
    window.location.href = defaultUrl;
  }
}

// 🌐 Global Window Function Bindings for Holidays Page
window.openAddHolidayModal = typeof openAddHolidayModal !== 'undefined' ? openAddHolidayModal : window.openAddHolidayModal;
window.openEditHolidayModal = typeof openEditHolidayModal !== 'undefined' ? openEditHolidayModal : window.openEditHolidayModal;
window.deleteHoliday = typeof deleteHoliday !== 'undefined' ? deleteHoliday : window.deleteHoliday;
window.closeHolidayModal = typeof closeHolidayModal !== 'undefined' ? closeHolidayModal : window.closeHolidayModal;
window.handleSaveHoliday = typeof handleSaveHoliday !== 'undefined' ? handleSaveHoliday : window.handleSaveHoliday;

// ==========================================
// 👥 TEAM LEAVES TAB LOGIC
// ==========================================
let teamLeavesData = [];
let teamCalCurrentDate = new Date();

window.switchHolidayTab = function(tab) {
  const companyTab = document.getElementById('tabCompanyHolidays');
  const teamTab = document.getElementById('tabTeamLeaves');
  const companyWrapper = document.getElementById('companyHolidaysWrapper');
  const teamWrapper = document.getElementById('teamLeavesWrapper');

  if (tab === 'company') {
    companyTab.classList.add('active');
    teamTab.classList.remove('active');
    companyTab.style.borderBottomColor = 'var(--primary, #0fa472)';
    companyTab.style.color = 'var(--primary, #0fa472)';
    teamTab.style.borderBottomColor = 'transparent';
    teamTab.style.color = '#64748b';
    companyWrapper.style.display = 'block';
    teamWrapper.style.display = 'none';
  } else {
    teamTab.classList.add('active');
    companyTab.classList.remove('active');
    teamTab.style.borderBottomColor = 'var(--primary, #0fa472)';
    teamTab.style.color = 'var(--primary, #0fa472)';
    companyTab.style.borderBottomColor = 'transparent';
    companyTab.style.color = '#64748b';
    companyWrapper.style.display = 'none';
    teamWrapper.style.display = 'block';
    
    // Set to current month initially
    teamCalCurrentDate = new Date();
    loadTeamLeavesForCalendar();
  }
};

window.teamCalPrevMonth = function() {
  teamCalCurrentDate.setMonth(teamCalCurrentDate.getMonth() - 1);
  loadTeamLeavesForCalendar();
};

window.teamCalNextMonth = function() {
  teamCalCurrentDate.setMonth(teamCalCurrentDate.getMonth() + 1);
  loadTeamLeavesForCalendar();
};

window.toggleTeamSidebar = function() {
  const sidebar = document.getElementById('teamSummarySidebar');
  const icon = document.getElementById('teamSidebarIcon');
  
  if (window.innerWidth <= 1024) {
    if (sidebar.classList.contains('mobile-open')) {
      sidebar.classList.remove('mobile-open');
      icon.innerText = 'chevron_left';
    } else {
      sidebar.classList.add('mobile-open');
      icon.innerText = 'chevron_right';
    }
  } else {
    if (sidebar.classList.contains('collapsed')) {
      sidebar.classList.remove('collapsed');
      icon.innerText = 'chevron_right';
    } else {
      sidebar.classList.add('collapsed');
      icon.innerText = 'chevron_left';
    }
  }
};

window.addEventListener('resize', () => {
  const sidebar = document.getElementById('teamSummarySidebar');
  const icon = document.getElementById('teamSidebarIcon');
  if (!sidebar || !icon) return;
  if (window.innerWidth > 1024) {
    sidebar.classList.remove('mobile-open');
    if (!sidebar.classList.contains('collapsed')) {
      icon.innerText = 'chevron_right';
    } else {
      icon.innerText = 'chevron_left';
    }
  } else {
    sidebar.classList.remove('collapsed');
    if (!sidebar.classList.contains('mobile-open')) {
      icon.innerText = 'chevron_left';
    } else {
      icon.innerText = 'chevron_right';
    }
  }
});

window.loadTeamLeavesForCalendar = async function() {
  const grid = document.getElementById('teamCalGrid');
  const listContainer = document.getElementById('teamLeavesList');
  if (!currentUserProfile || !grid || !listContainer) return;
  
  const strings = getLangStrings();
  const month = teamCalCurrentDate.getMonth();
  const year = teamCalCurrentDate.getFullYear();
  document.getElementById('teamCalMonthYear').innerText = `${strings.monthsFull[month]} ${strings.formatYear(year)}`;
  
  grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #64748b;"><span class="material-symbols-outlined spinning-icon" style="font-size: 32px;">sync</span></div>`;
  listContainer.innerHTML = `<div class="loading-state-box" style="text-align: center; padding: 40px; color: #64748b;"><span class="material-symbols-outlined spinning-icon" style="font-size: 24px;">sync</span></div>`;

  try {
    const supabase = window.pvtSupabase ? window.pvtSupabase.getClient() : null;
    if (!supabase) return;
    
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];
    
    let query = supabase
      .from('leave_requests')
      .select(`
        id, start_date, end_date, leave_type_id, total_days, reason, status,
        employees!inner (id, full_name, role, department_id, departments!department_id (department_name)),
        leave_types (leave_name)
      `)
      .in('status', ['approved', 'pending'])
      .lte('start_date', endStr)
      .gte('end_date', startStr);
      
    const role = currentUserProfile.role.toLowerCase();
    const isExecutiveOrHr = ['hr', 'admin', 'executive', 'director', 'owner'].includes(role);
    
    if (!isExecutiveOrHr) {
       const deptId = currentUserProfile.department_id;
       if (deptId) query = query.eq('employees.department_id', deptId);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    
    teamLeavesData = data || [];
    renderTeamCalendarGrid(year, month, teamLeavesData);
    renderTeamLeavesSidebar(teamLeavesData);
  } catch (err) {
    console.error('Error loading team leaves:', err);
    grid.innerHTML = `<div style="grid-column: 1 / -1; padding: 20px; color: #ef4444; text-align: center; background: #fee2e2; border-radius: 8px;">ไม่สามารถโหลดข้อมูลได้</div>`;
  }
};

window.renderTeamCalendarGrid = function(year, month, leaves) {
  const grid = document.getElementById('teamCalGrid');
  if (!grid) return;
  grid.innerHTML = '';
  
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  
  const today = new Date();
  const isCurrentMonth = (today.getFullYear() === year && today.getMonth() === month);
  const todayDate = today.getDate();
  
  for (let i = startOffset - 1; i >= 0; i--) {
    const dayNum = daysInPrevMonth - i;
    const cell = document.createElement('div');
    cell.className = 'cal-day-cell other-month';
    cell.innerHTML = `<span class="cal-day-number">${dayNum}</span>`;
    grid.appendChild(cell);
  }
  
  for (let i = 1; i <= daysInMonth; i++) {
    const cell = document.createElement('div');
    cell.className = 'cal-day-cell';
    if (isCurrentMonth && i === todayDate) cell.classList.add('today');
    
    const dayStr = `${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
    const dayLeaves = leaves.filter(l => {
      return l.start_date <= dayStr && l.end_date >= dayStr;
    });
    
    let dotsHtml = '';
    if (dayLeaves.length > 0) {
      dotsHtml = `<div class="cal-leave-dots">`;
      for(let j=0; j<Math.min(dayLeaves.length, 3); j++) {
        const bg = dayLeaves[j].status === 'approved' ? '#0fa472' : '#f59e0b';
        dotsHtml += `<div class="cal-leave-dot" style="background:${bg};" title="${dayLeaves[j].employees?.full_name}"></div>`;
      }
      if(dayLeaves.length > 3) {
         dotsHtml += `<span style="font-size: 10px; color: #64748b; line-height: 8px;">+${dayLeaves.length - 3}</span>`;
      }
      dotsHtml += `</div>`;
    }
    
    cell.innerHTML = `<span class="cal-day-number">${i}</span>${dotsHtml}`;
    cell.onclick = () => {
      document.querySelectorAll('#teamCalGrid .cal-day-cell').forEach(c => c.style.outline = 'none');
      cell.style.outline = '2px solid #0fa472';
      cell.style.outlineOffset = '-2px';
      
      const teamSearchInput = document.getElementById('teamSearchInput');
      if (teamSearchInput) teamSearchInput.value = '';
      if(dayLeaves.length > 0) {
        renderTeamLeavesSidebar(dayLeaves, dayStr);
      } else {
        renderTeamLeavesSidebar([], dayStr);
      }
    };
    grid.appendChild(cell);
  }
  
  const totalCells = startOffset + daysInMonth;
  const remainingCells = (Math.ceil(totalCells / 7) * 7) - totalCells;
  for (let i = 1; i <= remainingCells; i++) {
    const cell = document.createElement('div');
    cell.className = 'cal-day-cell other-month';
    cell.innerHTML = `<span class="cal-day-number">${i}</span>`;
    grid.appendChild(cell);
  }
};

window.filterTeamLeaves = function() {
  const keyword = (document.getElementById('teamSearchInput')?.value || '').toLowerCase();
  if (!keyword) {
    renderTeamLeavesSidebar(teamLeavesData);
    return;
  }
  
  const filtered = teamLeavesData.filter(leave => {
    const empName = (leave.employees?.full_name || '').toLowerCase();
    const reason = (leave.reason || '').toLowerCase();
    return empName.includes(keyword) || reason.includes(keyword);
  });
  renderTeamLeavesSidebar(filtered);
};

window.renderTeamLeavesSidebar = function(data, specificDay = null) {
  const container = document.getElementById('teamLeavesList');
  const title = document.getElementById('teamSummaryTitle');
  if (!container) return;

  const strings = getLangStrings();

  if (title) {
    if (specificDay) {
      title.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
          <span style="font-size: 15px;">${strings.teamDayTitle(parseInt(specificDay.split('-')[2], 10))}</span>
          <button type="button" onclick="renderTeamLeavesSidebar(teamLeavesData)" style="background: #f1f5f9; border: none; cursor: pointer; padding: 4px 8px; border-radius: 4px; font-size: 12px; color: #475569; display: flex; align-items: center; gap: 4px;">
            <span class="material-symbols-outlined" style="font-size: 14px;">calendar_month</span> ${strings.btnViewWholeMonth}
          </button>
        </div>`;
    } else {
      const currentM = teamCalCurrentDate.getMonth();
      const currentY = strings.formatYear(teamCalCurrentDate.getFullYear());
      title.innerText = strings.teamMonthlyTitle(strings.monthsFull[currentM], currentY);
      document.querySelectorAll('#teamCalGrid .cal-day-cell').forEach(c => c.style.outline = 'none');
    }
  }

  if (!data || data.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: #94a3b8;">
        <span class="material-symbols-outlined" style="font-size: 32px; margin-bottom: 12px; opacity: 0.5;">search_off</span>
        <p style="margin: 0; font-size: 13px;">${strings.noTeamLeaves}</p>
      </div>`;
    return;
  }
  
  let html = ``;
  
  data.forEach(leave => {
    const empName = leave.employees?.full_name || '-';
    const rawLeaveName = leave.leave_types?.leave_name || 'Leave';
    const leaveName = typeof window.localizeCategory === 'function' ? window.localizeCategory(rawLeaveName) : rawLeaveName;
    const startDate = formatLocalDateShort(leave.start_date);
    const endDate = formatLocalDateShort(leave.end_date);
    const dateDisplay = (leave.start_date === leave.end_date) ? startDate : `${startDate} - ${endDate}`;
    const statusBg = leave.status === 'approved' ? '#dcfce7' : '#fef08a';
    const statusColor = leave.status === 'approved' ? '#166534' : '#854d0e';
    const statusText = leave.status === 'approved' ? strings.approved : strings.pending;
    
    html += `
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <h4 style="margin: 0; font-size: 14px; color: #0f172a; line-height: 1.4;">${empName}</h4>
          <span class="status-badge" data-raw-status="${leave.status}" style="background: ${statusBg}; color: ${statusColor}; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; white-space: nowrap; margin-left: 8px;">${statusText}</span>
        </div>
        <div style="font-size: 12px; color: #64748b; display: flex; flex-direction: column; gap: 4px;">
          <span style="display: flex; align-items: center; gap: 4px;"><span class="material-symbols-outlined" style="font-size: 14px;">event</span>${dateDisplay} (${leave.total_days} ${strings.daysUnit})</span>
          <span style="display: flex; align-items: center; gap: 4px;"><span class="material-symbols-outlined" style="font-size: 14px;">category</span><span class="leave-type-title" data-raw-cat="${rawLeaveName}">${leaveName}</span></span>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
};

window.smartGoBack = smartGoBack;
window.changeYear = typeof changeYear !== 'undefined' ? changeYear : window.changeYear;

// ----------------------------------------------------
// 🏢 COMPANY HOLIDAY CALENDAR LOGIC
// ----------------------------------------------------
let companyCalCurrentDate = new Date();

window.companyCalPrevMonth = function() {
  const oldYear = companyCalCurrentDate.getFullYear();
  companyCalCurrentDate.setMonth(companyCalCurrentDate.getMonth() - 1);
  const newYear = companyCalCurrentDate.getFullYear();

  const monthSelect = document.getElementById('monthSelect');
  if (monthSelect) {
    monthSelect.value = companyCalCurrentDate.getMonth().toString();
  }
  const yearSelect = document.getElementById('yearSelect');
  if (yearSelect) {
    yearSelect.value = newYear.toString();
  }

  if (oldYear !== newYear) {
    fetchHolidays();
  } else {
    filterHolidays();
  }
};

window.companyCalNextMonth = function() {
  const oldYear = companyCalCurrentDate.getFullYear();
  companyCalCurrentDate.setMonth(companyCalCurrentDate.getMonth() + 1);
  const newYear = companyCalCurrentDate.getFullYear();

  const monthSelect = document.getElementById('monthSelect');
  if (monthSelect) {
    monthSelect.value = companyCalCurrentDate.getMonth().toString();
  }
  const yearSelect = document.getElementById('yearSelect');
  if (yearSelect) {
    yearSelect.value = newYear.toString();
  }

  if (oldYear !== newYear) {
    fetchHolidays();
  } else {
    filterHolidays();
  }
};

window.toggleCompanySidebar = function() {
  const sidebar = document.getElementById('companySummarySidebar');
  const icon = document.getElementById('companySidebarIcon');
  if (!sidebar || !icon) return;
  if (window.innerWidth <= 1024) {
    sidebar.classList.toggle('mobile-open');
    icon.innerText = sidebar.classList.contains('mobile-open') ? 'chevron_right' : 'chevron_left';
  } else {
    sidebar.classList.toggle('collapsed');
    icon.innerText = sidebar.classList.contains('collapsed') ? 'chevron_left' : 'chevron_right';
  }
};

window.renderCompanyCalendarGrid = function(year, month, holidaysList) {
  const grid = document.getElementById('companyCalGrid');
  if (!grid) return;
  grid.innerHTML = '';
  
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay(); 
  const daysInMonth = lastDay.getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  
  const today = new Date();
  const isCurrentMonth = (today.getFullYear() === year && today.getMonth() === month);
  const todayDate = today.getDate();
  
  for (let i = startOffset - 1; i >= 0; i--) {
    const dayNum = daysInPrevMonth - i;
    const cell = document.createElement('div');
    cell.className = 'cal-day-cell other-month';
    cell.innerHTML = `<span class="cal-day-number">${dayNum}</span>`;
    grid.appendChild(cell);
  }
  
  for (let i = 1; i <= daysInMonth; i++) {
    const cell = document.createElement('div');
    cell.className = 'cal-day-cell';
    if (isCurrentMonth && i === todayDate) cell.classList.add('today');
    
    const dayStr = `${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
    const dayHolidays = holidaysList.filter(h => h.holiday_date === dayStr);
    
    let dotsHtml = '';
    if (dayHolidays.length > 0) {
      dotsHtml = `<div class="cal-leave-dots">`;
      for(let j=0; j<Math.min(dayHolidays.length, 3); j++) {
        let bg = '#3b82f6';
        if(dayHolidays[j].holiday_type === 'official') bg = '#ef4444';
        if(dayHolidays[j].holiday_type === 'substitution') bg = '#f59e0b';
        const locName = getLocalizedHolidayName(dayHolidays[j].holiday_name);
        dotsHtml += `<div class="cal-leave-dot" style="background:${bg};" title="${locName}"></div>`;
      }
      dotsHtml += `</div>`;
      cell.style.background = '#f0f9ff';
      cell.style.borderColor = '#bae6fd';
    }
    
    cell.innerHTML = `<span class="cal-day-number">${i}</span>${dotsHtml}`;
    cell.onclick = () => {
      document.querySelectorAll('#companyCalGrid .cal-day-cell').forEach(c => c.style.outline = 'none');
      cell.style.outline = '2px solid #0ea5e9';
      cell.style.outlineOffset = '-2px';
      
      if(dayHolidays.length > 0) {
        renderCompanySummarySidebar(dayHolidays, dayStr);
      } else {
        renderCompanySummarySidebar([], dayStr);
      }
    };
    grid.appendChild(cell);
  }
  
  const totalCells = startOffset + daysInMonth;
  const remainingCells = (Math.ceil(totalCells / 7) * 7) - totalCells;
  for (let i = 1; i <= remainingCells; i++) {
    const cell = document.createElement('div');
    cell.className = 'cal-day-cell other-month';
    cell.innerHTML = `<span class="cal-day-number">${i}</span>`;
    grid.appendChild(cell);
  }
};

window.renderCompanySummarySidebar = function(list, specificDay = null, isYearly = false) {
  const container = document.getElementById('companySummaryList');
  const title = document.getElementById('companySummaryTitle');
  if (!container || !title) return;
  
  const strings = getLangStrings();
  const monthSelect = document.getElementById('monthSelect');
  const selectedMonthVal = monthSelect ? monthSelect.value : 'all';

  if (specificDay) {
    title.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
        <span style="font-size: 14px; font-weight: 600;">${strings.summaryDayTitle(parseInt(specificDay.split('-')[2], 10))}</span>
        <button type="button" onclick="filterHolidays()" style="background: #f1f5f9; border: none; cursor: pointer; padding: 4px 8px; border-radius: 4px; font-size: 12px; color: #475569; display: flex; align-items: center; gap: 4px;">
          <span class="material-symbols-outlined" style="font-size: 14px;">calendar_month</span> ${strings.btnBack}
        </button>
      </div>`;
  } else if (isYearly || selectedMonthVal === 'all') {
    const currentY = strings.formatYear(companyCalCurrentDate.getFullYear());
    title.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
        <span style="font-size: 15px; font-weight: 700; color: #0f172a;">${strings.summaryYearTitle(currentY)}</span>
        <span style="font-size: 11px; background: #e0f2fe; color: #0284c7; padding: 2px 8px; border-radius: 12px; font-weight: 600;">${strings.totalDaysLabel(list ? list.length : 0)}</span>
      </div>`;
    document.querySelectorAll('#companyCalGrid .cal-day-cell').forEach(c => c.style.outline = 'none');
  } else {
    const currentM = companyCalCurrentDate.getMonth();
    const currentY = strings.formatYear(companyCalCurrentDate.getFullYear());
    title.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
        <span style="font-size: 14px; font-weight: 600; color: #0f172a;">${strings.summaryMonthTitle(strings.monthsFull[currentM], currentY)}</span>
        <button type="button" onclick="showYearlySummary()" style="background: #f1f5f9; border: none; cursor: pointer; padding: 4px 8px; border-radius: 4px; font-size: 11px; color: #0284c7; font-weight: 500; display: flex; align-items: center; gap: 3px;" title="ดูสรุปวันหยุดตลอดทั้งปี">
          <span class="material-symbols-outlined" style="font-size: 13px;">calendar_today</span> ${strings.btnViewWholeYear}
        </button>
      </div>`;
    document.querySelectorAll('#companyCalGrid .cal-day-cell').forEach(c => c.style.outline = 'none');
  }
  
  if (!list || list.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: #94a3b8;">
        <span class="material-symbols-outlined" style="font-size: 32px; margin-bottom: 12px; opacity: 0.5;">event_busy</span>
        <p style="margin: 0; font-size: 13px;">${strings.noHolidaysSection}</p>
      </div>`;
    return;
  }
  
  const isPowerUser = currentUserProfile ? ['admin', 'hr'].includes(currentUserProfile.role ? currentUserProfile.role.toLowerCase() : '') : false;
  
  let html = ``;
  list.forEach(item => {
    let tagText = item.holiday_type === 'company' ? strings.tagCompany : (item.holiday_type === 'substitution' ? strings.tagSubstitution : strings.tagOfficial);
    let color = item.holiday_type === 'company' ? '#3b82f6' : (item.holiday_type === 'substitution' ? '#f59e0b' : '#ef4444');
    const locName = getLocalizedHolidayName(item.holiday_name);
    
    html += `
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-left: 3px solid ${color}; border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <h4 style="margin: 0; font-size: 14px; color: #0f172a; line-height: 1.4;">${locName}</h4>
        </div>
        <div style="font-size: 12px; color: #64748b; display: flex; flex-direction: column; gap: 4px;">
          <span style="display: flex; align-items: center; gap: 4px;"><span class="material-symbols-outlined" style="font-size: 14px; color: ${color}">event</span>${formatLocalDateShort(item.holiday_date)}</span>
          <span style="display: flex; align-items: center; gap: 4px;"><span class="material-symbols-outlined" style="font-size: 14px;">category</span>${tagText}</span>
        </div>
        ${isPowerUser ? `
        <div style="margin-top: 8px; display: flex; gap: 8px; justify-content: flex-end;">
          <button type="button" onclick="openEditHolidayModal('${item.id}')" style="background: none; border: none; cursor: pointer; color: #3b82f6; display: flex; align-items: center; justify-content: center; padding: 4px; border-radius: 4px;"><span class="material-symbols-outlined" style="font-size: 16px;">edit</span></button>
          <button type="button" onclick="deleteHoliday('${item.id}')" style="background: none; border: none; cursor: pointer; color: #ef4444; display: flex; align-items: center; justify-content: center; padding: 4px; border-radius: 4px;"><span class="material-symbols-outlined" style="font-size: 16px;">delete</span></button>
        </div>` : ''}
      </div>
    `;
  });
  
  container.innerHTML = html;
};

// 🌐 Multi-language event listener
window.addEventListener("pvt-lang-changed", () => {
  updateStatsAndHero();
  filterHolidays();
  
  const teamWrapper = document.getElementById('teamLeavesWrapper');
  if (teamWrapper && teamWrapper.style.display !== 'none' && typeof window.loadTeamLeavesForCalendar === "function") {
    window.loadTeamLeavesForCalendar();
  }
});
