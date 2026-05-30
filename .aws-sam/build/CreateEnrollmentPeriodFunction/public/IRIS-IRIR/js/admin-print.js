// ══════════════════════════════════════
// Print / Document Generation
// ══════════════════════════════════════

// ── PRINT DOCUMENTS ──
const _LOGO_URL = 'UM2_Logo.svg';
const _SEAL_URL = 'https://raw.githubusercontent.com/um2iucoffice/um2portal/6228ca9fd495583be236615d5b2e2fdac409865f/public/iucseal.svg';

function _getStaffForPrint() {
  const name     = document.getElementById('sp-realname')?.value.trim()   || document.getElementById('sp-nickname')?.value.trim() || '—';
  const nickname = document.getElementById('sp-nickname')?.value.trim()   || '—';
  const dept     = document.getElementById('sp-department')?.value        || '—';
  const title    = document.getElementById('sp-title')?.value             || '—';
  const quals    = document.getElementById('sp-qualifications')?.value.trim() || '';
  const capacity = document.getElementById('sp-capacity')?.value.trim()   || '';
  const bio      = document.getElementById('sp-bio')?.value.trim()        || '';
  const staffId  = (typeof currentUser !== 'undefined' && currentUser?.staff_id) ? currentUser.staff_id : '—';
  const rawDate  = document.getElementById('sp-startdate')?.value;
  const startDate = rawDate ? new Date(rawDate).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' }) : '—';
  const guestLecturer = document.getElementById('sp-guestLecturer')?.checked ? 'Yes' : 'No';
  return { name, nickname, dept, title, quals, capacity, bio, staffId, startDate, guestLecturer };
}


/* ══════════════════════════════════════════════════════════
   DOCUMENT OFFICE — full feature set
   ══════════════════════════════════════════════════════════ */

/* ── Title → allowed doc types ── */
/* COS, GSC, FIR are system-generated and available to ALL staff.
   STM, LTR, DIR are also available to staff but the department dropdown is
   locked to their own department and no VC letterhead override is allowed.
   Only the Registrar can freely select any department or use the VC letterhead. */
const _TITLE_ACCESS = {
  'head':                ['COS','GSC','FIR'],
  'coordinator':         ['COS','GSC','FIR'],
  'guest lecturer':      ['COS','GSC','FIR'],
  'lecturer':            ['COS','GSC','FIR'],
  'tutor':               ['COS','GSC','FIR'],
  'demonstrator':        ['COS','GSC','FIR'],
  'professor':           ['COS','GSC','FIR'],
  'associate professor': ['COS','GSC','FIR'],
  'administrative':      ['COS','GSC','FIR'],
};

/* ── Titles that can sign as Individual OR Department ── */
const _TITLE_DEPT_SIGN = ['head','coordinator'];

/* ── Get normalised title of current user ── */
function _getCurrentTitle() {
  return (document.getElementById('sp-title')?.value || '').trim().toLowerCase();
}

/* ── Role-based + title-based type filtering ── */
/* ── Render the role-access badge in the Document Office header ── */
function dofRenderRoleBadge() {
  const badge = document.getElementById('dof-role-badge');
  if (!badge) return;
  const role = (typeof currentRole !== 'undefined') ? currentRole : 'staff';
  if (role === 'registrar') {
    badge.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Registrar — Full Access`;
    badge.style.background   = 'var(--crimson-light)';
    badge.style.borderColor  = 'rgba(139,26,46,.25)';
    badge.style.color        = 'var(--crimson)';
  } else {
    /* Resolve department label */
    const rawFromSel = (document.getElementById('sp-department')?.value || '').trim().toLowerCase();
    const rawFromRo  = (document.getElementById('sp-dept-readonly')?.textContent || '').trim().toLowerCase();
    const staffDeptRaw  = rawFromSel || rawFromRo;
    const staffDeptCode = _DEPT_NAME_TO_CODE[staffDeptRaw]
      || staffDeptRaw.replace(/\s+/g,'').toUpperCase()
      || 'SEC';
    const deptLabel = DEPARTMENTS[staffDeptCode]?.en || staffDeptCode;
    badge.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Staff · ${deptLabel} — COS / GSC / FIR only`;
    badge.style.background  = 'var(--blue-light)';
    badge.style.borderColor = 'rgba(30,58,110,.2)';
    badge.style.color       = 'var(--blue)';
  }
}

function dofApplyRoleTypes() {
  const role    = (typeof currentRole !== 'undefined') ? currentRole : 'staff';
  const sel     = document.getElementById('dof-type');
  const deptSel = document.getElementById('dof-dept');
  const lhSel   = document.getElementById('dof-letterhead');
  const lhWrap  = document.getElementById('dof-lh-wrap');
  const deptWrap= deptSel ? deptSel.closest('.form-group') : null;
  if (!sel) return;

  /* Clean up any previously injected staff lock note */
  const prevNote = document.getElementById('dof-dept-staff-note');
  if (prevNote) prevNote.remove();

  /* ══════════════════════════════════════════════════════════════
     REGISTRAR
       STM / LTR / DIR — any department selectable, VC lh available
       COS / GSC / FIR — dept dropdown visible but irrelevant
                          (_letterHeadWithDept forces SEC for these)
     ══════════════════════════════════════════════════════════════ */
  if (role === 'registrar') {
    Array.from(sel.options).forEach(opt => { if (opt.value) opt.hidden = false; });
    if (deptSel) {
      Array.from(deptSel.options).forEach(opt => { opt.hidden = false; });
      deptSel.disabled         = false;
      deptSel.style.opacity    = '';
      deptSel.style.cursor     = '';
      deptSel.style.background = '';
      deptSel.title            = '';
      if (!deptSel.value) deptSel.value = 'SEC';
    }
    if (lhWrap) lhWrap.style.display = '';
    dofUpdateLhIndicator();
    if (typeof dofUpdateRef === 'function') dofUpdateRef();
    return;
  }

  /* ══════════════════════════════════════════════════════════════
     STAFF
       STM / LTR / DIR — visible, dept locked to own dept,
                          letterhead = own dept, no VC override
       COS / GSC / FIR — visible, dept dropdown locked + irrelevant
                          (_letterHeadWithDept forces SEC for these)
     ══════════════════════════════════════════════════════════════ */

  /* Resolve staff's own department code */
  const rawFromSel    = (document.getElementById('sp-department')?.value || '').trim().toLowerCase();
  const rawFromRo     = (document.getElementById('sp-dept-readonly')?.textContent || '').trim().toLowerCase();
  const staffDeptRaw  = rawFromSel || rawFromRo;
  const staffDeptCode = _DEPT_NAME_TO_CODE[staffDeptRaw]
    || staffDeptRaw.replace(/\s+/g, '').toUpperCase()
    || 'SEC';

  /* All 6 doc types visible for Staff */
  Array.from(sel.options).forEach(opt => { if (opt.value) opt.hidden = false; });

  /* Lock department to staff's own dept */
  if (deptSel) {
    Array.from(deptSel.options).forEach(opt => {
      opt.hidden = opt.value !== '' && opt.value !== staffDeptCode;
    });
    deptSel.value          = staffDeptCode;
    deptSel.disabled       = true;
    deptSel.style.opacity  = '1';
    deptSel.style.cursor   = 'not-allowed';
    deptSel.style.background = 'var(--surface)';
    deptSel.title          = 'Locked to your assigned department';
  }

  /* Inject lock note */
  if (deptWrap && !document.getElementById('dof-dept-staff-note')) {
    const note = document.createElement('div');
    note.id = 'dof-dept-staff-note';
    note.style.cssText = 'display:flex;align-items:center;gap:5px;margin-top:5px;font-size:11px;color:var(--ink3)';
    note.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg><span style="margin-left:4px">Locked to your assigned department</span>';
    deptWrap.appendChild(note);
  }

  /* No letterhead override for Staff — dept is auto, COS/GSC/FIR force SEC */
  if (lhWrap) lhWrap.style.display = 'none';
  if (lhSel)  lhSel.value = 'iuc';

  dofUpdateLhIndicator();
  if (typeof dofUpdateRef === 'function') dofUpdateRef();
}

/* ── Update the letterhead indicator strip below the dropdowns ── */
function dofUpdateLhIndicator() {
  const type    = document.getElementById('dof-type')?.value;
  const dept    = document.getElementById('dof-dept')?.value || 'SEC';
  const lhMode  = document.getElementById('dof-letterhead')?.value || 'iuc';
  const role    = (typeof currentRole !== 'undefined') ? currentRole : 'staff';
  const strip   = document.getElementById('dof-lh-indicator');
  const text    = document.getElementById('dof-lh-indicator-text');
  const banner  = document.getElementById('dof-fixed-banner');
  if (!strip || !text) return;

  const fixedTypes = ['COS','GSC','FIR'];
  const isFixed    = type && fixedTypes.includes(type);

  /* Show/hide the auto-generated banner — for fixed types, inform user
     that content is pulled from their profile automatically */
  if (banner) banner.style.display = isFixed ? 'flex' : 'none';

  if (!type) {
    text.textContent = 'Select a document type to see letterhead';
    strip.style.background = 'var(--surface)';
    strip.style.borderColor = 'var(--line)';
    strip.querySelector('svg').style.stroke = 'var(--ink3)';
    text.style.color = 'var(--ink3)';
    return;
  }

  let lhLabel, lhColor;
  if (isFixed) {
    /* COS/GSC/FIR always use IUC Secretariat letterhead regardless of dept/role */
    lhLabel = '🔒 IUC Secretariat letterhead — fixed for COS / GSC / FIR';
    lhColor = '#1E3A6E';
    strip.style.background  = '#EBF0F8';
    strip.style.borderColor = 'rgba(30,58,110,.2)';
  } else if (lhMode === 'vc') {
    lhLabel = 'Office of the Vice Chancellor letterhead';
    lhColor = '#7B1A2E';
    strip.style.background = '#f9f0f2';
    strip.style.borderColor = 'rgba(139,26,46,.2)';
  } else {
    /* Dynamic: letterhead follows the selected department */
    const deptName = _DEPT_EN_NAME[dept] || dept;
    lhLabel = (dept === 'SEC' || dept === 'ADM')
      ? 'IUC Secretariat letterhead'
      : `Department of ${deptName} letterhead`;
    if (role === 'staff') {
      lhLabel += ' (your department)';
      lhColor = '#1a5c3a';
      strip.style.background = '#EBF5F0';
      strip.style.borderColor = 'rgba(26,92,58,.2)';
    } else {
      lhColor = 'var(--ink2)';
      strip.style.background = 'var(--surface)';
      strip.style.borderColor = 'var(--line)';
    }
  }
  text.textContent = lhLabel;
  text.style.color = lhColor;
  strip.querySelector('svg').style.stroke = lhColor;
}

