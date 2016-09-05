//Must be placed in a subfolder so that it is loaded before
//the templates that use its global variables
var VALID_KEYS = [
  'activeAssessmentID',
  'activeStandardgroupID'
]

var validateKey = function(key) {
  if (!_.contains(VALID_KEYS, key)){
    throw new Error("Invalid key in gradesPageSession: " + key);
  }  
}

if (!('gradesPage' in Meteor)) {
  Meteor.gradesPage = {};
}
var KEY_PREFIX = "Meteor.gradesPage.";

//Template helpers
VALID_KEYS.forEach(function(key) {
  Template.registerHelper(key,function() { 
    return Session.get(KEY_PREFIX + key);
  })
});

gradesPageSession = {
  set: function(key,value) {
    validateKey(key);
    this._set(key, value);
  },
  _set: function(key, value) {
    Session.set(KEY_PREFIX + key, value);
  },
  get: function(key) {
    validateKey(key);
    return Session.get(KEY_PREFIX + key);
  }
}

/*** Template helpers ***/
Template.registerHelper('activeAssessment',function() {
  return Assessments.findOne(gradesPageSession.get('activeAssessmentID'));
});