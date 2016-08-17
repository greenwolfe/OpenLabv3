Assessments = new Meteor.Collection('Assessments');

/*
  make collection standardsForAssessment items will point 
  to assessment and standard and have an order parameter
  on assessment page, do a sortable1c on standardsForAssessment,
  and inside that, call the specific standard for presentation

  auto-create an activity whose pointTo field points back to
  the grades page with this particular assessment visible
  how to pass in the unit for it???  units and activities are not loaded on the grades page?
  so must load them for this page just in order to link?
  option to create on standards page, but then have to load assessments in order to choose one
*/
Meteor.methods({
  insertAssessment: function(createdFor,unitID) {
    check(createdFor,Match.idString);
    check(unitID,Match.Optional(Match.idString));
    /*
      createdBy: Match.idString,
      createdOn: Date,
      modifiedBy: Match.idString,
      modifiedOn: Date,
      visible: Boolean,
      title: String, //a title to refer to the assessment as (denormalize with title of activity?)
      text: String, //any instructions or other info about the assessment

    */
    /* linked objects
       activity, (pointsTo field) ... auto-created here
       workperiod, linked to both the assessment and the activity?
          assessmentID field, so activityID or assessmentID can be null, but not both
       todo items, (with their own workperiods ... ?)
    */
    var site = Site.findOne(createdFor);
    var student = Meteor.users.findOne(createdFor);
    if (!site && !student)
      throw new Meteor.Error('invalidAudience','Invalid audience for assessment.  Must be a specific student if its a reassessment or the entire class.');
    var cU = Meteor.userId();
    if (!cU)  
      throw new Meteor.Error('notLoggedIn', "You must be logged in to create an assessment.");
    if (!Roles.userIsInRole(cU,['teacher','student']))
      throw new Meteor.Error('notTeacherOrStudent','Only teachers or students can create an assessment.');
    if (Roles.userIsInRole(cU,'student') && (student) && (cU != createdFor))
      throw new Meteor.Error('onlySelf','You cannot create a reassessment for another student.');
    if ((site) && !Roles.userIsInRole(cU,'teacher'))
      throw new Meteor.Error('onlyTeacher','Only a teacher can create an assessment for the whole class.');
    var unit = Units.findOne(unitID);
    if ((site) && (!unit))
      throw new Meteor.Error('unitRequired','To create an assessment, you must specify a unit to put a linked activity in.');

    var today = new Date();
    var assessment = {
      createdFor: createdFor,
      createdBy: cU,
      createdOn: today,
      modifiedBy: cU,
      modifiedOn: today,
      visible: true,
      title: 'assessment',
      text: ''
    }
    return Assessments.insert(assessment,function(error,id) {
      if (error) {
        throw new Meteor.Error(error.reason);
      } else if (site) {
        Meteor.call('insertActivity',{
          pointsTo: id,
          title: 'assessment',
          unitID: unitID
        })
      }
    })
  },
  updateAssessment: function(assessment) {
    check(assessment, {
      _id: Match.idString,
      title: Match.Optional(String),
      text: Match.Optional(String),

      //may passed in, but will not be updated
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
      set.title = assessment.title | 'assessment';
    }
    var fields = ['text']; //all the rest, which is just text for now
    fields.forEach(function(field) {
      if (field in assessment) 
        set[field] = assessment[field];
    });
    if ((site) && ('title' in assessment)) {
      Activities.update({pointsTo:assessment._id},{$set:{title:set.title}});
    }
    return Assessments.update(assessment._id,{$set:set});
  }
});