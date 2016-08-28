Meteor.startup(function () {
  Units.update({},{$set:{teacherNotes:''}},{multi:true});
});
