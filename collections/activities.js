Activities = new Meteor.Collection('Activities');

Meteor.methods({
  /*removeAllActivities: function() {
    return Activities.remove({});
  },*/

  /***** INSERT ACTIVITY ****/
  insertActivity: function(activity) { 
    check(activity,{
      pointsTo: Match.Optional(Match.idString),
      title: Match.nonEmptyString,
      unitID: Match.idString,

      /*set below, value not passed in
      tag: Match.Optional(String), //MOVE TAGS TO SECTION STATUS
      visible:  Match.Optional(Boolean),
      showStatus: Match.Optional(Boolean),
      order: Match.Optional(Match.Integer), //for now, new activity always placed at end of list
      suborder: Match.Optional(Match.Integer),
      wallOrder: ['teacher','student','group','section'],
      wallVisible: {teacher:true,student:true,group:true,section:true}
      */
    });
    activity.wallOrder = ['teacher','student','group','section'];
    activity.wallVisible = {teacher:true,student:true,group:true,section:true};
    activity.studentID = activity.studentID || ''; //add default values for optional parameters
    activity.tag = '';
    activity.visible = true;
    activity.showStatus = true;
    //don't want order passed in.  Always add new activity at end of list
    var unit = Units.findOne(activity.unitID); //verify unit first
    if (!unit)
       throw new Meteor.Error('improperUnit', "Cannot post activity.  Improper unit.");
    var LastAct = Activities.findOne({unitID: activity.unitID},{
      fields:{order:1},
      sort:{order:-1},
      limit:1
    });
    activity.order = (LastAct) ? LastAct.order + 1 : 0; 
    if (activity.pointsTo) {
      var activityPointedTo = Activities.findOne(activity.pointsTo);
      var assessmentPointedTo = Assessments.findOne(activity.pointsTo);
      if ((!activityPointedTo) && (!assessmentPointedTo))
        throw new Meteor.Error('pointsToInvalid', "Cannot post activity.  Pointed to invalid host activity or assessment.");
      if (activityPointedTo) {
        if (activity.unitID != activityPointedTo.unitID)
          throw new Meteor.Error('notSameUnit',"A subactivity must begin in the same unit as its parent, although it can be moved later.");
        //pointing to valid activity ... set suborder
        //the list in a subactivities block is sorted separately by suborder
        LastAct = Activities.findOne({
          pointsTo: activity.pointsTo
        },{
          fields:{suborder:1},
          sort:{suborder:-1},
          limit:1
        });
        if (!LastAct)
          throw new Meteor.Error('noSubactivities',"When activity is created on the main page and is not a subactivity, it should point to itself and be the first subactivity in its list.  Therefore, something is wrong if there are no subactivities found.");
        if  (!('suborder' in LastAct))
          throw new Meteor.Error('noSuborder',"Every activity should have a suborder, even there are no subactivities and it points to itself, in which case suborder = 0.");
        activity.suborder = LastAct.suborder + 1;   
        //find where to place it on the main page after
        //the last subactivity remaining in the same unit as pointedTo
        //or right after pointedTo if it is the first activity
        LastAct = Activities.findOne({
          unitID: activity.unitID,
          pointsTo: activity.pointsTo
        },{
          fields:{order:1},
          sort:{order:-1},
          limit:1
        });
        //highly unlikely that there is not a properly formated LastAct in the unit
        //at this point.  Can add validation if problems occur.
        var orderEndOfSublist = LastAct.order + 1; 
      } else if (assessmentPointedTo) {
        activity.suborder = 0;
      }       
    }

    var cU = Meteor.user(); //currentUser
    if (!cU)  
      throw new Meteor.Error('notLoggedIn', "You must be logged in to post an activity");
    if (Roles.userIsInRole(cU,'parentOrAdvisor'))
      throw new Meteor.Error('parentNotAllowed', "Parents may only observe.  They cannot create new content.");
    if (!Roles.userIsInRole(cU,'teacher') && (cU._id != activity.ownerID))
      throw new Meteor.Error('notTeacher', 'Only teachers can post activities for the whole class.')
    
    var unit = Units.findOne(activity.unitID);
    if (!unit)
       throw new Meteor.Error('improperUnit', "Cannot post activity.  Improper unit.")

    return Activities.insert(activity, function( error, _id) { 
      if ( error ) console.log ( error ); //info about what went wrong
      if ( _id ) {
        if (activity.pointsTo) {
          if (activityPointedTo) {
            //is subactivity.  place it properly on main page.  see above.
            if (activity.order != orderEndOfSublist)
              Meteor.call('sortItem','Activities',_id,'order','unitID',null,orderEndOfSublist);
          } else if (assessmentPointedTo) {
            //nothing to do, already placed properly at end of activities list
            //and pointsTo points to assessment and not activity, so leave as is
            //and no default walls to add
          }
        } else {
          //if it's not a subactivity, it should point to itself
          //and become the first activity in its own subactivity block
          //this places it on equal footing with the other subactivities
          Activities.update(_id,{$set: {pointsTo:_id}});
          Activities.update(_id,{$set: {suborder:0}});
          if (Meteor.isServer)
            Walls.mutate.addDefaultWalls(_id);
        }
      }
    });
  },  

  /***** DELETE ACTIVITY ****/
  //denormalize canDelete and stick on activity object
  //so that check on client has full server information
  //about whether the activity is empty
  deleteActivity: function(activityID) { 
    check(activityID,Match.idString);
    var cU = Meteor.user(); //currentUser
    var activity = Activities.findOne(activityID);

    if (!cU)  
      throw new Meteor.Error(401, "You must be logged in to delete an activity");

    if (!activity)
      throw new Meteor.Error(412, "Cannot delete activity.  Invalid ID.");

    if (Roles.userIsInRole(cU,'parentOrAdvisor'))
      throw new Meteor.Error('parentNotAllowed', "Parents may only observe.  They cannot create new content.");
    if (!Roles.userIsInRole(cU,'teacher') && (cU._id != activity.studentID))
      throw new Meteor.Error('notTeacher', 'You must be a teacher to delete a whole class activity.')
      
    var numBlocks = Blocks.find({activityID:activityID,type:{$ne:'subactivities'}}).count();
    var numSubActivities = Activities.find({pointsTo:activity._id}).count();
    if ((activity.pointsTo == activity._id) && ((numBlocks > 0) || (numSubActivities > 1)))
      throw new Meteor.Error('notEmpty','This activity cannot be deleted because it is not empty.  Your options are to just hide it (and move it to a hidden unit to get it out of the way), or clear all of the blocks anyone has posted to the activity and then delete it.');
    var assessment = Assessments.findOne(activity.pointsTo);
    if (assessment)
      throw new Meteor.Error('isAssessment','Cannot delete this activity, because it is associated with an assessment.');

    var ids = _.pluck(Activities.find({unitID:activity.unitID,order:{$gt: activity.order}},{fields: {_id: 1}}).fetch(), '_id');
    var numberRemoved = Activities.remove(activityID); 
    Activities.update({_id: {$in: ids}}, {$inc: {order:-1}}, {multi: true});
    return numberRemoved; 
  }, 

  /***** UPDATE ACTIVITY ****/

  /* list of properties of activity object and where/how set

  pointsTo: Match.Optional(Match.idString), //cannot be changed
  title: Match.Optional(Match.nonEmptyString), //set by updateActivity below
  unitID: Match.Optional(Match.idString), //set by sortable1c and drag/drop
  studentID: Match.Optional(String), //cannot be changed
  tag: Match.Optional(String), //set in activitySetTag
  visible:  Match.Optional(Boolean), //set by show/hide methods
  showStatus: Match.Optional(Boolean), //set by updateActivity below
  order: Match.Optional(Match.Integer), //set by sortable1c and drag/drop
  suborder: Match.Optional(Match.Integer), //set by sortable1c and drag/drop
  wallOrder: [Match.OneOf('teacher','student','group','section')], //set in collection Hook after sortable1c reorders walls
  wallVisible: {teacher:Boolean,student:Boolean,group:Boolean,section:Boolean} //set in collection Hook after show/hide hides a wall
  */

  updateActivity: function(newActivity) {
    check(newActivity,{
      _id:Match.idString,
      title:Match.Optional(Match.nonEmptyString),
      showStatus: Match.Optional(Boolean)
    })

    var cU = Meteor.user(); //currentUser
    if (!cU)  
      throw new Meteor.Error('notLoggedIn', "You must be logged in to update an activity");
    if (Roles.userIsInRole(cU,'parentOrAdvisor'))
      throw new Meteor.Error('parentNotAllowed', "Parents may only observe.  They cannot create new content.");
    if (!Roles.userIsInRole(cU,'teacher') && (cU._id != activity.studentID))
      throw new Meteor.Error('onlyTeacher', 'You must be a teacher to update a whole class activity.')

    var activity = Activities.findOne(newActivity._id);
    if (!activity)
      throw new Meteor.Error('activityNotFound','Cannot update activity title.  Activity not found.');

    var fields = ['title','showStatus'];
    fields.forEach(function(field) {
      if ((field in newActivity) && (newActivity[field] != activity[field])) {
        var set = {};
        set[field] = newActivity[field];
        Activities.update(newActivity._id,{$set: set});
      }
    });
    return newActivity._id; 
  },
  
  /**** ACTIVITY SET TAG ****/
  activitySetTag: function(activityID,tag) {
    check(activityID,Match.idString);
    check(tag,String);
    tag = _.str.trim(tag);

    var cU = Meteor.user(); //currentUser
    if (!cU)  
      throw new Meteor.Error('notLoggedIn', "You must be logged in to update an activity");
    if (Roles.userIsInRole(cU,'parentOrAdvisor'))
      throw new Meteor.Error('parentNotAllowed', "Parents may only observe.  They cannot create new content.");
    if (!Roles.userIsInRole(cU,'teacher') && (cU._id != activity.studentID))
      throw new Meteor.Error('onlyTeacher', 'You must be a teacher to update a whole class activity.')

    var activity = Activities.findOne(activityID);
    if (!activity)
      throw new Meteor.Error('activityNotFound','Cannot update activity tag.  Activity not found.');

    if (tag != activity.tag)
      Meteor.call('insertTag',tag);
      return Activities.update(activityID,{$set: {tag:tag}});
  }
});

   /****************/
  /**** HOOKS *****/
 /****************/
 
