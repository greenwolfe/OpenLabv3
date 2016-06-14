  /*************************/
 /***** GROUP HELPERS *****/
/*************************/

//if groupOrID is not passed, returns members of current group for currently impersonated user or current user
//status can be current, former, or all.
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
  //check for current members: find those with startDate < today < endDate
  //if status == 'current' 
  //  if currentMembers.length, return those members
  //  else check for current members: find and return those with endDate > group.lastActivity //group has posted no new content since this member left, so member included in group if it wants to do something in the future





  if (_.isString(status) && _.str.include(status,',')) {
    var st = status.split(','); //must use new variable st because if I write status = status.split(","), javascript converts the array back to a string
    if (Match.test(st,[Match.OneOf('current','former','final')]))
      selector.status = {$in:st};    
  } else if (_.isArray(status)) {
    if (Match.test(status,[Match.OneOf('current','former','final')]))
      selector.status = {$in:status};
  } else {
    if (_.contains(['current','former','final'],status))
      selector.status = status;
    //the following should be redundant
    if (status == 'current') {
      selector.endDate = {$gt: today};
    } else if (_.contains(['former','final'],status)) {
      selector.endDate = {$lt: today};
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
    groupID = groupID || Meteor.currentGroupId();
  var today = new Date();
  var expiredMembership = Memberships.findOne({
      collectionName:'Groups',
      memberID: userID,
      itemID:groupID,
      startDate: {$lt: today}, //don't include invited members, who haven't entered the group yet
      endDate: {$lt: today}  //implies they have already left
    },{sort:[["endDate","desc"]]}); 
  var currentMemberships = Memberships.find({
      collectionName:'Groups',
      memberID: userID,
      itemID:groupID,
      status:'current',
      startDate: {$lt: today}, //don't include invited members, who haven't entered the group yet
      endDate: {$gt: today}  //so is current member
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
//      status:'current', //deprecated
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