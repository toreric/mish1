'use strict';

module.exports = function(environment) {
  const ENV = {
    modulePrefix: 'mish-project',
    environment,
    rootURL: '/',
    locationType: 'history', // 'auto', 'hash'
    EmberENV: {
      EXTEND_PROTOTYPES: false,
      FEATURES: {
        // Here you can enable experimental features on an ember canary build
        // e.g. EMBER_NATIVE_DECORATOR_SUPPORT: true
      },
    },
    /*contentSecurityPolicy: {
      'style-src': "'self' 'unsafe-inline' http://localhost:4200/",
      'default-src': "http://localhost:4200/",
      'default-src': "'none'",
      'script-src': "'self' 'unsafe-inline' 'unsafe-eval' ",
      'img-src': "'self' ",
      'frame-src': " "

    },*/

    APP: {
      // Here you can pass flags/options to your application instance
      // when it is created
    }
  };

  if (environment === 'development') {
    // ENV.APP.LOG_RESOLVER = true;
    ENV.APP.LOG_ACTIVE_GENERATION = true;
    ENV.APP.LOG_TRANSITIONS = true;
    ENV.APP.LOG_TRANSITIONS_INTERNAL = true;
    ENV.APP.LOG_VIEW_LOOKUPS = true;
  }

  if (environment === 'test') {
    // Testem prefers this...
    ENV.locationType = 'none';

    // keep test console output quieter
    ENV.APP.LOG_ACTIVE_GENERATION = false;
    ENV.APP.LOG_VIEW_LOOKUPS = false;

    ENV.APP.rootElement = '#ember-testing';
    ENV.APP.autoboot = false;
  }

  if (environment === 'production') {
    // here you can enable a production-specific feature
  }

  return ENV;
};
