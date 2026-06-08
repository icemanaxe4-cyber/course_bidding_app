require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, User, Term, Course, BiddingRound } = require('./src/models');

const seed = async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    console.log('✅ DB connected');

    // Create admin
    const adminHash = await bcrypt.hash('admin123', 10);
    const [admin] = await User.findOrCreate({
      where: { email: 'admin@college.edu' },
      defaults: {
        name: 'Admin Office',
        email: 'admin@college.edu',
        password_hash: adminHash,
        role: 'admin',
      },
    });
    console.log('✅ Admin:', admin.email);

    // Create faculty
    const facHash = await bcrypt.hash('faculty123', 10);
    const [faculty1] = await User.findOrCreate({
      where: { email: 'dr.sharma@college.edu' },
      defaults: {
        name: 'Dr. Anil Sharma',
        email: 'dr.sharma@college.edu',
        password_hash: facHash,
        role: 'faculty',
        department: 'Computer Science',
      },
    });
    const [faculty2] = await User.findOrCreate({
      where: { email: 'dr.mehta@college.edu' },
      defaults: {
        name: 'Dr. Priya Mehta',
        email: 'dr.mehta@college.edu',
        password_hash: facHash,
        role: 'faculty',
        department: 'Information Technology',
      },
    });
    console.log('✅ Faculty created');

    // Create students
    const stuHash = await bcrypt.hash('student123', 10);
    const students = [
      { name: 'Rahul Verma', email: 'rahul.v@college.edu', student_id: 'CS2021001', cqpi: 8.5 },
      { name: 'Priya Singh', email: 'priya.s@college.edu', student_id: 'CS2021002', cqpi: 7.8 },
      { name: 'Amit Kumar', email: 'amit.k@college.edu', student_id: 'CS2021003', cqpi: 6.9 },
      { name: 'Sneha Patel', email: 'sneha.p@college.edu', student_id: 'CS2021004', cqpi: 9.1 },
      { name: 'Rohan Das', email: 'rohan.d@college.edu', student_id: 'CS2021005', cqpi: 7.2 },
    ];

    for (const s of students) {
      await User.findOrCreate({
        where: { email: s.email },
        defaults: {
          ...s,
          password_hash: stuHash,
          role: 'student',
          enrollment_year: 2021,
          department: 'Computer Science',
        },
      });
    }
    console.log('✅ Students created (password: student123)');

    // Create term
    const [term] = await Term.findOrCreate({
      where: { year: 2024, term_number: 1 },
      defaults: {
        year: 2024,
        term_number: 1,
        label: '2024-25 Term 1',
        status: 'active',
      },
    });
    console.log('✅ Term created:', term.label);

    // Create courses — min 1, max 2 for testing (demonstrates CQPI-based seat priority)
    const courseData = [
      {
        code: 'CS501', name: 'Machine Learning',
        description: 'Introduction to ML algorithms and applications.',
        credits: 4, cqpi_cutoff: 7.0, faculty_id: faculty1.id, term_id: term.id,
        min_strength: 1, max_strength: 2,
      },
      {
        code: 'CS502', name: 'Cloud Computing',
        description: 'Distributed systems, AWS, Azure, and cloud architectures.',
        credits: 3, cqpi_cutoff: 6.5, faculty_id: faculty1.id, term_id: term.id,
        min_strength: 1, max_strength: 2,
      },
      {
        code: 'CS503', name: 'Cybersecurity Fundamentals',
        description: 'Network security, cryptography, and ethical hacking.',
        credits: 3, cqpi_cutoff: 6.0, faculty_id: faculty2.id, term_id: term.id,
        min_strength: 1, max_strength: 2,
      },
      {
        code: 'CS504', name: 'Advanced Database Systems',
        description: 'Query optimization, NoSQL, and distributed databases.',
        credits: 4, cqpi_cutoff: 7.5, faculty_id: faculty2.id, term_id: term.id,
        min_strength: 1, max_strength: 2,
      },
      {
        code: 'CS505', name: 'Human-Computer Interaction',
        description: 'UX design, usability testing, and interface design principles.',
        credits: 3, cqpi_cutoff: 5.5, faculty_id: faculty1.id, term_id: term.id,
        min_strength: 1, max_strength: 2,
      },
      {
        code: 'CS506', name: 'Computer Vision',
        description: 'Image processing, CNNs, and object detection.',
        credits: 4, cqpi_cutoff: 8.0, faculty_id: faculty2.id, term_id: term.id,
        min_strength: 1, max_strength: 2,
      },
    ];

    for (const c of courseData) {
      const [course, created] = await Course.findOrCreate({
        where: { code: c.code, term_id: term.id },
        defaults: { ...c, status: 'active' },
      });
      // Update existing courses with new min/max strength
      if (!created) {
        await course.update({ min_strength: c.min_strength, max_strength: c.max_strength, status: 'active', current_enrollment: 0 });
      }
    }
    console.log('✅ Courses created/updated (min: 1, max: 2 seats — CQPI decides on seat contention)');

    // Create Round 1
    const now = new Date();
    const opens_at = new Date(now.getTime() - 60000); // already open
    const closes_at = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24h from now

    await BiddingRound.findOrCreate({
      where: { term_id: term.id, round_number: 1 },
      defaults: {
        term_id: term.id,
        round_number: 1,
        status: 'open',
        opens_at,
        closes_at,
        notes: 'First bidding round. Students select 5-6 course preferences.',
      },
    });
    console.log('✅ Round 1 created and open');

    console.log('\n🎉 Seed complete!');
    console.log('Login credentials:');
    console.log('  Admin:   admin@college.edu / admin123');
    console.log('  Faculty: dr.sharma@college.edu / faculty123');
    console.log('  Student: rahul.v@college.edu / student123');

    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err);
    process.exit(1);
  }
};

seed();
