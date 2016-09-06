Meteor.publish('activities',function() {  
  return Activities.find();
});

Meteor.publish('standards',function() {  
  return [
    Standards.find(),
    StandardDates.find()
  ];
});

Meteor.publish('calendarEvents',function(userOrSectionID) {
  check(userOrSectionID,Match.idString);
  var participantList = [];
  var site = Site.findOne();
  if (site)
    participantList.push(site._id);
  if (Meteor.users.find(userOrSectionID).count()) { 
    participantList.push(userOrSectionID);
    var sectionID = Meteor.currentSectionId(userOrSectionID);
    if (sectionID)
      participantList.push(sectionID);
    //if teacher viewing as self, include events for whole sections as well
    if (Roles.userIsInRole(this.userId,'teacher') && (this.userId == userOrSectionID)) {
      var sectionIds = _.pluck(Sections.find({},{fields:{_id:1}}).fetch(),'_id');
      participantList = _.union(participantList,sectionIds);
    }
  } else if (Sections.find(userOrSectionID).count() && (Roles.userIsInRole(this.userId,['teacher','parentOrAdvisor']))) {
    participantList.push(userOrSectionID);
    //if teacher viewing single section, include events for all students in that section    
    if (Roles.userIsInRole(this.userId,'teacher'))
      participantList = _.union(participantList,Meteor.sectionMemberIds(userOrSectionID));
  }

  return CalendarEvents.find({participants: {$in: participantList}});
})

Meteor.publish('calendarInvitations',function(userID) {
  check(userID,Match.idString);
  return CalendarEvents.find({invite: {$in:[userID]}});
})

Meteor.publish('todos',function(calendarEventID) {
  check(calendarEventID,Match.idString);
  return Todos.find({calendarEventID:calendarEventID});
})

Meteor.publish('levelsOfMastery',function(standardOrCategoryID,studentID,activityID) {
  check(standardOrCategoryID,Match.OneOf(Match.idString,[Match.idString],null));
  check(studentID,Match.OneOf(Match.idString,null));
  check(activityID,Match.OneOf(Match.idString,null));
  if (!standardOrCategoryID && !studentID && !activityID)
    return this.ready();

  var selector = {}
  if (standardOrCategoryID) {
    if (_.isArray(standardOrCategoryID) && standardOrCategoryID.length > 0) {
      selector.standardID = {$in: standardOrCategoryID};
    } else {
      var standard = Standards.findOne(standardOrCategoryID);
      if (standard) {
        selector.standardID = standardOrCategoryID;
      } else {
        var category = Categories.findOne(standardOrCategoryID);
        if (category) {
          var standardIds = _.pluck(Standards.find({categoryID:standardOrCategoryID},{fields:{_id:1}}).fetch(),'_id');
          if (standardIds.length > 0)
            selector.standardID = {$in:standardIds};
        }
      }
    }
  }

  if (studentID)
    selector.studentID = studentID;
  if (activityID)
    selector.activityID = activityID;
  if (!Roles.userIsInRole(this.userId,'teacher'))
    selector.visible = true; //return only visible items
  return LevelsOfMastery.find(selector);
});

Meteor.publish('units',function(showHidden) {
  /*if (showHidden) {
    return Units.find();
  } else {
    return Units.find({visible:true});
  }*/
  check(showHidden,Boolean);
  if (Roles.userIsInRole(this.userId,'teacher')) {
    return Units.find();
  } else {
    return Units.find({},{fields:{teacherNotes:0}});
  }
});

Meteor.publish('categories',function(showHidden) {
  /*if (showHidden) {
    return Units.find();
  } else {
    return Units.find({visible:true});
  }*/
  check(showHidden,Boolean);
  return Categories.find();
});

Meteor.publish('site',function() {
  return Site.find();
});

/* send initial wall, column, block and file information
   as well as subactivityStatuses, subactivityProgresses
   with initial page info
   (note all activities, tags, standards and workperiods loaded at site level)
   Call with increasingly longer student list to load for all students in background once initial page loads
*/
//for later ... more limited publish/subscribe for memberships and groups ??

  /***********************************/
 /**** ACTIVITY PAGE PUBLCATIONS ****/
/***********************************/

Meteor.publish('subActivities',function(activityID) { //including the main activity
  check(activityID,Match.idString);
  var activity = Activities.findOne(activityID);
  if (!activity)
    return this.ready();
  return [
    Activities.find({pointsTo:activityID}),
    Units.find({_id:activity.unitID}),
    WorkPeriods.find({unitID:activity.unitID}),
    Tags.find()
  ]
});

