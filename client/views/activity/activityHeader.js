  /******************************/
 /******* ACTIVITY HEADER ******/
/******************************/
Template.activityHeader.onCreated(function() {
  var instance = this;
  var activityID = FlowRouter.getParam('_id');
  instance.subscribe('subActivities',activityID);

  instance.autorun(function() {
    var iU = Meteor.impersonatedOrUserId();
    var cU = Meteor.userId();
    var sectionID = Meteor.selectedSectionId();
    if (Roles.userIsInRole(iU,'student')) { //viewing single student
      instance.subscribe('subActivityStatuses',activityID,iU);      
    } else if (Roles.userIsInRole(cU,'teacher')) {
      if (sectionID) { //teacher viewing a single section
        instance.subscribe('subActivityStatuses',activityID,sectionID);
      } else { //teacher viewing with no specific student or section selected
        instance.subscribe('subActivityStatuses',activityID,null);
      }
    }
  });
})

Template.activityHeader.helpers({
  siteTitle: function() {
    return Site.findOne().title;
  },
  //sectionOnlySelected: function() {}
  noStudentSelected: function() {
    var studentID = Meteor.impersonatedId();
    //var sectionID = Meteor.selectedSectionId();
    var cU = Meteor.userId();
    //return (Roles.userIsInRole(cU,'teacher') && (!studentID) && (sectionID));
    return (Roles.userIsInRole(cU,'teacher') && (!studentID));
  },
  showingStudentOrGroupWalls: function() {
    return _.contains(['student','group'],activityPageSession.get('showWalls'));
  }
});

  /*************************/
 /******* SHOW WALLS ******/
/*************************/

Template.showWalls.helpers({
  showWalls: function() {
    var showWalls = activityPageSession.get('showWalls');
    if (showWalls == 'allTypes')
      return 'all types';
    return showWalls;
  },
  wallTypes: function() {
    return [
      {type: 'all types'},
      {type: 'teacher'},
      {type: 'student'},
      {type: 'group'},
      {type: 'section'}
    ]
  }
});

  /*********************************/
 /******* WALL TYPE SELECTOR ******/
/*********************************/

Template.wallTypeSelector.helpers({
  active: function() {
    var wallType = activityPageSession.get('showWalls');
    if (wallType == 'allTypes')
      wallType = 'all types';
    return (this.type == wallType);
  }
});

Template.wallTypeSelector.events({
  'click li a': function(event,tmpl) {
    var wallType = this.type;
    if (wallType == 'all types')
      wallType = 'allTypes';
    activityPageSession.set('showWalls',wallType);
  }
})

  /******************************/
 /******* FILTER STUDENTS ******/
/******************************/

Template.filterStudents.helpers({
  statusSelectors: function() {
    return [
      {level: 'nofilter'},
      {level: 'nostatus'},
      {level: 'submitted'},
      {level: 'returned'},
      {level: 'done'}
    ]    
  },
  statusFilter: function() {
    return activityPageSession.get('statusFilter');
  },
  subactivities: function() {
    var activityID = FlowRouter.getParam('_id');
    return Activities.find({pointsTo:activityID});
  },
  subactivityFilter: function() {
    return Activities.findOne(activityPageSession.get('subactivityFilter'));
  }
});

  /******************************/
 /******* STATUS SELECTOR ******/
/******************************/

Template.statusSelector.helpers({
  status: function() {
    return 'icon-' + this.level;
  },
  statusText: function() {
    statusTexts = {
      nofilter: 'no filter',
      nostatus: 'no status',
      submitted: 'submitted',
      returned: 'returned',
      done: 'done'
    }
    return statusTexts[this.level];
  },
  active: function() {
    return (this.level == activityPageSession.get('statusFilter'));
  }
});

Template.statusSelector.events({
  'click li a': function(event,tmpl) {
    activityPageSession.set('statusFilter',this.level);
  }
})

  /***********************************/
 /******* STATUS SELECTOR ******/
/***********************************/

Template.statusSelector.helpers({
  active: function() {
    return (this._id == activityPageSession.get('subactivityFilter'));
  }
});

Template.subactivitySelector.events({
  'click li a': function(event,tmpl) {
    activityPageSession.set('subactivityFilter',this._id);
  }
})

  /*****************************/
 /**** SUBACTIVITIES LIST *****/
/*****************************/

Template.subActivitiesList.onCreated(function() {
  var instance = this;
  instance.editingList = new ReactiveVar(false);
})

