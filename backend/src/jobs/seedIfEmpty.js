const bcrypt = require('bcryptjs');
const { User, Term, Course, BiddingRound, Program } = require('../models');

/**
 * Runs once on startup if the database has no users.
 * Safe to leave in production — it checks first before doing anything.
 */
const seedIfEmpty = async () => {
  const userCount = await User.count();
  if (userCount > 0) {
    console.log('ℹ️  Database already has data — skipping auto-seed.');
    return;
  }

  console.log('🌱 Empty database detected — running auto-seed...');

  // ── Admin ────────────────────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash('admin123', 10);
  const admin = await User.create({
    name: 'Admin Office',
    email: 'admin@college.edu',
    password_hash: adminHash,
    role: 'admin',
  });
  console.log('  ✅ Admin created:', admin.email);

  // ── Faculty ──────────────────────────────────────────────────────────────────
  const facHash = await bcrypt.hash('faculty123', 10);
  const faculty1 = await User.create({
    name: 'Dr. Anil Sharma',
    email: 'dr.sharma@college.edu',
    password_hash: facHash,
    role: 'faculty',
    department: 'Computer Science',
  });
  const faculty2 = await User.create({
    name: 'Dr. Priya Mehta',
    email: 'dr.mehta@college.edu',
    password_hash: facHash,
    role: 'faculty',
    department: 'Information Technology',
  });
  console.log('  ✅ Faculty created');

  // ── Students ─────────────────────────────────────────────────────────────────
  const stuHash = await bcrypt.hash('student123', 10);
  const studentData = [
    { name: 'Rahul Verma',  email: 'rahul.v@college.edu',  student_id: 'CS2021001', cqpi: 8.5 },
    { name: 'Priya Singh',  email: 'priya.s@college.edu',  student_id: 'CS2021002', cqpi: 7.8 },
    { name: 'Amit Kumar',   email: 'amit.k@college.edu',   student_id: 'CS2021003', cqpi: 6.9 },
    { name: 'Sneha Patel',  email: 'sneha.p@college.edu',  student_id: 'CS2021004', cqpi: 9.1 },
    { name: 'Rohan Das',    email: 'rohan.d@college.edu',  student_id: 'CS2021005', cqpi: 7.2 },
  ];
  for (const s of studentData) {
    await User.create({
      ...s,
      password_hash: stuHash,
      role: 'student',
      enrollment_year: 2021,
      department: 'Computer Science',
    });
  }
  console.log('  ✅ Students created');

  // ── Term ─────────────────────────────────────────────────────────────────────
  const term = await Term.create({
    year: 2024,
    term_number: 1,
    label: '2024-25 Term 1',
    status: 'active',
  });
  console.log('  ✅ Term created:', term.label);

  // ── Courses ───────────────────────────────────────────────────────────────────
  const courseData = [
    { code: 'CS501', name: 'Machine Learning',           credits: 4, cqpi_cutoff: 7.0, faculty_id: faculty1.id },
    { code: 'CS502', name: 'Cloud Computing',            credits: 3, cqpi_cutoff: 6.5, faculty_id: faculty1.id },
    { code: 'CS503', name: 'Cybersecurity Fundamentals', credits: 3, cqpi_cutoff: 6.0, faculty_id: faculty2.id },
    { code: 'CS504', name: 'Advanced Database Systems',  credits: 4, cqpi_cutoff: 7.5, faculty_id: faculty2.id },
    { code: 'CS505', name: 'Human-Computer Interaction', credits: 3, cqpi_cutoff: 5.5, faculty_id: faculty1.id },
    { code: 'CS506', name: 'Computer Vision',            credits: 4, cqpi_cutoff: 8.0, faculty_id: faculty2.id },
  ];
  for (const c of courseData) {
    await Course.create({
      ...c,
      term_id: term.id,
      status: 'active',
      min_strength: 1,
      max_strength: 30,
    });
  }
  console.log('  ✅ Courses created');

  // ── Bidding Round 1 ───────────────────────────────────────────────────────────
  const now = new Date();
  await BiddingRound.create({
    term_id: term.id,
    round_number: 1,
    status: 'open',
    opens_at: new Date(now.getTime() - 60000),          // already open
    closes_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    notes: 'First bidding round. Students select 5-6 course preferences.',
  });
  console.log('  ✅ Bidding Round 1 created (open)');

  console.log('\n🎉 Auto-seed complete!');
  console.log('   Admin:   admin@college.edu   / admin123');
  console.log('   Faculty: dr.sharma@college.edu / faculty123');
  console.log('   Student: rahul.v@college.edu  / student123');
};

module.exports = { seedIfEmpty };
