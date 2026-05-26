// ── Course catalog ────────────────────────────────────────────
// This is the built-in fallback catalog for the MBBS program.
// To support additional degree programs, your backend's login response
// can include a `courses` object and an optional `program_meta` object:
//
//   r.courses      → { [courseId]: { name, year, block, credits, assessment } }
//   r.program_meta → {
//                      label: 'MSc Nursing',          // shown in grade headers
//                      yearOrder: ['Year 1','Year 2']  // preferred sort order
//                    }
//
// When present, these override the built-in MBBS data below entirely.
// No changes to this file are needed to add new programs.
const COURSES_MBBS = {
  CRS001: { name: 'Myanmar Language',                              year: 'Foundation Year', block: 'Block 1 — Foundation for Science',            credits: 5,  assessment: 'Written Exam' },
  CRS002: { name: 'English Language',                              year: 'Foundation Year', block: 'Block 1 — Foundation for Science',            credits: 5,  assessment: 'Written Exam' },
  CRS003: { name: 'Mathematics',                                   year: 'Foundation Year', block: 'Block 1 — Foundation for Science',            credits: 5,  assessment: 'Written Exam' },
  CRS004: { name: 'Chemistry',                                     year: 'Foundation Year', block: 'Block 1 — Foundation for Science',            credits: 5,  assessment: 'Written Exam' },
  CRS005: { name: 'Physics',                                       year: 'Foundation Year', block: 'Block 1 — Foundation for Science',            credits: 5,  assessment: 'Written Exam' },
  CRS006: { name: 'Botany',                                        year: 'Foundation Year', block: 'Block 1 — Foundation for Science',            credits: 3,  assessment: 'Written Exam' },
  CRS007: { name: 'Zoology',                                       year: 'Foundation Year', block: 'Block 1 — Foundation for Science',            credits: 2,  assessment: 'Written Exam' },
  CRS008: { name: 'Principle of Structure (Anatomy)',              year: 'Foundation Year', block: 'Block 2 — Principle Block',                   credits: 3,  assessment: 'Written Exam' },
  CRS009: { name: 'Principle of Function (Physiology)',            year: 'Foundation Year', block: 'Block 2 — Principle Block',                   credits: 3,  assessment: 'Written Exam' },
  CRS010: { name: 'Principle of Molecule (Biochemistry)',          year: 'Foundation Year', block: 'Block 2 — Principle Block',                   credits: 2,  assessment: 'Written Exam' },
  CRS011: { name: 'Principle of Disease Mechanism (Pathology)',    year: 'Foundation Year', block: 'Block 2 — Principle Block',                   credits: 3,  assessment: 'Written Exam' },
  CRS012: { name: 'Principle of Drug Therapy (Pharmacology)',      year: 'Foundation Year', block: 'Block 2 — Principle Block',                   credits: 2,  assessment: 'Written Exam' },
  CRS013: { name: 'Principle of Defence Mechanism (Microbiology)', year: 'Foundation Year', block: 'Block 2 — Principle Block',                   credits: 2,  assessment: 'Written Exam' },
  CRS014: { name: 'Personal & Professional Development (PPD)',     year: 'Foundation Year', block: 'Block 3 — Personal & Professional Development',credits: 10, assessment: 'Portfolio / Continuous' },
  CRS015: { name: 'Musculo-skeletal',                              year: 'M-1',             block: 'Integrated System Modules',                   credits: 8,  assessment: 'In-block exam' },
  CRS016: { name: 'Genetic',                                       year: 'M-1',             block: 'Integrated System Modules',                   credits: 8,  assessment: 'In-block exam' },
  CRS017: { name: 'Cardio-vascular',                               year: 'M-1',             block: 'Integrated System Modules',                   credits: 8,  assessment: 'In-block exam' },
  CRS018: { name: 'Respiratory',                                   year: 'M-1',             block: 'Integrated System Modules',                   credits: 8,  assessment: 'In-block exam' },
  CRS019: { name: 'GI, Liver, Nutrition',                          year: 'M-1',             block: 'Integrated System Modules',                   credits: 8,  assessment: 'In-block exam' },
  CRS020: { name: 'Haematology',                                   year: 'M-2',             block: 'Integrated System Modules',                   credits: 8,  assessment: 'In-block exam' },
  CRS021: { name: 'Immunology',                                    year: 'M-2',             block: 'Integrated System Modules',                   credits: 8,  assessment: 'In-block exam' },
  CRS022: { name: 'Endocrine',                                     year: 'M-2',             block: 'Integrated System Modules',                   credits: 8,  assessment: 'In-block exam' },
  CRS023: { name: 'Renal & Reproductive',                          year: 'M-2',             block: 'Integrated System Modules',                   credits: 8,  assessment: 'In-block exam' },
  CRS024: { name: 'Neurology & Psychiatry',                        year: 'M-2',             block: 'Integrated System Modules',                   credits: 8,  assessment: 'In-block exam' },
  CRS025: { name: 'General Medicine',                              year: 'M-3',             block: 'Junior Clerkship',                            credits: 10, assessment: 'DOPS / Mini-CEX' },
  CRS026: { name: 'General Surgery',                               year: 'M-3',             block: 'Junior Clerkship',                            credits: 10, assessment: 'DOPS / Mini-CEX' },
  CRS027: { name: 'Infectious Diseases',                           year: 'M-3',             block: 'Junior Clerkship',                            credits: 3,  assessment: 'DOPS / Mini-CEX' },
  CRS028: { name: 'Radiology & Imaging',                           year: 'M-3',             block: 'Junior Clerkship',                            credits: 3,  assessment: 'Image interpretation OSCE' },
  CRS029: { name: 'Dermatology',                                   year: 'M-3',             block: 'Junior Clerkship',                            credits: 2,  assessment: 'Clinical exam' },
  CRS030: { name: 'Ophthalmology (Eye)',                           year: 'M-3',             block: 'Junior Clerkship',                            credits: 1,  assessment: 'Clinical exam' },
  CRS031: { name: 'Ear, Nose & Throat (ENT)',                      year: 'M-3',             block: 'Junior Clerkship',                            credits: 1,  assessment: 'Clinical exam' },
  CRS032: { name: 'Orthopaedics & Trauma Surgery',                 year: 'M-3',             block: 'Junior Clerkship',                            credits: 4,  assessment: 'DOPS / Mini-CEX' },
  CRS033: { name: 'Rehabilitation Medicine',                       year: 'M-3',             block: 'Junior Clerkship',                            credits: 3,  assessment: 'Case presentation' },
  CRS034: { name: 'Forensic Medicine',                             year: 'M-3',             block: 'Junior Clerkship',                            credits: 3,  assessment: 'Written exam' },
  CRS035: { name: 'Elective',                                      year: 'M-3',             block: 'Junior Clerkship',                            credits: 5,  assessment: 'Elective report' },
  CRS036: { name: 'Paediatrics',                                   year: 'M-4',             block: 'Specialty Clerkship',                         credits: 5,  assessment: 'DOPS / Mini-CEX' },
  CRS037: { name: 'Obstetrics & Gynaecology (O&G)',                year: 'M-4',             block: 'Specialty Clerkship',                         credits: 5,  assessment: 'DOPS / Mini-CEX' },
  CRS038: { name: 'Psychiatry',                                    year: 'M-4',             block: 'Specialty Clerkship',                         credits: 5,  assessment: 'MSE / Case report' },
  CRS039: { name: 'Medicine (Internal Medicine)',                   year: 'M-4',             block: 'Specialty Clerkship',                         credits: 3,  assessment: 'Mini-CEX' },
  CRS040: { name: 'Geriatric Medicine',                            year: 'M-4',             block: 'Specialty Clerkship',                         credits: 2,  assessment: 'Case presentation' },
  CRS041: { name: 'Palliative Care',                               year: 'M-4',             block: 'Specialty Clerkship',                         credits: 2,  assessment: 'Portfolio' },
  CRS042: { name: 'Surgery (Advanced General)',                    year: 'M-4',             block: 'Specialty Clerkship',                         credits: 3,  assessment: 'DOPS' },
  CRS043: { name: 'Emergency Medicine (EM)',                       year: 'M-4',             block: 'Specialty Clerkship',                         credits: 3,  assessment: 'DOPS / Mini-CEX' },
  CRS044: { name: 'Anaesthesia',                                   year: 'M-4',             block: 'Specialty Clerkship',                         credits: 2,  assessment: 'DOPS' },
  CRS045: { name: 'Forensic Medicine',                             year: 'M-4',             block: 'Specialty Clerkship',                         credits: 1,  assessment: 'Written exam' },
  CRS046: { name: 'Residential Field Trip',                        year: 'M-4',             block: 'Specialty Clerkship',                         credits: 5,  assessment: 'Field report' },
  CRS047: { name: 'Medicine — Senior Hospital Posting',            year: 'M-5',             block: 'Senior Clerkship',                            credits: 10, assessment: 'Mini-CEX / CBD' },
  CRS048: { name: 'Surgery — Senior Hospital Posting',             year: 'M-5',             block: 'Senior Clerkship',                            credits: 10, assessment: 'DOPS / CBD' },
  CRS049: { name: 'Obstetrics & Gynaecology — Senior',             year: 'M-5',             block: 'Senior Clerkship',                            credits: 10, assessment: 'DOPS / Mini-CEX' },
  CRS050: { name: 'Paediatrics — Senior Hospital Posting',         year: 'M-5',             block: 'Senior Clerkship',                            credits: 10, assessment: 'Mini-CEX / CBD' },
  CRS051: { name: 'SSC — Research Project (Dissertation)',         year: 'M-5',             block: 'Senior Clerkship',                            credits: 5,  assessment: 'Dissertation + viva' },
  CRS052: { name: 'SSC — Clinical Special Interest Attachment',    year: 'M-5',             block: 'Senior Clerkship',                            credits: 5,  assessment: 'Portfolio / log' },
};

// ── Program metadata defaults (MBBS) ─────────────────────────
// Overridden at runtime by r.program_meta from the login response.
const PROGRAM_META_MBBS = {
  label:     'MBBS Program',
  yearOrder: ['Foundation Year', 'M-1', 'M-2', 'M-3', 'M-4', 'M-5']
};

// Active catalog and program — set by populate(), used by renderGrades()
let COURSES       = COURSES_MBBS;
let PROGRAM_META  = PROGRAM_META_MBBS;

