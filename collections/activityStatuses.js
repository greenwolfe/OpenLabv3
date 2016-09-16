ActivityStatuses = new Meteor.Collection('ActivityStatuses');
ActivityStatuses.mutate = {};

//create or update status for this activity for this sectoin
//at end, calls itself with siteID to create status for whole class
//denormalized in: memberships, workPeriods, and here whenever student status is updated or inserted
//NOTE:  "status" appears to be a javascript, html, or windows reserved word
//and its use in this function threw an error when executing the stub in the browser
//should this type of error recur, consider switching from "status" to "actStatus" everywhere.
ActivityStatuses.mutate.updateSectionStatus = function(studentOrSectionID,activityOrAssessmentID) {
  check(studentOrSectionID,Match.idString); //studentID, sectionID, or siteID
  check(activityOrAssessmentID,Match.idString);

  var sectionID = null;
  if (Roles.userIsInRole(studentOrSectionID,'student')) {
    sectionID = Meteor.currentSectionId(studentOrSectionID);
  } else if (Sections.findOne(studentOrSectionID)) {
    sectionID = studentOrSectionID;
  }

  if (!sectionID)
    return; //throw error?
  var activity = Activities.findOne(activityOrAssessmentID);
  var assessment = Assessments.findOne(activityOrAssessmentID);
  if (!activity && !assessment)
    return; //throw error?
  var activityID = (activity) ? activity._id : null;
  var assessmentID = (assessment) ? assessment._id : null;

  var actStatus = { 
    studentsTotal: 0,     //total students in section
    studentsDone: 0,      //number of students whose status.level = done or doneWithComments
    studentsSubmitted: 0, //number of students whose status.level = submitted
    studentsReturned: 0,  //number of students whose status.level = returned
    studentsNotSubmitted: 0, //number of students who have no status yet
    studentsReSubmitted: 0, //number of students who are done, but chose to resubmit for teacher comments
    level: 'nostatus',
    lateStudents: [],     //[studentIDs]  IDs of students who have not yet submitted work after expected date has passed
    late: false           //true if due date has passed and some students still have not submitted their work, else false
  }

  //studentsTotal
  var sectionMemberIds = Meteor.sectionMemberIds(sectionID);
  actStatus.studentsTotal = sectionMemberIds.length;
  actStatus.studentsNotSubmitted = sectionMemberIds.length;
  var levels = _.pluck(ActivityStatuses.find({
    studentID:{$in:sectionMemberIds},
    activityID:activityID,
    assessmentID:assessmentID},
    {fields: {level: 1}}).fetch(),'level');

  if (levels.length) {
    //studentsDone
    actStatus.studentsDone = levels.reduce(function(n,l){
      return n + _.str.count(l,'done');
    },0)
    //studentsSubmitted
    actStatus.studentsSubmitted = levels.reduce(function(n,l){
      return n  + _.str.count(l,'submitted');
    },0)
    //studentsReturned
    actStatus.studentsReturned = levels.reduce(function(n,l){
      return n + _.str.count(l,'return');
    },0)
    actStatus.studentsResubmitted = levels.reduce(function(n,l){
      return n + _.str.count(l,'resubmitted');
    },0) //these students counted in both done and submitted above
    var firstSubmissionCount = actStatus.studentsSubmitted - actStatus.studentsResubmitted;
    //studentsNotSubmitted
    actStatus.studentsNotSubmitted = actStatus.studentsTotal - firstSubmissionCount - actStatus.studentsReturned - actStatus.studentsDone;

    //level
    if (actStatus.studentsSubmitted) { //at least one student has submitted something which the teacher has not yet returned
      actStatus.level = 'submitted';
    } else if (actStatus.studentsDone == actStatus.studentsTotal) { //every student marked done
      actStatus.level = 'done';
    } else if ((actStatus.studentsReturned) && (actStatus.studentsReturned + actStatus.studentsDone == levels.length)) { //teacher has returned all submissions
      actStatus.level = 'returned';
    }
  }

  //lateStudents and late
  var today = new Date();
  var workPeriod = WorkPeriods.findOne({
    activityID:activityID,
    sectionID:sectionID
  });
  var assessmentDate = AssessmentDates.findOne({
    assessmentID:assessmentID,
    secitonID:sectionID
  });
  if (  ((workPeriod) && (workPeriod.endDate) && (today > workPeriod.endDate))
      ||((assessmentDate) && (assessmentDate.testDate) && (today > assessmentDate.testDate))
      && (actStatus.studentsNotSubmitted)) {
    actStatus.late = true;
    var studentsOnTime = _.pluck(ActivityStatuses.find({
        studentID:{$in:sectionMemberIds},
        activityID:activityID,
        assessmentID: assessmentID,
        level:{$ne:'nostatus'}},
      {fields: {studentID: 1}}).fetch(),'studentID');
    actStatus.lateStudents = _.difference(sectionMemberIds,studentsOnTime);
  }

  var oldStatus = ActivityStatuses.findOne({sectionID:sectionID,activityID:activityID,assessmentID:assessmentID});
  if (oldStatus) {
    var id = ActivityStatuses.update(oldStatus._id,{$set:actStatus});
  } else { //no status exists yet, level has been displayed as 0 by default  
    var unitID = null;
    if (activity) {
      unitID = activity.unitID;
    } else if (assessment) {
      unitID = assessment.unitID;
    }
    var pointsTo = (activity) ? activity.pointsTo : null;
    _.extend(actStatus,{
      sectionID: sectionID,
      siteID: null,
      studentID: null,
      activityID:activityID,
      assessmentID:assessmentID,
      unitID: unitID,
      pointsTo: pointsTo,
      incrementedBy: sectionID, //in lieu of anything else because Meteor.userId() is not accessible a general helper that is not a method
      incrementedAt: today,
      increment: 0, 
      tag: ''
    });
    var id = ActivityStatuses.insert(actStatus);
  }
  ActivityStatuses.mutate.updateClassStatus(activityOrAssessmentID);
  return id;
}

