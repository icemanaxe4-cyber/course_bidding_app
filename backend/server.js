require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { DataTypes } = require('sequelize');
const { sequelize } = require('./src/models');
const { startRoundScheduler } = require('./src/jobs/roundScheduler');
const { bootstrapTerms } = require('./src/controllers/termController');

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/courses', require('./src/routes/courses'));
app.use('/api/applications', require('./src/routes/applications'));
app.use('/api/rounds', require('./src/routes/rounds'));
app.use('/api/allocations', require('./src/routes/allocations'));
app.use('/api/terms', require('./src/routes/terms'));
app.use('/api/users', require('./src/routes/users'));
app.use('/api/programs', require('./src/routes/programs'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error.' });
});

const PORT = process.env.PORT || 5000;

const prepareDatabase = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const tables = await queryInterface.showAllTables();
  const hasCoursesTable = tables.some((table) => {
    const tableName = typeof table === 'string' ? table : table.tableName;
    return tableName === 'courses';
  });

  if (!hasCoursesTable) return;

  await queryInterface.changeColumn('courses', 'faculty_id', {
    type: DataTypes.UUID,
    allowNull: true,
  });
};

const start = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ PostgreSQL connected.');

    await prepareDatabase();

    // Sync all models (use force:true ONLY in dev to reset; use migrations in prod)
    await sequelize.sync({ alter: true });
    console.log('✅ Database synced.');

    // Auto-create 3 default terms if the DB has none
    await bootstrapTerms();

    startRoundScheduler();

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
};

start();