Meteor.publish('teacherWalls',function(activityID) {
  check(activityID,Match.idString);
  var selector = {
    activityID: activityID,
    access:{$in: [Site.findOne()._id]},
    wallType:'teacher'
  };
  if (!Roles.userIsInRole(this.userId,'teacher')) {
    selector.visible = true;
    selector.wallVisible =true;
    var selectorF = _.clone(selector);
    selectorF.blockVisible = true;
  } else {
    selectorF = selector;
  }

  return [ 
    Walls.find(selector),
    Columns.find(selector),
    Blocks.find(selector),
    Files.find(selectorF)
  ];
});

//to provide teacher with access to a list of current groups for the activity page
Meteor.publish('groupsFromGroupWalls',function(activityID) {
  check(activityID,Match.idString);
  var activity = Activities.findOne(activityID);
  if (!activity) return this.ready();
  if (!Roles.userIsInRole(this.userId,'teacher')) return this.ready();
  return Walls.find({type:'group',activityID:activity.pointsTo},{fields:{createdFor:1,type:1,activityID:1}});
});

Meteor.publish('subActivityStatuses',function(activityID,studentOrSectionID) {
  //think this through ... really optional?
  //if teacher, need statuses for all students for filtering?
  check(activityID,Match.idString);
  check(studentOrSectionID,Match.OneOf(Match.idString,null)); 

  var studentID = studentOrSectionID || this.userId;  
  var sectionID = (Sections.find(studentOrSectionID).count()) ? studentOrSectionID : null;
  var selector = {pointsTo:activityID};
  if (Roles.userIsInRole(studentID,'student')) {
    selector.studentID = studentID;
  } else if (Roles.userIsInRole(this.userId,'teacher')) {
    if (sectionID) {
      selector.$or = [
        {sectionID:sectionID},
        {studentID:{$in:Meteor.sectionMemberIds(sectionID)}}
      ];
    } else {
      selector.$or = [
        {siteID:Site.findOne()._id},
        {studentID: {$in:Meteor.allStudentIds()}}
      ];
    }
  } else {
    return this.ready();
  }

  return ActivityStatuses.find(selector);  
});

Meteor.publish('sectionWalls',function(activityID,studentOrSectionID) {
  check(activityID,Match.idString);
  check(studentOrSectionID,Match.OneOf(Match.idString,null));
  var studentID = studentOrSectionID || this.userId;  
  var sectionID = (Sections.find(studentOrSectionID).count()) ? studentOrSectionID : null;
  var selector = {
    activityID: activityID,
    wallType:'section'
  };

  if (Roles.userIsInRole(studentID,'student')) { //anyone (student, teacher or parent) viewing a particular student
    selector.access = {$in:[studentID]};
  } else if (Roles.userIsInRole(this.userId,'teacher')) { 
    //don't include access field, so walls are sent even if there are no students in the section
  } else { //none of the above
    return this.ready();
  }

  if (!Roles.userIsInRole(this.userId,'teacher')) {
    selector.visible = true;
    selector.wallVisible =true;
    var selectorF = _.clone(selector);
    selectorF.blockVisible = true;
  } else {
    selectorF = selector;
  }

  if (Roles.userIsInRole(this.userId,'parentOrAdvisor')) {
    return [
      Walls.find(selector),
      Columns.find(selector)
    ];
  } else { 
    return [
      Walls.find(selector),
      Columns.find(selector),
      Blocks.find(selector),
      Files.find(selectorF)
    ];
  }
});

Meteor.publish('groupWalls',function(activityID,studentIDs) {
  check(activityID,Match.idString);
  check(studentIDs,[Match.idString]);
  var selector = {
    activityID:activityID,
    access: {$in:studentIDs},
    wallType:'group'
  }

  if (!Roles.userIsInRole(this.userId,'teacher')) {
    selector.visible = true;
    selector.wallVisible =true;
    var selectorF = _.clone(selector);
    selectorF.blockVisible = true;
  } else {
    selectorF = selector;
  }
 
  if (Roles.userIsInRole(this.userId,'parentOrAdvisor')) {
    return [
      Walls.find(selector),
      Columns.find(selector)
    ];
  } else { 
    return [
      Walls.find(selector),
      Columns.find(selector),
      Blocks.find(selector),
      Files.find(selectorF)
    ];
  }
});

