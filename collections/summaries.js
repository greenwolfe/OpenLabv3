Summaries = new Meteor.Collection('Summaries');

Meteor.methods({
  insertSummary: function(summary) {
    check(summary,{
      //required fields
      unitID: Match.idString,
      studentID: Match.idString,

      //other fields
      //activityID: Match.Optional(Match.OneOf(Match.idString,'')),
      //createdOn: Match.Optional(Date),
      //modifiedOn: Match.Optional(Date)
    })
    //validate user and set permissions
    if (this.isSimulation)
      return; //only execute this on the server
    var cU = Meteor.user();
    if (!cU)  
      throw new Meteor.Error('notLoggedIn', "You must be logged in to post a summary.");
    if (Roles.userIsInRole(cU,'parentOrAdvisor'))
      throw new Meteor.Error('parentNotAllowed', "Parents may only observe.  They cannot create new content.");
    var student = Meteor.users.findOne(summary.studentID);
    if (!student)
      throw new Meteor.Error('studentNotFound', "Cannot post model summary.  Student not found.");
    if (!Roles.userIsInRole(student,['teacher','student']))
      throw new Meteor.Error('notStudentOrTeacher','Only a teacher or a student can post a summary.');
    if (!Roles.userIsInRole(cU,'teacher') && (cU._id != summary.studentID))
      throw new Meteor.Error('notTeacher', 'Only teachers can post a model summary for someone else.')
    var unit = Units.findOne(summary.unitID);
    var site = Site.findOne(summary.unitID); //could be concept map for whole course
    if (!unit && !site)
      throw new Meteor.Error('unitNotFound','Cannot most model summary.  Unit not found.');

    var existingSummary = Summaries.findOne({unitID:summary.unitID,studentID:summary.studentID});
    if (existingSummary)
      return; //no error, just don't create a new one
      //throw new Meteor.Error('alreadyHasSummary','This student already has a summary for this unit.');

    var today = new Date();
    var otherSummary = Summaries.findOne({unitID:summary.unitID});
    summary.activityID = (otherSummary) ? otherSummary.activityID : '';
    summary.createdOn = today;
    summary.modifiedOn = today;

    return Summaries.insert(summary);
  },

  summaryLinkWithActivity: function(unitID,activityID) {
    check(unitID,Match.idString);
    check(activityID,Match.Optional(Match.OneOf(Match.idString,'')));
    var unit = Units.findOne(unitID);
    var site = Site.findOne(unitID); //could be concept map for whole course
    if (!unit && !site)
      throw new Meteor.Error('unitNotFound','Cannot most model summary.  Unit not found.');
    var activity = Activities.findOne(activityID);
    if ((activity) && (activity.unitID != unitID)) 
      throw new Meteor.Error('notSameUnit','A model summary can  only be linked to an activity from its own unit.');

    //validate user and set permissions
    var cU = Meteor.user();
    if (!cU)  
      throw new Meteor.Error('notLoggedIn', "You must be logged in to post a summary.");
    if (!Roles.userIsInRole(cU,'teacher'))
      throw new Meteor.Error('notTeacher', "Only a teacher may link a summary with an activity.");

    var sampleSummary = Summaries.findOne({unitID:unitID}) || {activityID:''};
    if (activityID != sampleSummary.activityID)
      Summaries.update({unitID:unitID},{$set:{activityID:activityID}},{multi:true});
  }
})