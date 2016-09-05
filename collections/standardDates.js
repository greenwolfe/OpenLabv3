StandardDates = new Meteor.Collection('StandardDates');
StandardDates.mutate = {};

//called from Assessments whenever an assessment date changes
StandardDates.mutate.setStandardDate = function(standardID,sectionID) {
  check(standardID,Match.idString);
  check(sectionID,Match.OneOf(Match.idString,'applyToAll'));

  Meteor.defer(function() {  
    var assessmentIDs = _.pluck(AssessmentStandards.find({standardID:standardID}).fetch(),'assessmentID');
    var selector =  (sectionID == 'applyToAll') ? {} : {_id:sectionID};
    Sections.find(selector).forEach(function(section) {
      var testDates = _.pluck(AssessmentDates.find({_id:{$in:assessmentIDs}}).fetch(),'testDate');
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
