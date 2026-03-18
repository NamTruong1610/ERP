const helmet = require('helmet')
var cookieParser = require('cookie-parser');
const express = require('express');
const adminRoutes = require('../routes/adminRoutes');
const activationRoutes = require('../routes/activationRoutes');
const authRoutes = require('../routes/authRoutes')

exports.appConfig = async (app) => {
  const port = process.env.PORT || 5500;
  app.use(helmet())
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api/v2/admin', adminRoutes);      
  app.use('/api/v2/activate', activationRoutes); 
  app.use('/api/v2/auth', authRoutes); 
  app.listen(port, () => {
    console.log(`App listening on port ${port}`);
  })
}

