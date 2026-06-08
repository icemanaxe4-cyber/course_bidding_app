const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Term = sequelize.define('Term', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  year: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  term_number: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { min: 1, max: 3 },
  },
  label: {
    type: DataTypes.STRING, // e.g. "2024-25 Term 1"
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('upcoming', 'active', 'completed'),
    defaultValue: 'upcoming',
  },
  bidding_opens_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  bidding_closes_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'terms',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['year', 'term_number'],
    },
  ],
});

module.exports = Term;
