  /*******************/
 /**** UTILITIES ****/
/*******************/
//todo list July 2016
//concept map (interactive to replace list navigation)
percentExpected =  function() {
  var studentID = Meteor.impersonatedOrUserId();
  var activityIDs = _.pluck(Activities.find(
    {
      unitID:this._id,
      visible:true
    },
    {fields:{_id:1}}).fetch(),'_id')
  var total = activityIDs.length; 
  if (total == 0) return 0;

  var endDates = _.pluck(WorkPeriods.find(
    {
      unitID:this._id,
      activityVisible:true,
      sectionID: Meteor.selectedSectionId()
    },
    {fields:{endDate:1}}).fetch(),'endDate')
  var today = new Date();
  var expected = endDates.filter(function(date) {
      return (today > date);
    }).length
  return 100*expected/total;
}
percentCompleted = function() {
  var studentID = Meteor.impersonatedOrUserId();
  var cU = Meteor.userId();
  var sectionID = Meteor.selectedSectionId();
  var activityIDs = _.pluck(Activities.find(
    {
      unitID:this._id,
      visible:true
    },
    {fields:{_id:1}}).fetch(),'_id')
  var total = activityIDs.length; 
  if (total == 0) return 0;
  
  var today = new Date();
  var expectedActivityIDs = activityIDs.filter(function(activityID) {
    var workPeriod = WorkPeriods.findOne({
      activityID: activityID,
      sectionID: sectionID
    });
    return ((workPeriod) && (today > workPeriod.endDate));
  });
  var selector = {
    activityID:{$in:expectedActivityIDs}
  };
  if (Roles.userIsInRole(studentID,'student')) {
    selector.studentID = studentID;
  } else  if (Roles.userIsInRole(cU,'teacher') && (sectionID)) {
    selector.sectionID = sectionID;
  } else {
    selector.studentID =  studentID; //will find no statuses
  }

  var statuses = ActivityStatuses.find(selector).fetch();
  var completed = statuses.reduce(function(p,status) {
    if (status.studentID) {
      return (_.str.include(status.level,'done')) ? p + 1 : p;
    } else if (status.sectionID) {
      return (status.studentsTotal) ? p + status.studentsDone/status.studentsTotal : p;
    }
  },0);
  return 100*completed/total;
}  

  /*************************/
 /*** UNIT NAVIGATION  ****/
/*************************/

Template.unitNavigation.onCreated(function() {
  var instance = this;

  instance.autorun(function() {
    var activeUnitID = openlabSession.get('activeUnit');
    var studentID = Meteor.impersonatedOrUserId();
    var sectionID = Meteor.selectedSectionId();
    var studentOrSectionID = null;
    if (Roles.userIsInRole(studentID,['student'])) {
      studentOrSectionID = studentID;
    } else if (Roles.userIsInRole(studentID,'teacher')) {
      studentOrSectionID = sectionID || studentID;
    }
    if (activeUnitID && studentOrSectionID) {
      Meteor.subscribe('activityStatuses',studentOrSectionID,activeUnitID,function() {
        Meteor.subscribe('activityStatuses',studentOrSectionID,null); //all units
      });
    }
  });  
})

Template.unitNavigation.onRendered(function() {
  var instance = this;
  $('.fa.fa-question-circle[data-toggle="tooltip"]').tooltip();
});

Template.unitNavigation.helpers({
  units: function() {
    var selector = {};
    if (!editingMainPage())
      selector.visible = true; //show only visible units
    return Units.find(selector,{sort: {order: 1}});
  },
  sortableOpts: function() {
    return {
      draggable:'.unittitle',
      handle: '.sortUnit',
      collection: 'Units',
      selectField: 'app', //selects all units
      selectValue: 'openlab', //as openlab is only allowed value of app field
      disabled: !editingMainPage() 
    }
  }
});

  /*********************/
 /** UNIT TITLE      **/
/*********************/

