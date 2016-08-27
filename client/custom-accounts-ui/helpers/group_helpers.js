  /*****************************/
 /***** EXTRA ROLE HELPER *****/
/*****************************/

Template.registerHelper('userIsInRole',function(user,role) {
  return Roles.userIsInRole(user,role);
});

  /*************************/
 /***** GROUP HELPERS *****/
/*************************/

Meteor.currentGroup = function(memberID) {  //if memberID is not passed, returns group for currently impersonated user or current user
  var groupID = Meteor.currentGroupId(memberID);
  return Groups.findOne(groupID);
}
Template.registerHelper('currentGroup',Meteor.currentGroup);

Meteor.groupMembers = function(status,groupOrID) {
  var memberIDs = Meteor.groupMemberIds(status,groupOrID);
  return Meteor.users.find({_id: {$in: memberIDs}});
}
Template.registerHelper('groupMembers',Meteor.groupMembers);

//returns a string with the names of all group members
//if groupID is not passed, defaults to groupies of current group for currently impersonated user or current user
Meteor.groupies = function(status,groupID) { 
  var groupies = '';
  var groupMembers = Meteor.groupMembers(status,groupID);
  var groupSize = groupMembers.count();
  if (!groupSize)
    return 'none';
  groupMembers.forEach(function(user,i,gMs) {
    var fullname =  user.profile.firstName + " " + user.profile.lastName;
    var expired = "";
    var dateLeftGroup = Meteor.dateLeftGroup(user._id,groupID)
    if (dateLeftGroup) {
      fullname += " left on " + moment(dateLeftGroup).format("MMM D YYYY");
      expired = " class='text-warning'";
    }
    groupies += "<span title='" + fullname  + "'" + expired + ">" + user.profile.firstName + "</span>";
    if (i == groupSize - 2) {
      groupies += ' and ';
    } else if (i < groupSize - 2) {
      groupies += ', ';
    };
  })
  return groupies;
}
Template.registerHelper('groupies',Meteor.groupies);

Meteor.listNamesFromAccess = function(access) {
  var list = '';
  var memberCount = access.length;
  if (!memberCount)
    return 'no one';
  access.forEach(function(id,ndex,g) {
    var user = Meteor.users.findOne(id);
    if (!user)
      return;
    var fullname =  user.profile.firstName + " " + user.profile.lastName;
    list += "<span title='" + fullname  + "'>" + user.profile.firstName + "</span>";
    if (ndex == memberCount - 2) {
      list += ' and ';
    } else if (ndex < memberCount - 2) {
      list += ', ';
    } 
  }) 
  return list;
}
Template.registerHelper('listNamesFromAccess',Meteor.listNamesFromAccess);

Meteor.groupFirstNames = function(status,groupID) { 
  var groupies = '';
  var groupMembers = Meteor.groupMembers(status,groupID);
  var groupSize = groupMembers.count();
  groupMembers.forEach(function(user,i,gMs) {
    groupies +=  user.profile.firstName;
    if (i == groupSize - 2) {
      groupies += ' and ';
    } else if (i < groupSize - 2) {
      groupies += ', ';
    };
  })
  return groupies;
}

   /******************************************/
  /*********** OTHER GROUP HELPERS **********/
 /**** DEFINED IN LOGIN BUTTONS SESSION ****/
/******************************************/

//none at the present time

   /*********************************************/
  /*********** OTHER GROUP HELPERS *************/
 /**** DEFINED IN /METHODS/groupMETHODS.JS ****/
/*********************************************/

//Meteor.groupCurrentMembersCount
//Meteor.groupMemberIds
//Meteor.isGroupMember
//Meteor.currentGroupId