/* ── Check if current user can sign as department ── */
function _canSignAsDept() {
  const role  = (typeof currentRole !== 'undefined') ? currentRole : 'staff';
  if (role === 'registrar') return false; // registrar always uses Secretariat's Office
  const title = _getCurrentTitle();
  return _TITLE_DEPT_SIGN.some(t => title.includes(t));
}

/* ── Ref number: fetch sequence from DB, build ref string ── */
async function dofGetNextSeq(docType) {
  const year = new Date().getFullYear();
  try {
    const { count, error } = await db
      .from('generated_documents')
      .select('id', { count: 'exact', head: true })
      .eq('doc_type', docType)
      .gte('created_at', `${year}-01-01`)
      .lt('created_at', `${year + 1}-01-01`);
    if (error) throw error;
    return (count || 0) + 1;
  } catch (e) {
    return Math.floor(Math.random() * 9000) + 1000;
  }
}

/* ── Myanmar numeral converter ── */
function _toMyanmarNumerals(n) {
  return String(n).replace(/[0-9]/g, d => '၀၁၂၃၄၅၆၇၈၉'[d]);
}

/* ── Doc type → Myanmar label map ── */
const _DOC_TYPE_MM = {
  LTR: 'စာ',
  DIR: 'ညွှန်ကြားလွှာ',
  STM: 'ကြေညာချက်',
  COS: 'ဝန်ဆောင်မှုအတည်ပြုချက်',
  GSC: 'ကောင်းမွန်မှုသက်သေချက်',
  FIR: 'ကနဦးအစီရင်ခံစာ',
};

/* ════════════════════════════════════════════════════════════
   DEPARTMENTS — single source of truth.
   To add a new department: add ONE entry here.
   Everything else (dropdown, ref numbers, letterhead, seal) updates automatically.

   Fields:
     en    — English name (used in letterhead dept line + EN ref number)
     mm    — Myanmar name (used in bilingual letterhead + MM ref number)
     label — Full label shown in the dropdown  (English · မြန်မာ)
     seal  — SVG filename for the department seal (used in COS/GSC signature block)
             Falls back to default _SEAL_URL if the file is missing.
     nameAlias — (optional) array of lowercase alternative name spellings from staff profiles
   ════════════════════════════════════════════════════════════ */
const DEPARTMENTS = {
  SEC: { en: 'Secretariat',                   mm: 'အတွင်းရေးမှူးများအဖွဲ့', label: 'Secretariat · အတွင်းရေးမှူးများအဖွဲ့',                              seal: 'secretariat.svg',                    nameAlias: ['secretariat'] },
  ADM: { en: 'Secretariat',                   mm: '',                        label: 'Administration · အုပ်ချုပ်ရေးအဖွဲ့',                                seal: 'University Council.svg',             nameAlias: ['administration'] },
  ANA: { en: 'Anatomy',                        mm: 'ခန္ဓာဗေဒ',               label: 'Anatomy · ခန္ဓာဗေဒဌာန',                                             seal: 'anatomy.svg',                        nameAlias: ['anatomy'] },
  PHY: { en: 'Physiology',                     mm: 'ဇီဝကမ္မဗေဒ',             label: 'Physiology · ဇီဝကမ္မဗေဒဌာန',                                        seal: 'physiology.svg',                     nameAlias: ['physiology'] },
  BIO: { en: 'Biochemistry',                   mm: 'ဇီဝဓာတုဗေဒ',             label: 'Biochemistry · ဇီဝဓာတုဗေဒဌာန',                                      seal: 'biochemistry.svg',                   nameAlias: ['biochemistry'] },
  PHA: { en: 'Pharmacology',                   mm: 'ဆေးဝါးဗေဒ',              label: 'Pharmacology · ဆေးဝါးဗေဒဌာန',                                       seal: 'pharmacology.svg',                   nameAlias: ['pharmacology'] },
  PAT: { en: 'Pathology',                      mm: 'ရောဂါဗေဒ',               label: 'Pathology · ရောဂါဗေဒဌာန',                                           seal: 'pathology.svg',                      nameAlias: ['pathology'] },
  MIC: { en: 'Microbiology',                   mm: 'အဏုဇီဝဗေဒ',              label: 'Microbiology · အဏုဇီဝဗေဒဌာန',                                       seal: 'microbiology.svg',                   nameAlias: ['microbiology'] },
  PSM: { en: 'Preventive & Social Medicine',   mm: 'ကြိုတင်ကာကွယ်ရေး',      label: 'Preventive & Social Medicine · ကြိုတင်ကာကွယ်ရေးနှင့် လူမှုဆေးပညာဌာန', seal: 'preventiveandsocialmedicine.svg',    nameAlias: ['preventive & social medicine', 'preventive and social medicine', 'preventative & social medicine', 'preventative and social medicine'] },
  FOR: { en: 'Forensic Medicine',              mm: 'မှုခင်းဆေးပညာ',          label: 'Forensic Medicine · မှုခင်းဆေးပညာဌာန',                              seal: 'forensicmedicine.svg',               nameAlias: ['forensic medicine'] },
  IMD: { en: 'Internal Medicine',              mm: 'အထွေထွေဆေးပညာ',          label: 'Internal Medicine · အထွေထွေဆေးပညာဌာန',                              seal: 'internalmedicine.svg',               nameAlias: ['internal medicine'] },
  SUR: { en: 'Surgery',                        mm: 'ခွဲစိတ်ကုသရေး',           label: 'Surgery · ခွဲစိတ်ကုသရေးဌာန',                                        seal: 'surgery.svg',                        nameAlias: ['surgery'] },
  OBG: { en: 'Obstetrics & Gynaecology',       mm: 'သားဖွားနှင့်မီးယပ်',      label: 'Obstetrics & Gynaecology · သားဖွားနှင့် မီးယပ်ပညာဌာန',              seal: 'obstetricsandgynaecology.svg',       nameAlias: ['obstetrics & gynaecology', 'obstetrics and gynaecology'] },
  PED: { en: 'Paediatrics',                    mm: 'ကလေးကျန်းမာ',            label: 'Paediatrics · ကလေးကျန်းမာပညာဌာန',                                  seal: 'paediatrics.svg',                    nameAlias: ['paediatrics', 'pediatrics'] },
  PSY: { en: 'Psychiatry',                     mm: 'စိတ်ကျန်းမာရေး',         label: 'Psychiatry · စိတ်ကျန်းမာရေးပညာဌာန',                                 seal: 'psychiatry.svg',                     nameAlias: ['psychiatry'] },
  OPH: { en: 'Ophthalmology',                  mm: 'မျက်စိပညာ',              label: 'Ophthalmology · မျက်စိပညာဌာန',                                      seal: 'ophthalmology.svg',                  nameAlias: ['ophthalmology'] },
  ENT: { en: 'ENT',                            mm: 'နားနှာလည်ချောင်း',        label: 'ENT · နား၊ နှာခေါင်း၊ လည်ချောင်းပညာဌာန',                           seal: 'ent.svg',                            nameAlias: ['ent', 'otolaryngology'] },
  ORT: { en: 'Orthopaedics',                   mm: 'အရိုးအထူးကု',             label: 'Orthopaedics · အရိုးအထူးကုဌာန',                                     seal: 'orthopaedics.svg',                   nameAlias: ['orthopaedics', 'orthopedics'] },
  RAD: { en: 'Radiology',                      mm: 'ဓာတ်မှန်',               label: 'Radiology · ဓာတ်မှန်နှင့် ပုံရိပ်ဖော်ပညာဌာန',                      seal: 'radiology.svg',                      nameAlias: ['radiology'] },
  ANE: { en: 'Anaesthesiology',                mm: 'မေ့ဆေးပညာ',              label: 'Anaesthesiology · မေ့ဆေးပညာဌာန',                                    seal: 'anaesthesiology.svg',                nameAlias: ['anaesthesiology', 'anesthesiology'] },
};

/* ── Derived lookup maps (auto-built from DEPARTMENTS — do not edit manually) ── */
const _DEPT_MM        = Object.fromEntries(Object.entries(DEPARTMENTS).map(([k,v]) => [k, v.mm]));
const _DEPT_EN_NAME   = Object.fromEntries(Object.entries(DEPARTMENTS).map(([k,v]) => [k, v.en]));
const _DEPT_SEAL      = Object.fromEntries(Object.entries(DEPARTMENTS).map(([k,v]) => [k, v.seal]));
/* flat alias → code map used by dofApplyRoleTypes to match staff profile dept names */
const _DEPT_NAME_TO_CODE = {};
Object.entries(DEPARTMENTS).forEach(([code, d]) => {
  (d.nameAlias || []).forEach(alias => { _DEPT_NAME_TO_CODE[alias.toLowerCase()] = code; });
});

/* ── Populate the dof-dept dropdown from DEPARTMENTS (called once on page load) ── */
function dofPopulateDeptDropdown() {
  const sel = document.getElementById('dof-dept');
  if (!sel) return;
  sel.innerHTML = Object.entries(DEPARTMENTS)
    .map(([code, d]) => `<option value="${code}">${d.label}</option>`)
    .join('');
}