Template.unitTitle.helpers({
  active: function() {
    var activeUnit = openlabSession.get('activeUnit');
    return (this._id == activeUnit) ? 'active' : '';
  },
  active2: function() {
    return (this._id == openlabSession.get('activeUnit2')) ? 'active2':'';
  },
  hidden: function() {
    var activeUnit = openlabSession.get('activeUnit');
    var activeUnit2 = openlabSession.get('activeUnit2');
    return ((this._id == activeUnit) || (this._id == activeUnit2)) ? '' : 'hidden';
  },
  percentExpected: percentExpected,
  percentCompleted: percentCompleted 
});

Template.unitTitle.events({
  'click li > a': function(event,tmpl) {
    event.preventDefault();
    $('#workPeriodPopoverX').modal('hide'); // fixes bug in workPeriodPopoverX ... see notes there
    if (event.ctrlKey) {
      var activeUnit2 = openlabSession.get('activeUnit2');
      var activeUnit = openlabSession.get('activeUnit');
      if (tmpl.data._id == activeUnit2) {
        openlabSession.set('activeUnit2',null);
      } else if (tmpl.data._id == activeUnit){
        return;
      } else if ((activeUnit2) && (tmpl.data._id == activeUnit)) {
        openlabSession.set('activeUnit',activeUnit2);
        openlabSession.set('activeUnit2',null);
      } else {
        openlabSession.set('activeUnit2',tmpl.data._id);
      }
    } else {
      openlabSession.set('activeUnit',tmpl.data._id);
      if (tmpl.data._id == openlabSession.get('activeUnit2'))
        openlabSession.set('activeUnit2',null);
    }
  },
  'dragstart li > a': function(event,tmpl) {
    //bootstrap navs are draggable by default
    //disabling this behavior so you have to grab
    //the draggable handle to sort the units
    event.preventDefault();
  }
})

  /*****************************/
 /** ACTIVITY LIST HEADER  ****/
/*****************************/

Template.activityListHeader.helpers({
  nameOrTitle: function() {
    return this.longname || this.title;
  },
  colWidth: function() {
    return openlabSession.get('activeUnit2') ? 'col-md-6' : 'col-md-12';
  },
  bgsuccess: function() {
    return openlabSession.get('activeUnit2') ? 'bgsuccess' : 'bgprimary';
  },
  bgprimary: function() {
    //return 'bgprimary';
    return openlabSession.get('activeUnit2') ? 'bgprimary' : '';
  },
  percentExpected: percentExpected,
  percentCompleted: percentCompleted 
});


  /*************************/
 /** ACTIVITY LIST  *******/
/*************************/