Meteor.publish('studentWalls',function(activityID,studentIDs) {
  check(activityID,Match.idString);
  check(studentIDs,[Match.idString]);
  var selector = {
    activityID:activityID,
    access: {$in:studentIDs},
    wallType:'student'
  }

  if (!Roles.userIsInRole(this.userId,'teacher')) {
    selector.visible = true;
    selector.wallVisible =true;
    var selectorF = _.clone(selector);
    selectorF.blockVisible = true;
  } else {
    selectorF = selector;
  }
 
  return [
    Walls.find(selector),
    Columns.find(selector),
    Blocks.find(selector),
    Files.find(selectorF)
  ];
});

/******* ASSESSMENTS *******/

//now just need one publish function with a date range?
Meteor.publish('assessments',function(pastDate,futureDate,studentID) {
  check(pastDate,Date);
  check(futureDate,Date);
  check(studentID,Match.OneOf(Match.idString,null));
  
  //select assessments if even one sections test date is in range
  var selector = {
    maxTestDate: {$gte:pastDate},
    minTestDate: {$lte:futureDate}
  };
  studentID = ((studentID) && Roles.userIsInRole(studentID,'student')) ? studentID : null;
  var siteID = Site.findOne()._id;
  var cU = this.userId;
  if (Roles.userIsInRole(cU,'teacher')) {
    if (studentID) {
      selector.createdFor = {$in:[siteID,studentID]};
    } else {
      selector.createdFor = siteID;
    }
  } else { //student or parent
    if (studentID) {
      selector.$or = [
        {createdFor:siteID,visible:true},
        {createdFor:studentID}
      ];
    } else {
      selector.createdFor = siteID
      selector.visible =true;
    }
  }

  var dSelector = _.clone(selector);
  delete dSelector.minTestDate;
  delete dSelector.maxTestDate;
  dSelector.testDate = {$gte:pastDate,$lte:futureDate};

  return [
    Assessments.find(selector),
    AssessmentStandards.find(selector),
    AssessmentDates.find(dSelector)
  ]
});

Meteor.publish('assessmentWithDatesAndStandards',function(assessmentID,studentID) {
  check(assessmentID,Match.idString);
  return [
    Assessments.find({_id:assessmentID}),
    AssessmentDates.find({assessmentID:assessmentID}),
    AssessmentStandards.find({assessmentID:assessmentID})
  ]
})

/******* END ASSESSMENT ********/

Meteor.publish('slides',function(studentOrSectionID,unitID,limit)  {
  check(studentOrSectionID,Match.idString); 
  check(unitID,Match.idString); 
  check(limit,Match.Integer);

  var selector = {
    unitID: unitID,
    type: {$in: ['text','file','embed']}
  };
  var slideIDs = [];
  var userID = studentOrSectionID;
  if (Roles.userIsInRole(studentOrSectionID,'student')) {
    if (Roles.userIsInRole(this.userId,'parentOrAdvisor')) {
      selector.wallType = 'student';
      selector.access = {$in: [studentOrSectionID]}; 
      slideIDs = _.pluck(Blocks.find(selector,{fields:{_id:1}}).fetch(),'_id'); 
    } else {
      if (Roles.userIsInRole(this.userId,'teacher')) {
        selector.access = {$in: [studentOrSectionID,this.userId]};
      } else {
        selector.access = {$in: [studentOrSectionID]};
      }
    }
    slideIDs = _.pluck(Blocks.find(selector,{fields:{_id:1}}).fetch(),'_id'); 
  } else if (Roles.userIsInRole(this.userId,'teacher')) { //and are not impersonating a student
    userID = this.userId;
    selector.$or = [{createdFor:studentOrSectionID}, //if viewing a section, draw in blocks posted to its walls
                    {access:{$in:[this.userId]}}];  //also draw in blocks with this particular teacher ID in the access field (which means the teacher selected it for his/her stack of slides)
    slideIDs = _.pluck(Blocks.find(selector,{fields:{_id:1}}).fetch(),'_id'); 
  }

  slideIDs =  slideIDs.sort(function(slideID1,slideID2) {
    var star1 = SlideStars.findOne({blockID:slideID1,userID:userID}) || {value:8};
    var star2 = SlideStars.findOne({blockID:slideID2,userID:userID}) || {value:8};
    if (star1.value != star2.value) {
      return star2.value - star1.value;
    } else { 
      var slide1 = Blocks.findOne(slideID1);
      var slide2 = Blocks.findOne(slideID2);
      return slide2.modifiedOn - slide1.modifiedOn;
    }
  })
  slideIDs = slideIDs.slice(0,limit);

  return [
    Blocks.find({_id:{$in:slideIDs}}),
    Files.find({blockID:{$in:slideIDs}}),
    SlideStars.find({blockID:{$in:slideIDs}})
  ]
});