function dofBuildRefEN(docType, dept, seq) {
  const year   = new Date().getFullYear();
  const padded = String(seq).padStart(4, '0');
  const lhMode = document.getElementById('dof-letterhead')?.value || 'iuc';
  if (lhMode === 'vc') {
    return `UM2-VC-${docType}-${year}-${padded}`;
  }
  const deptLabel = (_DEPT_EN_NAME[dept] || dept).toUpperCase().replace(/[^A-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return `UM2-${docType}-${deptLabel}-${year}-${padded}`;
}

function dofBuildRefMM(docType, dept, seq) {
  const year   = new Date().getFullYear();
  const typeMM = _DOC_TYPE_MM[docType] || docType;
  const yearMM = _toMyanmarNumerals(year);
  const seqMM  = _toMyanmarNumerals(String(seq).padStart(4, '0'));
  const lhMode = document.getElementById('dof-letterhead')?.value || 'iuc';
  if (lhMode === 'vc') {
    return `ဆ၂တကစ-ဒုတိယအဓိပတိရုံး-${typeMM}-${yearMM}-${seqMM}`;
  }
  const deptMM = _DEPT_MM[dept] || dept;
  return `ဆ၂တကစ-${typeMM}-${deptMM}-${yearMM}-${seqMM}`;
}

function dofBuildRef(docType, dept, seq, lang) {
  const l = lang || document.getElementById('dof-lang')?.value || 'en';
  const en = dofBuildRefEN(docType, dept, seq);
  const mm = dofBuildRefMM(docType, dept, seq);
  if (l === 'mm' || l === 'bilingual') return mm;
  return en;
}

let _dofCurrentSeq = null;
let _dofSigningMode = 'individual'; // 'individual' | 'department'

function dofSetSigningMode(mode) {
  _dofSigningMode = mode;
  document.getElementById('dof-sign-individual-btn')?.classList.toggle('btn-primary', mode === 'individual');
  document.getElementById('dof-sign-individual-btn')?.classList.toggle('btn-outline', mode !== 'individual');
  document.getElementById('dof-sign-dept-btn')?.classList.toggle('btn-primary', mode === 'department');
  document.getElementById('dof-sign-dept-btn')?.classList.toggle('btn-outline', mode !== 'department');
}

async function dofUpdateRef() {
  const type = document.getElementById('dof-type')?.value;
  const dept = document.getElementById('dof-dept')?.value || 'SEC';
  const display = document.getElementById('dof-ref-display');
  const previewBtn = document.getElementById('dof-preview-btn');
  const printBtn = document.getElementById('dof-print-btn');

  const fixedTypes = ['COS','GSC','FIR'];
  const isFixed = type && fixedTypes.includes(type);

  /* ── COS / GSC / FIR: system-generated, English only, no body, no subject, no signing ── */
  const signingWrap   = document.getElementById('dof-signing-wrap');
  const bodyWrap      = document.getElementById('dof-body-wrap');
  const titleSession  = document.getElementById('dof-title-session');
  const subjectEnWrap = document.getElementById('dof-subject-en-wrap');
  const subjectMmWrap = document.getElementById('dof-subject-mm-wrap');
  const langWrap      = document.getElementById('dof-lang')?.closest('.form-group');
  const priorityGrid  = document.getElementById('dof-priority-grid');
  let   infoBox       = document.getElementById('dof-fixed-info');

  const lang_now = document.getElementById('dof-lang')?.value || 'en';
  /* COS/GSC/FIR: hide ALL editable content sections — content is auto-filled from profile */
  if (signingWrap)   signingWrap.style.display   = (isFixed || !type) ? 'none' : '';
  if (bodyWrap)      bodyWrap.style.display       = 'none'; /* body is now in title session */
  if (titleSession)  titleSession.style.display   = isFixed ? 'none' : '';
  if (subjectEnWrap) subjectEnWrap.style.display  = (isFixed || type === 'STM') ? 'none' : '';
  if (subjectMmWrap) {
    const lang = document.getElementById('dof-lang')?.value || 'en';
    subjectMmWrap.style.display = (isFixed || type === 'STM' || lang === 'en') ? 'none' : '';
  }
  if (langWrap)      langWrap.style.display       = isFixed ? 'none' : '';

  /* Lock language to English for fixed types */
  const langSel = document.getElementById('dof-lang');
  if (langSel && isFixed) { langSel.value = 'en'; dofToggleLangFields(); }

  /* Show / hide info banner for fixed types */
  if (!infoBox) {
    infoBox = document.createElement('div');
    infoBox.id = 'dof-fixed-info';
    infoBox.style.cssText = 'background:#EBF0F8;border:1px solid rgba(30,58,110,.2);border-radius:6px;padding:10px 14px;font-size:12px;color:#1E3A6E;margin-bottom:14px;display:none';
    infoBox.innerHTML = '🔒 This document is <strong>system-generated in English only</strong>. Staff details are pulled automatically from your profile — no editing required.';
    bodyWrap?.parentNode?.insertBefore(infoBox, bodyWrap);
  }
  infoBox.style.display = isFixed ? '' : 'none';

  /* Show individual/dept toggle only for eligible titles (non-fixed types) */
  const signingModeWrap = document.getElementById('dof-signing-mode-wrap');
  if (signingModeWrap) {
    const isRegistrar = (typeof currentRole !== 'undefined') && currentRole === 'registrar';
    signingModeWrap.style.display = (!isRegistrar && _canSignAsDept() && type && !fixedTypes.includes(type)) ? '' : 'none';
  }

  if (!type) {
    if (display) display.textContent = '— select type —';
    if (previewBtn) previewBtn.disabled = true;
    if (printBtn) printBtn.disabled = true;
    return;
  }
  if (display) display.textContent = 'Generating… · ထုတ်နေသည်';
  _dofCurrentSeq = await dofGetNextSeq(type);
  const lang = document.getElementById('dof-lang')?.value || 'en';
  const ref = dofBuildRef(type, dept, _dofCurrentSeq, lang);
  if (display) display.textContent = ref;
  if (previewBtn) previewBtn.disabled = false;
  if (printBtn) printBtn.disabled = false;
}

/* ── Save to Supabase ── */
async function dofSaveToDb(refNo, docType, subjectEn, subjectMm, lang, priority, dist) {
  const { error } = await db
    .from('generated_documents')
    .insert({
      ref_no:       refNo,
      doc_type:     docType,
      subject_en:   subjectEn || null,
      subject_mm:   subjectMm || null,
      language:     lang,
      priority:     priority,
      distribution: dist,
      created_by:   currentUser?.id || null,
      staff_id:     currentUser?.staff_id || null,
      staff_name:   currentUser?.name || null
    });
  if (error) {
    toast('DB save failed · သိမ်းမရပါ: ' + error.message, '✗');
    return false;
  }
  toast('Saved · သိမ်းပြီး — ' + refNo, '✓');
  return true;
}

/* ── Quick-access shortcut (from the 3 cards) ── */
async function dofQuick(type, subjectEn, subjectMm) {
  const typeEl = document.getElementById('dof-type');
  const enEl   = document.getElementById('dof-subject-en');
  const mmEl   = document.getElementById('dof-subject-mm');
  if (typeEl) typeEl.value = type;
  if (enEl)   enEl.value  = subjectEn;
  if (mmEl)   mmEl.value  = subjectMm;
  /* Apply role-based constraints (dept lock for staff, etc.) before generating */
  if (typeof dofPopulateDeptDropdown === 'function') dofPopulateDeptDropdown();
  if (typeof dofApplyRoleTypes       === 'function') dofApplyRoleTypes();
  if (typeof dofRenderRoleBadge      === 'function') dofRenderRoleBadge();
  await dofUpdateRef();
  await dofGenerateAndPrint('print');
}

/* ── Main generate + print + save ── */
async function dofGenerateAndPrint(mode) {
  const type     = document.getElementById('dof-type')?.value;
  const dept     = document.getElementById('dof-dept')?.value || 'OPS';
  const subjectEn= (document.getElementById('dof-subject-en')?.value || '').trim();
  const subjectMm= (document.getElementById('dof-subject-mm')?.value || '').trim();
  const lang     = document.getElementById('dof-lang')?.value     || 'en';
  const priority = document.getElementById('dof-priority')?.value || 'normal';
  const dist     = document.getElementById('dof-dist')?.value     || 'internal';
  const body     = (document.getElementById('dof-body-title')?.value || document.getElementById('dof-body')?.value || '').trim();
  const docTitle = (document.getElementById('dof-doc-title')?.value  || '').trim();
  const closing  = (document.getElementById('dof-closing')?.value    || '').trim();
  const signNameLeft  = (document.getElementById('dof-sign-name-left')?.value  || '').trim();
  const signTitleLeft = (document.getElementById('dof-sign-title-left')?.value || '').trim();
  const signPosLeft   = (document.getElementById('dof-sign-pos-left')?.value   || '').trim();
  const signAuth      = (document.getElementById('dof-sign-auth')?.value       || '').trim();
  const signMode = _dofSigningMode;

  if (!type) { toast('Please select a document type · အမျိုးအစားရွေးပါ', '⚠'); return; }

  if (_dofCurrentSeq === null) { await dofUpdateRef(); }
  const refNo = dofBuildRef(type, dept, _dofCurrentSeq);

  const s = _getStaffForPrint();

  const signLeft  = { name: signNameLeft, title: signTitleLeft, pos: signPosLeft, auth: signAuth };

  /* Build the HTML for the printed document */
  const docHtml = _dofBuildDocHtml(type, refNo, subjectEn, subjectMm, lang, s, body, signMode, signLeft, null, docTitle, closing, priority, dist);

  if (mode === 'print') {
    /* Save first, then print */
    const saved = await dofSaveToDb(refNo, type, subjectEn, subjectMm, lang, priority, dist);
    if (saved) {
      _dofCurrentSeq = null; /* reset so next generation gets a fresh sequence */
      await dofUpdateRef();
      loadDocLog();
    }
    _printDoc(docHtml);
  } else {
    /* Preview only — no DB save */
    _printDoc(docHtml);
  }
}

/* ── Build document HTML based on type ── */
function _dofBuildDocHtml(type, refNo, subjectEn, subjectMm, lang, s, body, signMode, signLeft, signRight, docTitle, closing, priority, dist) {
  const bilingual = lang === 'bilingual';
  const showMm    = lang === 'mm' || bilingual;
  const showEn    = lang === 'en' || bilingual;

  const subjectLine = bilingual
    ? `${subjectEn || ''}${subjectEn && subjectMm ? ' · ' : ''}${subjectMm || ''}`
    : (showEn ? subjectEn : subjectMm) || '';

  /* ── Priority / Distribution banner (shown at top of all doc types) ── */
  const _priorityLabel = { normal: '', urgent: 'URGENT', confidential: 'CONFIDENTIAL' };
  const _distLabel = {
    internal: 'Internal Only',
    department: 'Department',
    all_staff: 'All Staff',
    external: 'External',
  };
  const priorityTag = (priority && priority !== 'normal')
    ? `<div style="margin-bottom:14px;text-align:center">
        <span style="display:inline-block;padding:4px 18px;border:2px solid #8B1A2E;color:#8B1A2E;font-size:11pt;font-weight:800;letter-spacing:2.5px;text-transform:uppercase">${_priorityLabel[priority] || priority.toUpperCase()}</span>
      </div>` : '';
  const distTag = (dist && dist !== 'internal')
    ? `<div style="font-size:9pt;color:#555;margin-bottom:10px"><strong>Distribution:</strong> ${_distLabel[dist] || dist}</div>` : '';

  /* Special templates — fixed secretariat signature */
  if (type === 'COS') return priorityTag + distTag + _dofTemplateCOS(refNo, subjectLine, bilingual, showEn, showMm, s, signLeft, signRight);
  if (type === 'GSC') return priorityTag + distTag + _dofTemplateGSC(refNo, subjectLine, bilingual, showEn, showMm, s, signLeft, signRight);
  if (type === 'FIR') return priorityTag + distTag + _dofTemplateFIR(refNo, subjectLine, bilingual, showEn, showMm, s, signLeft, signRight);
  if (type === 'STM') return priorityTag + distTag + _dofTemplateSTM(refNo, bilingual, showEn, showMm, s, body, signMode, signLeft, signRight, docTitle, closing);

  /* Helper: render body text as indented paragraphs */
  const _bodyHtml = (txt) => txt
    ? txt.split(/\n+/).filter(p => p.trim())
        .map(p => `<p style="margin-bottom:14px;text-align:justify;line-height:1.9;font-size:10.5pt;text-indent:2em">${p.trim()}</p>`)
        .join('')
    : `<p style="margin-bottom:20px;font-size:10.5pt">&nbsp;</p>`;

  /* Generic template for STM, LTR, DIR */
  const typeLabels = {
    LTR: ['OFFICIAL LETTER', 'တရားဝင်ပေးစာ'],
    DIR: ['DIRECTIVE', 'ညွှန်ကြားလွှာ'],
    STM: ['STATEMENT', 'ကြေညာချက်'],
  };
  const [labelEn, labelMm] = typeLabels[type] || [type, type];
  const titleDisplay = bilingual ? `${labelEn}  |  ${labelMm}` : (showEn ? labelEn : labelMm);

  /* Closing phrase — only render if user provided one */
  const closingPhrase = closing || '';

  const dept = document.getElementById('dof-dept')?.value || 'SEC';
  return `
    ${_letterHeadWithDept(dept, lang)}
    ${priorityTag}
    ${distTag}
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;font-size:10pt">
      <div style="line-height:1.9">
        ${showEn ? `<div><strong>Ref No:</strong> ${refNo}</div>` : ''}
        ${showMm ? `<div>စာအမှတ်: ${refNo}</div>` : ''}
      </div>
      <div style="text-align:right;line-height:1.9">
        ${showEn ? `<div><strong>Date:</strong> ${_todayFormatted()}</div>` : ''}
        ${showMm ? `<div><strong>ရက်စွဲ:</strong> ${_todayFormattedMM()}</div>` : ''}
      </div>
    </div>
    ${docTitle ? `<div style="text-align:center;margin-bottom:18px"><span style="font-size:13pt;font-weight:bold;text-transform:uppercase;letter-spacing:1.2px;text-decoration:underline">${docTitle}</span></div>` : ''}
    ${subjectLine ? `<div style="margin-bottom:16px;font-size:10.5pt"><strong>${showEn ? 'Subject' : 'အကြောင်းအရာ'}${bilingual ? ' / အကြောင်းအရာ' : ''}:</strong> ${subjectLine}</div>` : ''}
    ${_bodyHtml(body)}
    ${closingPhrase ? `<p style="margin-bottom:4px;font-size:10.5pt">${closingPhrase}</p>` : ''}
    ${_signatureBlockDynamic(s, signMode, signLeft, null)}
  `;
}

function _letterHeadWithStaff(s) {
  const dept = document.getElementById('dof-dept')?.value || 'SEC';
  const lang = document.getElementById('dof-lang')?.value || 'en';
  return `
    ${_letterHeadWithDept(dept, lang)}
    <div style="padding:10px 0 18px 0;border-bottom:1px solid #e0e0e0;margin-bottom:24px">
      <div style="font-size:12pt;font-weight:700;color:#0D1B2A">${s.name}</div>
      <div style="font-size:10pt;color:#3D4A5C;margin-top:2px">${s.title}${s.dept ? ' &nbsp;·&nbsp; Department of ' + s.dept : ''}</div>
      ${s.staffId && s.staffId !== '—' ? `<div style="font-size:9pt;color:#7A8599;margin-top:2px">Staff ID: ${s.staffId}</div>` : ''}
    </div>`;
}

function _dofTemplateSTM(refNo, bilingual, showEn, showMm, s, body, signMode, signLeft, signRight, docTitle, closing) {
  const _bodyHtml = (txt) => txt
    ? txt.split(/\n+/).filter(p => p.trim())
        .map(p => `<p style="margin-bottom:14px;text-align:justify;line-height:1.9;font-size:10.5pt;text-indent:2em">${p.trim()}</p>`)
        .join('')
    : `<p style="margin-bottom:20px;font-size:10.5pt">&nbsp;</p>`;
  /* Closing phrase — only render if user provided one */
  const closingPhrase = closing || '';
  const dept = document.getElementById('dof-dept')?.value || 'SEC';
  const lang = bilingual ? 'bilingual' : (showMm ? 'mm' : 'en');
  return `
    ${_letterHeadWithDept(dept, lang)}
    <div style="display:flex;justify-content:flex-end;margin-bottom:28px;font-size:10pt">
      <div style="text-align:right;line-height:1.9">
        ${showEn ? `<strong>Ref:</strong> ${refNo}<br><strong>Date:</strong> ${_todayFormatted()}` : ''}
        ${bilingual ? '<br>' : ''}
        ${showMm ? `<strong>စာအမှတ် ။</strong> ${refNo}<br><strong>ရက်စွဲ ။</strong> ${_todayFormattedMM()}` : ''}
      </div>
    </div>
    ${docTitle ? `<div style="text-align:center;margin-bottom:18px"><span style="font-size:13pt;font-weight:bold;text-transform:uppercase;letter-spacing:1.2px;text-decoration:underline">${docTitle}</span></div>` : ''}
    ${_bodyHtml(body)}
    ${closingPhrase ? `<p style="margin-bottom:4px;font-size:10.5pt">${closingPhrase}</p>` : ''}
    ${_signatureBlockDynamic(s, signMode, signLeft, null)}`;
}

function _dofTemplateCOS(refNo, subjectLine, bilingual, showEn, showMm, s, signLeft, signRight) {
  const dept = document.getElementById('dof-dept')?.value || 'SEC';
  const deptOfficeName = _getDeptOfficeName(dept);
  return `
    ${_letterHeadWithDept(dept, bilingual ? 'bilingual' : (showMm ? 'mm' : 'en'))}
    <div style="display:flex;justify-content:flex-end;margin-bottom:28px;font-size:10pt">
      <div style="text-align:right;line-height:1.9">
        ${showEn ? `<strong>Ref:</strong> ${refNo}<br><strong>Date:</strong> ${_todayFormatted()}` : ''}
        ${bilingual ? '<br>' : ''}
        ${showMm ? `<strong>စာအမှတ် ။</strong> ${refNo}<br><strong>ရက်စွဲ ။</strong> ${_todayFormattedMM()}` : ''}
      </div>
    </div>
    <div style="text-align:center;margin-bottom:28px">
      <span style="font-size:14pt;font-weight:bold;text-decoration:underline;text-transform:uppercase;letter-spacing:1.5px">
        ${bilingual ? 'Confirmation of Service  |  အတည်ပြုစာ' : (showEn ? 'Confirmation of Service' : 'အတည်ပြုစာ')}
      </span>
    </div>
    <p style="margin-bottom:16px;font-size:10.5pt">${bilingual ? 'To Whom It May Concern,' : (showEn ? 'To Whom It May Concern,' : 'သက်ဆိုင်ရာသူများသို့')}</p>
    <p style="margin-bottom:16px;text-align:justify;line-height:1.9;font-size:10.5pt">
      ${showEn ? `This is to confirm that <strong>${s.name}</strong> (known as <strong>${s.nickname}</strong>), Staff ID <strong>${s.staffId}</strong>, is currently serving as <strong>${s.title}</strong> in the <strong>Department of ${s.dept}</strong> at the University of Medicine (2), Yangon, under the Interim University Council` : ''}
      ${bilingual ? '<br><br>' : ''}
      ${showMm ? `<strong>${s.name}</strong> (${s.nickname}), အိုင်ဒီအမှတ် <strong>${s.staffId}</strong> သည် ရန်ကုန်ဆေးတက္ကသိုလ်(၂) UM2 MBBS ပရိုဂရမ်တွင် <strong>${s.dept}</strong> ဌာန၌ <strong>${s.title}</strong> အဖြစ် တာဝန်ထမ်းဆောင်လျက်ရှိကြောင်း အတည်ပြုအပ်ပါသည်။` : ''}
    </p>
    <p style="margin-bottom:28px;text-align:justify;line-height:1.9;font-size:10.5pt">
      ${showEn ? `This letter is issued upon the request of the staff member for official purposes. The ${deptOfficeName} certifies the accuracy of the above information as of the date of issue.` : ''}
      ${bilingual ? '<br><br>' : ''}
      ${showMm ? 'ဤစာသည် ဝန်ထမ်း၏ တောင်းဆိုချက်အရ တရားဝင်ရည်ရွယ်ချက်များအတွက် ထုတ်ပေးခြင်းဖြစ်သည်။ အတွင်းရေးမှူးဌာနမှ အထက်ဖော်ပြပါ အချက်အလက်များ၏ မှန်ကန်မှုကို ထုတ်ပေးသည့်ရက်စွဲ ၌ အတည်ပြုပါသည်။' : ''}
    </p>
    <p style="margin-bottom:4px;font-size:10.5pt">${bilingual ? 'Yours faithfully / လေးစားစွာဖြင့်' : (showEn ? 'Yours faithfully,' : 'လေးစားစွာဖြင့်')}</p>
    ${_signatureBlock(signLeft, signRight)}
  `;
}

function _dofTemplateGSC(refNo, subjectLine, bilingual, showEn, showMm, s, signLeft, signRight) {
  const dept = document.getElementById('dof-dept')?.value || 'SEC';
  const deptOfficeName = _getDeptOfficeName(dept);
  return `
    ${_letterHeadWithDept(dept, bilingual ? 'bilingual' : (showMm ? 'mm' : 'en'))}
    <div style="display:flex;justify-content:flex-end;margin-bottom:28px;font-size:10pt">
      <div style="text-align:right;line-height:1.9">
        ${showEn ? `<strong>Ref:</strong> ${refNo}<br><strong>Date:</strong> ${_todayFormatted()}` : ''}
        ${bilingual ? '<br>' : ''}
        ${showMm ? `<strong>စာအမှတ် ။</strong> ${refNo}<br><strong>ရက်စွဲ ။</strong> ${_todayFormattedMM()}` : ''}
      </div>
    </div>
    <p style="margin-bottom:16px;font-size:10.5pt">${bilingual ? 'To Whom It May Concern,' : (showEn ? 'To Whom It May Concern,' : 'သက်ဆိုင်ရာသူများသို့')}</p>
    <p style="margin-bottom:16px;text-align:justify;line-height:1.9;font-size:10.5pt">
      ${showEn ? `This is to certify that <strong>${s.name}</strong> (known as <strong>${s.nickname}</strong>), Staff ID <strong>${s.staffId}</strong>, is currently employed as <strong>${s.title}</strong> in the <strong>Department of ${s.dept}</strong> at the University of Medicine (2), Yangon.` : ''}
      ${bilingual ? '<br><br>' : ''}
      ${showMm ? `<strong>${s.name}</strong> (${s.nickname}), အိုင်ဒီအမှတ် <strong>${s.staffId}</strong> သည် ရန်ကုန်ဆေးတက္ကသိုလ်(၂)တွင် <strong>${s.dept}</strong> ဌာန၌ <strong>${s.title}</strong> အဖြစ် ယခုအခါ တာဝန်ထမ်းဆောင်လျက်ရှိကြောင်း သက်သေပြုအပ်ပါသည်။` : ''}
    </p>
    <p style="margin-bottom:16px;text-align:justify;line-height:1.9;font-size:10.5pt">
      ${showEn ? `Based on the records maintained by the ${deptOfficeName}, the above-named staff member is <strong>in good professional and institutional standing</strong> with the university as of the date of this certificate.` : ''}
      ${bilingual ? '<br><br>' : ''}
      ${showMm ? 'အတွင်းရေးမှူးဌာန၏ မှတ်တမ်းများအရ အထက်ဖော်ပြပါ ပုဂ္ဂိုလ် သည် ဤသက်သေချက် ထုတ်ပေးသည့်ရက်တွင် တက္ကသိုလ်နှင့် <strong>ကောင်းမွန်သော ပညာရှင်ဆိုင်ရာနှင့် အဖွဲ့အစည်းဆိုင်ရာ ရပ်တည်မှု</strong> ရှိကြောင်း အတည်ပြုသည်။' : ''}
    </p>
    <p style="margin-bottom:28px;text-align:justify;line-height:1.9;font-size:10.5pt">
      ${showEn ? 'This certificate is issued at the staff member\'s request and is valid for official purposes only when accompanied by an authorised signature and the university\'s official stamp.' : ''}
      ${bilingual ? '<br><br>' : ''}
      ${showMm ? 'ဤစာကို ပုဂ္ဂိုလ်၏ တောင်းဆိုချက်အရ ထုတ်ပေးခြင်းဖြစ်ပြီး တရားဝင်လက်မှတ်နှင့် တံဆိပ်မှသာ တရားဝင်ပါသည်။' : ''}
    </p>
    <p style="margin-bottom:4px;font-size:10.5pt">${bilingual ? 'Yours faithfully / လေးစားစွာဖြင့်' : (showEn ? 'Yours faithfully,' : 'လေးစားစွာဖြင့်')}</p>
    ${_signatureBlock(signLeft, signRight)}
  `;
}

function _dofTemplateFIR(refNo, subjectLine, bilingual, showEn, showMm, s, signLeft, signRight) {
  const yearsOfService = (() => {
    const rawDate = document.getElementById('sp-startdate')?.value;
    if (!rawDate) return '—';
    const start = new Date(rawDate);
    const now = new Date();
    const yrs = now.getFullYear() - start.getFullYear() - (now < new Date(now.getFullYear(), start.getMonth(), start.getDate()) ? 1 : 0);
    return yrs === 1 ? '1 year / ၁ နှစ်' : `${yrs} years / ${yrs} နှစ်`;
  })();
  const dept = document.getElementById('dof-dept')?.value || 'SEC';
  return `
    ${_letterHeadWithDept(dept, bilingual ? 'bilingual' : (showMm ? 'mm' : 'en'))}
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;font-size:10pt">
      <div></div>
      <div style="text-align:right;line-height:1.9">
        <strong>Ref:</strong> ${refNo}<br>
        <strong>Date${bilingual ? ' / ရက်စွဲ' : (showMm ? ' / ရက်စွဲ' : '')}:</strong> ${_todayFormatted()}${bilingual ? ' · ' + _todayFormattedMM() : (showMm ? '<br>' + _todayFormattedMM() : '')}
      </div>
    </div>
    <div style="text-align:center;margin-bottom:28px">
      <span style="font-size:14pt;font-weight:bold;text-decoration:underline;text-transform:uppercase;letter-spacing:1.5px">
        ${bilingual ? 'Faculty Member Information Record  |  အချက်အလက် မှတ်တမ်း' : (showEn ? 'Faculty Member Information Record' : 'အချက်အလက် မှတ်တမ်း')}
      </span>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:10.5pt;margin-bottom:24px">
      <colgroup><col style="width:36%"><col style="width:64%"></colgroup>
      <tbody>
        <tr style="background:#f7eef0"><td colspan="2" style="padding:8px 12px;font-weight:bold;font-size:10pt;color:#8B1A2E;border:1px solid #ddd">
          ${bilingual ? 'Personal Information · ကိုယ်ရေးအချက်အလက်' : (showEn ? 'Personal Information' : 'ကိုယ်ရေးအချက်အလက်')}
        </td></tr>
        <tr><td style="padding:8px 12px;border:1px solid #ddd;color:#555;font-weight:600">${bilingual ? 'Full Name · အမည်' : (showEn ? 'Full Name' : 'အမည်')}</td><td style="padding:8px 12px;border:1px solid #ddd">${s.name}</td></tr>
        <tr style="background:#fafafa"><td style="padding:8px 12px;border:1px solid #ddd;color:#555;font-weight:600">${bilingual ? 'Known As · အမည်အတို' : (showEn ? 'Known As' : 'အမည်အတို')}</td><td style="padding:8px 12px;border:1px solid #ddd">${s.nickname}</td></tr>
        <tr><td style="padding:8px 12px;border:1px solid #ddd;color:#555;font-weight:600">${bilingual ? 'Staff ID · အိုင်ဒီအမှတ်' : (showEn ? 'Staff ID' : 'အိုင်ဒီအမှတ်')}</td><td style="padding:8px 12px;border:1px solid #ddd;font-family:monospace">${s.staffId}</td></tr>
        <tr style="background:#fafafa"><td colspan="2" style="padding:8px 12px;font-weight:bold;font-size:10pt;color:#8B1A2E;border:1px solid #ddd">
          ${bilingual ? 'Academic Appointment · ပညာရေးဆိုင်ရာ ခန့်အပ်မှု' : (showEn ? 'Academic Appointment' : 'ပညာရေးဆိုင်ရာ ခန့်အပ်မှု')}
        </td></tr>
        <tr><td style="padding:8px 12px;border:1px solid #ddd;color:#555;font-weight:600">${bilingual ? 'Department · ဌာန' : (showEn ? 'Department' : 'ဌာန')}</td><td style="padding:8px 12px;border:1px solid #ddd">${s.dept}</td></tr>
        <tr style="background:#fafafa"><td style="padding:8px 12px;border:1px solid #ddd;color:#555;font-weight:600">${bilingual ? 'Title / Position · ရာထူး' : (showEn ? 'Title / Position' : 'ရာထူး')}</td><td style="padding:8px 12px;border:1px solid #ddd">${s.title}</td></tr>
        <tr style="background:#fafafa"><td colspan="2" style="padding:8px 12px;font-weight:bold;font-size:10pt;color:#8B1A2E;border:1px solid #ddd">
          ${bilingual ? 'Service Record · ဝန်ဆောင်မှု မှတ်တမ်း' : (showEn ? 'Service Record' : 'ဝန်ဆောင်မှု မှတ်တမ်း')}
        </td></tr>
        <tr><td style="padding:8px 12px;border:1px solid #ddd;color:#555;font-weight:600">${bilingual ? 'Start Date · စတင်သည့်ရက်' : (showEn ? 'Start Date at UM2 IUC' : 'UM2 IUC တွင် စတင်သည့်ရက်')}</td><td style="padding:8px 12px;border:1px solid #ddd">${s.startDate}</td></tr>
        <tr style="background:#fafafa"><td style="padding:8px 12px;border:1px solid #ddd;color:#555;font-weight:600">${bilingual ? 'Years of Service · ဝန်ဆောင်မှုနှစ်' : (showEn ? 'Years of Service' : 'ဝန်ဆောင်မှုနှစ်')}</td><td style="padding:8px 12px;border:1px solid #ddd">${yearsOfService}</td></tr>
        ${s.quals ? `<tr><td colspan="2" style="padding:8px 12px;font-weight:bold;font-size:10pt;color:#8B1A2E;border:1px solid #ddd;background:#fafafa">${bilingual ? 'Academic Qualifications · ပညာအရည်အချင်း' : (showEn ? 'Academic Qualifications' : 'ပညာအရည်အချင်း')}</td></tr><tr><td colspan="2" style="padding:8px 12px;border:1px solid #ddd;line-height:1.7">${s.quals}</td></tr>` : ''}
      </tbody>
    </table>
    <p style="margin-bottom:4px;font-size:10.5pt">${bilingual ? 'Prepared by / ပြုစုသူ' : (showEn ? 'Prepared by,' : 'ပြုစုသူ')}</p>
    ${_signatureBlock(signLeft, signRight)}
  `;
}

/* ── Myanmar date formatter ── */
function _todayFormattedMM() {
  const d = new Date();
  const months = ['ဇန်နဝါရီ','ဖေဖော်ဝါရီ','မတ်','ဧပြီ','မေ','ဇွန်','ဇူလိုင်','သြဂုတ်','စက်တင်ဘာ','အောက်တိုဘာ','နိုဝင်ဘာ','ဒီဇင်ဘာ'];
  const toMM = n => String(n).replace(/[0-9]/g, x => '၀၁၂၃၄၅၆၇၈၉'[x]);
  return `${toMM(d.getDate())} ${months[d.getMonth()]} ${toMM(d.getFullYear())}`;
}

/* ── Document Log: load from Supabase ── */
let _dofLogAll = [];

async function loadDocLog() {
  const tbody = document.getElementById('dof-log-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--ink3);padding:20px">Loading… · ခဏစောင့်ပါ</td></tr>';

  const role = (typeof currentRole !== 'undefined') ? currentRole : 'staff';
  let query = db.from('generated_documents').select('*').order('created_at', { ascending: false }).limit(200);

  const { data, error } = await query;
  if (error) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--ink3);padding:20px">Failed to load · မဆွဲနိုင်ပါ: ${error.message}</td></tr>`;
    return;
  }
  _dofLogAll = data || [];
  dofRenderLog(_dofLogAll);
}

function dofRenderLog(rows) {
  const tbody = document.getElementById('dof-log-body');
  if (!tbody) return;
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--ink3);padding:24px">No documents yet · မှတ်တမ်း မရှိသေးပါ</td></tr>';
    return;
  }
  const langLabel = { en: 'EN', mm: 'MM', bilingual: 'EN+MM' };
  tbody.innerHTML = rows.map(r => {
    const d = new Date(r.created_at);
    const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const timeStr = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    return `<tr>
      <td style="font-family:monospace;font-size:12px;white-space:nowrap;font-weight:600;color:var(--crimson)">${r.ref_no || '—'}</td>
      <td><span style="background:var(--blue-light);color:var(--blue);font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;letter-spacing:.5px">${r.doc_type || '—'}</span></td>
      <td style="font-size:12px">${r.subject_en || '—'}</td>
      <td style="font-size:12px">${r.subject_mm || '—'}</td>
      <td style="font-size:11px;white-space:nowrap"><span style="background:var(--surface);border:1px solid var(--line);padding:1px 6px;border-radius:4px">${langLabel[r.language] || r.language || '—'}</span></td>
      <td style="font-size:12px;white-space:nowrap">${r.staff_name || r.staff_id || '—'}</td>
      <td style="font-size:11px;white-space:nowrap;color:var(--ink3)">${dateStr}<br>${timeStr}</td>
    </tr>`;
  }).join('');
}