Template.activityList.helpers({
  activities0: function() {
    var activeUnit2 = openlabSession.get('activeUnit2');
    var columns = [];
    var selector = {
      unitID: this._id,
      ownerID: {$in: [null,'']} //matches if Activities does not have onwerID field, or if it has the field, but it contains the value null or an empty string
    };
    if (!editingMainPage())
      selector.visible = true; //show only visible activities
    columns[1] = Activities.find(selector,{sort: {order: 1}}).fetch(); 
    if (activeUnit2)
      return columns[1];
    var half = Math.ceil(columns[1].length/2)
    columns[0] = columns[1].splice(0,half); 
    return columns[0];
  },
  activities1: function() {
    var activeUnit2 = openlabSession.get('activeUnit2');
    var columns = [];
    var selector = {
      unitID: this._id,
      ownerID: {$in: [null,'']} //matches if Activities does not have onwerID field, or if it has the field, but it contains the value null or an empty string
    };
    if (!editingMainPage())
      selector.visible = true; //show only visible activities
    columns[1] = Activities.find(selector,{sort: {order: 1}}).fetch(); 
    if (activeUnit2)
      return null;
    var half = Math.ceil(columns[1].length/2)
    columns[0] = columns[1].splice(0,half); 
    return columns[1];
  },
  bgsuccess: function() {
    return openlabSession.get('activeUnit2') ? 'bgsuccess' : '';
  },
  bgprimary: function() {
    //return 'bgprimary';
    return openlabSession.get('activeUnit2') ? 'bgprimary' : '';
  },
  activities2: function() {
    var activeUnit2 = openlabSession.get('activeUnit2');
    if (!activeUnit2) return null;
    var selector = {
      unitID: activeUnit2,
      ownerID: {$in: [null,'']} //matches if Activities does not have onwerID field, or if it has the field, but it contains the value null or an empty string
    };
    if (!editingMainPage())
      selector.visible = true; //show only visible activities
    return Activities.find(selector,{sort: {order: 1}})
  },
  sortableOpts2: function() {
    var activeUnit2 = openlabSession.get('activeUnit2');
    return {
      draggable:'.aItem',
      handle: '.sortActivity',
      group: 'activityColumn',
      collection: 'Activities',
      selectField: 'unitID',
      selectValue: activeUnit2,
      disabled: !editingMainPage() //currently not working
      //disabled: (!Session.get('editedWall')), //!= this.wallID to apply to a single wall 
    }    
  },
  sortableOpts: function() {
    return {
      draggable:'.aItem',
      handle: '.sortActivity',
      group: 'activityColumn',
      collection: 'Activities',
      selectField: 'unitID',
      selectValue: this._id,
      //disabled: !editingMainPage() //currently not working
      //disabled: (!Session.get('editedWall')), //!= this.wallID to apply to a single wall 
    }
  },
  reassessments: function() {
    var userToShow = Meteor.userId();
    if (Roles.userIsInRole(userToShow,'teacher')) {
      userToShow = openlabSession.get('TeacherViewAs');
    };
    return Activities.find({unitID: this._id, 
      ownerID: {$in: [userToShow]},
      type: 'assessment',
      visible: true},
      {sort: {rank: 1}});
  }
});

  /*************************/
 /** ACTIVITY ITEM  *******/
/*************************/

/* currentStatus */
var currentStatus = function(activityID) {
  var studentID = Meteor.impersonatedOrUserId();
  var sectionID = Meteor.selectedSectionId();
  var cU = Meteor.userId();
  if (Roles.userIsInRole(studentID,'student')) {
    return ActivityStatuses.findOne({studentID:studentID,activityID:activityID});
  } else if (Roles.userIsInRole(cU,'teacher') && (sectionID)) {
    return ActivityStatuses.findOne({sectionID:sectionID,activityID:activityID});
  }
}

Template.activityItem.onRendered(function() {
  $('span.glyphicon-calendar[data-toggle="tooltip"]').tooltip();
})

var dateTimeFormat = "ddd, MMM D YYYY [at] h:mm a";

