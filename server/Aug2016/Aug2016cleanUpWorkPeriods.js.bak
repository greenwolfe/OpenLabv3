Meteor.startup(function() {
  WorkPeriods.find().forEach(function(wP) {
    WorkPeriods.update(wP._id,{$unset:{
      unitStartDate: '',
      unitEndDate: '',
      unitStartDateWithoutSelf: '',
      unitEndDateWithoutSelf: ''
    }})
  })
});