  /**************************/
 /**** ASSESSMENT PAGE *****/
/**************************/

Template.assessmentPage.onCreated(function() {
  var instance = this;
  instance.showAssessment = new ReactiveVar('this'); //or all
  instance.showTimePeriod = new ReactiveVar('mostRecent'); //or all time
  var assessment = Assessments.findOne(FlowRouter.getParam('_id'));
  var assessmentSubscription = Meteor.subscribe('assessmentWithDatesAndStandards',FlowRouter.getParam('_id'));

  instance.autorun(function() {
    if (!assessmentSubscription.ready())
      return;
    var assessment = Assessments.findOne(FlowRouter.getParam('_id'));
    if (!assessment)
      return;
    if (Roles.userIsInRole(assessment.createdFor,'student'))
      loginButtonsSession.set('viewAs',assessment.createdFor);
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
  assessmentStandards: function() {
    var assessmentID = FlowRouter.getParam('_id');
    return AssessmentStandards.find(
      {assessmentID:assessmentID,standardVisible:true},
      {sort:{order:1}});
  },
  studentText: function() {
    var assessment = Assessments.findOne(FlowRouter.getParam('_id')) || {createdFor:null};
    if (Roles.userIsInRole(assessment.createdFor,'student')) {
      return 'Reassessment for ' + Meteor.getname(assessment.createdFor,'full');
    }
    return 'Assessment for whole class';
  },
  assessmentTitle: function() {
    var assessment = Assessments.findOne(FlowRouter.getParam('_id'));
    if ((assessment) && ('title' in assessment))
      return assessment.title;
  },
  sortableOpts: function() {
    return {
      draggable:'.assessmentStandardItem',
      handle: '.standardSortableHandle',
      collection: 'AssessmentStandards',
      selectField: 'assessmentID',
      selectValue: FlowRouter.getParam('_id'),
      disabled: (!Roles.userIsInRole(Meteor.userId(),'teacher'))
    }
  },
  standard: function() {
    return Standards.findOne(this.standardID);
  },
  validStudent: function() {
    var studentID = Meteor.impersonatedOrUserId();
    var assessment = Assessments.findOne(FlowRouter.getParam('_id'));
    if (assessment && Roles.userIsInRole(assessment.createdFor,'student'))
      return (studentID == assessment.createdFor);
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