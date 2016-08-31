Meteor.startup(function () {
  Activities.find().forEach(function(activity) {
    Sections.find().forEach(function(section) {
      ActivityStatuses.mutate.updateSectionStatus(section._id,activity._id);
    })
  }) 
});