function dofFilterLog() {
  const q = (document.getElementById('dof-log-search')?.value || '').toLowerCase();
  const t = document.getElementById('dof-log-filter')?.value || '';
  const filtered = _dofLogAll.filter(r => {
    const matchType = !t || r.doc_type === t;
    const matchQ = !q || (r.ref_no || '').toLowerCase().includes(q)
      || (r.subject_en || '').toLowerCase().includes(q)
      || (r.subject_mm || '').toLowerCase().includes(q)
      || (r.staff_name || '').toLowerCase().includes(q);
    return matchType && matchQ;
  });
  dofRenderLog(filtered);
}

/* ── Hook: init when docOffice view is shown ── */
const _origShowViewDOF = typeof showView === 'function' ? showView : null;
if (_origShowViewDOF) {
  const __showViewPatched = _origShowViewDOF;
  showView = function(viewId, ...args) {
    __showViewPatched(viewId, ...args);
    if (viewId === 'docOffice') {
      if (typeof dofPopulateDeptDropdown === 'function') dofPopulateDeptDropdown();
      if (typeof dofRenderRoleBadge     === 'function') dofRenderRoleBadge();
      if (typeof dofApplyRoleTypes      === 'function') dofApplyRoleTypes();
      if (typeof dofUpdateRef           === 'function') dofUpdateRef();
      if (typeof dofToggleLangFields    === 'function') dofToggleLangFields();
      if (typeof loadDocLog             === 'function') loadDocLog();
    }
  };
}

