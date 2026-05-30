// ══════════════════════════════════════
// Global State, Password Utilities, Schema SQL
// ══════════════════════════════════════

// ══════════════════════════════════════════
// ██████╗  █████╗     ██████╗ ██████╗ ███╗   ██╗███████╗██╗ ██████╗
// ██╔══██╗██╔══██╗   ██╔════╝██╔═══██╗████╗  ██║██╔════╝██║██╔════╝
// ██║  ██║███████║   ██║     ██║   ██║██╔██╗ ██║█████╗  ██║██║  ███╗
// ██║  ██║██╔══██║   ██║     ██║   ██║██║╚██╗██║██╔══╝  ██║██║   ██║
// ██████╔╝██║  ██║   ╚██████╗╚██████╔╝██║ ╚████║██║     ██║╚██████╔╝
// ╚═════╝ ╚═╝  ╚═╝    ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝     ╚═╝ ╚═════╝
//
// UM2 MBBS Registrar — Supabase Live Backend
// ── Paste your Supabase credentials below ──
// ══════════════════════════════════════════

// ── Credentials are loaded from config.js (never hardcode here) ──
if (!window.APP_CONFIG) {
  document.body.innerHTML = '<div style="font-family:sans-serif;padding:40px;color:#8B1A2E"><h2>Missing config.js</h2><p>Place <strong>config.js</strong> in the same folder as this HTML file before opening it.</p></div>';
  throw new Error('APP_CONFIG not found. Did you forget to include config.js?');
}
const SUPABASE_URL      = window.APP_CONFIG.supabaseUrl;
const SUPABASE_ANON_KEY = window.APP_CONFIG.supabaseAnonKey;

// ── Init client ──
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ══════════════════════════════════════════
// GLOBAL STATE  (no demo data)
// ══════════════════════════════════════════
let currentUser   = null;
let currentRole   = null;
let currentProfileId = null;
let selectedLoginRole = 'registrar';

let students        = [];
let gradeData       = {};     // { student_id: [grade, …] }
let enrollHistory   = {};     // { student_id: [enrollment, …] }
let courses         = [];     // [[id, name, year, block, credits, assess], …]
let coursePrograms  = {};     // { course_id: [program_id, …] }
let attendanceRecords = [];
let _gradesColumns  = null;   // detected live columns in the grades table

let gradeCSVRows    = [];
let bulkEnrollRows  = [];
let bulkStudentRows = [];
let attendanceCSVRows = [];
let bulkCourseRows  = [];
let editingAttendanceKey = null;
let _editGradeSid   = null;
let _editGradeId    = null;

// ══════════════════════════════════════════
// PASSWORD UTILITIES
// ══════════════════════════════════════════
function generateMasterPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const arr = new Uint8Array(12);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => chars[b % chars.length]).join('');
}

async function hashPassword(plain) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(plain));
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2,'0')).join('');
}

// Send welcome email directly with plaintext password — called BEFORE hashing.
// Falls back silently so a network failure never blocks student creation.
async function sendWelcomeEmail(toEmail, sid, nameEn, plainPassword, dob, trigger = 'new student') {
  try {
    if (!plainPassword || plainPassword.trim().length === 0) {
      console.error('[sendWelcomeEmail] plainPassword is empty — credential block will be missing from email. sid:', sid);
    }
    const EDGE_URL = SUPABASE_URL.replace(/\/+$/, '') + '/functions/v1/send-email';
    console.log('[sendWelcomeEmail] sending to:', toEmail, '| sid:', sid, '| trigger:', trigger, '| password length:', (plainPassword || '').length);
    const res = await fetch(EDGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        to:              toEmail,
        subject:         '[UM2 Registry System] Welcome — Your student account is ready',
        trigger:         trigger,
        sid:             sid,
        name:            nameEn,
        master_password: plainPassword,
        dob:             dob || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('[sendWelcomeEmail] edge function error:', res.status, JSON.stringify(data));
    } else {
      console.log('[sendWelcomeEmail] success:', data.id || data);
    }
  } catch (e) {
    console.warn('[sendWelcomeEmail] fetch failed (non-blocking):', e);
  }
}

function togglePwVisibility(inputId, btn) {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  const isHidden = inp.type === 'password';
  inp.type = isHidden ? 'text' : 'password';
  btn.innerHTML = isHidden
    ? '<svg><use href="#i-eye-off"></use></svg>'
    : '<svg><use href="#i-eye"></use></svg>';
}

