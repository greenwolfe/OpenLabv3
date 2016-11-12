Template.assessmentList.onCreated(function() {
  var instance = this;

  instance.autorun(function() {
    var unitID = openlabSession.get('activeUnit');
    var unitID2 = openlabSession.get('activeUnit2');
    if (unitID2)
      unitID = [unitID,unitID2];
    var studentID = Meteor.impersonatedOrUserId();
    studentID = Roles.userIsInRole(studentID,'student') ? studentID : null;
    var sectionID = Meteor.selectedSectionId() || null;
    var studentOrSectionID = studentID || sectionID;
    var today = new Date();
    var twoWeeksFromNow = moment(today).add(2,'weeks').toDate();
    Meteor.subscribe('unitsAssessments',studentOrSectionID,unitID);    
    Meteor.subscribe('otherUpcomingAssessments',today,twoWeeksFromNow,studentOrSectionID);
  })
});

var dateFormat = "ddd, MMM D YYYY";

/* currentStatus */
var currentStatus = function(assessmentID) {
  var studentID = Meteor.impersonatedOrUserId();
  var sectionID = Meteor.selectedSectionId();
  var cU = Meteor.userId();
  if (Roles.userIsInRole(studentID,'student')) {
    return ActivityStatuses.findOne({studentID:studentID,assessmentID:assessmentID});
  } else if (Roles.userIsInRole(cU,'teacher')) {
    if (sectionID)
      return ActivityStatuses.findOne({sectionID:sectionID,assessmentID:assessmentID});
    return ActivityStatuses.findOne({siteID:Site.findOne()._id,assessmentID:assessmentID});
  }
}

Template.assessmentList.helpers({
  unitTitle: function() {
    var unitID = openlabSession.get('activeUnit');
    var unit = Units.findOne(unitID);
    if ((unit) && ('title' in unit)) {
      return unit.title
    }
  },
  unitsAssessments: function() {
    var cU = Meteor.userId();
    var sectionID = Meteor.selectedSectionId();
    var unitID = openlabSession.get('activeUnit');
    var studentID = Meteor.impersonatedOrUserId();
    var selector = {
      unitID:unitID,
      visible:true
    }
    if (Roles.userIsInRole(studentID,'student')) {
      selector.createdFor = {$in:[Site.findOne()._id,studentID]};
    } else if (Roles.userIsInRole(cU,'teacher')) {
      if (sectionID) {
        var studentIDs = Meteor.sectionMemberIds(sectionID);
        studentIDs.push(Site.findOne()._id);
        selector.createdFor = {$in:studentIDs};
      } //else no filter on createdFor
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
    var cU = Meteor.userId();
    var sectionID = Meteor.selectedSectionId();
    var unitID = openlabSession.get('activeUnit2');
    var studentID = Meteor.impersonatedOrUserId();
    var selector = {
      unitID:unitID,
      visible:true
    }
    if (Roles.userIsInRole(studentID,'student')) {
      selector.createdFor = {$in:[Site.findOne()._id,studentID]};
    } else if (Roles.userIsInRole(cU,'teacher')) {
      if (sectionID) {
        var studentIDs = Meteor.sectionMemberIds(sectionID);
        studentIDs.push(Site.findOne()._id);
        selector.createdFor = {$in:studentIDs};
      } //else no filter on createdFor
    } else {
      selector.createdFor = Site.findOne()._id;
    }
    return Assessments.find(selector);
  },
  bgsuccess: function() {
    return openlabSession.get('activeUnit2') ? 'bgsuccess' : 'bgprimary';
  },
  upcomingAssessments: function() {
    var cU = Meteor.userId();
    var studentID = Meteor.impersonatedOrUserId();
    var sectionID = Meteor.selectedSectionId();
    var unitID = openlabSession.get('activeUnit');
    var today = new Date();
    var twoWeeksFromNow = moment(today).add(2,'weeks').toDate();
    var selector = {testDate:{$gte:today,$lte:twoWeeksFromNow}};
    if (Roles.userIsInRole(studentID,'student')) {
      selector.createdFor = {$in:[Site.findOne()._id,studentID]};
    } else if (Roles.userIsInRole(cU,'teacher')) {
      if (sectionID) {
        var studentIDs = Meteor.sectionMemberIds(sectionID);
        studentIDs.push(Site.findOne()._id);
        selector.createdFor = {$in:studentIDs};
      } //else no filter on createdFor
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
  studentText: function() {
    if (Roles.userIsInRole(this.createdFor,'student')) {
      return 'Reassessment for ' + Meteor.getname(this.createdFor,'full');
    }
    return '';
  },
  assessmentTitle: function() {
    return _.str.stripTags(this.title) || 'Assessment'
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
  },
  status: function() {
    var status = currentStatus(this._id);
    if (!status)
      return 'icon-nostatus';
    return 'icon-' + status.level;
  },
  statusTitle: function() {
    var status = currentStatus(this._id);
    if (!status)
      return 'Student has not yet taken assessment.';
    if (status.studentID) {
      var titleDict = {
        'nostatus':'Student has not yet taken assessment.',
        'submitted':'Assessment not yet graded, but student has taken it.',
        'returned':'Assessment graded.  Reassessment expected.',
        'donewithcomments':'Assessment completed.  Comments available in gradebook.',
        'done':'Assessment completed. Student has viewed any comments.',
        'donebutresubmitted': 'Assessment completed.'
      };
    } else if (status.sectionID || status.siteID) {
      var message = status.studentsSubmitted + ' students have taken assessment. ' + status.studentsReturned + ' assessments graded and reassessment expected. ' + status.studentsDone + ' Assessments graded and returned. ' + status.studentsNotSubmitted + ' have not yet taken this assessment.';
      var titleDict = {
        'nostatus': message,
        'submitted':  message,
        'returned': message,
        'donewithcomments': message,
        'done': message
      };
    }
    return titleDict[status.level];
  },
  late: function() {
    var status = currentStatus(this._id);
    if (!status)
      return '';
    return (status.late) ? 'icon-late' : '';  
  },
  lateHoverText: function() {
    //needs own popup ... mark all as late?
    var status = currentStatus(this._id);
    if (!status || !status.late)
      return '';
    if (status.studentID) {
      return 'late';
    } else if (status.sectionID || status.siteID) {
      var message = (status.studentsNotSubmitted > 1) ? ' students have' : ' student has';
      message = 'The deadline has passed and ' + status.lateStudents.length + message + ' not yet taken this assessment. ';
      status.lateStudents.forEach(function(studentID,i) {
        message += Meteor.getname(studentID,'full');
        if (i == status.studentsNotSubmitted - 2) {
          message += ' and ';
        } else if (i < status.studentsNotSubmitted - 2) {
          message += ', ';
        }
      })
      return message;
    }
  }
});