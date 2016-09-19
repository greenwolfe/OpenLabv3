Assessments = new Meteor.Collection('Assessments');
Assessments.mutate = {};

Assessments.mutate.updateStandardsCount = function(assessmentID) {
  check(assessmentID,Match.idString);
  var assessment = Assessments.findOne(assessmentID);
  if (!assessment)
    return;
  var standardsCount = AssessmentStandards.find({assessmentID:assessmentID,visible:true,standardVisible:true}).count();
  var hiddenStandardsCount = AssessmentStandards.find({assessmentID:assessmentID,$or:[{visible:false},{standardVisible:false}]}).count();
  Assessments.update(assessmentID,{$set:{
    standardsCount:standardsCount,
    hiddenStandardsCount:hiddenStandardsCount
  }})
}
Assessments.mutate.updateTodoCount = function(assessmentID) {
  check(assessmentID,Match.idString);
  var assessment = Assessments.findOne(assessmentID);
  if (!assessment)
    return;
  var todoCount = Todos.find({assessmentID:assessmentID}).count();
  Assessments.update(assessmentID,{$set:{
    todoCount:todoCount
  }})
}
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
      minTestDate: Match.Optional(Date), //set in AssessmentDates
      maxTestDate: Match.Optional(Date), //set in AssessmentDates
      standardsCount: Match.Optional(Match.Integer), //set in AssessmentStandards
      hiddenStandardsCount: Match.Optional(Match.Integer) //set in AssessmentStandards
      todoCount: Match.Optional(Match.Integer), //set in Todos
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
    if (Roles.userIsInRole(cU,'student') && (student) && (cU._id != createdFor))
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
    var deadline = moment().hours(16).toDate();
    var assessment = {
      createdFor: createdFor,
      unitID: unitID,
      createdBy: cU._id,
      createdOn: today,
      modifiedBy: cU._id,
      modifiedOn: today,
      visible: true,
      title: '',
      text: '',
      minTestDate: deadline,
      maxTestDate: deadline,
      standardsCount: 0,
      hiddenStandardsCount: 0,
      todoCount: 0
    }
    return Assessments.insert(assessment,function(error,id) {
      if (error) {
        console.log(error.reason)
      } else {
        AssessmentDates.mutate.setAssessmentDate({
          assessmentID:id,
          sectionID:'applyToAll',
          testDate: deadline
        })
      }
    });
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
      minTestDate: Match.Optional(Date), //set in AssessmentDates
      maxTestDate: Match.Optional(Date), //set in AssessmentDates
      standardsCount: Match.Optional(Match.Integer), //set in AssessmentStandards
      hiddenStandardsCount: Match.Optional(Match.Integer), //set in AssessmentStandards
      todoCount: Match.Optional(Match.Integer), //set in Todos
    /* linked objects
       activity, (pointsTo field) ... auto-created here
       workperiod, linked to both the assessment and the activity?
          assessmentID field, so activityID or assessmentID can be null, but not both
       todo items, (with their own workperiods ... ?)
    */
    })
    var originalAssessment = Assessments.findOne(assessment._id);
    if (!originalAssessment)
      throw new Meteor.Error('assessmentNotFound',"Cannot update assessment.  Assessment not found.");

    var site = Site.findOne(originalAssessment.createdFor);
    var student = Meteor.users.findOne(originalAssessment.createdFor);
    if (!site && !student)
      throw new Meteor.Error('invalidAudience','Invalid audience for assessment.  Must be a specific student if its a reassessment or the entire class.');
    var cU = Meteor.userId();
    if (!cU)  
      throw new Meteor.Error('notLoggedIn', "You must be logged in to update an assessment.");
    if (!Roles.userIsInRole(cU,['teacher','student']))
      throw new Meteor.Error('notTeacherOrStudent','Only teachers or students can update an assessment.');
    if (Roles.userIsInRole(cU,'student') && (student) && (cU != originalAssessment.createdFor))
      throw new Meteor.Error('onlySelf','You cannot update a reassessment for another student.');
    if ((site) && !Roles.userIsInRole(cU,'teacher'))
      throw new Meteor.Error('onlyTeacher','Only a teacher can update an assessment for the whole class.');

    var today = new Date();
    var set = {
      modifiedBy: cU,
      modifiedOn: today
    }
    if ('unitID' in assessment) {
      var unit = Units.findOne(assessment.unitID);
      if (!unit)
        throw new Meteor.Error('unitNotFound','could not find a unit to put the assessment reminder under.');        
      set.unitID = assessment.unitID;
    }
    var fields = ['text','title']; //all the rest, which is just text and title for now
    fields.forEach(function(field) {
      if (field in assessment) 
        set[field] = assessment[field];
    });
    return Assessments.update(assessment._id,{$set:set});
  }
});
Meteor.methods({
  deleteAssessmentIfEmpty: function(assessmentID) {
    check(assessmentID,Match.idString);

    //can't figure out how to generate an error in the mutate function and pass it back to here
    //so duplicating these checks
    var assessment = Assessments.findOne(assessmentID);
    if (!assessment)
      throw new Meteor.Error('assessmentNotFound',"Cannot delete assessment.  Assessment not found.");
    var assessmentStandardsCount = AssessmentStandards.find({assessmentID:assessmentID}).count();
    var todoCount = Todos.find({assessmentID:assessmentID}).count();
    if (assessmentStandardsCount || todoCount)
      throw new Meteor.Error('assessmentNotEmpty',"You must remove all standards and all items from the to do list before deleting an assessment.");
    var site = Site.findOne(assessment.createdFor);
    var student = Meteor.users.findOne(assessment.createdFor);
    if (!site && !student)
      throw new Meteor.Error('invalidAudience','Invalid audience for assessment.  Must be a specific student if its a reassessment or the entire class.');

    //the checks that should really be in this method
    var cU = Meteor.userId();
    if (!cU)  
      throw new Meteor.Error('notLoggedIn', "You must be logged in to update an assessment.");
    if (!Roles.userIsInRole(cU,['teacher','student']))
      throw new Meteor.Error('notTeacherOrStudent','Only teachers or students can update an assessment.');
    if (Roles.userIsInRole(cU,'student') && (student) && (cU != assessment.createdFor))
      throw new Meteor.Error('onlySelf','You cannot update a reassessment for another student.');
    if ((site) && !Roles.userIsInRole(cU,'teacher'))
      throw new Meteor.Error('onlyTeacher','Only a teacher can update an assessment for the whole class.');


    return Assessments.mutate.deleteAssessmentIfEmpty(assessmentID);
  }
});
Assessments.mutate.deleteAssessmentIfEmpty = function(assessmentID) {
  check(assessmentID,Match.idString);
  var assessment = Assessments.findOne(assessmentID);
  if (!assessment)
    return;
  var assessmentStandardsCount = AssessmentStandards.find({assessmentID:assessmentID}).count();
  var todoCount = Todos.find({assessmentID:assessmentID}).count();
  if (assessmentStandardsCount || todoCount)
    return;

  return Assessments.remove(assessment._id);
}

/**** HOOKS ****/
Assessments.after.update(function (userID, doc, fieldNames, modifier) {
  var fields = {
    assessmentID: doc._id, //passed in for query, not changed
    sectionID: 'applyToAll',
  }
  if (doc.visible != this.previous.visible) //denormalize these to keep them the same as their assessment
    fields.visible = doc.visible;
  if (doc.unitID != this.previous.unitID)
    fields.unitID = doc.unitID;
  if (('visible' in fields) || ('unitID' in fields))
    AssessmentDates.mutate.setAssessmentDate(fields);
  if (doc.maxTestDate != this.previous.maxTestDate)
    fields.maxTestDate = doc.maxTestDate;
  if (doc.minTestDate != this.previous.minTestDate)
    fields.minTestDate = doc.minTestDate;
  if (('visible' in fields) || ('unitID' in fields) || ('minDate' in fields) || ('maxDate' in fields)) {
    delete fields.assessmentID;
    delete fields.sectionID;
    AssessmentStandards.update({assessmentID:doc._id},{$set:fields});
  }
});