ActivityStatuses.mutate.updateClassStatus = function(activityOrAssessmentID) {
  var activity = Activities.findOne(activityOrAssessmentID);
  var assessment = Assessments.findOne(activityOrAssessmentID);
  if (!activity && !assessment)
    return; //throw error?
  var activityID = (activity) ? activity._id : null;
  var assessmentID = (assessment) ? assessment._id : null;
  var siteID = Site.findOne()._id;

  var actStatus = { 
    studentsTotal: 0,     //total students in section
    studentsDone: 0,      //number of students whose status.level = done or doneWithComments
    studentsSubmitted: 0, //number of students whose status.level = submitted
    studentsReturned: 0,  //number of students whose status.level = returned
    studentsNotSubmitted: 0, //number of students who have no status yet
    studentsReSubmitted: 0, //number of students who are done, but chose to resubmit for teacher comments
    level: 'nostatus',
    lateStudents: [],     //[studentIDs]  IDs of students who have not yet submitted work after expected date has passed
    late: false           //true if due date has passed and some students still have not submitted their work, else false
  }

  var sectionIDs = _.pluck(Sections.find().fetch(),'_id')
  ActivityStatuses.find({activityID:activityID,assessmentID:assessmentID,sectionID:{$in:sectionIDs}}).forEach(function(sectionStatus) {
    actStatus.studentsTotal += sectionStatus.studentsTotal;
    actStatus.studentsDone += sectionStatus.studentsDone;
    actStatus.studentsSubmitted += sectionStatus.studentsSubmitted;
    actStatus.studentsReturned += sectionStatus.studentsReturned;
    actStatus.studentsNotSubmitted += sectionStatus.studentsNotSubmitted;
    actStatus.studentsResubmitted += sectionStatus.studentsResubmitted;
    actStatus.late = actStatus.late || sectionStatus.late;
    actStatus.lateStudents = _.union(actStatus.lateStudents,sectionStatus.lateStudents);
  })
  //level
  if (actStatus.studentsSubmitted) { //at least one student has submitted something which the teacher has not yet returned
    actStatus.level = 'submitted';
  } else if (actStatus.studentsDone == actStatus.studentsTotal) { //every student marked done
    actStatus.level = 'done';
  } else if ( (actStatus.studentsReturned + actStatus.studentsDone > 0) &&
              (actStatus.studentsReturned + actStatus.studentsDone + actStatus.studentsNotSubmitted - actStatus.studentsResubmitted == actStatus.studentsTotal) ) { //teacher has returned all submissions
    actStatus.level = 'returned';
  }

  var today = new Date();
  var oldStatus = ActivityStatuses.findOne({siteID:siteID,activityID:activityID,assessmentID:assessmentID});
  if (oldStatus) {
    var id = ActivityStatuses.update(oldStatus._id,{$set:actStatus});
  } else { //no status exists yet, level has been displayed as 0 by default  
    var unitID = null;
    if (activity) {
      unitID = activity.unitID;
    } else if (assessment) {
      unitID = assessment.unitID;
    }
    var pointsTo = (activity) ? activity.pointsTo : null;
    _.extend(actStatus,{
      sectionID: null,
      siteID: siteID,
      studentID: null,
      activityID:activityID,
      unitID: unitID,
      pointsTo: pointsTo,
      incrementedBy: siteID, //in lieu of anything else because Meteor.userId() is not accessible a general helper that is not a method
      incrementedAt: today,
      increment: 0, 
      tag: ''
    });
    var id = ActivityStatuses.insert(actStatus);
  }
}

