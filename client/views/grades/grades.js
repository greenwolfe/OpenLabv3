Template.grades.onCreated(function() {
  var iU = Meteor.impersonatedOrUserId();
  var cU = Meteor.userId();  
  var instance = this;

  instance.autorun(function() {
    var studentID = Meteor.impersonatedOrUserId();
    var categoryID = openlabSession.get('activeCategory');
    var sectionID = Meteor.selectedSectionId();
//    denormalize levels of mastery to create one for each sectionID
//    then modify the publication function to take a section id
/*    var studentOrSectionID = null;
    if (Roles.userIsInRole(studentID,['student'])) {
      studentOrSectionID = studentID;
    } else if (Roles.userIsInRole(studentID,'teacher')) {
      studentOrSectionID = sectionID || studentID;
    }*/
    if (Roles.userIsInRole(studentID,'student') && categoryID) {
      instance.subscribe('levelsOfMastery',categoryID,studentID,null,function() {
        Meteor.subscribe('levelsOfMastery',null,studentID,null);
      })
    }
  });
});