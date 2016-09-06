AssessmentStandards = new Meteor.Collection('AssessmentStandards');

////LOM's now point to assessmentStandard by ID as well?
Meteor.methods({
  'assessmentAddStandard':function(assessmentStandard) {
    check(assessmentStandard,{
      assessmentID: Match.idString,
      standardID: Match.OneOf(Match.idString,'applyToAll') 
      //to be denormalized from assessment
      //visible: Match.Optional(Boolean),
      //unitID: Match.Optional(Match.idString),
      //createdFor: Match.Optional(Match.idString),
      //maxDate: Match.Optional(Date),
      //minDate: Match.Optional(Date),
      //standardVisible: Match.Optional(Boolean),

       //order: Match.Optional(Match.Integer) //new standard always placed at end of list
    })

    var cU = Meteor.userId();
    if (!cU)
      throw new Meteor.Error('notLoggedIn','You must be logged in to add a standard to an assessment.');
    if (!Roles.userIsInRole(cU,['teacher','student']))
      throw new Meteor.Error('notTeacherOrStudent','Only a teacher or student can add a standard to an assessment.');

    var assessment = Assessments.findOne(assessmentStandard.assessmentID);
    if (!assessment)
      throw new Meteor.Error('assessmentNotFound','Cannot add standard.  Assessment not found.');
    if (Roles.userIsInRole(cU,'student') && (cU != assessment.createdFor))
      throw new Meteor.Error('notYours','A student can only add a standard to his/her own reassessment.');
    assessmentStandard.unitID = assessment.unitID;
    assessmentStandard.createdFor = assessment.createdFor;
    assessmentStandard.maxTestDate = assessment.maxTestDate;
    assessmentStandard.minTestDate = assessment.minTestDate;

    var standard = Standards.findOne(assessmentStandard.standardID);
    if (!standard)
      throw new Meteor.Error('standardNotFound','Cannot add standard to assessment.  Standard not found.');
    assessmentStandard.standardVisible = standard.visible;
    assessmentStandard.visible = standard.visible;

    var lastStandard = AssessmentStandards.findOne({assessmentID: assessmentStandard.assessmentID},{
      fields:{order:1},
      sort:{order:-1}
    });
    assessmentStandard.order = (lastStandard) ? lastStandard.order + 1 : 0; 

    var today = new Date();
    Assessments.update(assessmentStandard.assessmentID,{$set:{
      modifiedBy: cU,
      modifiedOn: today
    }})

    return AssessmentStandards.insert(assessmentStandard,function(error,id) {
      if (error) {
        console.log(error);
      } else {
        StandardDates.mutate.setStandardDate(assessmentStandard.standardID,'applyToAll');
        Assessments.mutate.updateStandardsCount(assessmentStandard.assessmentID);
      }
    });
  },
  'assessmentRemoveStandard': function(assessmentStandardID) {
    check(assessmentStandardID,Match.idString);

    var cU = Meteor.userId();
    if (!cU)
      throw new Meteor.Error('notLoggedIn','You must be logged in to delete an assessment date.');
    if (!Roles.userIsInRole(cU,['teacher','student']))
      throw new Meteor.Error('notTeacherOrStudent','Only a teacher or student can delete an assessment date.');

    assessmentStandard = AssessmentStandards.findOne(assessmentStandardID);
    if (!assessmentStandard)
      throw new Meteor.Error('assessmentStandardNotFound',"Cannot remove standard with id = , " + assessmentStandardID + " from it's assessment.  AssessmentStandard not found.")

    var assessment = Assessments.findOne(assessmentStandard.assessmentID);
    if (!assessment)
      throw new Meteor.Error('assessmentNotFound','Cannot add standard.  Assessment not found.');
    if (Roles.userIsInRole(cU,'student') && (cU != assessment.createdFor))
      throw new Meteor.Error('notYours','A student can only remove a standard from his/her own reassessment.');

    var LoMcount = LevelsOfMastery.find({assessmentID:assessmentStandard.assessmentID,standardID:assessmentStandard.standardID}).count();
    if (LoMcount > 0)
      throw new Meteor.Error('alreadyAssessed','Cannot remove standard from assessment.  At least one student has already received a grade for this standard on this assessment. Deleting it will orphan those grades.');

    if (assessment) {
      var today = new Date();
      Assessments.update(assessmentStandard.assessmentID,{$set:{
        modifiedBy: cU,
        modifiedOn: today
      }})
    }

    var ids = _.pluck(AssessmentStandards.find({assessmentID:assessmentStandard.assessmentID,order:{$gt: assessmentStandard.order}},{fields: {_id: 1}}).fetch(), '_id');
    var numberRemoved = AssessmentStandards.remove(assessmentStandardID,function(error,id) {
      if (error) {
        console.log(error);
      } else {
        StandardDates.mutate.setStandardDate(assessmentStandard.standardID,'applyToAll');
        Assessments.mutate.updateStandardsCount(assessmentStandard.assessmentID);
      }
    });
    AssessmentStandards.update({_id: {$in: ids}}, {$inc: {order:-1}}, {multi: true});
    return numberRemoved; 
  }
})