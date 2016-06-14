Sections = new Meteor.Collection('Sections');

Meteor.methods({

  /***** ADD SECTION ****/
  insertSection: function(section) {
    check(section,{
      name: Match.nonEmptyString
      /*meetingDays: //deprecated 
      */
    })

    var cU = Meteor.user(); //currentUser
    if (!cU)  
      throw new Meteor.Error('notLoggedIn', "You must be logged in to create a section.");
    if (!Roles.userIsInRole(cU,'teacher'))
      throw new Meteor.Error('notTeacher', 'Only teachers can create a section.')

    today = new Date();
    section.latestActivity = today;
    Sections.insert(section);
  },

  /***** UPDATE SECTION ****/
  updateSection: function(section) { //return to implement this with latestActivity
    check(section,{
      _id: Match.idString,
      name: Match.Optional(Match.nonEmptyString),
      latestActivity: Match.Optional(Date)
    })
    var cU = Meteor.user(); //currentUser
    if (!cU)  
      throw new Meteor.Error('notLoggedIn', "You must be logged in to update a section.");
    if (!Roles.userIsInRole(cU,'teacher'))
      throw new Meteor.Error('notTeacher', 'Only teachers can update a section.')

    var originalSection = Sections.findOne(section._id);
    if (!originalSection)
      throw new Meteor.Error('invalidID','Cannot update section.  Invalid ID.');

    if (('name' in section) && (section.name != originalSection.name))
      Sections.update(section._id,{$set:{name:section.name}});

    if (('latestActivity' in section) && (section.latestActivity > originalSection.latestActivity))
      Sections.update(section._id,{$set:{latestActivity:section.latestActivity}});
  },

  /**** SECTION MOVE USERS ?? ****/
    /* move all users from this section to another 
       but in that case, could just rename the section? */

  /**** DELETE SECTION ****/
  deleteSection: function(sectionID) { //return to implement this with latestActivity
    check(sectionID,Match.idString);

    var cU = Meteor.user(); //currentUser
    if (!cU)  
      throw new Meteor.Error('notLoggedIn', "You must be logged in to delete a section.");
    if (!Roles.userIsInRole(cU,'teacher'))
      throw new Meteor.Error('notTeacher', 'Only teachers can delete a section.')

    var section = Sections.findOne(sectionID);
    if (!section)
      throw new Meteor.Error('invalidID','Cannot delete section.  Invalid ID.');

    var enrolledStudents = Meteor.sectionMemberIds(sectionID);
    if (enrolledStudents.length > 0)
      throw new Meteor.Error('sectionNotEmpty','This section is not empty.  Have these students move to a new section before deleting it.');

    return Sections.remove(sectionID);
    //denormalization ... will have to remove this element from all LoM calculations

  }
});