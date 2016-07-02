Walls = new Meteor.Collection('Walls');

Meteor.methods({
  insertWall: function(wall) {
    check(wall,{
      activityID: Match.idString,
      createdFor: Match.idString, //must = siteID if teacher wall (only one Site object, so only one id possible)
                                  //userID of a student if student wall
                                  //id of a group if group wall
                                  //id of a section if section wall
      type: Match.OneOf('teacher','student','group','section'),
      /* set below, value not passed in
      unitID: activity.unitID,
      visible: activity.wallVisible[wall.type],
      order: activity.wallOrder.indexOf(wall.type);
      access: Match.Optional([Match.idString])    // [studentID] | [groupMemberIDs] | [sectionMemberIDs]
      */
    });
    var cU = Meteor.user();
    if (!cU)  
      throw new Meteor.Error('notLoggedIn', "You must be logged in to create a new wall.");
    //troubles here when creating default walls for a parent???
    if (!Roles.userIsInRole(cU,['teacher','student']))
      throw new Meteor.Error('onlyTeachersAndStudentsAllowed', "Only teachers or students can add a wall to an activity.");

    var activity = Activities.findOne(wall.activityID);
    if (!activity)
      throw new Meteor.Error('activity-not-found',"Cannot add wall, invalid activityID.");
    wall.unitID = activity.unitID;
    wall.order = activity.wallOrder.indexOf(wall.type);
    wall.visible = activity.wallVisible[wall.type];

    //validate createdFor collection and specific item 
    if (wall.type == 'student') {
      var student = Meteor.users.findOne(wall.createdFor);
      if (!Roles.userIsInRole(student,'student'))
        throw new Meteor.Error('notStudent','Could not create student wall.  Assigned user is not a student.');
      wall.access = [student._id];
    } else if (wall.type == 'group') {
      var group = Groups.findOne(wall.createdFor);
      if (!group)
        throw new Meteor.Error('group-not-found','Could not create group wall.  Group not found.');
      wall.access = Meteor.groupMemberIds('current,final',group._id);
    } else if (wall.type == 'section') {
      var section = Sections.findOne(wall.createdFor);
      if (!section)
        throw new Meteor.Error('section-not-found','Could not create section wall.  Section not found.');
      wall.access = Meteor.sectionMemberIds(section._id);      
    } else if (wall.type == 'teacher') {
      var site = Sites.findOne(wall.createdFor);
      if (!site)
        throw new Meteor.Error('site-not-found','Could not create teacher wall.  Site not found.');        
      wall.access = []; //not sure what to do here, should not need to be used
    } else {
      throw new Meteor.Error('owner-not-found','Error creating wall.  Owner (student,group, section or site) not found.');      
    }

    return Walls.insert(wall , function( error, _id) { 
      if ( error ) console.log ( error.reason ); //info about what went wrong
      if ( _id ) {
        Meteor.call('insertColumn',_id,-1,'right');
        Meteor.call('insertColumn',_id,0,'right');
        //Meteor.call('insertColumn',_id,1,'right'); //trying out just inserting two columns on new walls with default width of 6
      }
    });
  },
  wallChangeGroup: function(wallID,newGroupID) {
    //only allow group change if wall is empty?
    check(wallID,Match.idString);
    check(newGroupID,Match.idString);
    check(studentID,Match.idString);

    var wall = Walls.findOne(wallID);
    if (!wall)
      throw new Meteor.Error('wallNotFound','Cannot change group.  Wall not found.');
    if (wall.type != 'group')
      throw new Meteor.Error('notGroupWall','Cannot change group.  This is not a group wall.');
    if (Blocks.find({wallID:wall._id}).count())
      throw new Meteor.Error('notEmpty',"Cannot change group if wall already has blocks in it.");
    var cU = Meteor.userId();
    if (!cU)  
      throw new Meteor.Error('notLoggedIn', "You must be logged in to create a new wall.");
    if (!Roles.userIsInRole(cU,['teacher','student']))
      throw new Meteor.Error('onlyTeachersAndStudentsAllowed', "Only teachers or students can change the group for a group wall.");

    var groupMemberIds = Meteor.groupMemberIds('current,final',wall.createdFor);
    if (Roles.userIsInRole(cU,'student') && !_.contains(groupMemberIds,cU))
      throw new Meteor.Error('studentNotInGroup','A student can only change the group for a wall if they are in the group to begin with.');
    var newGroupMemberIds = Meteor.groupMemberIds('current,final',newGroupID);
    if (Roles.userIsInRole(cU,'student') && !_.contains(newGroupMemberIds,cU))
      throw new Meteor.Error('studentNotInNewGroup','A student can only change the group for a wall if they are in the new group.');

    return Walls.update(wallID,{$set:{createdFor:newGroupID,access:newGroupMemberIds}});
  },
  deleteWallIfEmpty: function(wallID) {
    check(wallID,Match.idString);
    if (this.isSimulation)
      return;
    var wall = Walls.findOne(wallID);
    if (!wall)
      return; //already deleted on the server, but apparently its ghost was left in the browser
      //throw new Meteor.Error('wallNotFound','Cannot delete wall.  Wall not found.')
    var blockCount = Blocks.find({wallID:wallID}).count();
    if (blockCount > 0)
      return; //only delete empty walls
    if (wall.type == 'teacher') {
      var teacherWallCount = Walls.find({activityID:wall.activityID,type:'teacher'}).count();
      if (teacherWallCount == 1)
        return; //don't delete last teacher wall
    }
    return Walls.remove(wallID);
  },
  addDefaultWalls: function(studentOrSectionIDs,activityID,wallType) {
    if (Meteor.isSimulation)
      return;
    check(wallType,Match.OneOf('allTypes','teacher','student','group','section'));
    check(studentOrSectionIDs,[Match.idString]);
    check(activityID,Match.idString);
    if (wallType == 'teacher') //default teacher wall added when activity is created and then never removed
      return 0;
    var wallTypes = (wallType == 'allTypes') ? ['teacher','student','group','section'] : [wallType];
    var wallsCreated = 0;
    var activity = Activities.findOne(activityID);
    //if activity doesn't exist, just don't create walls for it
    //but don't throw error ... see if this is OK
    if (!activity)
      return;
      //throw new Meteor.Error('activityNotFound','Cannot create default walls.  Activity not found.');
    var studentIDs = studentOrSectionIDs.filter(function(studentID) {
      return Roles.userIsInRole(studentID,'student');
    })
    var sectionIDs = studentOrSectionIDs.filter(function(sectionID) {
      return Sections.find(sectionID,{limit:1}).count();
    })

    var wall = {};
    studentIDs.forEach(function(studentID) {
      var sectionID = Meteor.currentSectionId(studentID);
      if (sectionID && !_.contains(sectionIDs,sectionID))
        sectionIDs.push(sectionID);

      wall = {
        activityID: activityID,
        type: 'student',
        createdFor: studentID
      }
      if (_.contains(wallTypes,'student') && (Walls.find(wall).count() == 0)) {
        Meteor.call('insertWall',wall,function(error,id) {
          if (error)
            throw new Meteor.Error(error);
        });
        wallsCreated += 1;
      }

      wall.type = 'group';
      var groupIds = _.pluck(Memberships.find({memberID:studentID,collectionName:'Groups'},{fields:{itemID:1}}).fetch(),'itemID');
      wall.createdFor = {$in: groupIds}; 
      if (_.contains(wallTypes,'group') && (Walls.find(wall).count() == 0)) { //count non-empty walls for all past groups
        wall.createdFor = Meteor.currentGroupId(studentID); //if none, create wall for current group
        if (wall.createdFor)
          Meteor.call('insertWall',wall,function(error,id) {
          if (error)
            throw new Meteor.Error(error);
        });
        wallsCreated += 1;
      }
    })

    sectionIDs.forEach(function(sectionID) {
      var wall = {
        activityID: activityID
      }

      var section = Sections.findOne(sectionID);
      if (section) {
        wall.type = 'section';
        wall.createdFor = sectionID;
        if ((_.contains(wallTypes,'section')) && (Walls.find(wall).count() == 0)) {
           Meteor.call('insertWall',wall,function(error,id) {
            if (error)
              throw new Meteor.Error(error);
          });
          wallsCreated += 1;
        }
      }
    });

    return wallsCreated;
  }
});

