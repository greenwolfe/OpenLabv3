Template.assessmentList.onCreated(function() {
  var instance = this;

  instance.autorun(function() {
    var unitID = openlabSession.get('activeUnit');
    var unitID2 = openlabSession.get('activeUnit2');
    if (unitID2)
      unitID = [unitID,unitID2];
    var studentID = Meteor.impersonatedOrUserId();
    var today = new Date();
    var twoWeeksFromNow = moment(today).add(2,'weeks').toDate();
    Meteor.subscribe('unitsAssessments',studentID,unitID);    
    Meteor.subscribe('assessments',today,twoWeeksFromNow,studentID);
  })
});

var dateFormat = "ddd, MMM D YYYY";

Template.assessmentList.helpers({
  unitTitle: function() {
    var unitID = openlabSession.get('activeUnit');
    var unit = Units.findOne(unitID);
    if ((unit) && ('title' in unit)) {
      return unit.title
    }
  },
  unitsAssessments: function() {
    var unitID = openlabSession.get('activeUnit');
    var studentID = Meteor.impersonatedOrUserId();
    var selector = {
      unitID:unitID,
      visible:true
    }
    if (Roles.userIsInRole(studentID,'student')) {
      selector.createdFor = {$in:[Site.findOne()._id,studentID]};
    } else {
      selector.createdFor = Site.findOne()._id;
    }
    return Assessments.find(selector);
  },
  bgprimary: function() {
    //return 'bgprimary';
    return openlabSession.get('activeUnit2') ? 'bgprimary' : '';
  },
  activeUnit2: function() {
    return openlabSession.get('activeUnit2');
  },
  unit2Title: function() {
    var unitID = openlabSession.get('activeUnit2');
    var unit = Units.findOne(unitID);
    if ((unit) && ('title' in unit)) {
      return unit.title
    }    
  },
  unit2sAssessments: function() {
    var unitID = openlabSession.get('activeUnit2');
    var studentID = Meteor.impersonatedOrUserId();
    var selector = {
      unitID:unitID,
      visible:true
    }
    if (Roles.userIsInRole(studentID,'student')) {
      selector.createdFor = {$in:[Site.findOne()._id,studentID]};
    } else {
      selector.createdFor = Site.findOne()._id;
    }
    return Assessments.find(selector);
  },
  bgsuccess: function() {
    return openlabSession.get('activeUnit2') ? 'bgsuccess' : 'bgprimary';
  },
  upcomingAssessments: function() {
    var studentID = Meteor.impersonatedOrUserId();
    var sectionID = Meteor.selectedSectionId();
    var unitID = openlabSession.get('activeUnit');
    var today = new Date();
    var twoWeeksFromNow = moment(today).add(2,'weeks').toDate();
    var selector = {testDate:{$gte:today,$lte:twoWeeksFromNow}};
    if (Roles.userIsInRole(studentID,'student')) {
      selector.createdFor = {$in:[Site.findOne()._id,studentID]};
    } else {
      selector.createdFor = Site.findOne()._id;
    }
    if (unitID) 
      selector.unitID = {$ne:unitID}
    if (sectionID)
      selector.sectionID = sectionID;
    var assessmentIDs = _.pluck(AssessmentDates.find(selector).fetch(),'assessmentID');
    assessmentIDs = _.unique(assessmentIDs);
    return Assessments.find({_id:{$in:assessmentIDs}});
  },
  assessmentTitle: function() {
    if (this.createdFor == Site.findOne()._id) {
      return this.title || 'Assessment'
    } else {
      return (this.title.search(/reassessment/i)>0) ? this.title :  this.title + "<strong> (reassessment)</strong>"
    }
  },
  date: function() {
    var assessmentDate = AssessmentDates.findOne({
      assessmentID:this._id,
      sectionID:Meteor.selectedSectionId()
    });
    var date = (assessmentDate) ? assessmentDate.testDate : this.minDate;
    return moment(date).format(dateFormat);
  },
  assessmentUnitTitle: function() {
    var unitID = this.unitID || null;
    var unit = Units.findOne(unitID);
    if (unit)
      return '(' + unit.title + ')';
  }
});