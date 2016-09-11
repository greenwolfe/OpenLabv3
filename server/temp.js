Meteor.startup(function() {
  Standards.find().forEach(function(standard) {
    StandardDates.mutate.setStandardDate(standard._id,'applyToAll');
  });
});