Walls.after.update(function (userID, doc, fieldNames, modifier) {
  //if wallorder changed, denormalize wall order in activity
  //                    , and set order of any other walls in the activity
  if (doc.order != this.previous.order) {
    var activity = Activities.findOne(doc.activityID);
    var to = doc.order;
    var from = activity.wallOrder.indexOf(doc.type);
    if (to != from) {
      activity.wallOrder.splice(to, 0, activity.wallOrder.splice(from, 1)[0]);
      Activities.update(activity._id,{$set:{wallOrder:activity.wallOrder}});
      Walls.find({activityID:doc.activityID}).forEach(function(wall){
        var newOrder = activity.wallOrder.indexOf(wall.type);
        if (wall.order != newOrder)
          Walls.direct.update(wall._id,{$set:{order:newOrder}});
      })
    }
  }
  //if wall visible changed, denormalize wall visible in activty
  //                       , and set visible of any walls of same type for this activity
  if (doc.visible != this.previous.visible) {
    var activity = Activities.findOne(doc.activityID);
    var wallVisible = activity.wallVisible;
    wallVisible[doc.type] = doc.visible;
    Activities.update(doc.activityID,{$set:{wallVisible:wallVisible}});
    Walls.find({activityID:doc.activityID,type:doc.type}).forEach(function(wall){
      if (wall.visible != doc.visible) 
        Walls.direct.update(wall._id,{$set:{visible:doc.visible}});
    });    
  }
});