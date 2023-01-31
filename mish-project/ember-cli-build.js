/* eslint-env node */
'use strict';

// DET HÄR VAR FÖRUT (2015) Brocfile.js
const EmberApp = require('ember-cli/lib/broccoli/ember-app');

module.exports = function(defaults) {
  let app = new EmberApp(defaults, {
    // Add options here
    emberCliDropzonejs: {
      includeDropzoneCss: false
    },
    //minifyJS: {
    'ember-cli-uglify': {
      enabled: false
    },
    minifyCSS: {
      enabled: false
    },
    sourcemaps: {
      enabled: false
    },
    'ember-auto-import': {
      forbidEval: true
    }
    /*/ Disable jQuery bundled with Ember.js
    vendorFiles: { 'jquery.js': null },
    // Include jQuery slim instead of default build
    jquery: {
      slim: true
    }*/
  });
  // Use `app.import` to add additional libraries to the generated
  // output files.
  //
  // If you need to use different assets in different
  // environments, specify an object as the first parameter. That
  // object's keys should be the environment name and the values
  // should be the asset to use in that environment.
  //
  // If the library that you are including contains AMD or ES6
  // modules that you would like to import into your application
  // please specify an object with the list of modules as keys
  // along with the exports of each module as its value.

  app.import('app/styles/app.css'); // Needed from 2029july, why?

  app.import('bower_components/jquery-ui/jquery-ui.js');
  //app.import('bower_components/jquery-ui/ui/core.js');
  //app.import('bower_components/jquery-ui/ui/widget.js');
  //app.import('bower_components/jquery-ui/ui/widgets/dialog.js');
  //app.import('bower_components/jquery-ui/themes/base/all.css');
  //app.import('bower_components/jquery-ui/themes/smoothness/jquery-ui.css');
  //app.import('bower_components/jquery-ui/themes/smoothness/theme.css');
  //app.import('bower_components/jquery-ui/themes/smoothness/images/'); Put in public/assets/images/

  return app.toTree();
};
