  /**********************/
 /******* GROUPS *******/
/**********************/

Template.groups.onCreated(function() {
  var instance = this;
  instance.showHistory = new ReactiveVar(false);
})

/* groups helpers */
Template.groups.helpers({
  openGroups: function() {
    var groupIDs = [];
    var students = Roles.getUsersInRole('student');
    students.forEach(function(student) {
      var currentGroupID = Meteor.currentGroupId(student._id);
      if (currentGroupID)
        groupIDs.push(currentGroupID);
    });
    groupIDs = _.unique(groupIDs);
    var today = new Date();
    return Groups.find({_id:{$in:groupIDs},openUntil:{$gt:today}});
  },
  openGroupsCount: function() {
    var groupIDs = [];
    var students = Roles.getUsersInRole('student');
    students.forEach(function(student) {
      var currentGroupID = Meteor.currentGroupId(student._id);
      if (currentGroupID)
        groupIDs.push(currentGroupID);
    });
    groupIDs = _.unique(groupIDs);
    var today = new Date();
    return Groups.find({_id:{$in:groupIDs},openUntil:{$gt:today}}).count();
  },
  groupIsOpen: function() {
    var today = new Date();
    return (today < this.openUntil);
  },
  pollIsOpen: function() {
    var today = new Date();
    return (today < this.pollClosesAt);
  },
  voteIsYes: function() {
    var today = new Date();
    if (today > this.pollClosesAt)
      return false;
    return _.contains(this.votesToOpen,Meteor.impersonatedOrUserId());
  },
  membersWhoVotedToOpen: function() {
    var today = new Date();
    if (today > this.pollClosesAt)
      return '';
    if (!this.votesToOpen.length)
      return "So far, no one has";
    var verb = (this.votesToOpen.length > 1) ? ' have' : ' has';
    return groupToString(this.votesToOpen) + verb;
  },
  formerMembersCount: function() {
    return Meteor.groupMemberIds('former',this._id).length;
  },
  showHistory: function() {
    var tmpl = Template.instance();
    return tmpl.showHistory.get();
  },
  hasPastGroups: function() {
    var cU = Meteor.userId();
    if (!Roles.userIsInRole(cU,['student','teacher']))
      return 0;
    var studentID = Meteor.impersonatedOrUserId();
    if (!Roles.userIsInRole(studentID,'student'))
      return 0;
    var groupIDs = _.pluck(Memberships.find({memberID:studentID,collectionName:'Groups'},{fields:{itemID:1}}).fetch(),'itemID');
    groupIDs = _.unique(groupIDs);
    return groupIDs.length;
  },
  pastGroups: function() {
    var cU = Meteor.userId();
    if (!Roles.userIsInRole(cU,['student','teacher']))
      return '';
    var studentID = Meteor.impersonatedOrUserId();
    if (!Roles.userIsInRole(studentID,'student'))
      return '';
    var groupIDs = _.pluck(Memberships.find({memberID:studentID,collectionName:'Groups'},{fields:{itemID:1},sort:{startDate:-1}}).fetch(),'itemID');
    groupIDs = _.unique(groupIDs);
    if (!groupIDs.length)
      return '';
    var pastGroups = [];

    groupIDs.forEach(function(groupID) {
      var group = Groups.findOne(groupID);
      var pastGroupies = Meteor.groupies('current,final',group._id);
      if (pastGroupies == 'none')
        return;
      var membership = Memberships.findOne({
        memberID:studentID,
        collectionName:'Groups',
        itemID:group._id
      },{sort:{startDate:-1}});
      var today = new Date();
      if (membership.endDate > today) { //current member
        pastGroupies += ' from ' + moment(membership.startDate).format("MMM D, YYYY") + ' to present';
      } else {  //left group at some point in the past
        pastGroupies += ' from ' + moment(membership.startDate).format("MMM D, YYYY") + ' to ' + moment(membership.endDate).format("MMM D, YYYY");
        if (membership.endDate < group.lastActivity) //former member, group did some stuff after this student left
          pastGroupies = 'with ' + pastGroupies;
      }
      pastGroups.push({names:pastGroupies});
    })

    return pastGroups;
  }
})

/* groups events */
Template.groups.events({
  'click #leave-group': function(event,tmpl) {
    event.stopPropagation();
    var user = Meteor.user();
    if (!Roles.userIsInRole(user,['student','teacher']))
      return;
    var studentID = Meteor.impersonatedOrUserId();
    if (!Roles.userIsInRole(studentID,'student'))
      return;
    var groupID = Meteor.currentGroupId();
    var today = new Date();
    var membership = Memberships.findOne({
      itemID:groupID,
      collectionName:'Groups',
      memberID: studentID,
      startDate: {$lt:today}, //startDate < today < endDate
      endDate: {$gt:today}
    });
    if (!membership)
      return;
    Meteor.call('removeMember',membership._id,alertOnError);
  },
  'click #open-group': function(event,tmpl) {
    event.stopPropagation();
    var user = Meteor.user();
    if (!Roles.userIsInRole(user,['student','teacher']))
      return;
    var studentID = Meteor.impersonatedOrUserId();
    if (!Roles.userIsInRole(studentID,'student'))
      return;
    var groupID = Meteor.currentGroupId();
    Meteor.call('voteToOpenGroup',groupID,studentID,alertOnError);
  },
  'click #close-group': function(event,tmpl) {
    event.stopPropagation();
    var user = Meteor.user();
    if (!Roles.userIsInRole(user,['student','teacher']))
      return;
    var studentID = Meteor.impersonatedOrUserId();
    if (!Roles.userIsInRole(studentID,'student'))
      return;
    var groupID = Meteor.currentGroupId();
    Meteor.call('closeGroup',groupID,studentID,alertOnError);
  },
  'click #form-new-group': function(event,tmpl) {
    event.stopPropagation();
    var user = Meteor.user();
    if (!Roles.userIsInRole(user,['student','teacher']))
      return;
    var studentID = Meteor.impersonatedOrUserId();
    if (!Roles.userIsInRole(studentID,'student'))
      return;
    //make new group, add first member, remains open to accept new members for 10 minutes
    Meteor.call('addGroup',studentID,alertOnError);
  },
  'click #show-history': function(event,tmpl) {
    event.stopPropagation();
    tmpl.showHistory.set(true);
  },
  'click #hide-history': function(event,tmpl) {
    event.stopPropagation();
    tmpl.showHistory.set(false);
  }
})

Template.joinGroup.events({
  'click #join-group': function(event,tmpl) {
    event.preventDefault();
    var user = Meteor.user();
    if (!Roles.userIsInRole(user,['student','teacher']))
      return;
    var studentID = Meteor.impersonatedOrUserId();
    if (!Roles.userIsInRole(studentID,'student'))
      return;
    Meteor.call('addMember',{
      memberID: studentID,
      itemID: this._id,
      collectionName: 'Groups'
    },alertOnError);    
  }
})

/* groups helper functions */
var groupToString = function(invitees) {
  var groupies = '';
  var groupMembers = Meteor.users.find({_id:{$in:invitees}});
  var groupSize = groupMembers.count();
  groupMembers.forEach(function(user,i,gMs) {
    var fullname =  user.profile.firstName + " " + user.profile.lastName;
    groupies += "<span title='" + fullname  + "'>" + user.profile.firstName + "</span>";
    if (i == groupSize - 2) {
      groupies += ' and ';
    } else if (i < groupSize - 2) {
      groupies += ', ';
    };
  })
  return groupies;
}


