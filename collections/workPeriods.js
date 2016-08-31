WorkPeriods = new Meteor.Collection('WorkPeriods');

//recompute statuses (particularly late indicator) for section and 
//course activityStatuses when deadlines expire.
Meteor.setInterval(function() {
  var rightNow = new Date();
  var oneHourAgo = moment(rightNow).subtract(1,'hour').subtract(1,'second').toDate();
  var sectionIDs = _.pluck(Sections.find().fetch(),'_id');
  WorkPeriods.find({endDate:{$gt:oneHourAgo,$lt:rightNow}}).forEach(function(workPeriod) {
    sectionIDs.forEach(function(sectionID) {
      ActivityStatuses.mutate.updateSectionStatus(sectionID,workPeriod.activityID);
    })
  })
},3600000); //run every hour

Meteor.methods({
  'setWorkPeriod': function(workPeriod) {
    check(workPeriod,{
      activityID: Match.idString,
      sectionID: Match.OneOf(Match.idString,'applyToAll'), 
      startDate: Match.OneOf(Date,null),
      endDate: Match.OneOf(Date,null),
      //below included to avoid check error in case it was easier to pass in the existing full record
      _id: Match.Optional(Match.idString), //check for existing workPeriod using activityID and sectionID rather than this value if its passed in
      unitID: Match.Optional(Match.idString), //set from activity below, reset by update hook whenver activity itself changes
      activityVisible: Match.Optional(Boolean), //same here
    });

    var cU = Meteor.user();
    if (!cU)
      throw new Meteor.Error('notLoggedIn','You must be logged in to set or change a work period.');
    if (!Roles.userIsInRole(cU,'teacher'))
      throw new Meteor.Error('notTeacher','Only a teacher can set or change a work period.');

    var activity = Activities.findOne(workPeriod.activityID);
    if (!activity)
      throw new Meteor.Error('activity-not-found', "Cannot set work period, could not find activity " + workPeriod.activityID + '.');

    var dateTimeFormat = "ddd, MMM D YYYY [at] h:mm a";
    if ((workPeriod.endDate) && (workPeriod.startDate) && (workPeriod.endDate < workPeriod.startDate))
      throw new Meteor.Error('invalid-work-period',"Cannot set work period.  end date " + moment(workPeriod.endDate).format(dateTimeFormat) + ' < start date ' + moment(workPeriod.endDate).format(dateTimeFormat) +'.');

    delete workPeriod._id;
    workPeriod.unitID = activity.unitID;
    workPeriod.activityVisible = activity.visible;

    var selector =  (workPeriod.sectionID == 'applyToAll') ? {} : {_id:workPeriod.sectionID};
    Sections.find(selector).forEach(function(section) {
      var wP = WorkPeriods.findOne({sectionID:section._id,activityID:workPeriod.activityID});
      if (wP) {
          WorkPeriods.update(wP._id,{$set:{
            startDate:workPeriod.startDate,
            endDate:workPeriod.endDate,
          }});
      } else {
        workPeriod.sectionID = section._id;
        WorkPeriods.insert(workPeriod);
      }
    });
  },
  'deleteWorkPeriod': function(workPeriod) {
    check(workPeriod,Match.ObjectIncluding({
      sectionID: Match.OneOf(Match.idString,'applyToAll'), 
      _id: Match.idString,
      activityID: Match.idString
    }));

    var cU = Meteor.user();
    if (!cU)
      throw new Meteor.Error('notLoggedIn','You must be logged in to increment an activity status.');
    if (!Roles.userIsInRole(cU,'teacher'))
      throw new Meteor.Error('notTeacher','Only a teacher can set or change a work period.');

    wP = WorkPeriods.findOne(workPeriod._id);
    if (!wP)
      throw new Meteor.Error('workPeriod-not-found',"Cannot delete work period with id = , " + workPeriod._id + " work period not found.")

    var selector =  (workPeriod.sectionID == 'applyToAll') ? {} : {_id:workPeriod.sectionID};
    Sections.find(selector).forEach(function(section) {
      var wP = WorkPeriods.findOne({sectionID:section._id,activityID:workPeriod.activityID});
      if (wP) {
        WorkPeriods.remove(wP._id);
      }
    });
  }
})