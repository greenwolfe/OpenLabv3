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
    return Sections.insert(section,function(error,id) {
      if (error) {
        throw new Meteor.Error('failedToAddSection',error)
      } else if (Meteor.isServer) {
        Meteor.defer(function() {  //create default walls for this group
          Activities.find().forEach(function(activity) {
            var wall = {
              activityID:activity._id,
              createdFor:id,
              type: 'section'
            }
            Walls.mutate.insertWall(wall);
          })
        });
      }
    });
  },

  /***** UPDATE SECTION ****/
  updateSection: function(section) { 
    check(section,{
      _id: Match.idString,
      name: Match.Optional(Match.nonEmptyString),
      latestActivity: Match.Optional(Date)
    })
    var cU = Meteor.user(); //currentUser
    if (!cU)  
      throw new Meteor.Error('notLoggedIn', "You must be logged in to update a section.");
    if (!Roles.userIsInRole(cU,['teacher','student']))
      throw new Meteor.Error('notTeacherOrStudent', 'Only teachers and students can update a section.')

    var originalSection = Sections.findOne(section._id);
    if (!originalSection)
      throw new Meteor.Error('invalidID','Cannot update section.  Invalid ID.');

    if (('name' in section) && (section.name != originalSection.name)) {
      if (!Roles.userIsInRole(cU,'teacher'))
        throw new Meteor.Error('notTeacher', 'Only teachers can change the name of a section.')
      Sections.update(section._id,{$set:{name:section.name}});
    }

    if (('latestActivity' in section) && (section.latestActivity > originalSection.latestActivity))
      Sections.update(section._id,{$set:{latestActivity:section.latestActivity}});
  },

  /**** SECTION MOVE USERS ?? ****/
    /* move all users from this section to another 
       but in that case, could just rename the section? */

  /**** DELETE SECTION ****/
  deleteSection: function(sectionID) { 
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

    var blocks = Blocks.find({createdFor:sectionID},{limit:10});
    var numBlocks = blocks.count();
    if (numBlocks) {
      var errorMessage = 'Blocks have been created for this section, including in the following activities: ';
      var i = 0;
      Blocks.forEach(function(block) {
        i += 1;
        var activity = Activities.findOne(block.activityID)
        errorMessage += activity.title;
        if (i == numBlocks - 1) {
          errorMessage += ', and ';
        } else if (i < numBlocks - 1) {
          errorMessage += ', ';
        }
      })
      errorMessage += '. Move or remove the blocks from the section wall of these activities before deleting the section.';
      throw new Meteor.Error('sectionHasContent',errorMessage);
    }
    
    return Sections.remove(sectionID,function(error,num) {
      if (Meteor.isServer) {
        Meteor.defer(function() {
          var wall = {
            createdFor:sectionID,
            type: 'section',
            wallIsEmpty:true
          }    
          var wallIDs = _.pluck(Walls.find(wall,{fields:{_id:1}}).fetch(),'_id');
          Columns.remove({wallID:{$in:wallIDs}});
          Walls.remove({_id:{$in:wallIDs}});  
        });
      }
    });
  },
  deleteSectionWalls: function(sectionID) {
    check(sectionID,Match.idString);
    if (Meteor.isServer) {
      Meteor.defer(function() {
        var wall = {
          createdFor:sectionID,
          type: 'section',
          wallIsEmpty:true
        }    
        var wallIDs = _.pluck(Walls.find(wall,{fields:{_id:1}}).fetch(),'_id');
        Columns.remove({wallID:{$in:wallIDs}});
        Walls.remove({_id:{$in:wallIDs}});  
      });
    }
  }
});