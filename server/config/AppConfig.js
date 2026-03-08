const helmet = require('helmet')
var cookieParser = require('cookie-parser');
const express = require('express');
const routes = require('../routes/adminRoutes')

exports.appConfig = async (app) => {
  const port = process.env.PORT || 5500;
  app.use(helmet())
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api/v2', routes)
  app.listen(port, () => {
    console.log(`App listening on port ${port}`);
  })
}