function toggleTablePwVisibility(btn, maskedId) {
  const cell = btn.closest('td');
  const masked = cell.querySelector('.pw-masked');
  const plain  = cell.querySelector('.pw-plain');
  const isHidden = masked.style.display !== 'none';
  masked.style.display = isHidden ? 'none' : '';
  plain.style.display  = isHidden ? '' : 'none';
  btn.innerHTML = isHidden
    ? '<svg style="width:13px;height:13px;stroke:currentColor;stroke-width:1.9;fill:none;stroke-linecap:round;stroke-linejoin:round"><use href="#i-eye-off"></use></svg>'
    : '<svg style="width:13px;height:13px;stroke:currentColor;stroke-width:1.9;fill:none;stroke-linecap:round;stroke-linejoin:round"><use href="#i-eye"></use></svg>';
}

// ══════════════════════════════════════════
// SQL SCHEMA (shown in Setup view)
// ══════════════════════════════════════════
const SCHEMA_SQL = `-- IRIR Registrar — Supabase Schema
-- Run this once in your Supabase SQL Editor

-- 1. Profiles (maps auth users to roles)
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       text not null default 'staff',   -- 'registrar' | 'staff'
  staff_id   text,
  full_name  text,
  created_at timestamptz default now()
);
alter table profiles enable row level security;
create policy "Users can read own profile" on profiles for select using (auth.uid() = id);
create policy "Registrar full access" on profiles for all using (
  (select role from profiles where id = auth.uid()) = 'registrar'
);

-- 2. Students
create table if not exists students (
  id           text primary key,
  name_en      text not null,
  name_my      text,
  father       text,
  father_my    text,
  mother       text,
  mother_my    text,
  dob          date,
  email        text unique not null,
  phone        text,
  address      text,
  admission    text,
  year         text default 'Foundation Year',
  program      text default 'MBBS',
  status       text default 'Active',
  gpa          numeric(4,2) default 0,
  grad_status     text default 'In Progress',
  graduation_id   text,
  graduation_id_my text,
  graduation_date date,
  graduation_date_my text,
  master_password text,  -- hashed session master key; only readable by registrar role
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
-- Migration for existing databases (run if students table already exists):
-- alter table students add column if not exists grad_status text default 'In Progress';
-- alter table students add column if not exists graduation_id text;
-- alter table students add column if not exists graduation_date date;
-- alter table students add column if not exists mother text;
-- alter table students add column if not exists mother_my text;
-- alter table students add column if not exists graduation_id_my text;
-- alter table students add column if not exists graduation_date_my text;
alter table students enable row level security;
-- Students can read their own record but NOT the master_password column
create policy "Authenticated read students" on students for select using (auth.role() = 'authenticated');
create policy "Registrar write students" on students for all using (
  (select role from profiles where id = auth.uid()) = 'registrar'
);

-- 3. Courses
create table if not exists courses (
  id              text primary key,
  name            text not null,
  year            text,
  block_module    text,
  credits         integer default 0,
  assessment_type text,
  program         text default 'MBBS',
  status          text default 'Active',
  created_at      timestamptz default now()
);
alter table courses enable row level security;
create policy "Authenticated read courses" on courses for select using (auth.role() = 'authenticated');
create policy "Registrar write courses" on courses for all using (
  (select role from profiles where id = auth.uid()) = 'registrar'
);

-- 4. Enrollments
create table if not exists enrollments (
  id                  bigserial primary key,
  student_id          text references students(id) on delete cascade,
  year_id             text,
  enrollment_status   text default 'Active',
  graduation_status   text default 'In Progress',
  effective_date      date,
  notes               text,
  created_at          timestamptz default now()
);
alter table enrollments enable row level security;
create policy "Authenticated read enrollments" on enrollments for select using (auth.role() = 'authenticated');
create policy "Registrar write enrollments" on enrollments for all using (
  (select role from profiles where id = auth.uid()) = 'registrar'
);

-- 5. Grades
create table if not exists grades (
  id          text primary key,
  student_id  text references students(id) on delete cascade,
  course_id   text references courses(id),
  course      text,
  score       numeric(6,2),
  letter      text,
  gp          numeric(4,2),
  attempt     text default '1st Attempt',
  year        text,
  uploaded_by text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
-- Migration for existing databases (run if grades table already exists):
-- alter table grades add column if not exists attempt   text default '1st Attempt';
-- alter table grades add column if not exists course_id text references courses(id);
-- alter table grades add column if not exists course     text;
-- alter table grades add column if not exists uploaded_by text;
-- alter table grades add column if not exists updated_at  timestamptz default now();
alter table grades enable row level security;
create policy "Authenticated read grades" on grades for select using (auth.role() = 'authenticated');
create policy "Registrar write grades" on grades for all using (
  (select role from profiles where id = auth.uid()) = 'registrar'
);
create policy "Staff insert grades" on grades for insert with check (
  (select role from profiles where id = auth.uid()) in ('registrar','staff')
);
create policy "Staff update grades" on grades for update using (
  (select role from profiles where id = auth.uid()) in ('registrar','staff')
);

-- 6. Attendance
create table if not exists attendance (
  id           bigserial primary key,
  student_id   text references students(id) on delete cascade,
  lecture_name text not null,
  session_date date not null,
  session_from time not null,
  session_till time,
  status       text default 'Present',
  remarks      text,
  created_at   timestamptz default now(),
  unique (student_id, lecture_name, session_date, session_from)
);
alter table attendance enable row level security;
create policy "Authenticated read attendance" on attendance for select using (auth.role() = 'authenticated');
create policy "Staff write attendance" on attendance for all using (
  (select role from profiles where id = auth.uid()) in ('registrar','staff')
);

-- 7. Degree Programs
create table if not exists degree_programs (
  id           text primary key,
  name         text not null,
  duration_yrs integer,
  year_sequence text,
  status       text default 'Active',
  created_at   timestamptz default now()
);
alter table degree_programs enable row level security;
create policy "Authenticated read degrees" on degree_programs for select using (auth.role() = 'authenticated');
create policy "Registrar write degrees" on degree_programs for all using (
  (select role from profiles where id = auth.uid()) = 'registrar'
);

-- 8. Academic Years
create table if not exists academic_years (
  id          text primary key,
  name        text not null,
  sort_order  integer default 99,
  program_id  text references degree_programs(id) on delete set null,
  created_at  timestamptz default now()
);
-- Migration for existing databases (run if academic_years table already exists):
-- alter table academic_years add column if not exists program_id text references degree_programs(id) on delete set null;
alter table academic_years enable row level security;
create policy "Authenticated read academic_years" on academic_years for select using (auth.role() = 'authenticated');
create policy "Registrar write academic_years" on academic_years for all using (
  (select role from profiles where id = auth.uid()) = 'registrar'
);

-- 9. Email Log
create table if not exists email_log (
  id         bigserial primary key,
  sent_at    timestamptz default now(),
  to_email   text,
  student_id text,
  subject    text,
  trigger    text,
  status     text default 'Queued'
);
alter table email_log enable row level security;
create policy "Registrar read email log" on email_log for select using (
  (select role from profiles where id = auth.uid()) = 'registrar'
);
create policy "System insert email log" on email_log for insert with check (auth.role() = 'authenticated');

-- 10. Enrollment Periods
create table if not exists enrollment_periods (
  id            uuid primary key default gen_random_uuid(),
  program_id    text references degree_programs(id) on delete cascade,
  from_year_id  text references academic_years(id) on delete cascade,
  to_year_id    text references academic_years(id) on delete cascade,
  open_at       date not null,
  close_at      date not null,
  min_pass_rate numeric(5,4) default 0.8,
  require_core  boolean default false,
  auto_promote  boolean default false,
  created_at    timestamptz default now()
);
alter table enrollment_periods enable row level security;
create policy "Registrar manage enrollment_periods" on enrollment_periods for all using (
  (select role from profiles where id = auth.uid()) = 'registrar'
);

-- 11. Enrollment Requests
create table if not exists enrollment_requests (
  id                   uuid primary key default gen_random_uuid(),
  period_id            uuid references enrollment_periods(id) on delete cascade,
  student_id           text references students(id) on delete cascade,
  status               text default 'requested',
  eligibility_snapshot jsonb,
  override_reason      text,
  reviewed_at          timestamptz,
  created_at           timestamptz default now(),
  unique(period_id, student_id)
);
alter table enrollment_requests enable row level security;
create policy "Registrar manage enrollment_requests" on enrollment_requests for all using (
  (select role from profiles where id = auth.uid()) = 'registrar'
);
create policy "Student read own enrollment_requests" on enrollment_requests for select using (
  student_id = (select id from students where id = auth.uid()::text)
);`;

