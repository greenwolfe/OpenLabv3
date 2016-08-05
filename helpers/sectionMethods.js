Meteor.sectionCurrentMembersCount = function(sectionID) {
  var today = new Date();
  return Memberships.find({
      collectionName:'Sections',
      itemID:sectionID,
      endDate: {$gt: today}    
  }).count()
}

Meteor.sectionMemberIds = function(sectionOrID) {
  var sectionID = ((sectionOrID) && ('object' === typeof sectionOrID)) ? sectionOrID._id : sectionOrID;
  if (Meteor.isClient)
    sectionID = sectionID || Meteor.currentSectionId();
  if (!sectionID) //throw error?
    return [];
  var section = Sections.findOne(sectionID);
  if (!section) //throw error?
    return [];

  var today = new Date();
  var memberships = Memberships.find({
      collectionName:'Sections',
      itemID:sectionID,
      startDate: {$lt: today}, //startDate < today < endDate
      endDate: {$gt: today}
    },
    {fields:{memberID:1}}).fetch();
  return _.pluck(memberships,'memberID');
}

Meteor.allStudentIds = function() {
  var today = new Date();
  var memberships = Memberships.find({
      collectionName:'Sections',
      startDate: {$lt: today}, //startDate < today < endDate
      endDate: {$gt: today}
    },
    {fields:{memberID:1}}).fetch();
  return _.pluck(memberships,'memberID');  
}

Meteor.isSectionMember = function(userOrID,sectionOrID) {
  var userID = ((userOrID) && ('object' === typeof userOrID)) ? userOrID._id : userOrID;
  if (Meteor.isClient)
    userID = userID || Meteor.impersonatedOrUserId();
  var memberIDs = Meteor.sectionMemberIds(sectionOrID);
  return _.contains(memberIDs,userID);
}
//if memberID is not passed, returns id of current section for currently impersonated user or current user
Meteor.currentSectionId = function(memberID) {
  var today = new Date();
  if (Meteor.isClient)
    memberID = memberID || Meteor.impersonatedOrUserId();
  var membership = Memberships.find({
      memberID:memberID,
      collectionName:'Sections',
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