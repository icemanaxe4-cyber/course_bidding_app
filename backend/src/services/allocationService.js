const { Op } = require('sequelize');
const { sequelize, User, Course, BiddingRound, Application, Allocation, Term, CourseProgram } = require('../models');

/**
 * Core allocation algorithm per course:
 *  - CQPI criteria  → rank by CQPI desc, applied_at asc (tiebreaker)
 *  - SOP criteria   → rank by SOP score (admin can pre-score via grade_score field), applied_at asc
 *  - GRADE criteria → rank by grade_score desc, applied_at asc
 *
 * For oversubscribed courses (>max_strength): keep top N, displace rest.
 * For under-subscribed courses (<min_strength eligible): cancel course, displace all.
 * Frozen courses are an exception: freezing stops new bids and preserves current eligible interest for allocation.
 *
 * Multi-term support: if round.covers_all_terms = true, process courses from ALL
 * active/upcoming terms in the same academic year as the round's term.
 */
const processRound = async (roundId) => {
  const transaction = await sequelize.transaction();

  try {
    const round = await BiddingRound.findByPk(roundId, {
      include: [
        { model: Term, as: 'term' },
        { model: require('../models/Program'), as: 'program' },
      ],
      transaction,
    });

    if (!round) throw new Error('Round not found');
    if (round.status === 'completed') throw new Error('Round already processed');

    await round.update({ status: 'processing' }, { transaction });

    // Determine which termIds to process
    let termIds = round.term_id ? [round.term_id] : [];

    if (round.covers_all_terms && round.term) {
      // Find all terms in the same academic year
      const yearTerms = await Term.findAll({
        where: {
          year: round.term.year,
          status: { [Op.in]: ['active', 'upcoming'] },
        },
        attributes: ['id'],
        transaction,
      });
      termIds = yearTerms.map(t => t.id);
    } else if (round.covers_all_terms && !round.term) {
      // No specific term — use all active/upcoming terms
      const allTerms = await Term.findAll({
        where: { status: { [Op.in]: ['active', 'upcoming'] } },
        attributes: ['id'],
        transaction,
      });
      termIds = allTerms.map(t => t.id);
    }

    // Build course filter — scope to program if set, and terms if available
    const courseWhere = {};
    if (round.program_id) {
      const courseProgramLinks = await CourseProgram.findAll({
        where: { program_id: round.program_id },
        attributes: ['course_id'],
        transaction,
      });
      const linkedCourseIds = courseProgramLinks.map(link => link.course_id);
      courseWhere[Op.or] = [
        { program_id: round.program_id },
        ...(linkedCourseIds.length ? [{ id: { [Op.in]: linkedCourseIds } }] : []),
      ];
    }
    if (termIds.length > 0) courseWhere.term_id = { [Op.in]: termIds };

    // Fetch all pending applications for this round across all relevant terms/program
    const applications = await Application.findAll({
      where: { round_id: roundId, status: 'pending' },
      include: [
        {
          model: User,
          as: 'student',
          attributes: ['id', 'name', 'cqpi'],
        },
        {
          model: Course,
          as: 'course',
          attributes: [
            'id', 'name', 'cqpi_cutoff', 'min_strength', 'max_strength',
            'status', 'term_id', 'program_id', 'allocation_criteria', 'is_frozen', 'is_floated',
          ],
          where: {
            ...(Object.keys(courseWhere).length > 0 ? courseWhere : {}),
            status: 'active',
            is_floated: true,
          },
        },
      ],
      transaction,
    });

    // Group applications by course
    const courseMap = {};
    for (const app of applications) {
      if (!courseMap[app.course_id]) {
        courseMap[app.course_id] = {
          course: app.course,
          eligible: [],
          ineligible: [],
        };
      }

      const studentCQPI = parseFloat(app.student.cqpi) || 0;
      const cutoff = parseFloat(app.course.cqpi_cutoff) || 0;

      if (studentCQPI >= cutoff) {
        courseMap[app.course_id].eligible.push(app);
      } else {
        courseMap[app.course_id].ineligible.push(app);
      }
    }

    const allocatedStudentIds = new Set();
    const displacedAppIds = [];
    const cancelledCourseIds = [];
    const allocationRecords = [];

    for (const courseId in courseMap) {
      const { course, eligible, ineligible } = courseMap[courseId];

      // Mark ineligible as displaced
      for (const app of ineligible) {
        displacedAppIds.push(app.id);
      }

      // Sort by allocation_criteria
      const criteria = course.allocation_criteria || 'cqpi';
      eligible.sort((a, b) => {
        let diff = 0;
        if (criteria === 'cqpi') {
          diff = parseFloat(b.student.cqpi) - parseFloat(a.student.cqpi);
        } else if (criteria === 'sop') {
          // SOP: rank by grade_score (admin pre-scores SOPs numerically)
          diff = (parseFloat(b.grade_score) || 0) - (parseFloat(a.grade_score) || 0);
        } else if (criteria === 'grade') {
          diff = (parseFloat(b.grade_score) || 0) - (parseFloat(a.grade_score) || 0);
        }
        // FCFS tiebreaker
        if (diff !== 0) return diff;
        return new Date(a.applied_at) - new Date(b.applied_at);
      });

      const maxSeats = course.max_strength || 120;
      const minStudents = course.min_strength || 15;
      const existingEnrollment = await Allocation.count({
        where: { course_id: courseId },
        transaction,
      });
      const availableSeats = Math.max(maxSeats - existingEnrollment, 0);

      // Under-subscription check. Frozen courses allocate current eligible interest even below min strength.
      if (!course.is_frozen && eligible.length < minStudents) {
        cancelledCourseIds.push(courseId);
        for (const app of eligible) {
          displacedAppIds.push(app.id);
        }
        continue;
      }

      // Fill only seats that are still available after previous/manual allocations.
      const accepted = eligible.slice(0, availableSeats);
      const displaced = eligible.slice(availableSeats);

      for (const app of displaced) {
        displacedAppIds.push(app.id);
      }

      for (const app of accepted) {
        allocatedStudentIds.add(app.student_id);
        allocationRecords.push({
          student_id: app.student_id,
          course_id: courseId,
          term_id: course.term_id,
          round_id: roundId,
          allocated_by: 'system',
        });
        await app.update({ status: 'allocated' }, { transaction });
      }
    }

    // Cancel under-subscribed courses
    if (cancelledCourseIds.length > 0) {
      await Course.update(
        { status: 'cancelled' },
        { where: { id: { [Op.in]: cancelledCourseIds } }, transaction }
      );
      await Application.update(
        { status: 'cancelled_course' },
        {
          where: {
            id: {
              [Op.in]: displacedAppIds.filter(id => {
                const app = applications.find(a => a.id === id);
                return app && cancelledCourseIds.includes(app.course_id);
              }),
            },
            round_id: roundId,
          },
          transaction,
        }
      );
    }

    // Mark remaining displaced
    if (displacedAppIds.length > 0) {
      await Application.update(
        { status: 'displaced' },
        {
          where: {
            id: { [Op.in]: displacedAppIds },
            status: 'pending',
          },
          transaction,
        }
      );
    }

    // Bulk create allocations
    if (allocationRecords.length > 0) {
      await Allocation.bulkCreate(allocationRecords, {
        ignoreDuplicates: true,
        transaction,
      });
    }

    // BUG-2: Removed Course.increment('current_enrollment') — withCourseCounts computes live counts
    // from Allocation.count(), so the stored field is redundant and causes drift.

    // GAP-4: Cancel frozen courses that ended up with zero total enrollment after this round.
    // A frozen course bypasses min_strength, but if nobody applied (or all were displaced)
    // it stays 'active' forever in a limbo state — so we cancel it.
    const frozenCourseIds = Object.keys(courseMap).filter(id => courseMap[id].course.is_frozen);
    // Also check frozen courses in scope that had NO applicants (not in courseMap at all)
    const allScopedFrozenCourses = await Course.findAll({
      where: {
        ...(Object.keys(courseWhere).length > 0 ? courseWhere : {}),
        is_frozen: true,
        status: 'active',
      },
      attributes: ['id'],
      transaction,
    });
    for (const fc of allScopedFrozenCourses) {
      if (cancelledCourseIds.includes(fc.id)) continue;
      const totalEnrollment = await Allocation.count({ where: { course_id: fc.id }, transaction });
      if (totalEnrollment === 0) {
        cancelledCourseIds.push(fc.id);
        await Course.update({ status: 'cancelled' }, { where: { id: fc.id }, transaction });
        await Application.update(
          { status: 'cancelled_course' },
          {
            where: { course_id: fc.id, round_id: roundId, status: { [Op.in]: ['pending', 'displaced'] } },
            transaction,
          }
        );
      }
    }

    await round.update(
      { status: 'completed', processed_at: new Date() },
      { transaction }
    );

    await transaction.commit();

    // Summary
    const displacedStudents = await getDisplacedStudentsForTerms(termIds, roundId);

    return {
      success: true,
      allocations_created: allocationRecords.length,
      courses_cancelled: cancelledCourseIds.length,
      displaced_students: displacedStudents.length,
      cancelled_course_ids: cancelledCourseIds,
      terms_processed: termIds.length,
    };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

/**
 * Get displaced students across one or multiple terms
 */
const getDisplacedStudentsForTerms = async (termIds, afterRoundId = null) => {
  const termIdsArr = Array.isArray(termIds) ? termIds : [termIds];

  const allApplicants = await Application.findAll({
    include: [
      {
        model: BiddingRound,
        as: 'round',
        where: { term_id: { [Op.in]: termIdsArr } },
        attributes: ['id', 'round_number'],
      },
    ],
    attributes: ['student_id'],
    group: ['student_id', 'round.id', 'round.round_number'],
  });

  const allStudentIds = [...new Set(allApplicants.map(a => a.student_id))];

  const allocated = await Allocation.findAll({
    where: { term_id: { [Op.in]: termIdsArr } },
    attributes: ['student_id'],
    group: ['student_id'],
  });

  const allocatedIds = new Set(allocated.map(a => a.student_id));
  const displacedIds = allStudentIds.filter(id => !allocatedIds.has(id));

  if (displacedIds.length === 0) return [];

  return User.findAll({
    where: { id: { [Op.in]: displacedIds } },
    attributes: ['id', 'name', 'email', 'student_id', 'cqpi'],
  });
};

/**
 * Legacy wrapper for single term (used by allocationController)
 */
const getDisplacedStudentsForTerm = async (termId, afterRoundId = null) => {
  return getDisplacedStudentsForTerms([termId], afterRoundId);
};

/**
 * Get summary stats for one or multiple terms
 */
const getTermStats = async (termId) => {
  const totalStudents = await User.count({ where: { role: 'student' } });
  const totalCourses = await Course.count({ where: { term_id: termId } });
  const activeCourses = await Course.count({ where: { term_id: termId, status: 'active' } });
  const cancelledCourses = await Course.count({ where: { term_id: termId, status: 'cancelled' } });
  const floatedCourses = await Course.count({ where: { term_id: termId, is_floated: true } });
  const frozenCourses = await Course.count({ where: { term_id: termId, is_frozen: true } });
  const totalAllocations = await Allocation.count({ where: { term_id: termId } });
  const allocatedStudents = await Allocation.count({
    where: { term_id: termId },
    distinct: true,
    col: 'student_id',
  });

  return {
    totalStudents,
    totalCourses,
    activeCourses,
    cancelledCourses,
    floatedCourses,
    frozenCourses,
    totalAllocations,
    allocatedStudents,
    unallocatedStudents: totalStudents - allocatedStudents,
  };
};

module.exports = {
  processRound,
  getDisplacedStudentsForTerm,
  getDisplacedStudentsForTerms,
  getTermStats,
};
