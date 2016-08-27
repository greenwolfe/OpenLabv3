Groups = new Meteor.Collection('Groups');

Meteor.methods({
  addGroup: function(studentID) {
    check(studentID,Match.idString);
    var cU = Meteor.user(); //current user
    if (!Roles.userIsInRole(cU,['student','teacher']))
      throw new Meteor.Error('notStudentOrTeacher','You must be a student or a teacher to add a new group.');    
    if (!Roles.userIsInRole(studentID,'student'))
      throw new Meteor.Error('invalidStudent','A valid student ID is needed to create a new group.');

    var longLongAgo = new Date(0);
    var today = new Date();
    var tenMinutesFromNow = moment().add(10,'minutes').toDate();
    var groupID = Groups.insert({ //insert group
      openUntil: tenMinutesFromNow, 
      votesToOpen: [],
      pollClosesAt: longLongAgo,
      latestActivity: today,
    },function(error,groupID) {
      if (error) {
        throw new Meteor.Error('failedToAddGroup',error)
      } else {
        Meteor.call('addMember',{ //add first member immediately before returning
          memberID:  studentID,
          itemID: groupID,
          collectionName: 'Groups'
        },function(error,id) {
          if (error)
            throw new Meteor.Error('failedToAddMember',error)
        });
        if (Meteor.isServer) {
          Meteor.defer(function() {  //create default walls for this group
            Activities.find().forEach(function(activity) {
              var wall = {
                activityID:activity._id,
                wallType: 'group',
                access: {$in: [studentID]},
                wallIsEmpty: true
              }
              Walls.find(wall).forEach(function(w) {  //user's empty group walls on this page
                var groupMemberIds = Meteor.groupMemberIds('current',w.createdFor);
                if (w.access.length <= 1) { //last person will be leaving group so delete it
                  Walls.mutate.deleteWallIfEmpty(w._id);
                } else {
                  Walls.mutate.wallChangeAccess(w._id,[studentID],'remove');
                }
              });
              wall.wallIsEmpty = false;
              if (!Walls.find(wall).count()) { //user has no group wall with any contents for this activity
                wall = {
                  activityID:activity._id,
                  createdFor:groupID,
                  type: 'group'
                }
                Walls.mutate.insertWall(wall);  
              }
            })
          });
        }
      }
    });
    return groupID
  },
  updateGroup: function(group) { //return to implement this with latestActivity
    check(group,{
      _id: Match.idString,
      latestActivity: Match.Optional(Date)
    })
    var cU = Meteor.user(); //currentUser
    if (!cU)  
      throw new Meteor.Error('notLoggedIn', "You must be logged in to update a group.");
    var currentMemberIDs = Meteor.groupMemberIds('current',groupID);
    if (!_.contains(currentMemberIDs,cU._id) && !Roles.userIsInRole(cU,'teacher'))
      throw new Meteor.Error('notGroupMemberOrTeacher', 'Only a member of a group or a teacher can update a group.')

    var originalGroup = Groups.findOne(group._id);
    if (!originalGroup)
      throw new Meteor.Error('invalidID','Cannot update group.  Invalid ID.');

    if (('latestActivity' in group) && (group.latestActivity > originalGroup.latestActivity))
      Groups.update(group._id,{$set:{latestActivity:group.latestActivity}});

  },
  voteToOpenGroup: function(groupID,memberID) { //return to implement this with latestActivity
    check(groupID,Match.idString);
    check(memberID,Match.idString);
    var group = Groups.findOne(groupID);
    if (!group)
      throw new Meteor.Error('groupNotFound','Cannot vote to open group.  Group not found. ' + groupID);
    if (!Meteor.groupCurrentMembersCount(groupID)) 
      throw new Meteor.Error('groupNotActive','Only active groups can accept new members.');
    var cU = Meteor.userId();
    if (!Roles.userIsInRole(cU,['teacher','student']))
      throw new Meteor.Error('notTeacherOrStudent','Only a student (or a teacher on behalf of a student) can vote to open a group to new members');
    if (Roles.userIsInRole(cU,'student')) {
      if (cU != memberID)
        throw new Meteor.Error('notOwnVote','A student can only vote to open a group for themself, not for another student.');
    }
    var currentMemberIDs = Meteor.groupMemberIds('current',groupID);
    if (!_.contains(currentMemberIDs,memberID))
      throw new Meteor.Error('notAMember','You cannot vote to opne the group unless you are a member');
    var today = new Date();
    if (today < group.openUntil)
      throw new Meteor.Error('alreadyOpen','This group is already open. Why are you trying to vote to open it?');

    if (today < group.pollClosesAt) { //poll is open
      if (!_.contains(group.votesToOpen,memberID)) //record vote
        group.votesToOpen.push(memberID);
    } else {//any past poll is closed
      group.pollClosesAt = moment().add(2,'hours').toDate(); //open a new one for a limited time
      group.votesToOpen = [memberID]; //with just a vote for this member
    } 
    //if all members have voted to open, then make group open for a limited time
    if (_.difference(currentMemberIDs,group.votesToOpen).length == 0) {
      group.openUntil = moment().add(2,'hours').toDate();
      group.pollClosesAt = new Date(0); //and close the poll
      group.votesToOpen = [];
    }
    delete group._id

    Groups.update(groupID,{$set: group});
  },
  closeGroup: function(groupID,memberID) {  //return to implement this with latestActivity
    check(groupID,Match.idString);
    check(memberID,Match.idString);
    var group = Groups.findOne(groupID);
    if (!group)
      throw new Meteor.Error('groupNotFound','Cannot vote to open group.  Group not found. ' + groupID);
    var cU = Meteor.userId();
    if (!Roles.userIsInRole(cU,['teacher','student']))
      throw new Meteor.Error('notTeacherOrStudent','Only a student (or a teacher on behalf of a student) can vote to open a group to new members');
    if (Roles.userIsInRole(cU,'student')) {
      if (cU != memberID)
        throw new Meteor.Error('notOwnVote','A student can only vote to open a group for themself, not for another student.');
    }
    var currentMemberIDs = Meteor.groupMemberIds('current',groupID);
    if (!_.contains(currentMemberIDs,memberID))
      throw new Meteor.Error('notAMember','You cannot vote to opne the group unless you are a member');
    var today = new Date(); 
    if (!_.contains(group.votesToOpen,memberID)) { //no current vote to open
      if (today > group.openUntil) //and didn't already vote to open 
        throw new Meteor.Error('alreadyClosed','This group is not open.  No need to take action to close it.');
    }

    var longLongAgo = new Date(0);
    Groups.update(groupID,{$set: {
      openUntil:longLongAgo,
      pollClosesAt: longLongAgo, 
      votesToOpen: []
    }});
  }
});