Meteor.methods({
  incrementStatus: function(studentID,activityOrAssessmentID) {
    check(studentID,Match.idString);
    check(activityOrAssessmentID,Match.idString);
    var student = Meteor.users.findOne(studentID);
    if (!student)
      throw new Meteor.Error('studentNotFound','Cannot increment activity status.  Student not found.');
    if (!Roles.userIsInRole(student,'student'))
      throw new Meteor.Error('notStudent','Only students have activity status.');

    var activity = Activities.findOne(activityOrAssessmentID);
    var assessment = Assessments.findOne(activityOrAssessmentID);
    if (!activity && !assessment)
      return; //throw error?
    var activityID = (activity) ? activity._id : null;
    var assessmentID = (assessment) ? assessment._id : null;


    var cU = Meteor.user();
    if (!cU)
      throw new Meteor.Error('notLoggedIn','You must be logged in to increment an activity status.');
    var cUisStudent = Roles.userIsInRole(cU,'student');
    var cUisTeacher = Roles.userIsInRole(cU,'teacher');
    if (!cUisStudent && !cUisTeacher)
      throw new Meteor.Error('notTeacherOrStudent','You must be a teacher or a student to increment an activity status.');
    if (cUisStudent && (cU._id != student._id))
      throw new Meteor.Error('onlyChangeOwnStatus',"Only a teacher can change someone else's activity status.")

    var statuses = ['nostatus','submitted','returned','donewithcomments','done','donebutresubmitted']
    var oldStatus = ActivityStatuses.findOne({studentID:studentID,activityID:activityID,assessmentID:assessmentID});
    var oneMinuteAgo = moment().subtract(1,'minute').toDate();
    var rightNow = new Date();
    if (oldStatus) {
      var status = {increment:oldStatus.increment};
      var i = statuses.indexOf(oldStatus.level);
      doneIndex = statuses.length - 2;
      if (oldStatus.incrementedAt < oneMinuteAgo) status.increment = 1; //going up by default
      if (i == 0) status.increment = 1; //only way to go
      if (cUisTeacher) {
        if (i == doneIndex + 1) {
          status.increment = -1; //only way to go
        } else if (i == doneIndex) { /*DONE*/
          if ((status.increment == 1) && !status.late) {
            status.late = true; //mark as late (can mark as on time again by clicking on late icon)
            status.increment = 0; //and don't increment this time
          } else {
            status.increment = -1; //teacher goes back down rather than on up to resubmit
          } 
        }
      } else if (cUisStudent) {
        if (i == doneIndex + 1) /*DONEBUTRESUBMITED*/ status.increment = -1; //if marked resubmit, then another click goes back to done
        if (i == doneIndex)     /*DONE*/              status.increment =  1;  //clicking on done sends it up to resubmit
        if (i == doneIndex - 1) /*DONEWITHCOMMENTS*/  status.increment =  1;  //student can increment from donewithcomments to done, but cannot decrement from here
        if (i == doneIndex - 2) /*RETURNED*/          status.increment = -1; //teacher returned work, so student decrements to indicate they are working on revisions or have submitted them
        if (i == doneIndex - 3) /*SUBMITTED*/         status.increment = -1; //only teacher marks as returned or done
      }
      status.level = statuses[i + status.increment];
      status.incrementedBy = cU._id;
      status.incrementedAt = new Date();
      return ActivityStatuses.update(oldStatus._id,{$set:status},function() {
        if (Meteor.isServer) {
          Meteor.defer(function() {
            ActivityStatuses.mutate.updateSectionStatus(studentID,activityID);
          });
        }
      });
    } else { //no status exists yet, level has been displayed as 0 by default  
      var unitID = null;
      if (activity) {
        unitID = activity.unitID;
      } else if (assessment) {
        unitID = assessment.unitID;
      }
      var pointsTo = (activity) ? activity.pointsTo : null;
      status = {
        studentID:studentID,
        activityID:activityID,
        assessmentID: assessmentID,
        unitID: unitID,
        pointsTo: pointsTo,
        level: statuses[1], //First increment sets it to level 1 
        incrementedBy: cU._id,
        incrementedAt: rightNow,
        increment: 1, //+1 or -1 to show direction of latest travel
        late: false,
        tag: '',
      }
      return ActivityStatuses.insert(status,function() {
        ActivityStatuses.mutate.updateSectionStatus(studentID,activityOrAssessmentID);
      });
    }
  },
  //late icon appears at end of increment Status sequence
  //therefore no separate markAsLate method
  //once the late icon is present, clicking on it should call markOnTime
  markOnTime: function(studentID,activityOrAssessmentID) {
    check(studentID,Match.idString);
    check(activityOrAssessmentID,Match.idString);
    var student = Meteor.users.findOne(studentID);
    if (!student)
      throw new Meteor.Error('studentNotFound','Cannot mark activity on time.  Student not found.');
    if (!Roles.userIsInRole(student,'student'))
      throw new Meteor.Error('notStudent','Only students have activity status.');

    var activity = Activities.findOne(activityOrAssessmentID);
    var assessment = Assessments.findOne(activityOrAssessmentID);
    if (!activity && !assessment)
      return; //throw error?
    var activityID = (activity) ? activity._id : null;
    var assessmentID = (assessment) ? assessment._id : null;

    var cU = Meteor.user();
    if (!cU)
      throw new Meteor.Error('notLoggedIn','You must be logged in to mark an activity on time.');
    if (!Roles.userIsInRole(cU,'teacher'))
      throw new Meteor.Error('notTeacher','You must be a teacher to mark an activity on time.');

    var status = ActivityStatuses.findOne({studentID:studentID,activityID:activityID,assessmentID:assessmentID});
    if (!status) 
      throw new Meteor.Error('statusNotFound','There should already be a status if you are trying to mark it as on time.'); 
    
    ActivityStatuses.update(status._id,{$set: {late:false}},function() {
      if (Meteor.isServer) {
        Meteor.defer(function() {
          ActivityStatuses.mutate.updateSectionStatus(studentID,activityOrAssessmentID);
        });
      }
    });
  },
  statusSetTag: function(studentID,activityOrAssessmentID,tag) {
    check(studentID,Match.idString);
    check(activityOrAssessmentID,Match.idString);
    check(tag,String);
    var student = Meteor.users.findOne(studentID);
    if (!student)
      throw new Meteor.Error('studentNotFound','Cannot designate activity as a reassessment.  Student not found.');
    if (!Roles.userIsInRole(student,'student'))
      throw new Meteor.Error('notStudent','Only students have activity status.');


    var activity = Activities.findOne(activityOrAssessmentID);
    var assessment = Assessments.findOne(activityOrAssessmentID);
    if (!activity && !assessment)
      return; //throw error?
    var activityID = (activity) ? activity._id : null;
    var assessmentID = (assessment) ? assessment._id : null;

    var cU = Meteor.user();
    if (!cU)
      throw new Meteor.Error('notLoggedIn','You must be logged in to designate an activity as a reassessment.');
    if (!Roles.userIsInRole(cU,'teacher'))
      throw new Meteor.Error('notTeacher','You must be a teacher to designate an activity as a reassessment.');

    var status = ActivityStatuses.findOne({studentID:studentID,activityID:activityID,assessmentID:assessmentID});
    var rightNow = new Date();
    if (!status) {
      var unitID = null;
      if (activity) {
        unitID = activity.unitID;
      } else if (assessment) {
        unitID = assessment.unitID;
      }
      var pointsTo = (activity) ? activity.pointsTo : null;
      status = {
        studentID:studentID,
        activityID:activityID,
        assessmentID: assessmentID,
        unitID: unitID,
        pointsTo: pointsTo,
        level: 'nostatus',  
        incrementedBy: cU._id,
        incrementedAt: rightNow,
        increment: 1, //+1 or -1 to show direction of latest travel
        late: false,
        tag: tag
      }
      Meteor.call('insertTag',tag);
      return ActivityStatuses.insert(status);
    } else {
      Meteor.call('insertTag',tag);
      ActivityStatuses.update(status._id,{$set: {tag:tag}});
    }
  }
})