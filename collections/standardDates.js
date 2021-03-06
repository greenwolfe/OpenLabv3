StandardDates = new Meteor.Collection('StandardDates');
StandardDates.mutate = {};

//called from Assessments whenever an assessment date changes
StandardDates.mutate.setStandardDate = function(standardID,sectionID) {
  check(standardID,Match.idString);
  check(sectionID,Match.OneOf(Match.idString,'applyToAll'));

  if (Meteor.isServer) {
    Meteor.defer(function() {  
      var assessmentIDs = _.pluck(AssessmentStandards.find({standardID:standardID,createdFor:Site.findOne()._id}).fetch(),'assessmentID');
      var selector =  (sectionID == 'applyToAll') ? {} : {_id:sectionID};
      Sections.find(selector).forEach(function(section) {
        var testDates = _.pluck(AssessmentDates.find({assessmentID:{$in:assessmentIDs},sectionID:section._id}).fetch(),'testDate');
        testDates.push(wayWayInTheFuture());
        var standardDate = _.min(testDates);
        var sD = StandardDates.findOne({sectionID:section._id,standardID:standardID});
        if (sD) {
          StandardDates.update(sD._id,{$set:{masteryExpected:standardDate}});
        } else {
          StandardDates.insert({
            standardID:standardID,
            sectionID:section._id,
            masteryExpected: standardDate
          })
        }
      });
    });
  }
}
