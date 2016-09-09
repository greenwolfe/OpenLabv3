Template.grades.onCreated(function() {
  var instance = this;
  var assessmentID = FlowRouter.getParam('_id');
  assessmentID = assessmentID || null;
  gradesPageSession.set('activeAssessmentID',assessmentID);
  gradesPageSession.set('addingStandards',false);
  var showing = (assessmentID) ? 'assessments' : 'none';
  instance.showing = new ReactiveVar(showing); //assessments, standardGroups

  instance.autorun(function() {
    var studentID = Meteor.impersonatedOrUserId();
    var categoryID = openlabSession.get('activeCategory');
    var sectionID = Meteor.selectedSectionId();
//    have not implemented LOMs for sectionID or siteID yet
//    denormalize levels of mastery to create one for each section as well as the whole class
//    then modify the publication function to take a section id or siteId
//    finally modify the standardItem to display the LOM for sections and site
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

Template.grades.helpers({
  showingAssessments: function() {
    var instance = Template.instance();
    return (instance.showing.get() == 'assessments')
  },
  assessmentsActive: function() {
    var instance = Template.instance();
    return (instance.showing.get() == 'assessments') ? 'active' : '';
  },
  showingStandardGroups: function() {
    var instance = Template.instance();
    return (instance.showing.get() == 'standardGroups')
  },
  standardGroupsActive: function() {
    var instance = Template.instance();
    return (instance.showing.get() == 'standardGroups') ? 'active' : '';
  },
  showingNone: function() {
    var instance = Template.instance();
    return (instance.showing.get() == 'none')
  },
  noneActive: function() {
    var instance = Template.instance();
    return (instance.showing.get() == 'none') ? 'active' : '';
  }
})

Template.grades.events({
  'click button.showAssessments': function(event,tmpl) {
    tmpl.showing.set('assessments');
  },
  'click button.showStandardGroups': function(event,tmpl) {
    //tmpl.showing.set('standardGroups');
    gradesPageSession.set('activeAssessmentID',null);
  },
  'click button.showNone': function(event,tmpl) {
    tmpl.showing.set('none');
    gradesPageSession.set('activeAssessmentID',null);
  },
})