Template.subActivitiesList.helpers({
  editingList: function() {
    var instance = Template.instance();
    return instance.editingList.get();
  },
  helpMessages: function () {
    return [
      'Activities created here will also appear in the main units and activities list, for example on the main page.',
      "They will all link back to the same activity page - this one.",
      "Reordering of the list in this block is independent of the main list.  In the main list, these activities can be sorted among the other activities or even moved to other units.",
      "The title of this block, if it exists, will be used as the title of the page as well.  Otherwise, the title of the initial activity is used.",
      "Create just one subactivities block per activity page.  It can be deleted and re-created without causing problems, but it is probably better just to hide it if you don't want it visible to students."
    ]
  },
  subactivities: function() {
    var activity = Activities.findOne(FlowRouter.getParam('_id'));
    var selector = {
      pointsTo:FlowRouter.getParam('_id'), //activity._id
    }
    var instance = Template.instance();
    var editingList = instance.editingList.get();
    if (!editingList) //show only visible activities
      selector.visible = true;
    return Activities.find(selector,{sort: {suborder: 1}});
  },
  sortableOpts: function() {
    var instance = Template.instance();
    var activity = Activities.findOne(FlowRouter.getParam('_id'));
    return {
      draggable:'.aItem',
      handle: '.sortActivity',
      group: '.activityColumn',
      collection: 'Activities',
      selectField: 'pointsTo',
      selectValue: activity._id,
      sortField: 'suborder',
      disabled: false //(!instance.editingList.get()) 
      //onAdd: function(evt) {
      //  Meteor.call('denormalizeBlock',evt.data._id,alertOnError);
      //}
    }
  }
})

Template.subActivitiesList.events({
  'click .editSubactivities': function(event,tmpl) {
    tmpl.editingList.set(true);
  },
  'click .stopEditingSubactivities' : function(event,tmpl) {
    tmpl.editingList.set(false);
  }
})

  /**************************/
 /*** SUBACTIVITY ITEM  ****/
/**************************/

/* currentStatus */
var currentStatus = function(activityID) {
  var studentID = Meteor.impersonatedOrUserId();
  var data = Template.parentData(function(data){return ('createdFor' in data)});
  if ((data) && Meteor.users.find(data.createdFor).count())
    studentID = data.createdFor;
  var sectionID = Meteor.selectedSectionId();
  var cU = Meteor.userId();
  if (Roles.userIsInRole(studentID,'student')) {
    return ActivityStatuses.findOne({studentID:studentID,activityID:activityID});
  } else if (Roles.userIsInRole(cU,'teacher')) {
    if (sectionID)
      return ActivityStatuses.findOne({sectionID:sectionID,activityID:activityID});
    return ActivityStatuses.findOne({siteID:Site.findOne()._id,activityID:activityID});
  } else {
    return undefined;
  }
}

Template.subactivityItem.onRendered(function() {
  $('span.glyphicon-calendar[data-toggle="tooltip"]').tooltip();
})

var dateTimeFormat = "ddd, MMM D YYYY [at] h:mm a";

