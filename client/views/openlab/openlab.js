Template.openlab.onCreated(function() {
  var instance = this;
  instance.showing = new ReactiveVar('summary'); //slides or summary or concept or teacherNotes
})

Template.openlab.onRendered(function() {
  var instance = this;

  instance.autorun(function() { 
    var unitID = openlabSession.get('activeUnit');
    var studentID = Meteor.impersonatedOrUserId();
    var sectionID = Meteor.selectedSectionId();
    //make more sophisticated, check for new slides
    //check if new slides are dated 
    //check if a summary exists and has a current image
    instance.showing.set('summary');    
  });

});

Template.openlab.helpers({
  showingSlides: function() {
    var instance = Template.instance();
    return (instance.showing.get() == 'slides')
  },
  slidesActive: function() {
    var instance = Template.instance();
    return (instance.showing.get() == 'slides') ? 'active' : '';
  },
  showingSummary: function() {
    var instance = Template.instance();
    return (instance.showing.get() == 'summary')
  },
  summaryActive: function() {
    var instance = Template.instance();
    return (instance.showing.get() == 'summary') ? 'active' : '';
  },
  showingConceptMap: function() {
    var instance = Template.instance();
    return (instance.showing.get() == 'concept')
  },
  conceptMapActive: function() {
    var instance = Template.instance();
    return (instance.showing.get() == 'concept') ? 'active' : '';
  },
  showingTeacherNotes: function() {
    var instance = Template.instance();
    return (instance.showing.get() == 'teacherNotes')
  },
  teacherNotesActive: function() {
    var instance = Template.instance();
    return (instance.showing.get() == 'teacherNotes') ? 'active' : '';    
  },
  site: function() {
    return Site.findOne();
  },
  activeUnit: function() {
    return Units.findOne(openlabSession.get('activeUnit'));
  }
});

Template.openlab.events({
  'click button.showSlides': function(event,tmpl) {
    tmpl.showing.set('slides');
  },
  'click button.showSummary': function(event,tmpl) {
    tmpl.showing.set('summary');
  },
  'click button.showConceptMap': function(event,tmpl) {
    tmpl.showing.set('concept');
  },
  'click button.showTeacherNotes': function(event,tmpl) {
    tmpl.showing.set('teacherNotes');
  }
})