AssessmentDates = new Meteor.Collection('AssessmentDates');
AssessmentDates.mutate = {};

//update modified fields of assessment
Meteor.methods({
  'setAssessmentDate':function(assessmentDate) {
    check(assessmentDate,{
      //used for queries, but not changed
      assessmentID: Match.idString,
      sectionID: Match.OneOf(Match.idString,'applyToAll'),
      //will be changed if passed in
      testDate: Match.Optional(Match.OneOf(Date,null)),
      //these three will always be set to match their assessment
      visible: Match.Optional(Boolean),
      unitID: Match.Optional(Match.idString),
      createdFor: Match.Optional(Match.idString), //but this one is never modified on update
      //below included to avoid check error in case full record passed in
      _id: Match.Optional(Match.idString)
    })

    var cU = Meteor.userId();
    if (!cU)
      throw new Meteor.Error('notLoggedIn','You must be logged in to set or change a date for an assessment.');
    if (!Roles.userIsInRole(cU,['teacher','student']))
      throw new Meteor.Error('notTeacherOrStudent','Only a teacher or student can set or change an assessment date.');

    var assessment = Assessments.findOne(assessmentDate.assessmentID);
    if (!assessment)
      throw new Meteor.Error('assessmentNotFound','Cannot set assessment date.  Assessment not found.');
    if (Roles.userIsInRole(cU,'student') && (cU != assessment.createdFor))
      throw new Meteor.Error('notYours','A student can only set a date for his/her own reassessment.');

    AssessmentDates.mutate.setAssessmentDate(assessmentDate);

    var today = new Date();
    Assessments.update(assessmentDate.assessmentID,{$set:{
      modifiedBy: cU,
      modifiedOn: today
    }})
  }
})
AssessmentDates.mutate.setAssessmentDate = function(assessmentDate) {
  check(assessmentDate,{
    //used for queries, but not changed
    assessmentID: Match.idString,
    sectionID: Match.OneOf(Match.idString,'applyToAll'),
    //will be changed if passed in
    testDate: Match.Optional(Match.OneOf(Date,null)),
    //these three will always be set to match their assessment
    visible: Match.Optional(Boolean),
    unitID: Match.Optional(Match.idString),
    createdFor: Match.Optional(Match.idString), //but this one is never modified on update
    //below included to avoid check error in case full record passed in
    _id: Match.Optional(Match.idString)
  })

  var assessment = Assessments.findOne(assessmentDate.assessmentID);
  if (!assessment)
    return;

  var selector = (assessmentDate.sectionID == 'applyToAll') ? {} : {_id:assessmentDate.sectionID};
  Sections.find(selector).forEach(function(section) {
    var fields = {
      visible: assessment.visible,
      unitID: assessment.unitID
    }
    if ('testDate' in assessmentDate)
      fields.testDate = assessmentDate.testDate;
    var aD = AssessmentDates.findOne({sectionID:section._id,assessmentID:assessmentDate.assessmentID});
    if (aD) {
        AssessmentDates.update(aD._id,{$set:fields});
    } else {
      if ('testDate' in assessmentDate) {
        fields.assessmentID = assessmentDate.assessmentID;
        fields.sectionID = section._id;
        fields.createdFor = assessment.createdFor;
        AssessmentDates.insert(fields);
      } //else we were just trying to update visible and unitID fields of existing assessmentDates
    }
  });

  if ('testDate' in assessmentDate) {
    if (assessmentDate.testDate < assessment.minTestDate)
      Assessments.update(assessmentDate.assessmentID,{$set:{minTestDate:assessmentDate.testDate}});
    if (assessmentDate.testDate > assessment.maxTestDate)
      Assessments.update(assessmentDate.assessmentID,{$set:{maxTestDate:assessmentDate.testDate}});
    AssessmentStandards.find({assessmentID:assessmentDate.assessmentID}).forEach(function(assessmentStandard) {
      StandardDates.mutate.setStandardDate(assessmentStandard.standardID,'applyToAll');      
    });  
  }
}

  //in current thinking, should not be able to delete date
  //assessment always has to have a valid date
  /*
  Meteor.methods({
  'deleteAssessmentDate': function(assessmentDate) {
    check(assessmentDate,Match.ObjectIncluding({
      sectionID: Match.OneOf(Match.idString,'applyToAll'), 
      _id: Match.idString,
      assessmentID: Match.idString
    }));

    var cU = Meteor.userId();
    if (!cU)
      throw new Meteor.Error('notLoggedIn','You must be logged in to delete an assessment date.');
    if (!Roles.userIsInRole(cU,['teacher','student']))
      throw new Meteor.Error('notTeacherOrStudent','Only a teacher or student can delete an assessment date.');

    var assessment = Assessments.findOne(assessmentDate.assessmentID);
    if ((assessment) && Roles.userIsInRole(cU,'student') && (cU != assessment.createdFor))
      throw new Meteor.Error('notYours','A student can only delete a date for his/her own reassessment.');

    aD = AssessmentDates.findOne(assessmentDate._id);
    if (!aD)
      throw new Meteor.Error('assessmentDateNotFound',"Cannot delete assessment date with id = , " + assessmentDate._id + " assessment date not found.")

    if (assessment) {
      var today = new Date();
      Assessments.update(assessmentDate.assessmentID,{$set:{
        modifiedBy: cU,
        modifiedOn: today
      }})
    }

    var selector =  (workPeriod.sectionID == 'applyToAll') ? {} : {_id:workPeriod.sectionID};
    Sections.find(selector).forEach(function(section) {
      var aD = AssessmentDates.findOne({sectionID:section._id,activityID:workPeriod.activityID});
      if (aD) {
        AssessmentDates.remove(aD._id);
      }
    });

    AssessmentStandards.find({assessmentID:assessmentDate.assessmentID}).forEach(function(assessmentStandard) {
      StandardDates.mutate.setStandardDate(assessmentStandard.standardID,'applyToAll');      
    });
  }
})
*/