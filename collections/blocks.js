Blocks = new Meteor.Collection('Blocks');

Meteor.methods({
  insertBlock: function(block) {
    check(block,{
      //required fields to create the new block
      columnID: Match.idString,
      type: Match.OneOf('file','embed'), //deprecated 'workSubmit','text','subactivities','assessment'
        //workSubmit blocks probably deprecated
      /*fields that will be initially filled based on the information passed in
      createdBy: Match.idString,              //current user
      createdOn: Match.Optional(Date),            //today's date
      createdFor: Match.idString, //must = siteID if teacher wall (only one Site object, so only one id possible)
                                  //userID of a student if student wall
                                  //id of a group if group wall
                                  //id of a section if section wall

      modifiedBy: Match.Optional(Match.idString), //current user
      modifiedOn: Match.Optional(Date),           //current date
      wallID: Match.Optional(Match.idString),     //denormalized value from column
      wallType: Match.Optional(Match.OneOf('teacher','student','group','section')), //denormalize value from wall
      wallVisible: Match.Optional(Boolean),
      activityID: Match.Optional(Match.idString), //same as above
      unitID: Match.Optional(Match.idString),     //same as above
      visible: Match.Optional(Boolean),           //true
      order: Match.Optional(Match.Integer),        //0 new blocks always added at top of column
      access: Match.Optional([Match.idString])    // [studentID] | [groupMemberIDs] | [sectionMemberIDs]
      */

      /*content fields, block types indicated, all filled with blank string on insertion
      title: Match.Optional(String),        //all
      text: Match.Optional(String),         //text, embed, file
      studentText: Match.Optional(String),  //workSubmit
      teacherText: Match.Optional(String),  //workSubmit
      embedCode: Match.Optional(String),    //embed
      raiseHand: Match.Optional(Match.OneOf('visible','')) //only partially implemented (all?)
      standardIDs: [Match.idString],           //assessment
      subActivityID: Match.Optional(Match.idString) //assessment
      */
    });
    //validate user and set permissions
    var cU = Meteor.user();
    if (!cU)  
      throw new Meteor.Error('notLoggedIn', "You must be logged in to create a new block.");
    if (Roles.userIsInRole(cU,'parentOrAdvisor'))
      throw new Meteor.Error('parentNotAllowed', "Parents may only observe.  They cannot create new content.");
    block.createdBy = cU._id;
    block.modifiedBy = cU._id;
    if (Roles.userIsInRole(cU,'student')) {
      //workSubmit block deprecated
      //for workSubmit block, put a teacherID in createdBy at all times, even if a student creates it
      //restrict certain fields by default so student can never edit them
      //workSubmit blocks probably deprecated ... no harm done leaving this in for now
      if (block.type == 'workSubmit') { //deprecated
        var teachers = Roles.getUsersInRole('teacher');
        if (!teachers.count()) 
          throw new Meteor.Error('teacherNotFound','Cannot create worksubmit block, could not find a teacher.');
        block.createdBy = teachers[0]._id;
      } else if (block.type == 'subactivities') { //deprecated
        throw new Meteor.Error('onlyTeacher', "Only teachers may create a subactivities block.");
      } else if (block.type == 'assessment') { //to be deprecated
        //for now ... until the process seems smooth enough and I have time
        //to work out an easy work flow for students to create their own reassessment
        throw new Meteor.Error('onlyTeacher', "Only teachers may create an assessment block.");
      }
    }
    var today = new Date();
    block.createdOn = today;
    block.modifiedOn = today;

    //validate column and wall
    var column = Columns.findOne(block.columnID)
    if (!column)
      throw new Meteor.Error('column-not-found', "Cannot add block, not a valid column");
    var wall = Walls.findOne(column.wallID);
    if (!wall)
      throw new Meteor.Error('wall-not-found', "Cannot add block, not a valid wall");
    var activity = Activities.findOne(wall.activityID);
    if (!activity)
      throw new Meteor.Error('activityNotFound',"Cannot add block, activity not found.");
    if (Roles.userIsInRole(cU,'student') && !Meteor.studentCanEditWall(cU._id,wall))
      throw new Meteor.Error('cannodEditWall', "You do not have permissions to edit this wall.");
    block.wallID = column.wallID; //denormalize block
    block.activityID = column.activityID;
    block.unitID = activity.unitID;
    block.createdFor = wall.createdFor;
    block.wallType = wall.type;
    block.wallVisible = wall.visible;
    if (wall.type == 'group') {
      block.access = Meteor.groupMemberIds('current,final',wall.createdFor);
    } else if (wall.type == 'section') {
      block.access = Meteor.sectionMemberIds(wall.createdFor);
    } else {
      block.access = wall.access;
    }

    block.order = 0;  //always insert at top of column
    block.raiseHand = '';
    block.visible = true;

    block.title = '';
    block.text = '';
    block.studentText = ''; //probably deprecated
    block.teacherText = ''; //probably deprecated
    block.embedCode = '';
    block.standardIDs = [];
    block.subActivityID = '';

    //move other blocks in column down to make room
    var ids = _.pluck(Blocks.find({columnID:block.columnID},{fields: {_id: 1}}).fetch(), '_id');
    Blocks.update({_id: {$in: ids}}, {$inc: {order:1}}, {multi: true});
    //add new block at top
    return Blocks.insert(block,function(error,id) {
      Walls.update(wall._id,{$set:{wallIsEmpty:false}});
    });      
  },
  //make a pasteBlock method pasteBlock: function(blockID,columnID)
  //is it necessary to pass in anything else?
  /* REVISE THIS to past contents of block at time it was copied */
  pasteBlock: function(block) {
    check(block,{
      //required fields to paste the block
      columnID: Match.idString, //NEW column ID
      type: Match.OneOf('file','embed'), //deprecated 'workSubmit','text','subactivities','assessment'
      fileIDs: [Match.idString], //required, but could be an empty array
      //optional fields that may be passed in with new block
      modifiedBy: Match.Optional(Match.idString), //current user
      modifiedOn: Match.Optional(Date),           //current date
      title: Match.Optional(String),        //all
      text: Match.Optional(String),         //text, embed, file
      embedCode: Match.Optional(String),    //embed
      subActivityID: Match.Optional(Match.OneOf(Match.idString,'')), //assessment
      visible: Match.Optional(Boolean),          //true



      //fields that will be filled with values based on above information
      //anything passedin will be ignored
      _id: Match.Optional(Match.idString),
      createdBy: Match.Optional(Match.idString),              //current user
      createdOn: Match.Optional(Date),            //today's date
      createdFor: Match.Optional(Match.idString), //must = siteID if teacher wall (only one Site object, so only one id possible)
                                  //userID of a student if student wall
                                  //id of a group if group wall
                                  //id of a section if section wall

      wallID: Match.Optional(Match.idString),     //denormalized value from column
      wallType: Match.Optional(Match.OneOf('teacher','student','group','section')), //denormalize value from wall
      wallVisible: Match.Optional(Boolean),
      activityID: Match.Optional(Match.idString), //same as above
      unitID: Match.Optional(Match.idString),     //same as above
      order: Match.Optional(Match.Integer),        //0 new blocks always added at top of column
      access: Match.Optional([Match.idString]),   // [studentID] | [groupMemberIDs] | [sectionMemberIDs]
      studentText: Match.Optional(String),  //workSubmit
      teacherText: Match.Optional(String),  //workSubmit
      raiseHand: Match.Optional(Match.OneOf('visible','')), //only partially implemented (all?)
      standardIDs: Match.Optional([Match.idString])          //assessment
    });
    //validate user and set permissions
    var blockID = block._id; //for finding and copying links to attached files
    delete block._id;
    var cU = Meteor.user();
    if (!cU)  
      throw new Meteor.Error('notLoggedIn', "You must be logged in to paste a block.");
    if (Roles.userIsInRole(cU,'parentOrAdvisor'))
      throw new Meteor.Error('parentNotAllowed', "Parents may only observe.  They cannot create new content.");
    block.createdBy = cU._id;
    block.modifiedBy = block.modifiedBy || cU._id;
    var today = new Date();
    block.createdOn = today;
    block.modifiedOn = block.modifiedOn || today;

    //validate column and wall
    var column = Columns.findOne(block.columnID)
    if (!column)
      throw new Meteor.Error('column-not-found', "Cannot add block, not a valid column");
    var wall = Walls.findOne(column.wallID);
    if (!wall)
      throw new Meteor.Error('wall-not-found', "Cannot add block, not a valid wall");
    var activity = Activities.findOne(wall.activityID);
    if (!activity)
      throw new Meteor.Error('activityNotFound',"Cannot add block, activity not found.");
    if (Roles.userIsInRole(cU,'student') && !Meteor.studentCanEditWall(cU._id,wall))
      throw new Meteor.Error('cannodEditWall', "You do not have permissions to edit this wall.");
    block.wallID = column.wallID; //denormalize block
    block.activityID = column.activityID;
    block.unitID = activity.unitID;
    block.createdFor = wall.createdFor;
    block.wallType = wall.type;
    block.wallVisible = wall.visible;
    if (wall.type == 'group') {
      block.access = Meteor.groupMemberIds('current,final',wall.createdFor);
    } else if (wall.type == 'section') {
      block.access = Meteor.sectionMemberIds(wall.createdFor);
    } else {
      block.access = wall.access;
    }

    block.order = 0;  //always insert at top of column
    block.raiseHand = '';
    block.visible = ('visible' in block) ? block.visible : true;

    block.title = block.title || '';
    block.text = block.text || '';
    block.studentText = ''; //probably deprecated
    block.teacherText = ''; //probably deprecated
    block.embedCode = block.embedCode || '';
    block.standardIDs = [];
    if ('subActivityID' in block) {
      var subactivity = Activities.findOne(block.subActivityID);
      if ((!subactivity) || (subactivity.pointsTo != block.activityID)) { //block pasted into an entirely different activity page, subactivity not available on new page
        block.subactivityID = '';
      }
    } else {
      block.subactivityID = '';
    }

    //move other blocks in column down to make room
    var ids = _.pluck(Blocks.find({columnID:block.columnID},{fields: {_id: 1}}).fetch(), '_id');
    Blocks.update({_id: {$in: ids}}, {$inc: {order:1}}, {multi: true});
    //add new block at top
    var fileIDs = block.fileIDs;
    delete block.fileIDs;
    return Blocks.insert(block,function(error,id) {
      Walls.update(wall._id,{$set:{wallIsEmpty:false}});
      Files.find({_id:{$in:fileIDs}}).forEach(function(file) {
        file.blockID = id;
        delete file._id;
        Meteor.call('insertFile',file);
      });  
    });   
  },
  deleteBlock: function(blockID) {
    check(blockID,Match.idString);
    //check if it has a subactivity
    //if so, check if other blocks share the same subactivity
    //if not, set isReassessment, isExtraPractice, isMakeUp to null
    var cU = Meteor.user();
    if (!cU)  
      throw new Meteor.Error('notLoggedIn', "You must be logged in to delete a block.");
    if (Roles.userIsInRole(cU,'parentOrAdvisor'))
      throw new Meteor.Error('parentNotAllowed', "Parents may only observe.  They cannot delete any content.");

    block = Blocks.findOne(blockID);
    if (!block)
      throw new Meteor.Error('block-not-found',"Cannot delete block, block not found.")

    var fileCount = Files.find({blockID:blockID}).count();
    if (fileCount > 0) return; 
      //throw error as well?

    var LoMcount = LevelsOfMastery.find({assignmentID:blockID}).count();
    if (LoMcount > 0)
      throw new Meteor.Error('alreadyAssessed','This assessment block has already been used to grade students.  Deleting it will orphan those standards.  Try hiding the assignment block instead.');
      //just remove assessmentID and activityID from each affected LoM instead?  Do so after confirming?

    if (Roles.userIsInRole(cU,'student')) {
      if (cU._id != block.createdBy)
        throw new Meteor.Error('noPermissions','You did not create this block, and do not have permissions to delete it.');
    }

    var ids = _.pluck(Blocks.find({columnID:block.columnID,order:{$gt: block.order}},{fields: {_id: 1}}).fetch(), '_id');
    var numberRemoved = Blocks.remove(blockID); 
    var wallIsEmpty = !Blocks.find({wallID:block.wallID}).count();
    Walls.update(block.wallID,{$set:{wallIsEmpty:wallIsEmpty}});
    Blocks.update({_id: {$in: ids}}, {$inc: {order:-1}}, {multi: true});
    return numberRemoved; 
  },
  blockChangeAccess: function(blockID,access,action) {
    check(blockID,Match.idString);
    check(access,[Match.idString]);
    check(action,Match.OneOf('set','add','remove'));

    var block = Blocks.findOne(blockID);
    if (!block)
      throw new Meteor.Error('blockNotFount','Cannot change access.  Block not found.');
    var wall = Walls.findOne(block.wallID);
    if (!wall)
      throw new Meteor.Error('wallNotFound','Cannot change access.  Wall not found.');
    var cU = Meteor.userId();
    if (!cU)  
      throw new Meteor.Error('notLoggedIn', "You must be logged in to change block access.");
    if (!Roles.userIsInRole(cU,['teacher','student']))
      throw new Meteor.Error('onlyTeachersAndStudentsAllowed', "Only teachers or students can change the block access.");
    if ((wall.type == 'teacher') || (wall.type == 'student')) 
      throw new Meteor.Error('notGroupOrSectionWall','You cannot change access for blocks in student or teacher walls.');
    if (wall.type == 'group') {
      var memberIds = Meteor.groupMemberIds('current,final',wall.createdFor);
      if (Roles.userIsInRole(cU,'student') && !_.contains(block.access,cU))
        throw new Meteor.Error('studentNotAMember','A student can only change the group for a block if they already have access to it.');
    } else if (wall.type == 'section') {
      var memberIds = Meteor.sectionMemberIds(wall.createdFor);
      if (!Roles.userIsInRole(cU,'teacher'))
        throw new Meteor.Error('notATeacher','Only a teacher can change access to a block in a section wall.');
    }
    if (_.intersection(access,memberIds).length != access.length)
      throw new Meteor.Error('notInGroupOrSection','Not a group or section member.  You must specify members of the group or section to be added or removed from block access.')

    if (action == 'set') {
      Files.update({blockID:blockID},{$set:{access:access}},{multi:true});
      return Blocks.update(blockID,{$set:{access:access}});
    } else if (action == 'add') {
      Files.update({blockID:blockID},{$addToSet:{access:{$each: access}}},{multi:true});
      return Blocks.update(blockID,{$addToSet:{access:{$each: access}}});
    } else if (action == 'remove') {
      Files.update({blockID:blockID},{$pullAll:{access:access}},{multi:true});
      return Blocks.update(blockID,{$pullAll:{access:access}});
    }
  },
  updateBlock: function(block) { 
    check(block,Match.ObjectIncluding({
      _id: Match.idString,
      //content fields, block types indicated, all filled with blank string on insertion
      title: Match.Optional(String),        //all
      text: Match.Optional(String),         //text, embed, file
      studentText: Match.Optional(String),  //workSubmit
      teacherText: Match.Optional(String),  //workSubmit
      embedCode: Match.Optional(String),    //embed
      raiseHand: Match.Optional(Match.OneOf('visible','')), //only partially implemented (all?)
      subActivityID: Match.Optional(Match.OneOf(Match.idString,'')), //assessment
      standardIDs: Match.Optional([Match.idString]) //assessment ... also set using assessmentAddStandard and assessmentRemoveStandard, or just deprecate those?
          //careful with this method for standard IDS ... none of the checks to avoid deleting a standard that has already been assessed are in place!
          
      /*fields set below, values passed in are ignored          
      modifiedBy: Match.Optional(Match.idString), //current user
      modifiedOn: Match.Optional(Date),           //current date
      */

      /*fields that might be passed along with original block object, but are ignored
      columnID: Match.Optional(Match.idString), 
      wallID: Match.Optional(Match.idString), 
      wallType: Match.Optional(Match.OneOf('teacher','student','group','section')), //denormalize value from wall
      wallVisible: Match.Optional(Boolean),      
      activityID: Match.Optional(Match.idString),
      type: Match.Optional(String), //'file','embed' - precated 'workSubmit','text','subactivities','assessment'
      order: Match.Optional(Match.Integer), 
      access: Match.Optional([Match.idString])    // [studentID] | [groupMemberIDs] | [sectionMemberIDs]
      createdFor: Match.Optional(Match.idString),
      createdBy: Match.Optional(Match.idString),  
      createdOn: Match.Optional(Date), 
      visible: Match.Optional(Boolean)  //set in showHideMethod.js
      */ 
    }));
    var originalBlock = Blocks.findOne(block._id);
    if (!originalBlock)
      throw new Meteor.Error('block-not-found','Cannot update block.  Block not found.');

    var cU = Meteor.user();
    if (!cU)  
      throw new Meteor.Error('notLoggedIn', "You must be logged in to create a new block.");
    if (Roles.userIsInRole(cU,'parentOrAdvisor'))
      throw new Meteor.Error('parentNotAllowed', "Parents may only observe.  They cannot create new content.");
    if (Roles.userIsInRole(cU,'student')) {
      if (!Meteor.studentCanEditBlock(cU._id,originalBlock))
        throw new Meteor.Error('noPermissions','You do not have access to edit this block.');
    }    
    block.modifiedBy = cU._id;
    block.modifiedOn = new Date();

    var fields = ['title','text','studentText','teacherText','embedCode','raiseHand','subActivityID','standardIDs','modifiedBy','modifiedOn'];
    fields.forEach(function(field) {
      if ((field in block) && (block[field] != originalBlock[field])) {
        var set = {};
        set[field] = block[field];
        Blocks.update(block._id,{$set: set});
      }
    });
    return block._id; 
  },
  assessmentAddStandard: function(assessmentID,standardID) {
    check(assessmentID,Match.idString);
    check(standardID,Match.idString);

    var assessment = Blocks.findOne(assessmentID);
    if (!assessment)
      throw new Meteor.Error('invalidAssessment','Cannot add standard to assessment block.  Invalid assessment block ID.');

    var standard = Standards.findOne(standardID);
    if (!standard)
      throw new Meteor.Error('invalidStandardID','Cannot add standard to assessment.  Standard not found.  Invalid standard ID');

    var cU = Meteor.user();
    if (!cU)  
      throw new Meteor.Error('notLoggedIn', "You must be logged in to add a standard to an assessment.");
    if (Roles.userIsInRole(cU,'parentOrAdvisor'))
      throw new Meteor.Error('parentNotAllowed', "Parents may only observe.  They cannot create new content.");
    if (Roles.userIsInRole(cU,'student')) {
      if (!Meteor.studentCanEditBlock(cU._id,originalBlock))
        throw new Meteor.Error('noPermissions','You did not create this assessment, and do not have permissions to add a standard.');
    }  

    var today = new Date();
    Blocks.update(assessmentID,{$addToSet: {standardIDs:standardID}});
    Blocks.update(assessmentID,{$set:{modifiedBy:cU._id}});
    Blocks.update(assessmentID,{$set:{modifiedOn: today}});

    return assessmentID;
  },
  assessmentRemoveStandard: function(assessmentID,standardID) {
    check(assessmentID,Match.idString);
    check(standardID,Match.idString);

    var assessment = Blocks.findOne(assessmentID);
    if (!assessment)
      throw new Meteor.Error('invalidAssessment','Cannot add standard to assessment block.  Invalid assessment block ID.');

    var standard = Standards.findOne(standardID);
    if (!standard)
      throw new Meteor.Error('invalidStandardID','Cannot add standard to assessment.  Standard not found.  Invalid standard ID');

    var cU = Meteor.user();
    if (!cU)  
      throw new Meteor.Error('notLoggedIn', "You must be logged in to add a standard to an assessment.");
    if (Roles.userIsInRole(cU,'parentOrAdvisor'))
      throw new Meteor.Error('parentNotAllowed', "Parents may only observe.  They cannot create new content.");
    if (Roles.userIsInRole(cU,'student')) {
      if (!Meteor.studentCanEditBlock(cU._id,originalBlock))
        throw new Meteor.Error('noPermissions','You did not create this assessment, and do not have permissions to add a standard.');
    }  

    var LoMcount = LevelsOfMastery.find({assessmentID:assessmentID,standardID:standardID}).count();
    if (LoMcount > 0)
      throw new Meteor.Error('alreadyAssessed','Cannot delete standard.  At least one student has already received a grade for this standard on this assessment. Deleting it will orphan those grades.');
      //provide a way to hide the standard just within an assessment block?

    var today = new Date();
    Blocks.update(assessmentID,{$pull: {standardIDs:standardID}});
    Blocks.update(assessmentID,{$set:{modifiedBy:cU._id}});
    Blocks.update(assessmentId,{$set:{modifiedOn: today}}); 
    
    return assessmentID;   
  }
});

/**** HOOKS *****/
Blocks.after.update(function (userID, doc, fieldNames, modifier) {
  if (doc.columnID !== this.previous.columnID) {
    //denormalizing
    var column = Columns.findOne(doc.columnID);
    var wall = Walls.findOne(column.wallID);
    Blocks.update(doc._id,{$set:{
      wallID:column.wallID,
      wallType:wall.type,
      wallVisible: wall.visible,
      activityID:column.activityID,
      unitID:wall.unitID,
      access:wall.access
    }});
    Files.update({blockID:doc._id},{$set:{
        columnID:column._id,
        wallID:column.wallID,
        wallType:wall.type,
        wallVisible: wall.visible,
        activityID:column.activityID,
        unitID:wall.unitID,
        access:wall.access
    }},{multi:true});
    SlideStars.update({blockID:doc._id},{$set:{
        columnID:column._id,
        wallID:column.wallID,
        activityID:column.activityID,
        unitID:wall.unitID,
        access:wall.access
    }},{multi:true}); 
  }
  if (doc.visible != this.previous.visible) {
    Files.update({blockID:doc._id},{$set:{
        blockVisible: doc.visible,
    }},{multi:true});    
  }
});