Template.subactivityItem.helpers({
  currentlyEditing: function() {
    var parent = Template.parentData();
    if ('wallID' in parent)
      return (activityPageSession.get('editedWall') == parent.wallID);
    var instance = Template.instance();
    parent = instance.parent();
    if ('editingList' in parent)
      return parent.editingList.get();
    return false;
  },
  canDelete: function() {
    var cU = Meteor.userId();
    if (!Roles.userIsInRole(cU,'teacher')) return false;
    var numBlocks = Blocks.find({activityID:this._id,type:{$ne:'subactivities'}}).count();
    var numSubActivities = Activities.find({pointsTo:this._id}).count();
    return ((this._id != this.pointsTo) || ((numBlocks == 0) && (numSubActivities == 1)) );
  },
  subactivities: function() {
    return Activities.find({pointsTo:this.pointsTo});
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
    var activity = Template.parentData();
    var status = currentStatus(activity._id);
    status = status || {level:'nostatus'}
    if (_.str.contains(status.level,'done'))
      return 'completed';
    var today = new Date();
    if ((this.endDate) && (today > this.endDate) && (activity.showStatus))
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
  status: function() {
    var status = currentStatus(this._id);
    if (!status)
      return 'icon-nostatus'
    return 'icon-' + status.level;
  },
  showStatusText: function() {
    return (this.showStatus) ? 'icon-done' : 'icon-nostatus';
  },
  statusTitle: function() {
    var status = currentStatus(this._id);
    if (!status)
      return 'not started';
    if (status.studentID) {
      var titleDict = {
        'nostatus':'empty inbox: not started',
        'submitted':'full inbox: work submitted, waiting for teacher response',
        'returned':'full outbox:  Returned with comments by your teacher.  Please revise and resubmit.',
        'donewithcomments':'Done.  Revisions not required but review comments by your teacher before taking an assessment',
        'done':'Done.'
      };
    } else if (status.sectionID || status.siteID) {
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
    } else if (status.sectionID || status.siteID) {
      var message = (status.studentsNotSubmitted > 1) ? ' students have' : ' student has';
      message = 'The deadline has passed and ' + status.studentsNotSubmitted + message + ' not yet submitted this assignment. ';
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
  //deprecated Aug 2016
  /*studentOrSectionID: function() {
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
  },*/ 
  tags: function() {
    var studentID = Meteor.impersonatedOrUserId();
    var data = Template.parentData(function(data){return ('createdFor' in data)});
    if ((data) && Meteor.users.find(data.createdFor).count())
      studentID = data.createdFor;
    var activityID = this._id;
    var status = ActivityStatuses.findOne({studentID:studentID,activityID:activityID});
    var tags = '';
    if (this.tag) 
      tags += ' (' + this.tag + ')';
    var block = Template.parentData();
    var wall = Walls.findOne(block.wallID);
    if ((wall) && (wall.type == 'teacher') && (this.inBlockHeader))
      return tags;
    if ((status) && (status.tag))
      tags += '<strong> (' + status.tag + ')</strong>';
    return tags;    
  }
});

Template.subactivityItem.events({
  'click .deleteActivity':function(event,tmpl) {
    var isNotSubActivity = (tmpl.data._id == tmpl.data.pointsTo);
    if (confirm('Are you sure you want to delete this activity?')) {
      Meteor.call('deleteActivity', tmpl.data._id,function(error,num){
        if (error) {
          alert(error.reason);
        } else {
          alert('Activity deleted');
          if (isNotSubActivity)
            FlowRouter.go('/');
        }
      });
    }
  },
  'click li.subactivityChoice': function(event,tmpl) {
    var block = Template.parentData();
    var subactivity = this;
    if (subactivity._id != block.subActivityID) 
      Meteor.call('updateBlock',{_id:block._id,subActivityID:subactivity._id},alertOnError);
    event.preventDefault();
  },
  'click li.chooseNoSubactivity': function(event,tmpl) {
    var block = Template.parentData();
    Meteor.call('updateBlock',{_id:block._id,subActivityID:''},alertOnError);
    event.preventDefault();
  },
  'click .activityProgress': function(event,tmpl) {
    var studentID = Meteor.impersonatedOrUserId();
    var data = Template.parentData(function(data){return ('createdFor' in data)});
    if ((data) && Meteor.users.find(data.createdFor).count())
      studentID = data.createdFor;
    if (!Roles.userIsInRole(studentID,'student'))
      return; 
    Meteor.call('incrementProgress',studentID,tmpl.data._id,alertOnError);  
  },
  'click .activityStatus': function(event,tmpl) {
    var studentID = Meteor.impersonatedOrUserId();
    var data = Template.parentData(function(data){return ('createdFor' in data)});
    if ((data) && Meteor.users.find(data.createdFor).count())
      studentID = data.createdFor;
    if (!Roles.userIsInRole(studentID,'student'))
      return; 
    Meteor.call('incrementStatus',studentID,tmpl.data._id,alertOnError);  
  },
  'click .activityPunctual': function(event,tmpl) {
    var studentID = Meteor.impersonatedOrUserId();
    var data = Template.parentData(function(data){return ('createdFor' in data)});
    if ((data) && Meteor.users.find(data.createdFor).count())
      studentID = data.createdFor;
    if (!Roles.userIsInRole(studentID,'student'))
      return; 
    Meteor.call('markOnTime',studentID,tmpl.data._id,alertOnError);  
  },
  'click .showActivityStatus.icon-nostatus, click .showActivityStatus': function(event,tmpl) {
    Meteor.call('updateActivity',{
      _id:tmpl.data._id,
      showStatus: true
    },alertOnError);  
  },
  'click .showActivityStatus.icon-done': function(event,tmpl) {
    Meteor.call('updateActivity',{
      _id:tmpl.data._id,
      showStatus: false
    },alertOnError);  
  },
  'click .tagActivity': function(event,tmpl) {
    Session.set('activityForTagModal',this);
    var studentID = Meteor.impersonatedOrUserId();
    var data = Template.parentData(function(data){return ('createdFor' in data)});
    if ((data) && Meteor.users.find(data.createdFor).count())
      studentID = data.createdFor;
    Session.set('studentIDForTagModal',studentID);
  }
})

  /*************************/
 /*** NEW SUBACTIVITY  ****/
/*************************/

Template.newSubactivity.helpers({
  fixedFields: function() {
    var activity = Activities.findOne(this.activityID);
    if (!activity) 
      activity = Activities.findOne(Activities.findOne(FlowRouter.getParam('_id')));
    return {
      unitID:activity.unitID,
      pointsTo:activity._id
    }
  }
})
