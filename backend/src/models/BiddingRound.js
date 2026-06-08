const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const BiddingRound = sequelize.define('BiddingRound', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  program_id: {
    type: DataTypes.UUID,
    allowNull: true, // null = applies to all programs
  },
  term_id: {
    type: DataTypes.UUID,
    allowNull: true, // kept for allocation scoping compatibility
  },
  round_number: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('upcoming', 'open', 'closed', 'processing', 'completed'),
    defaultValue: 'upcoming',
  },
  covers_all_terms: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'If true, this round processes courses from ALL terms of the academic year for this program',
  },
  opens_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  closes_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  processed_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'bidding_rounds',
  timestamps: true,
  underscored: true,
});

module.exports = BiddingRound;