Activities.after.update(function (userID, doc, fieldNames, modifier) {
  if (doc.unitID !== this.previous.unitID) {
    //denormalizing
    ActivityStatuses.update({activityID:this.previous._id},{$set: {unitID:doc.unitID}}, {multi: true});
    ActivityProgress.update({activityID:this.previous._id},{$set: {unitID:doc.unitID}}, {multi: true});
    WorkPeriods.update({activityID:this.previous._id},{$set: {unitID:doc.unitID}}, {multi: true});
    Walls.update({activityID:this.previous._id},{$set: {unitID:doc.unitID}}, {multi: true});
    Columns.update({activityID:this.previous._id},{$set: {unitID:doc.unitID}}, {multi: true});
    Blocks.update({activityID:this.previous._id},{$set: {unitID:doc.unitID}}, {multi: true});
    Files.update({activityID:this.previous._id},{$set: {unitID:doc.unitID}}, {multi: true});
  }
  if (doc.visible != this.previous.visible) 
    WorkPeriods.update({activityID:this.previous._id},{$set: {activityVisible:doc.visible}}, {multi: true});
  if (doc.showStatus != this.previous.showStatus) 
    WorkPeriods.update({activityID:this.previous._id},{$set: {activityShowStatus:doc.showStatus}}, {multi: true});
});

//check Walls, Columns, Blocks, Files
//insert, update, put server function to put in unit ID