Meteor.publish('blocks',function(studentOrSectionID,activityID)  {  //change to user or section ID in order to generate summary page for whole activity and section ... later!
  check(studentOrSectionID,Match.Optional(Match.OneOf(Match.idString,null))); 
  check(activityID,Match.idString); 
  var wallIds = currentWallIds(studentOrSectionID,activityID);
  //if parent, only publish titles (except for text blocks in student wall)
  if (Roles.userIsInRole(this.userId,'parentOrAdvisor')) {
    studentWallIds = wallIds.filter(function(wallID) { 
      var wall = Walls.findOne(wallID);
      return ((wall) && (wall.type == 'student'));
    })
    teacherWallIds = wallIds.filter(function(wallID) { 
      var wall = Walls.findOne(wallID);
      return ((wall) && (wall.type == 'teacher'));
    })
    return Blocks.find({$or: [
      {wallID:{$in:studentWallIds},type:{$in:['file','assessment','text']}},
      {wallID:{$in:teacherWallIds}}
    ]});
  }
  return Blocks.find({wallID:{$in:wallIds}});
});

Meteor.publish('files',function(studentOrSectionID,activityID) {  //change to user or section ID in order to generate summary page for whole activity and section ... later!
  check(studentOrSectionID,Match.Optional(Match.OneOf(Match.idString,null))); 
  check(activityID,Match.idString); 
  var wallIds = currentWallIds(studentOrSectionID,activityID);
  return Files.find({wallID:{$in:wallIds}});
});

Meteor.publish('summary',function(studentID,unitID) {
  check(studentID,Match.idString);
  check(unitID,Match.idString);
  return Summaries.find({studentID:studentID,unitID:unitID});
});

Meteor.publish('fileForSummary',function(studentID,unitID) {
  check(studentID,Match.idString);
  check(unitID,Match.idString);
  return Files.find({studentID:studentID,unitID:unitID},{sort:{modifiedOn:1},limit:1});
});

Meteor.publish('activityStatuses',function(studentOrSectionID,unitID) { 
  check(studentOrSectionID,Match.Optional(Match.OneOf(Match.idString,null))); 
  check(unitID,Match.Optional(Match.OneOf(Match.idString,null)));
  var studentID = studentOrSectionID || this.userId;  
  var sectionID = (Sections.find(studentOrSectionID).count()) ? studentOrSectionID : null;
  var selector = {}
  if (Roles.userIsInRole(studentID,'student')) {
    selector.studentID = studentID;
  } else if (Roles.userIsInRole(this.userId,'teacher') && sectionID) {
    selector.sectionID = sectionID;
  } else {
    selector.siteID = Site.findOne()._id;
  }
  if (unitID)
    selector.unitID = unitID;

  return ActivityStatuses.find(selector);
});

Meteor.publish('tags',function() {
  return Tags.find()
})

Meteor.publish('activityProgress',function(studentID,unitID) { 
  check(studentID,Match.Optional(Match.OneOf(Match.idString,null))); 
  studentID = studentID || this.userId;  
  var selector = {}
  if (Roles.userIsInRole(studentID,'student'))
    selector.studentID = studentID;

  check(unitID,Match.Optional(Match.OneOf(Match.idString,null)));
  if (unitID)
    selector.unitID = unitID;

  return ActivityProgress.find(selector);
});

Meteor.publish('subActivityProgress',function(studentID,pointsTo){
  check(studentID,Match.Optional(Match.idString)); 
  studentID = studentID || this.userId;  //setting default here because flow router cannot pass in user id
  var selector = {}
  if (Roles.userIsInRole(studentID,'student'))
    selector.studentID = studentID;

  check(pointsTo,Match.Optional(Match.idString));
  if (pointsTo)
    selector.pointsTo = pointsTo;

  return ActivityProgress.find(selector);  
})

//passing in sectionID and unitID allows initial loading of just enough data to render the visible unit
//passing in just sectionID allows loading workperiods for other units in the background after the first data comes through
//passing in neither allows loading all workperiods for teacher
Meteor.publish('workPeriods',function(sectionID,unitID) { 
  check(sectionID,Match.Optional(Match.OneOf(Match.idString,'',null)));
  var selector = {};
  if (sectionID)
    selector.sectionID = sectionID;

  check(unitID,Match.Optional(Match.OneOf(Match.idString,'',null)));
  if (unitID)
    selector.unitID = unitID;

  return WorkPeriods.find(selector);
});

Meteor.publish('gradingPeriods',function() {
  return GradingPeriods.find();
})