/* ── Keep original quick-print functions as aliases ── */
function printStaffConfirmation() { dofQuick('COS', 'Confirmation of Active Service', 'အတည်ပြုချက်'); }
function printStaffGoodStanding() { dofQuick('GSC', 'Certificate of Good Standing',   'ထောက်ခံစာ'); }
function printFacultyInfoRecord() { dofQuick('FIR', 'Faculty Member Information Record','အချက်အလက် မှတ်တမ်း'); }

function _getStudentForPrint() {
  const s = students.find(x => x.id === currentProfileId);
  if (!s) { toast('No student selected.', '⚠'); return null; }
  return s;
}

function _todayFormatted() {
  return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function _letterHead() {
  const dept = document.getElementById('dof-dept')?.value || 'SEC';
  return _letterHeadWithDept(dept, 'en');
}

/* ── Letterhead with department name shown ── */
function _letterHeadWithDept(deptCode, lang) {
  /* RULE:
     COS / GSC / FIR  → always IUC Secretariat letterhead (force SEC), no exceptions.
     STM / LTR / DIR  → use the deptCode passed in (Registrar: any dept; Staff: own dept).
     VC letterhead     → only available for STM/LTR/DIR, Registrar only. */
  const _callerType = document.getElementById('dof-type')?.value || '';
  const _fixedTypes = ['COS','GSC','FIR'];
  const _isFixedDoc = _fixedTypes.includes(_callerType);

  /* Force Secretariat for COS/GSC/FIR */
  if (_isFixedDoc) deptCode = 'SEC';

  const lhMode  = document.getElementById('dof-letterhead')?.value || 'iuc';
  /* VC only for non-fixed docs */
  const isVC    = lhMode === 'vc' && !_isFixedDoc;
  const deptName = _getDeptOfficeName(deptCode || 'SEC');
  const showMm  = lang === 'mm' || lang === 'bilingual';
  const deptMM  = _DEPT_MM[deptCode] || '';

  /* ── Vice Chancellor letterhead ── */
  if (isVC) {
    return `
    <div style="display:flex;align-items:center;gap:20px;border-bottom:2.5px solid #8B1A2E;padding-bottom:16px;margin-bottom:24px">
      <img src="${_LOGO_URL}" alt="UM2 Logo" style="height:72px;width:auto;flex-shrink:0" onerror="this.style.display='none'">
      <div style="flex:1">
        <div style="font-size:9pt;letter-spacing:2px;text-transform:uppercase;color:#555;margin-bottom:2px">University of Medicine (2), Yangon</div>
        <div style="font-size:17pt;font-weight:bold;font-family:'Times New Roman',serif;color:#8B1A2E">Office of the Vice Chancellor</div>
        <div style="font-size:9pt;color:#8B1A2E;font-weight:600;margin-top:3px">ဒုတိယအဓိပတိရုံး</div>
        <div style="font-size:8pt;color:#777;margin-top:1px">Institutional Registry & Information Repository · Authorized Personnel Only</div>
      </div>
    </div>`;
  }

  /* ── Default IUC Secretariat / Departmental letterhead ── */
  const isDeptDoc = (deptCode !== 'SEC' && deptCode !== 'ADM');
  const deptLine = isDeptDoc
    ? (showMm && deptMM
        ? `Department of ${deptName} · ${deptMM} ဌာန`
        : `Department of ${deptName}`)
    : (showMm ? `UM2 IUC Secretariat${deptMM ? ' · ' + deptMM : ''}` : 'UM2 IUC Secretariat');

  /* For STM/LTR/DIR on a departmental letterhead, show auth control chain */
  const authLine = isDeptDoc
    ? '<div style="font-size:7.5pt;color:#8B1A2E;margin-top:2px;font-style:italic;letter-spacing:.3px">Issued under Secretariat Office Authentication &amp; Document Control</div>'
    : '';

  return `
    <div style="display:flex;align-items:center;gap:20px;border-bottom:2.5px solid #8B1A2E;padding-bottom:16px;margin-bottom:24px">
      <img src="${_LOGO_URL}" alt="UM2 Logo" style="height:72px;width:auto;flex-shrink:0" onerror="this.style.display='none'">
      <div style="flex:1">
        <div style="font-size:9pt;letter-spacing:2px;text-transform:uppercase;color:#555;margin-bottom:2px">University of Medicine (2), Yangon</div>
        <div style="font-size:17pt;font-weight:bold;font-family:'Times New Roman',serif;color:#8B1A2E">Interim University Council</div>
        <div style="font-size:9pt;color:#8B1A2E;font-weight:600;margin-top:3px">${deptLine}</div>
        ${authLine}
        <div style="font-size:8pt;color:#777;margin-top:1px">Institutional Registry & Information Repository · Authorized Personnel Only</div>
      </div>
    </div>`;
}

function _getDeptOfficeName(deptCode) {
  const code = (deptCode || 'SEC').toUpperCase();
  const name = _DEPT_EN_NAME[code] || code;
  if (code === 'SEC' || code === 'ADM') return name; // "Secretariat"
  return name; // "Anatomy", "Physiology", etc — just the department name, no prefix
}

/* ── Toggle subject/body field visibility based on language selection ── */
function dofToggleLangFields() {
  const lang = document.getElementById('dof-lang')?.value || 'en';
  const type = document.getElementById('dof-type')?.value || '';
  const fixedTypes = ['COS','GSC','FIR'];
  const isFixed = fixedTypes.includes(type);
  const enWrap = document.getElementById('dof-subject-en-wrap');
  const mmWrap = document.getElementById('dof-subject-mm-wrap');
  const signingWrap = document.getElementById('dof-signing-wrap');
  if (enWrap) enWrap.style.display = (isFixed || type === 'STM') ? 'none' : (lang === 'mm' ? 'none' : '');
  if (mmWrap) mmWrap.style.display = (isFixed || type === 'STM' || lang === 'en') ? 'none' : '';
  /* Signature block shown for ALL non-fixed types regardless of language */
  if (signingWrap && type && !isFixed) {
    signingWrap.style.display = '';
  }
}

/* ── Dynamic signature block — single signer, NO seal (customizable letters) ── */
function _signatureBlockDynamic(s, signMode, signLeft, _unused) {
  const dept      = document.getElementById('dof-dept')?.value || s.dept || '';
  const signerEmail    = (document.getElementById('dof-sign-email-left')?.value || '').trim();
  const deptOfficeName = _getDeptOfficeName(dept);

  const leftName  = signLeft?.name  || s.name  || '';
  const leftTitle = signLeft?.title || s.title || '';
  const leftPos   = signLeft?.pos   || (signMode === 'department' ? deptOfficeName : '');
  const authPhrase = signLeft?.auth || '';

  const eSignBadge = authPhrase
    ? `<div style="display:inline-flex;align-items:center;gap:5px;background:#EBF5F0;border:1px solid #1A5C3A;border-radius:4px;padding:3px 9px;margin-bottom:8px;font-size:8pt;color:#1A5C3A;font-weight:600;letter-spacing:.3px">
        <span style="font-size:9pt">✔</span> Electronically Signed
      </div>` : '';
  return `
    <div style="margin-top:64px;display:flex;justify-content:flex-end;align-items:flex-end;gap:40px">
      <div style="text-align:center;min-width:200px">
        ${eSignBadge}
        ${authPhrase ? `<div style="font-size:9.5pt;font-style:italic;color:#555;margin-bottom:10px">${authPhrase}</div>` : ''}
        <div style="border-top:1px solid #000;padding-top:6px;font-size:10.5pt;font-weight:600">${leftName}</div>
        ${leftTitle ? `<div style="font-size:9.5pt;color:#444">${leftTitle}</div>` : ''}
        ${leftPos   ? `<div style="font-size:9pt;color:#666">${leftPos}</div>`   : ''}
        ${signerEmail ? `<div style="font-size:8.5pt;color:#888;margin-top:1px">${signerEmail}</div>` : ''}
        <div style="font-size:9pt;color:#888;margin-top:2px">${_todayFormatted()}</div>
      </div>
    </div>
    <div style="margin-top:36px;font-size:7.5pt;color:#999;text-align:center;border-top:1px solid #ddd;padding-top:8px">
      Generated by UM2 Institutional Registry & Information Repository System on ${_todayFormatted()}. Valid without the  stamp and  signature.
    </div>`;
}

function _signatureBlock(signLeft, signRight) {
  const dept     = document.getElementById('dof-dept')?.value || 'SEC';
  const sealFile = _DEPT_SEAL[dept] || 'secretariat.svg';
  const deptOfficeName = _getDeptOfficeName(dept);
  /* For COS/GSC/FIR the letterhead is always IUC Secretariat, so the
     default signer name should always be "Registrar", not the dept name. */
  const _callerType  = document.getElementById('dof-type')?.value || '';
  const _fixedTypes  = ['COS','GSC','FIR'];
  const _defaultName = _fixedTypes.includes(_callerType) ? 'Registrar' : deptOfficeName;
  const leftName  = signLeft?.name  || _defaultName;
  const leftTitle = signLeft?.title || '';
  const leftPos   = signLeft?.pos   || '';
  const rightName  = signRight?.name  || '';
  const rightTitle = signRight?.title || '';
  const rightPos   = signRight?.pos   || 'Vice Chancellor';
  return `
    <div style="margin-top:64px;display:flex;justify-content:space-between;align-items:flex-end">
      <div style="text-align:center;width:200px">
        <div style="border-top:1px solid #000;padding-top:6px;font-size:10pt;font-weight:600">${leftName}</div>
        ${leftTitle ? `<div style="font-size:9.5pt;color:#444">${leftTitle}</div>` : ''}
        ${leftPos   ? `<div style="font-size:9pt;color:#666">${leftPos}</div>` : ''}
      </div>
      <div style="text-align:center">
        <img src="${sealFile}" alt="Department Seal"
          style="width:160px;height:160px;object-fit:contain;display:block;margin:0 auto 4px"
          onerror="this.onerror=null;this.src='${_SEAL_URL}'">
      </div>
      <div style="text-align:center;width:200px">
        <div style="border-top:1px solid #000;padding-top:6px;font-size:10pt;font-weight:600">${rightName}</div>
        ${rightTitle ? `<div style="font-size:9.5pt;color:#444">${rightTitle}</div>` : ''}
        ${rightPos   ? `<div style="font-size:9pt;color:#666">${rightPos}</div>` : ''}
      </div>
    </div>
    <div style="margin-top:36px;font-size:7.5pt;color:#999;text-align:center;border-top:1px solid #ddd;padding-top:8px">
      Generated by UM2 Institutional Registry & Information Repository System on ${_todayFormatted()}. Valid  without stamp and signature.
    </div>`;
}

function _printDoc(html, docLabel) {
  const typeVal  = document.getElementById('dof-type')?.value || '';
  const typeLabels = {
    LTR:'Official Letter', DIR:'Directive', STM:'Statement',
    COS:'Confirmation of Service', GSC:'Good Standing',
    FIR:'Faculty Info Record',
  };
  const label = docLabel || typeLabels[typeVal] || typeVal || 'Document';

  const prevTitle = document.title;
  /* Set title to just the doc type — no name appended, so PDF filename is clean */
  document.title  = label;

  const area = document.getElementById('printArea');
  area.innerHTML = html;
  area.style.display = 'block';
  setTimeout(() => {
    window.print();
    setTimeout(() => {
      document.title = prevTitle;
      area.style.display = 'none';
      area.innerHTML = '';
    }, 800);
  }, 200);
}

function openTranscript() {
  const s = _getStudentForPrint();
  if (!s) return;
  const sid     = s.id;
  const grades  = gradeData[sid] || [];
  const isGrad  = s.grad_status === 'Graduated';
  const now     = new Date();
  const issued  = now.toLocaleDateString('en-GB', { day:'2-digit', month:'2-digit', year:'numeric' });
  const issuedTime = now.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });

  /* Group grades by enrollment year label */
  const byYear = {};
  grades.forEach(g => {
    const yr = g.year || 'Unknown Year';
    if (!byYear[yr]) byYear[yr] = [];
    byYear[yr].push(g);
  });

  const yearOrder = Object.keys(byYear).sort();

  let tableRows = '';
  yearOrder.forEach(yr => {
    tableRows += `<tr><td colspan="8" style="background:#f7f0f2;font-weight:700;font-size:9.5pt;padding:8px 12px;letter-spacing:.3px;border-bottom:1.5px solid #c9a0aa">Year ${yr}</td></tr>`;
    byYear[yr].forEach(g => {
      const score  = g.score ?? g.NumericScore ?? g.numericscore ?? '—';
      const course = g.course || g.course_id || g.CourseID || '—';
      const cid    = g.course_id || g.CourseID || g.courseid || '';
      const letter = g.letter || '—';
      const credits= g.credits || '—';
      const assess = g.assessment_type || 'Written Exam';
      tableRows += `<tr>
        <td style="font-size:9pt;padding:7px 10px;border-bottom:1px solid #eee;font-family:monospace;color:#6b1a2e">${cid}</td>
        <td style="font-size:9pt;padding:7px 10px;border-bottom:1px solid #eee;font-weight:500">${course}</td>
        <td style="font-size:9pt;padding:7px 10px;border-bottom:1px solid #eee;text-align:center">${credits}</td>
        <td style="font-size:9pt;padding:7px 10px;border-bottom:1px solid #eee;text-align:center;color:#555">${assess}</td>
        <td style="font-size:9pt;padding:7px 10px;border-bottom:1px solid #eee;text-align:center;font-weight:600">${score}</td>
        <td style="font-size:9pt;padding:7px 10px;border-bottom:1px solid #eee;text-align:center">${yr}</td>
        <td style="font-size:9pt;padding:7px 10px;border-bottom:1px solid #eee;text-align:center;font-weight:700;color:#8B1A2E">${letter}</td>
        <td style="font-size:9pt;padding:7px 10px;border-bottom:1px solid #eee"></td>
      </tr>`;
    });
  });

  if (!tableRows) {
    tableRows = `<tr><td colspan="8" style="text-align:center;padding:24px;color:#999;font-style:italic">No grade records found.</td></tr>`;
  }

  const gpa = s.gpa ? Number(s.gpa).toFixed(2) : '—';
  const program = s.program || 'Bachelor of Medicine &amp; Bachelor of Surgery';
  const nameEn  = s.name_en || s.id;
  const nameMy  = s.name_my  ? ` (${s.name_my})`  : '';
  const fatherEn= s.father   || '—';
  const dob     = s.dob      || '—';
  const admitted= s.admission|| '—';
  const enrollStatus = isGrad ? 'Graduated' : (s.status || 'Active');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Academic Transcript — ${nameEn}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;color:#1a1a1a;font-size:10pt;padding:0}
  .page{max-width:820px;margin:0 auto;padding:28px 36px 48px}
  .topbar{display:flex;justify-content:space-between;align-items:center;font-size:8pt;color:#666;padding-bottom:8px;border-bottom:1px solid #e0d0d4;margin-bottom:18px}
  .header{display:flex;align-items:center;gap:18px;margin-bottom:18px}
  .logo{height:64px;width:auto}
  .uni-block{}
  .uni-name{font-size:20pt;font-weight:700;color:#1a1a1a;letter-spacing:.5px}
  .uni-sub{font-size:8.5pt;color:#555;line-height:1.5}
  .doc-title-block{text-align:right;flex-shrink:0}
  .doc-title{font-size:14pt;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#1a1a1a}
  .doc-meta{font-size:8.5pt;color:#444;line-height:1.6;margin-top:4px}
  .divider{border:none;border-top:2.5px solid #8B1A2E;margin:10px 0 18px}
  .section-label{font-size:7.5pt;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#555;margin-bottom:8px}
  .info-grid{display:grid;grid-template-columns:140px 1fr;gap:4px 12px;margin-bottom:18px}
  .info-key{font-size:8pt;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#777}
  .info-val{font-size:9.5pt;color:#1a1a1a}
  .info-val.bold{font-weight:700}
  .info-val.crimson{color:#8B1A2E;font-weight:700}
  .record-heading{font-size:9.5pt;font-weight:700;color:#1a1a1a;padding:10px 0 8px;border-bottom:1.5px solid #8B1A2E;margin-bottom:8px;letter-spacing:.2px}
  .foundation-label{font-size:11pt;font-weight:700;color:#1a1a1a;margin:16px 0 10px;padding-left:2px}
  table{width:100%;border-collapse:collapse}
  thead tr th{font-size:8pt;font-weight:700;letter-spacing:.5px;text-transform:uppercase;background:#f7f0f2;color:#6b1a2e;padding:8px 10px;border-bottom:1.5px solid #c9a0aa;text-align:left}
  thead tr th.center{text-align:center}
  .gpa-row{margin-top:18px;display:flex;justify-content:flex-end}
  .gpa-box{background:#f7f0f2;border:1.5px solid #c9a0aa;border-radius:6px;padding:10px 22px;text-align:center}
  .gpa-label{font-size:7.5pt;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#6b1a2e;margin-bottom:2px}
  .gpa-value{font-size:18pt;font-weight:700;color:#8B1A2E;line-height:1}
  .gpa-den{font-size:9pt;color:#555}
  .notice-box{margin-top:28px;border-top:1px solid #ddd;padding-top:14px}
  .notice-title{font-size:7.5pt;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#444;margin-bottom:6px}
  .notice-text{font-size:8pt;color:#555;line-height:1.6}
  .sig-block{margin-top:36px;display:flex;justify-content:flex-end}
  .sig-inner{text-align:center}
  .sig-line{width:160px;border-top:1px solid #333;margin:0 auto 4px}
  .sig-name{font-size:8.5pt;font-weight:700}
  .sig-title{font-size:7.5pt;color:#555}
  @media print{body{padding:0}.page{padding:18px 28px 36px}}
</style>
</head>
<body>
<div class="page">
  <div class="topbar">
    <span>Academic Transcript — ${nameEn}</span>
    <span>${issued}, ${issuedTime}</span>
  </div>
  <div class="header">
    <img class="logo" src="${_LOGO_URL}" alt="UM2" onerror="this.style.display='none'">
    <div class="uni-block" style="flex:1">
      <div class="uni-name">UM2</div>
      <div class="uni-sub">Interim University Council<br>Republic of the Union of Myanmar</div>
    </div>
    <div class="doc-title-block">
      <div class="doc-title">Academic Transcript</div>
      <div class="doc-meta">Student ID: <strong>${s.id}</strong><br>Enrollment: <strong>${enrollStatus}</strong></div>
    </div>
  </div>
  <hr class="divider">

  <div class="section-label">Student Details</div>
  <div class="info-grid">
    <div class="info-key">Full Name</div>       <div class="info-val bold">${nameEn}${nameMy}</div>
    <div class="info-key">Father's Name</div>   <div class="info-val bold">${fatherEn}</div>
    <div class="info-key">Date of Birth</div>   <div class="info-val bold">${dob}</div>
    <div class="info-key">Degree Program</div>  <div class="info-val bold">${program}</div>
    <div class="info-key">Admitted</div>         <div class="info-val bold">${admitted}</div>
    <div class="info-key">Overall GPA</div>      <div class="info-val crimson">${gpa} / 4.00</div>
  </div>
  <hr class="divider">

  <div class="record-heading">Academic Record — ${program}</div>
  <div class="foundation-label">— Foundation Year · ${program}</div>

  <table>
    <thead>
      <tr>
        <th>Course Code</th>
        <th>Course Title</th>
        <th class="center">Credits</th>
        <th class="center">Assessment Type</th>
        <th class="center">Score</th>
        <th class="center">Year</th>
        <th class="center">Grade</th>
        <th>Note</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>

  <div class="gpa-row">
    <div class="gpa-box">
      <div class="gpa-label">Overall GPA</div>
      <div class="gpa-value">${gpa} <span class="gpa-den">/ 4.00</span></div>
    </div>
  </div>

  <div class="notice-box">
    <div class="notice-title">Official Notice</div>
    <div class="notice-text">
      This document is an official record.<br>
      Any alteration renders it invalid.<br>
      Issued on ${issued}.
    </div>
  </div>

  <div class="sig-block">
    <div class="sig-inner">
      <div class="sig-line"></div>
      <div class="sig-name">Registrar</div>
      <div class="sig-title">University of Medicine (2)</div>
      <div class="sig-title" style="font-style:italic;color:#999;margin-top:2px">Registrar Signature</div>
    </div>
  </div>
</div>
</body>
</html>`;

  const win = window.open('', `transcript_${s.id}`, '');
  if (win) {
    win.document.open();
    win.document.write(html);
    win.document.close();
  } else {
    toast('Pop-up blocked. Please allow pop-ups and try again.', '⚠');
  }
}

function printConfirmationOfStudy() {
  const s = _getStudentForPrint();
  if (!s) return;
  const refNo = `UM2/SEC/COS/${s.id}/${new Date().getFullYear()}`;
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<title>Confirmation of Study — ${s.name_en || s.id}</title>
<style>
  body{font-family:'Times New Roman',Times,serif;font-size:12pt;color:#000;background:#fff;margin:0;padding:0}
  .page{padding:22mm 28mm;max-width:210mm;margin:0 auto}
  @media print{@page{size:A4 portrait;margin:22mm 28mm}body,html{margin:0;padding:0}.page{padding:0}}
</style></head><body><div class="page">
    <div style="display:flex;align-items:center;gap:20px;border-bottom:2.5px solid #8B1A2E;padding-bottom:16px;margin-bottom:24px">
      <img src="${_LOGO_URL}" alt="UM2" style="height:72px;width:auto" onerror="this.style.display='none'">
      <div>
        <div style="font-size:9pt;letter-spacing:2px;text-transform:uppercase;color:#555;margin-bottom:2px">University of Medicine (2), Yangon</div>
        <div style="font-size:17pt;font-weight:bold;font-family:'Times New Roman',serif;color:#8B1A2E">Interim University Council</div>
        <div style="font-size:9pt;color:#8B1A2E;font-weight:600;margin-top:3px">UM2 IUC Secretariat</div>
        <div style="font-size:8pt;color:#777;margin-top:1px">Institutional Registry &amp; Information Repository · Authorized Personnel Only</div>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;font-size:10pt">
      <div></div>
      <div style="text-align:right;line-height:1.8">
        <strong>Ref:</strong> ${refNo}<br>
        <strong>Date:</strong> ${_todayFormatted()}
      </div>
    </div>
    <div style="text-align:center;margin-bottom:28px">
      <span style="font-size:14pt;font-weight:bold;text-decoration:underline;text-transform:uppercase;letter-spacing:1.5px">
        Confirmation of Study
      </span>
    </div>
    <p style="margin-bottom:16px">To Whom It May Concern,</p>
    <p style="margin-bottom:16px;text-align:justify;line-height:1.9">
      This is to confirm that <strong>${s.name_en}${s.name_my ? ' (' + s.name_my + ')' : ''}</strong>,
      bearing Student ID <strong>${s.id}</strong>${s.dob ? ', date of birth <strong>' + s.dob + '</strong>' : ''},
      is currently enrolled as a <strong>${s.status || 'Active'}</strong> student in the
      <strong>${s.program || 'MBBS'} Programme</strong> at the University of Medicine (2), Yangon.
    </p>
    <p style="margin-bottom:16px;text-align:justify;line-height:1.9">
      The student is presently in <strong>${s.year || '—'}</strong> of the programme,
      having been admitted in <strong>${s.admission || '—'}</strong>.
      ${s.gpa ? 'Their current cumulative GPA is <strong>' + Number(s.gpa).toFixed(2) + ' / 4.00</strong>.' : ''}
    </p>
    <p style="margin-bottom:28px;text-align:justify;line-height:1.9">
      This letter is issued upon the request of the student for official purposes. The Secretariat's Office
      certifies the accuracy of the above information as of the date of issue.
    </p>
    <p style="margin-bottom:4px">Yours faithfully,</p>
    <div style="margin-top:64px;display:flex;justify-content:space-between;align-items:flex-end">
      <div style="text-align:center;width:200px">
        <div style="border-top:1px solid #000;padding-top:6px;font-size:10pt;font-weight:600">Registrar</div>
        <div style="font-size:9pt;color:#444">University of Medicine (2)</div>
      </div>
      <div style="text-align:center">
        <img src="${_SEAL_URL}" alt="Seal" style="width:120px;height:120px;object-fit:contain;display:block;margin:0 auto 4px" onerror="this.style.display='none'">
      </div>
      <div style="width:200px"></div>
    </div>
    <div style="margin-top:36px;font-size:7.5pt;color:#999;text-align:center;border-top:1px solid #ddd;padding-top:8px">
      Generated by UM2 Institutional Registry &amp; Information Repository System on ${_todayFormatted()}. Valid without stamp and signature.
    </div>
</div>window.onload=function(){window.print();}<\/script></body></html>`;
  const win = window.open('', `cos_${s.id}`, '');
  if (win) { win.document.open(); win.document.write(html); win.document.close(); }
  else { toast('Pop-up blocked. Please allow pop-ups and try again.', '⚠'); }
}

function printGoodStanding() {
  const s = _getStudentForPrint();
  if (!s) return;
  const refNo = `UM2/SEC/GSC/${s.id}/${new Date().getFullYear()}`;
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<title>Certificate of Good Standing — ${s.name_en || s.id}</title>
<style>
  body{font-family:'Times New Roman',Times,serif;font-size:12pt;color:#000;background:#fff;margin:0;padding:0}
  .page{padding:22mm 28mm;max-width:210mm;margin:0 auto}
  @media print{@page{size:A4 portrait;margin:22mm 28mm}body,html{margin:0;padding:0}.page{padding:0}}
</style></head><body><div class="page">
    <div style="display:flex;align-items:center;gap:20px;border-bottom:2.5px solid #8B1A2E;padding-bottom:16px;margin-bottom:24px">
      <img src="${_LOGO_URL}" alt="UM2" style="height:72px;width:auto" onerror="this.style.display='none'">
      <div>
        <div style="font-size:9pt;letter-spacing:2px;text-transform:uppercase;color:#555;margin-bottom:2px">University of Medicine (2), Yangon</div>
        <div style="font-size:17pt;font-weight:bold;font-family:'Times New Roman',serif;color:#8B1A2E">Interim University Council</div>
        <div style="font-size:9pt;color:#8B1A2E;font-weight:600;margin-top:3px">UM2 IUC Secretariat</div>
        <div style="font-size:8pt;color:#777;margin-top:1px">Institutional Registry &amp; Information Repository · Authorized Personnel Only</div>
      </div>
    </div>
    <div style="display:flex;justify-content:flex-end;margin-bottom:28px;font-size:10pt">
      <div style="text-align:right;line-height:1.8">
        <strong>Ref:</strong> ${refNo}<br>
        <strong>Date:</strong> ${_todayFormatted()}
      </div>
    </div>
    <div style="text-align:center;margin-bottom:28px">
      <span style="font-size:14pt;font-weight:bold;text-decoration:underline;text-transform:uppercase;letter-spacing:1.5px">
        Certificate of Good Standing
      </span>
    </div>
    <p style="margin-bottom:16px">To Whom It May Concern,</p>
    <p style="margin-bottom:16px;text-align:justify;line-height:1.9">
      This is to certify that <strong>${s.name_en}${s.name_my ? ' (' + s.name_my + ')' : ''}</strong>,
      Student ID <strong>${s.id}</strong>${s.dob ? ', date of birth <strong>' + s.dob + '</strong>' : ''},
      is a registered student of the <strong>${s.program || 'MBBS'} Programme</strong>
      at the University of Medicine (2), Yangon, currently in <strong>${s.year || '—'}</strong>,
      admitted in <strong>${s.admission || '—'}</strong>.
    </p>
    <p style="margin-bottom:16px;text-align:justify;line-height:1.9">
      Based on the records maintained by the Secretariat's Office, the above-named student is
      <strong>in good academic and disciplinary standing</strong> with the university as of the date of this certificate.
      ${s.gpa ? 'The student maintains a cumulative GPA of <strong>' + Number(s.gpa).toFixed(2) + ' / 4.00</strong>.' : ''}
    </p>
    <p style="margin-bottom:16px;text-align:justify;line-height:1.9">
      There are no outstanding disciplinary proceedings, academic sanctions, or administrative holds
      recorded against this student in the university's official registry.
    </p>
    <p style="margin-bottom:28px;text-align:justify;line-height:1.9">
      This certificate is issued at the student's request and is valid for official purposes. It is generated by UM2 Institutional Registry &amp; Information Repository and is valid without stamp and signature.
    </p>
    <p style="margin-bottom:4px">Yours faithfully,</p>
    <div style="margin-top:64px;display:flex;justify-content:space-between;align-items:flex-end">
      <div style="text-align:center;width:200px">
        <div style="border-top:1px solid #000;padding-top:6px;font-size:10pt;font-weight:600">Registrar</div>
        <div style="font-size:9pt;color:#444">University of Medicine (2)</div>
      </div>
      <div style="text-align:center">
        <img src="${_SEAL_URL}" alt="Seal" style="width:120px;height:120px;object-fit:contain;display:block;margin:0 auto 4px" onerror="this.style.display='none'">
      </div>
      <div style="width:200px"></div>
    </div>
    <div style="margin-top:36px;font-size:7.5pt;color:#999;text-align:center;border-top:1px solid #ddd;padding-top:8px">
      Generated by UM2 Institutional Registry &amp; Information Repository System on ${_todayFormatted()}. Valid without stamp and signature.
    </div>
</div>window.onload=function(){window.print();}<\/script></body></html>`;
  const win = window.open('', `gsc_${s.id}`, '');
  if (win) { win.document.open(); win.document.write(html); win.document.close(); }
  else { toast('Pop-up blocked. Please allow pop-ups and try again.', '⚠'); }
}
