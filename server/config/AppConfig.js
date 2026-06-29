const helmet = require('helmet')
var cookieParser = require('cookie-parser');
const express = require('express');


exports.appConfig = async (app) => {
  const port = process.env.PORT || 5500;
  const adminRoutes = require('../routes/adminRoutes');
  const activationRoutes = require('../routes/activationRoutes');
  const authRoutes = require('../routes/authRoutes')
  const userRoutes = require('../routes/userRoutes')
  const patientRoutes = require('../routes/patientRoutes')
  const appointmentRoutes = require('../routes/appointmentRoutes')
  const treatmentRoutes = require('../routes/treatmentRoutes')
  const systemRoutes = require('../routes/systemRoutes')
  const fileRoutes = require('../routes/fileRoutes')
  const statsRoutes = require('../routes/statsRoutes')

  app.use(helmet())
  app.use(cookieParser());
  app.use(express.json());
  
  app.use('/api/v2/admin', adminRoutes);
  app.use('/api/v2/activate', activationRoutes);
  app.use('/api/v2/auth', authRoutes);
  app.use('/api/v2/user', userRoutes);
  app.use('/api/v2/patients', patientRoutes);
  app.use('/api/v2/appointments', appointmentRoutes);
  app.use('/api/v2/treatments', treatmentRoutes)
  app.use('/api/v2/system', systemRoutes)
  app.use('/api/v2/files', fileRoutes)
  app.use('/api/v2/stats', statsRoutes)

  app.use((err, req, res, next) => {
    console.error(err)
    res.status(500).json({ message: 'Internal server error' })
  })
}

