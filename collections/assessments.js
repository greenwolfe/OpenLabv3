Assessments = new Meteor.Collection('Assessments');

/*
  pass units in to grades page, select unit to show assessment in,
  make new row at bottom of activies list for assessments
  PASS IN creating users last viewed unit or else the unit with lowest order
  then provide for changing that selecting a different unit
  in the assessment ... move some of these functions to mutate objects for the standard
  ???not following notes below now
  so must load them for this page just in order to link?
  option to create on standards page, but then have to load assessments in order to choose one
*/
Meteor.methods({
  insertAssessment: function(createdFor) {
    check(createdFor,Match.idString);
    /*
      unitID:Match.idString,
      createdBy: Match.idString,
      createdOn: Date,
      modifiedBy: Match.idString,
      modifiedOn: Date,
      visible: Boolean,
      title: String, //a title to refer to the assessment as (denormalize with title of activity?)
      text: String, //any instructions or other info about the assessment

    */
    /* linked objects
       assessmentStandard, linked to standard and assessment
       assessmentDate, linked to both the assessment and the activity?
          assessmentID field, so activityID or assessmentID can be null, but not both
       todo items, (with their own due dates)
    */
    var site = Site.findOne(createdFor);
    var student = Meteor.users.findOne(createdFor);
    if (!site && !student)
      throw new Meteor.Error('invalidAudience','Invalid audience for assessment.  Must be a specific student if its a reassessment or the entire class.');
    var cU = Meteor.user();
    if (!cU)  
      throw new Meteor.Error('notLoggedIn', "You must be logged in to create an assessment.");
    if (!Roles.userIsInRole(cU,['teacher','student']))
      throw new Meteor.Error('notTeacherOrStudent','Only teachers or students can create an assessment.');
    if (Roles.userIsInRole(cU,'student') && (student) && (cU != createdFor))
      throw new Meteor.Error('onlySelf','You cannot create a reassessment for another student.');
    if ((site) && !Roles.userIsInRole(cU,'teacher'))
      throw new Meteor.Error('onlyTeacher','Only a teacher can create an assessment for the whole class.');

    if (student) {
      var unitID = student.profile.lastViewedUnit;
    } else if (site) {
      var unitID = cU.profile.lastViewedUnit;
    }
    if (!unitID) {
      var unit = Units.findOne({},{sort:{order:-1}});
      if (!unit)
        throw new Meteor.Error('unitNotFound','could not find a unit to put the assessment reminder under.');
      unitID = unit._id;
    }

    var today = new Date();
    var assessment = {
      createdFor: createdFor,
      unitID: unitID,
      createdBy: cU._id,
      createdOn: today,
      modifiedBy: cU._id,
      modifiedOn: today,
      visible: true,
      title: '',
      text: ''
    }
    return Assessments.insert(assessment);
  },
  updateAssessment: function(assessment) {
    check(assessment, {
      _id: Match.idString,
      title: Match.Optional(String),
      text: Match.Optional(String),
      unitID: Match.Optional(Match.idString),

      //may be passed in, but will not be updated
      createdFor: Match.Optional(Match.idString),
      createdBy: Match.Optional(Match.idString),
      createdOn: Match.Optional(Date),

      //may be passed in, but values will not be used ... values will be set automatically below
      modifiedBy: Match.Optional(Match.idString),  //current user
      modifiedOn: Match.Optional(Date), //today's date
      visible: Match.Optional(Boolean), //set in showHideMethod.js
    /* linked objects
       activity, (pointsTo field) ... auto-created here
       workperiod, linked to both the assessment and the activity?
          assessmentID field, so activityID or assessmentID can be null, but not both
       todo items, (with their own workperiods ... ?)
    */
    })
    var site = Site.findOne(assessment.createdFor);
    var student = Meteor.users.findOne(assessment.createdFor);
    if (!site && !student)
      throw new Meteor.Error('invalidAudience','Invalid audience for assessment.  Must be a specific student if its a reassessment or the entire class.');
    var cU = Meteor.userId();
    if (!cU)  
      throw new Meteor.Error('notLoggedIn', "You must be logged in to update an assessment.");
    if (!Roles.userIsInRole(cU,['teacher','student']))
      throw new Meteor.Error('notTeacherOrStudent','Only teachers or students can update an assessment.');
    if (Roles.userIsInRole(cU,'student') && (student) && (cU != assessment.createdFor))
      throw new Meteor.Error('onlySelf','You cannot update a reassessment for another student.');
    if ((site) && !Roles.userIsInRole(cU,'teacher'))
      throw new Meteor.Error('onlyTeacher','Only a teacher can update an assessment for the whole class.');

    var today = new Date();
    var set = {
      modifiedBy: cU,
      modifiedOn: today,
    }
    if ('title' in assessment) {
      set.title = assessment.title;
    }
    if ('unitID' in assessment) {
      var unit = Units.findOne(unitID);
      if (!unit)
        throw new Meteor.Error('unitNotFound','could not find a unit to put the assessment reminder under.');        
      set.unitID = unitID;
    }
    var fields = ['text']; //all the rest, which is just text for now
    fields.forEach(function(field) {
      if (field in assessment) 
        set[field] = assessment[field];
    });
    return Assessments.update(assessment._id,{$set:set});
  }
});