Template.activityItem.helpers({
  canDelete: function() {
    var cU = Meteor.userId();
    if (!Roles.userIsInRole(cU,'teacher')) return false;
    var numBlocks = Blocks.find({activityID:this._id,type:{$ne:'subactivities'}}).count();
    return ((this._id != this.pointsTo) || (numBlocks == 0));
  },
  pointsToOrID: function() {
    return this.pointsTo || this._id;
  },
  studentOrSectionID: function() {
    var cU = Meteor.userId();
    if (Roles.userIsInRole(cU,'teacher')) {
      var studentID = Meteor.impersonatedId();
      if (studentID)
        return 'id=' + studentID;
      var sectionID = Meteor.selectedSectionId();
      if (sectionID)
        return 'id=' + sectionID;
      return '';
    } else {
      var studentID = Meteor.impersonatedOrUserId(); //in case is parent viewing as student
      if (studentID)
        return 'id=' + studentID; 
      return '';     
    }
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
      return 'empty inbox, not started';
    if (status.studentID) {
      var titleDict = {
        'nostatus':'empty inbox: not started',
        'submitted':'full inbox: work submitted, waiting for teacher response',
        'returned':'full outbox:  Returned with comments by your teacher.  Please revise and resubmit.',
        'donewithcomments':'Done.  Revisions not required but review comments by your teacher before taking an assessment',
        'done':'Done.'
      };
    } else if (status.sectionID) {
      var message = status.studentsSubmitted + ' submitted. ' + status.studentsReturned + ' returned to students for resubmission. ' + status.studentsDone + ' done. ' + status.studentsNotSubmitted + ' not yet submitted.';
      var titleDict = {
        'nostatus':'empty inbox. ' + message,
        'submitted': 'Inbox has submissions. ' + message,
        'returned':'Outbox has returned work. ' + message,
        'donewithcomments':"All students marked done.",
        'done':"All students marked done."
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
    } else if (status.sectionID) {
      var message = (status.studentsNotSubmitted > 1) ? ' students have' : ' student has';
      var message = 'The deadline has passed and ' + status.studentsNotSubmitted + message + ' not yet submitted this assignment. ';
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
  },
  workPeriod: function () {
    //find existing workPeriod
    return workPeriod =  WorkPeriods.findOne({
      activityID: this._id,
      sectionID: Meteor.selectedSectionId()
    });
  },
  formatDateTime: function(date) {
    return ((Match.test(date,Date)) && !dateIsNull(date)) ? moment(date).format(dateTimeFormat) : '_____';
  },
  currentLateComplete: function() {
    var parentData = Template.parentData();
    var status = currentStatus(parentData._id);
    status = status || {level:'nostatus'}
    if (_.str.contains(status.level,'done'))
      return 'completed';
    var today = new Date();
    if ((this.endDate) && (today > this.endDate))
      return 'expected';
    var longLongAgo = new Date(0);
    var wayWayInTheFuture = new Date(8640000000000000);
    var endDate = this.endDate || longLongAgo;
    var startDate = this.startDate || wayWayInTheFuture;
    if ((this.endDate) && (!this.startDate))
      startDate = moment(this.endDate).subtract(1,'week').toDate();
    if ((startDate < today) && (today < endDate))
      return 'current'
    return '';
  },
  tags: function() {
    var studentID = Meteor.impersonatedOrUserId();
    var activityID = this._id;
    var status = ActivityStatuses.findOne({studentID:studentID,activityID:activityID});
    var tags = '';
    if (this.tag) 
      tags += ' (' + this.tag + ')';
    if ((status) && (status.tag))
      tags += '<strong> (' + status.tag + ')</strong>';
    return tags;    
  },
  activities: function() {
    return Activities.find({unitID:openlabSession.get('activeUnit')});
  }
})

Template.activityItem.events({
  'click .deleteActivity':function() {
    if (confirm('Are you sure you want to delete this activity?')) {
      Meteor.call('deleteActivity', this._id,alertOnError);
    }
  },
  'click .activityProgress': function(event,tmpl) {
    var studentID = Meteor.impersonatedOrUserId();
    if (!Roles.userIsInRole(studentID,'student'))
      return; 
    Meteor.call('incrementProgress',studentID,tmpl.data._id,alertOnError);  
  },
  'click .activityStatus': function(event,tmpl) {
    var studentID = Meteor.impersonatedOrUserId();
    if (!Roles.userIsInRole(studentID,'student'))
      return; 
    Meteor.call('incrementStatus',studentID,tmpl.data._id,alertOnError);  
  },
  'click .activityPunctual': function(event,tmpl) {
    var studentID = Meteor.impersonatedOrUserId();
    if (!Roles.userIsInRole(studentID,'student'))
      return; 
    Meteor.call('markOnTime',studentID,tmpl.data._id,alertOnError);  
  },
  'click .tagActivity': function(event,tmpl) {
    Session.set('activityForTagModal',this);
  },
  'click li.activityChoice': function(event,tmpl) {
    var summary = Template.parentData();
    var activity = this;
    if (activity._id != summary.activityID) 
      Meteor.call('summaryLinkWithActivity',summary.unitID,activity._id,alertOnError);
    event.preventDefault();
  },
  'click li.chooseNoActivity': function(event,tmpl) {
    var summary = Template.parentData();
    Meteor.call('summaryLinkWithActivity',summary.unitID,'',alertOnError);
    event.preventDefault();
  }
})

  /*************************/
 /*** NEW ACTIVITY  *******/
/*************************/

Template.newActivity.helpers({
  fixedFields: function() {
    return {unitID:this._id}
  }
})