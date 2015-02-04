module.exports = function (grunt) {
  'use strict';
  
  grunt.initConfig({

    clean: {
    },
    
    jshint: {
      all: ['Gruntfile.js', 'lib/*.js'],
      options: {
      }
    }
  });

  // Default task.
  grunt.registerTask('default', ['jshint']);
};


