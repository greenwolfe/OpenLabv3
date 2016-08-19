
Template.activityPage.onCreated(function() {
  var instance = this;
  activityPageSession.initializePage(); //set initial values of editedWalls, showWalls, statusFilter, subActivityFilter
  var activityID = FlowRouter.getParam('_id');

  var iU = Meteor.impersonatedOrUserId();
  var cU = Meteor.userId();
 //reset to teacher if teacher reached the page while impersonating a parent
  if (Roles.userIsInRole(cU,'teacher') && Roles.userIsInRole(iU,'parentOrAdvisor')) {
    loginButtonsSession.set('viewAs',cU);
    iU = cU;
  }
  var studentID = (Roles.userIsInRole(iU,'student')) ? iU : null;

  //deprecated Aug 2016
  //reactive var needed so this doesn't flip when the publication is invalidated when student data is loaded in the background
  //instance.initialSubscriptionsLoaded = new ReactiveVar(false);

  //add limit and loaded instead of requested and loaded as separate variables?
  var reactiveArray = function(initialValue) {
    if (initialValue) {
      var initialArray = _.isArray(initialValue) ? initialValue : [initialValue];
    } else {
      var initialArray = [];
    }
    return {
      nonReactive: initialArray,
      reactive: new ReactiveVar(initialArray),
      add: function(newvalues) {
        if (!_.isArray(newvalues))
          newvalues = [newvalues];
        this.nonReactive = _.unique(_.union(this.nonReactive,newvalues));
        this.reactive.set(this.nonReactive);
      },
      set:function(newvalue) { 
        this.nonReactive = newvalue; 
        this.reactive.set(newvalue) 
      }
    };
  };
  instance.requestedStudentWallAccess = reactiveArray(studentID);
  instance.loadedStudentWallAccess = reactiveArray([]);
  instance.requestedGroupWallAccess = reactiveArray(studentID);
  instance.loadedGroupWallAccess = reactiveArray([]);

  //Meteor.call('addDefaultWalls',activityID);
  instance.subscribe('subActivities',activityID);
  instance.subscribe('teacherWalls',activityID);
  //get all groups walls for this activity to create the group list for browsing
  if (Roles.userIsInRole(cU,'teacher')) {
    instance.subscribe('groupsFromGroupWalls',activityID);
  }

  instance.autorun(function() {
    var iU = Meteor.impersonatedOrUserId();
    var cU = Meteor.userId();
    var sectionID = Meteor.selectedSectionId();
    var statusFilter = activityPageSession.get('statusFilter');
    var showWalls = activityPageSession.get('showWalls');

    if (Roles.userIsInRole(iU,'student')) { //viewing single student
      instance.requestedStudentWallAccess.add(iU);
      instance.requestedGroupWallAccess.add(iU);
      instance.subscribe('sectionWalls',activityID,iU);
      instance.subscribe('subActivityStatuses',activityID,iU);      
    } else if (Roles.userIsInRole(cU,'teacher')) {
      if (sectionID) { //teacher viewing a single section
        instance.subscribe('sectionWalls',activityID,sectionID);
        instance.subscribe('subActivityStatuses',activityID,sectionID);
        if (showWalls == 'student')
          instance.requestedStudentWallAccess.add(Meteor.sectionMemberIds(sectionID));
        if (showWalls == 'group')
          instance.requestedGroupWallAccess.add(Meteor.sectionMemberIds(sectionID));
      } else { //teacher viewing with no specific student or section selected
        instance.subscribe('sectionWalls',activityID,null);
        instance.subscribe('subActivityStatuses',activityID,null);
        if (showWalls == 'student')
          instance.requestedStudentWallAccess.add(Meteor.allStudentIds());
        if (showWalls == 'group')
          instance.requestedGroupWallAccess.add(Meteor.allStudentIds());
      }
    }
  })

  instance.autorun(function() {
    var studentIDs = instance.requestedStudentWallAccess.reactive.get();
    instance.subscribe('studentWalls',activityID,studentIDs,function() {
      instance.loadedStudentWallAccess.set(studentIDs);
    });
  })

  instance.autorun(function() {
    var studentIDs = instance.requestedGroupWallAccess.reactive.get();
    instance.subscribe('groupWalls',activityID,studentIDs,function() {
      instance.loadedGroupWallAccess.set(studentIDs);
    });
  })
});

Template.activityPage.helpers({
  walls: function() {
    var selector = {activityID:FlowRouter.getParam('_id')}
    var cU = Meteor.userId();
    if (!Roles.userIsInRole(cU,'teacher'))
      selector.visible = true;
    var showWalls = activityPageSession.get('showWalls');
    var studentID = Meteor.impersonatedOrUserId();
    var sectionID = Meteor.selectedSectionId();
    var statusFilter = activityPageSession.get('statusFilter');
    var subactivityFilter = activityPageSession.get('subactivityFilter');

    if (showWalls != 'allTypes')
      selector.type = showWalls;
    if ((studentID) && Roles.userIsInRole(studentID,'student')) {
      selector.access = {$in:[studentID]};
    } else if (Roles.userIsInRole(cU,'teacher')) {
      if ((showWalls == 'student') || (showWalls == 'group')) {
        var sectionMemberIds = (sectionID) ? Meteor.sectionMemberIds(sectionID) : Meteor.allStudentIds();
        if (statusFilter == 'nofilter') {
          selector.access = {$in: sectionMemberIds};
        } else {
          var filteredIds = sectionMemberIds.filter(function(studentID) {
            var status = ActivityStatuses.findOne({studentID:studentID,activityID:subactivityFilter});
            if (!status)
              return (statusFilter == 'nostatus');
            return _.str.count(status.level,statusFilter);
          });
          selector.access = {$in: filteredIds};
        }
      } else if (showWalls == 'section') {
        var sectionMemberIds = (sectionID) ? Meteor.sectionMemberIds(sectionID) : Meteor.allStudentIds();
        selector.access = {$in: sectionMemberIds};
      } else if (showWalls == 'teacher') { 
        selector.access = {$in:[]};
      } else if (showWalls == 'allTypes') {
        var sectionMemberIds = (sectionID) ? Meteor.sectionMemberIds(sectionID) : Meteor.allStudentIds();
        selector.access = {$in: sectionMemberIds};
        selector.type = {$in:['teacher','section']};
      }
    }
    if ((showWalls == 'allTypes') || (showWalls == 'teacher'))
      selector.access.$in.push(Site.findOne()._id);
    //make sure student walls are included even if there are no students
    if (Roles.userIsInRole(cU,'teacher') && !Roles.userIsInRole(studentID,'student') && ((showWalls == 'section') || (showWalls == 'allTypes'))) {
      var sectionselector = _.clone(selector);
      delete sectionselector.access;
      sectionselector.type = 'section';
      if (sectionID) 
        sectionselector.createdFor = sectionID;
      selector = {$or:[selector,sectionselector]};
    }
    //secondary sort on date?
    return Walls.find(selector,{sort: {order:1}});
  },
  sortableOpts: function() {
    return {
      draggable:'.wall',
      handle: '.wallSortableHandle',
      collection: 'Walls',
      selectField: 'activityID',
      selectValue: FlowRouter.getParam('_id'),
      disabled: !activityPageSession.get('editedWall')
    }
  }
});