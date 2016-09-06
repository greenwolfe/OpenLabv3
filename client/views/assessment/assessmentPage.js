  /**************************/
 /**** ASSESSMENT PAGE *****/
/**************************/

Template.assessmentPage.onCreated(function() {
  var instance = this;
  instance.showAssessment = new ReactiveVar('this'); //or all
  instance.showTimePeriod = new ReactiveVar('mostRecent'); //or all time

  var assessmentSubscription = Meteor.subscribe('assessmentWithDatesAndStandards',FlowRouter.getParam('_id'));

  instance.autorun(function() {
    if (!assessmentSubscription.ready())
      return;
    var assessment = Assessments.findOne(FlowRouter.getParam('_id'));
    if (!assessment)
      return;
    var standardIDs = _.pluck(AssessmentStandards.find({assessmentID:FlowRouter.getParam('_id'),standardVisible:true},{fields:{standardID:1}}).fetch(),'standardID');
    //first get the info that will be immediately shown
    var studentID = Meteor.impersonatedOrUserId();    
    if ((!studentID) || !Roles.userIsInRole(studentID,'student'))
      return;
    var LoMsThisStudentAndAssessment = Meteor.subscribe('levelsOfMastery',standardIDs,studentID,assessment._id);

    if (LoMsThisStudentAndAssessment.ready()) { //then load the rest in the background
      var LoMsThisStudent = Meteor.subscribe('levelsOfMastery',standardIDs,studentID,null); //all levels and comments for these standards
      
      if (LoMsThisStudent.ready() && Roles.userIsInRole(Meteor.userId(),'teacher'))
        Meteor.subscribe('levelsOfMastery',standardIDs,null,null); //and for all students ... for copy and pasting of past comments
    }
  });
});

Template.assessmentPage.helpers({
  standards: function() {
    var assessmentID = FlowRouter.getParam('_id');
    var standardIDs = _.pluck(AssessmentStandards.find(
      {assessmentID:assessmentID,standardVisible:true},
      {fields:{standardID:1}},
      {sort:{order:1}}).fetch(),'standardID');
    var standards = Standards.find({_id:{$in:standardIDs}}).fetch();
    standards.sort(function(sa,sb) {
      var asa = AssessmentStandards.findOne({assessmentID:assessmentID,standardID:sa._id});
      var asb = AssessmentStandards.findOne({assessmentID:assessmentID,standardID:sb._id});
      return asa.order - asb.order;
    });
    return standards;
  },
  validStudent: function() {
    var studentID = Meteor.impersonatedOrUserId();
    return Roles.userIsInRole(studentID,'student');
  },
  LoMAveragecolorcode: function() {
    var studentID = Meteor.impersonatedOrUserId();
    var standardID = this._id;
    if (!studentID || !standardID)
      return '';
    var LoM = LevelsOfMastery.findOne({studentID:studentID,standardID:standardID,visible:true});
    if (!LoM) return '';
    var standard = Standards.findOne(standardID);
    return Meteor.LoMcolorcode(LoM.average['schoolyear'],standard.scale);
    //update for grading period when available
  },
  LoMAveragetext: function() {
    var studentID = Meteor.impersonatedOrUserId();
    var standardID = this._id;
    if (!studentID || !standardID)
      return '';
    var LoM = LevelsOfMastery.findOne({studentID:studentID,standardID:standardID,visible:true});
    if (!LoM) return '';
    var standard = Standards.findOne(standardID);
    if (_.isArray(standard.scale))
      return LoM.average['schoolyear']; //update for grading period when available 
    return +LoM.average['schoolyear'].toFixed(2) + ' out of ' + standard.scale;
  },
  showThis: function() {
    var tmpl = Template.instance();
    return (tmpl.showAssessment.get() == 'this') ? 'active' : '';
  },
  showAll: function() {
    var tmpl = Template.instance();
    return (tmpl.showAssessment.get() == 'all') ? 'active' : '';
  },
  showMostRecent: function() {
    var tmpl = Template.instance();
    return (tmpl.showTimePeriod.get() == 'mostRecent') ? 'active' : '';
  },
  showAllTime: function() {
    var tmpl = Template.instance();
    return (tmpl.showTimePeriod.get() == 'allTime')? 'active' : '';
  },
  LoMs: function() {
    var tmpl = Template.instance();
    var studentID = Meteor.impersonatedOrUserId();
    var standardID = this._id;
    if (!studentID || !standardID)
      return '';
    var selector = {
      studentID: studentID,
      standardID: standardID
    }
    //var editingPage = openlabSession.get('editingMainPage');
    //if (!editingPage)
    //  selector.visible = true; //show only visible LoMs
    if (tmpl.showAssessment.get() == 'this')
      selector.assessmentID = FlowRouter.getParam('_id');
    if (tmpl.showTimePeriod.get() == 'mostRecent') {
      return LevelsOfMastery.find(selector,{sort:{submitted:-1},limit:1});
    } else {
      return LevelsOfMastery.find(selector,{sort:{submitted:-1}});
    }
  }
});

Template.assessmentPage.events({
  'click .thisAssessment': function(event,tmpl) {
    tmpl.showAssessment.set('this');
  },
  'click .allAssessments': function(event,tmpl) {
    tmpl.showAssessment.set('all');
  },
  'click .mostRecent': function(event,tmpl) {
    tmpl.showTimePeriod.set('mostRecent');
  },
  'click .allTime': function(event,tmpl) {
    tmpl.showTimePeriod.set('allTime');
  },  
});