const cron = require('node-cron');
const { Op } = require('sequelize');
const { BiddingRound } = require('../models');
const { processRound } = require('../services/allocationService');

let schedulerStarted = false;

const startRoundScheduler = () => {
  if (schedulerStarted) return;
  schedulerStarted = true;

  // Check every minute for rounds that need to be opened or closed
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();

      // Open upcoming rounds whose opens_at has passed
      const roundsToOpen = await BiddingRound.findAll({
        where: {
          status: 'upcoming',
          opens_at: { [Op.lte]: now },
        },
      });

      for (const round of roundsToOpen) {
        await round.update({ status: 'open' });
        console.log(`[Scheduler] Round ${round.round_number} (${round.id}) opened.`);
      }

      // Close open rounds whose closes_at has passed
      const roundsToClose = await BiddingRound.findAll({
        where: {
          status: 'open',
          closes_at: { [Op.lte]: now },
        },
      });

      for (const round of roundsToClose) {
        await round.update({ status: 'closed' });
        console.log(`[Scheduler] Round ${round.round_number} (${round.id}) closed. Processing...`);

        try {
          const result = await processRound(round.id);
          console.log(`[Scheduler] Round ${round.round_number} processed:`, result);
        } catch (err) {
          console.error(`[Scheduler] Error processing round ${round.id}:`, err.message);
        }
      }
    } catch (err) {
      console.error('[Scheduler] Cron job error:', err.message);
    }
  });

  console.log('[Scheduler] Round scheduler started. Checking every minute.');
};

module.exports = { startRoundScheduler };
