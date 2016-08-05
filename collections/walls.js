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
      access: Match.Optional([Match.idString])    // [studentID] | [groupMemberIDs] | [sectionMemberIDs]
      wallType: wall.type, //denormalized value for ease of publication functions
      unitID: activity.unitID,
      visible: activity.wallVisible[wall.type],
      wallVisible: wall.Visible, //denormalized value for ease of publication functions
      order: activity.wallOrder.indexOf(wall.type);
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
    wall.wallType = wall.type; //denormalized for ease of publication functions
    wall.visible = activity.wallVisible[wall.type];
    wall.wallVisible = wall.visible; //denormalizing for ease of publication functions

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
      var site = Site.findOne(wall.createdFor);
      if (!site)
        throw new Meteor.Error('site-not-found','Could not create teacher wall.  Site not found.');        
      wall.access = [site._id]; 
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

    Columns.update({wallID:wallID},{$set:{access:newGroupMemberIds}},{multi:true});
    return Walls.update(wallID,{$set:{createdFor:newGroupID,access:newGroupMemberIds}});
  },
  wallChangeAccess: function(wallID,access,action) {
    check(wallID,Match.idString);
    check(access,[Match.idString]);
    check(action,Match.OneOf('set','add','remove'));

    var wall = Walls.findOne(wallID);
    if (!wall)
      throw new Meteor.Error('wallNotFound','Cannot change access.  Wall not found.');
    var cU = Meteor.userId();
    if (!cU)  
      throw new Meteor.Error('notLoggedIn', "You must be logged in to change wall access.");
    if (!Roles.userIsInRole(cU,['teacher','student']))
      throw new Meteor.Error('onlyTeachersAndStudentsAllowed', "Only teachers or students can change the wall access.");
    if ((wall.type == 'teacher') || (wall.type == 'student')) 
      throw new Meteor.Error('notGroupOrSectionWall','You cannot change access for student or teacher walls.');
    if (wall.type == 'group') {
      var memberIds = Meteor.groupMemberIds('current,final',wall.createdFor);
      if (Roles.userIsInRole(cU,'student') && !_.contains(wall.access,cU))
        throw new Meteor.Error('studentNotAMember','A student can only change the group for a wall if they already have access to it.');
    } else if (wall.type == 'section') {
      var memberIds = Meteor.sectionMemberIds(wall.createdFor);
      if (!Roles.userIsInRole(cU,'teacher'))
        throw new Meteor.Error('notATeacher','Only a teacher can change access to a section wall.');
    }
    if (_.intersection(access,memberIds).length != access.length)
      throw new Meteor.Error('notInGroupOrSection','Not a group or section member.  You must specify members of the group or section to be added or removed from wall access.')

    if (action == 'set') {
      Columns.update({wallID:wallID},{$set:{access:access}},{multi:true});
      return Walls.update(wallID,{$set:{access:access}});
    } else if (action == 'add') {
      Columns.update({wallID:wallID},{$addToSet:{access:{$each: access}}},{multi:true});
      return Walls.update(wallID,{$addToSet:{access:{$each: access}}});
    } else if (action == 'remove') {
      Columns.update({wallID:wallID},{$pullAll:{access:access}},{multi:true});
      return Walls.update(wallID,{$pullAll:{access:access}});
    }
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
  addDefaultWalls: function(activityID) {
    if (Meteor.isSimulation)
      return;
    check(activityID,Match.idString);
    var wallsCreated = 0;
    var activity = Activities.findOne(activityID);
    //if activity doesn't exist, just don't create walls for it
    //but don't throw error ... see if this is OK
    if (!activity)
      return;
      //throw new Meteor.Error('activityNotFound','Cannot create default walls.  Activity not found.');

    //teacher wall
    var siteID = Site.findOne()._id;
      var wall = {
        activityID: activityID,
        type: 'teacher',
        access: [siteID],
        createdFor: siteID
      }

      foundEmptyWall = false;
      Walls.find(wall).fetch().forEach(function(w) {
        if (!Blocks.find({wallID:w._id}).count())  { //wall is empty
          if (foundEmptyWall) {
            Walls.remove(w._id)
          } else {
            foundEmptyWall = true;
          }
        }
      })  

      if((Walls.find(wall).count() == 0)) {
        delete wall.access;
        Meteor.call('insertWall',wall,function(error,id) {
          if (error)
            throw new Meteor.Error(error);
        });
        wallsCreated += 1;
      }  
    //  

    //section walls
    Sections.find().forEach(function(section) {
      wall = {
        activityID: activityID,
        type: 'section',
        createdFor: section._id
      }

      foundEmptyWall = false;
      Walls.find(wall).fetch().forEach(function(w) {
        if (!Blocks.find({wallID:w._id}).count())  { //wall is empty
          if (foundEmptyWall) {
            Walls.remove(w._id)
          } else {
            foundEmptyWall = true;
            Meteor.call('wallChangeAccess',w._id,Meteor.sectionMemberIds(section._id),'set',function(error,id) {
              if (error)
                throw new Meteor.Error(error);
            });
          }
        }
      })

      if((Walls.find(wall).count() == 0)) {
         Meteor.call('insertWall',wall,function(error,id) {
          if (error)
            throw new Meteor.Error(error);
        });
        wallsCreated += 1;
      }
    });

    //student walls
    Meteor.allStudentIds().forEach(function(studentID) {
      wall = {
        activityID: activityID,
        type: 'student',
        createdFor: studentID
      }

      foundEmptyWall = false;
      Walls.find(wall).fetch().forEach(function(w) {
        if (!Blocks.find({wallID:w._id}).count())  { //wall is empty
          if (foundEmptyWall) {
            Walls.remove(w._id);
          } else {
            foundEmptyWall = true;
          }
        }
      })

      if (Walls.find(wall).count() == 0) {
        Meteor.call('insertWall',wall,function(error,id) {
          if (error)
            throw new Meteor.Error(error);
        });
        wallsCreated += 1;
      }

      //group walls
      wall = {
        activityID: activityID,
        type: 'group',
        access: {$in:[studentID]}
      }

      var currentGroupID = Meteor.currentGroupId(studentID);
      foundEmptyWall = false;
      Walls.find(wall).fetch().forEach(function(w) {
        if (!Blocks.find({wallID:w._id}).count())  { //wall is empty
          if (foundEmptyWall) {
            Walls.remove(w._id)
          } else {
            foundEmptyWall = true;
            if (currentGroupID)
              Meteor.call('wallChangeGroup',w._id,currentGroupID,function(error,id) {
                if (error)
                  throw new Meteor.Error(error);
              });
          }
        }
      })

      if ((Walls.find(wall).count() == 0) && (currentGroupID)) { 
        wall.createdFor = currentGroupID; 
        delete wall.access;
        Meteor.call('insertWall',wall,function(error,id) {
          if (error)
            throw new Meteor.Error(error);
        });
      }
      wallsCreated += 1;
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
      Walls.direct.update(wall._id,{$set:{visible:doc.visible,wallVisible:doc.visible}});
      Columns.update({wallID:wall._id},{$set:{wallVisible:doc.visible}},{multi:true});
      Blocks.update({wallID:wall._id},{$set:{wallVisible:doc.visible}},{multi:true});
      Files.update({wallID:wall._id},{$set:{wallVisible:doc.visible}},{multi:true});
    }); 
  }
});