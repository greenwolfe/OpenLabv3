  /*************************/
 /***** GROUP HELPERS *****/
/*************************/

Meteor.groupCurrentMembersCount = function(groupID) {
  var today = new Date();
  return Memberships.find({
      collectionName:'Groups',
      itemID:groupID,
      endDate: {$gt: today}    
  }).count()
}
//if groupOrID is not passed, returns members of current group for currently impersonated user or current user
//status must be a string containing one or more of current, former, final, and/or all.
Meteor.groupMemberIds = function(status,groupOrID) {
  var groupID = ((groupOrID) && ('object' === typeof groupOrID)) ? groupOrID._id : groupOrID;
  if (Meteor.isClient)
    groupID = groupID || Meteor.currentGroupId();
  if (!groupID) //throw error?
    return [];
  var group = Groups.findOne(groupID);
  if (!group) //throw error?
    return [];

  var today = new Date();
  var selector = {
      collectionName:'Groups',
      itemID:groupID 
  }
  var former = _.str.contains(status,'former'); 
  var current = _.str.contains(status,'current');
  var final = _.str.contains(status,'final');
  var all = _.str.contains(status,'all');
  if ((all) || (current && former && final)) {
    // do nothing, leave selector as is to return all members
  } else if (Meteor.groupCurrentMembersCount(groupID)) { //group has current members (endDate > today => current)
                                                        //                           (endDate < today => former) 
                                                       //                             no final members
    if (current && former) {
      //do nothing, this is all the members
    } else if (former) { //regardless of whether final is selected
      selector.endDate = {$lt: today};    
    } else if (current) { //regardless of whether final is selected
      selector.endDate = {$gt: today}; 
    } else {
      return []; //there are no final members to return, so returning blank array regardless of whether final is selected                                             
    }
  } else { //group has no current members, everyone has left the group (endDate < group.lastActivity => former)
          //                                                           (endDate > group.lastActivity => final)
         //final status allows member to go back and post something for this past group
    if (former && final) {
      //do nothing, this is all the members
    } else if (former) { //regardless of whether current is selected
      selector.endDate = {$lt: group.latestActivity};    
    } else if (final) { //regardless of whether current is selected
      selector.endDate = {$gt: group.latestActivity}; 
    } else {
      return [];  //there are no current members to return, so returning blank array regardless of whether current is selected                                        
    }
  }
  return _.unique(_.pluck(Memberships.find(selector,{fields:{memberID:1}}).fetch(),'memberID'));
}

//specify ['current','final'] or leave as is?  ... where are all the places this is used?
Meteor.isGroupMember = function(userOrID,groupOrID) {
  var userID = ((userOrID) && ('object' === typeof userOrID)) ? userOrID._id : userOrID;
  if (Meteor.isClient)
    userID = userID || Meteor.impersonatedOrUserId();
  var memberIDs = Meteor.groupMemberIds('current',groupOrID);
  return _.contains(memberIDs,userID);
}
Meteor.dateLeftGroup = function(userOrID,groupOrID) {
  var userID = ((userOrID) && ('object' === typeof userOrID)) ? userOrID._id : userOrID;
  if (Meteor.isClient)
    userID = userID || Meteor.impersonatedOrUserId();
  var groupID = ((groupOrID) && ('object' === typeof groupOrID)) ? groupOrID._id : groupOrID;
  if (Meteor.isClient)
    groupID = groupID || Meteor.currentGroupId(userID);
  var today = new Date();
  var expiredMembership = Memberships.findOne({
      collectionName:'Groups',
      memberID: userID,
      itemID:groupID,
      endDate: {$lt: today}  //endDate < today
    },{sort:[["endDate","desc"]]}); 
  var currentMemberships = Memberships.find({
      collectionName:'Groups',
      memberID: userID,
      itemID:groupID,
      status:'current',
      startDate: {$lt: today}, //startDate < today < endDate
      endDate: {$gt: today}  
    }).count(); 
  if (expiredMembership && !currentMemberships) return expiredMembership.endDate;
  return false;
}

//on client, if memberID is not passed, returns id of current group for currently impersonated user or current user
Meteor.currentGroupId = function(memberID) {     
  var today = new Date();
  if (Meteor.isClient)
    memberID = memberID || Meteor.impersonatedOrUserId();
  var membership = Memberships.find({
      memberID:memberID,
      collectionName:'Groups',
      startDate: {$lt: today}, //startDate < today < endDate
      endDate: {$gt: today}
    },
    {sort:[["endDate","desc"]]}, 
    {limit:1}
  ).fetch().pop();
  if (!membership)
    return ''; 
  return membership.itemID;
}