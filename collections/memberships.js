Memberships = new Meteor.Collection('Memberships');

Meteor.methods({
  addMember: function(membership) {
    check(membership,{
      memberID:  Match.idString,
      itemID: Match.idString,
      collectionName: Match.OneOf('Groups','Sections'),
      startDate: Match.Optional(Date),
      endDate: Match.Optional(Date)
    });
    var longLongAgo = new Date(0);
    var aLittleWhileAgo = moment().subtract(1,'minutes').toDate();  //converted to javascript date object after subtracting 1 minute
    var today = new Date();
    var wayWayInTheFuture = new Date(8630000000000000); //new Date(8640000000000000) =  Sat Sep 13 275760 01:00:00 GMT+0100 (BST) and is the maximum possible javascript Date
    membership.startDate = membership.startDate || aLittleWhileAgo;
    membership.endDate = membership.endDate || wayWayInTheFuture; 

    var Collection = Mongo.Collection.get(membership.collectionName);
    if (!Collection)
      throw new Meteor.Error('collection-not-found', "Cannot add member, not a valid collection, " + membership.collectionName + '.');
    var item = Collection.findOne(membership.itemID);
    if (!item)
      throw new Meteor.Error('item-not-found', "Cannot add member, could not find item " + membership.itemID +  " in collection" + membership.collectionName + '.');
    if (today > item.openUntil)
      throw new Meteor.Error('closedGroup',"You are trying to join a closed group.");
    var member = Meteor.users.findOne(membership.memberID);
    if (!member)
      throw new Meteor.Error('user-not-found', "Cannot add member.  User not found.");

    //only allow add if new member does not already have a current membership
    Memberships.find({memberID:membership.memberID,collectionName:membership.collectionName}).forEach(function(mship) {
      if ((mship.startDate < today) && (today < mship.endDate)) 
        throw new Meteor.Error('hasCurrentMembership','You have a current membership.  You cannot request to join a new group until you leave your old group.  groupID = ' + mship.itemID + ' collectionName = ' + mship.collectionName + ' membershipID = ' + mship._id);
    });

    //update access fields of walls belonging to section or group
    var getType = {'Sections':'section','Groups':'group'};
    var selector = {
      createdFor:membership.itemID,
      type:getType[membership.collectionName],
      wallIsEmpty: true
    }
    if (Meteor.isServer) {
      Meteor.defer(function() {
        Walls.update(selector,{$addToSet:{access:membership.memberID}},{multi:true});
        var wallIDs = _.pluck(Walls.find(selector,{fields:{_id:1}}).fetch(),'_id');
        Columns.update({wallID:{$in:wallIDs}},{$addToSet:{access:membership.memberID}},{multi:true});
      });
    }
    var formerMembership = Memberships.findOne({
      memberID:membership.memberID,
      collectionName:membership.collectionName,
      itemID:membership.itemID
    })
    if (formerMembership) {
      return Memberships.update(formerMembership._id,{$set:{endDate:wayWayInTheFuture}}); //make former membership current again
        //note member still has no access to any materials posted while they were not a member
        //but access can be added on a block by block basis
    } else {
      return Memberships.insert(membership);
    }
  },
  removeMember: function(membershipID) { //parameter futureStatus deprecated
    check(membershipID,Match.idString);
    var membership = Memberships.findOne(membershipID);
    if (!membership)
      throw new Meteor.Error('membershipNotFound','Cannot remove member.  Membership not found.');
    var cU = Meteor.userId();
    if (!Roles.userIsInRole(cU,['teacher','student']))
      throw new Meteor.Error('notTeacherOrStudent','Only a student (or a teacher on behalf of a student) can remove a student from a group.');
    if (Roles.userIsInRole(cU,'student')) {
      if (cU != membership.memberID)
        throw new Meteor.Error('canOnlyRemoveSelf','A student can only remove themselves from a group, not another student.');
    }

    var Collection = Mongo.Collection.get(membership.collectionName);
    if (!Collection)
      throw new Meteor.Error('collection-not-found', "Cannot remove member, not a valid collection, " + membership.collectionName + '.');
    var item = Collection.findOne(membership.itemID);
    if (!item)
      throw new Meteor.Error('item-not-found', "Cannot remove member, could not find item " + membership.itemID +  " in collection" + membership.collectionName + '.');
    var today = new Date();
    if (membership.endDate < today)
      throw new Meteor.Error('alreadyLeft','You have already left the group.');

    //update access fields of walls belonging to section or group
    var getType = {'Sections':'section','Groups':'group'};
    var selector = {
      createdFor:membership.itemID,
      type:getType[membership.collectionName],
      wallIsEmpty: true
    }
    if (Meteor.isServer) {
      Meteor.defer(function() {
        Walls.update(selector,{$pull:{access:membership.memberID}},{multi:true});
        var wallIDs = _.pluck(Walls.find(selector,{fields:{_id:1}}).fetch(),'_id');
        Columns.update({wallID:{$in:wallIDs}},{$pull:{access:membership.memberID}},{multi:true});
      });
    }
    //Indicate when the member left this group, and keep record rather than deleting it.
    var aLittleWhileAgo = moment(today).subtract(1,'minutes').toDate();
    return Memberships.update(membershipID,{$set: {
      endDate: aLittleWhileAgo
    }})
  },
  //Make some routines to allow teachers only to
  //turn a former member into a final member
  //check that there are no current members (if there are, the member can just rejoin with the normal process)
  //change endDate to be < group.latestActivity
  changeMembershipDates: function(membershipID,startDate,endDate) { //deprecated???
    check(membershipID,Match.idString);
    check(startDate,Match.Optional(Date));
    check(endDate,Match.Optional(Date));
    //this is dangerous, as it could expire a membership
    //and there is no provision to add a new one
    //or it could activate a membership and then there
    //would be two active memberships
    //perhaps check if membership is current and then allow increasing to
    //rename it to extend membership period or some such?
    var membership = Memberships.findOne(membershipID);
    if (!membership)
      throw new Meteor.Error('membership not found','Cannot remove member.  Membership not found.');
    var cU = Meteor.userId();
    if (!Roles.userIsInRole(cU,['teacher','student']))
      throw new Meteor.Error('notTeacherOrStudent','Only a student (or a teacher on behalf of a student) can change membership dates.');
    if (Roles.userIsInRole(cU,'student')) {
      if (cU != membership.memberID)
        throw new Meteor.Error('canOnlyChangeOwnDates','A student can change their own membership dates, not those of another student.');
    }

    if (Match.test(endDate,Date))
      Memberships.update(membershipID,{$set: {endDate:endDate}});
    if (Match.test(startDate,Date))
      Memberships.update(membershipID,{$set: {startDate:startDate}});
  }
});

/**** HOOKS *****/
//section status surveys status for all members, so must
//be denormalized when section membership changes
var updateAllSectionStatuses = function(doc) {
  if (doc.collectionName == "Sections") {
    ActivityStatuses.find({sectionID:doc.itemID}).forEach(function(actStatus) {
      Meteor.updateSectionStatus(doc.itemID,actStatus.activityID);
    })
  }  
}
Memberships.after.update(function (userID, doc, fieldNames, modifier) {
  updateAllSectionStatuses(doc);
});
Memberships.after.insert(function (userID, doc) {
  updateAllSectionStatuses(doc);
});
Memberships.after.remove(function (userID, doc) {
  updateAllSectionStatuses(doc);
});
