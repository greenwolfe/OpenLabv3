SlideStars = new Meteor.Collection('SlideStars')

/* when teacher views as student or section, have a row
of student stars and another of teacher stars.  If teacher
clicks on teacher stars, the teacher's ID is added to access and
a slideStar is created for them, putting that block in their individual
stack of slides. */
Meteor.methods({
  setSlideStar: function(userID,blockID,value) {
    check(userID,Match.idString);
    check(blockID,Match.idString);
    check(value,Match.Integer);
    if ((value <= 0) || (value > 7))
      throw new Meteor.Error('outOfRange','Out of range.  A slide can be ranked from 1 to 7 stars.');
    var user = Meteor.users.findOne(userID);
    if (!user)
      throw new Meteor.Error('userNotFound','Cannot rank slide with stars.  User not found.');
    var userIsStudent = Roles.userIsInRole(user,'student');
    var userIsTeacher = Roles.userIsInRole(user,'teacher');
    if (!userIsStudent && !userIsTeacher)
      throw new Meteor.Error('notStudentOrTeacher','Only students or a teacher have a stack of slides to rank with stars.');
    var block = Blocks.findOne(blockID);
    if (!block)
      throw new Meteor.Error('blockNotFound','Cannot increment stars for slide.  Block not found.');
    var cU = Meteor.user();
    if (!cU)
      throw new Meteor.Error('notLoggedIn','You must be logged in to rank a slide with stars.');
    var cUisStudent = Roles.userIsInRole(cU,'student');
    var cUisTeacher = Roles.userIsInRole(cU,'teacher');
    if (!cUisStudent && !cUisTeacher)
      throw new Meteor.Error('notTeacherOrStudent','You must be a teacher or a student to rank a slide with stars.');
    if (cUisStudent && (cU._id != user._id))
      throw new Meteor.Error('onlyChangeOwnStar',"Only a teacher can change someone else's stars rating of slides.")
    if (cUisTeacher && userIsTeacher && cU._id != user._id)
      throw new Meteor.Error('onlyChangeOwnStar',"A teacher cannot change another teacher's stars rating of slides.")

    var slideStar = SlideStars.findOne({userID:userID,blockID:blockID});
    var rightNow = new Date();
    if (slideStar) {
      SlideStars.update(slideStar._id,{$set:{
        value:value,
        incrementedBy: cU._id,
        incrementedAt: rightNow
      }});
    } else { //no progress exists yet, level has been displayed as 0 by default  
      if (cUisTeacher && userIsTeacher) { //add to teachers stack
        Blocks.update(blockID,{$addToSet:{access:userID}});
        Files.update({blockID:blockID},{$addToSet:{access:userID}},{multi:true});
      }
      slideStar = {
        userID:userID,
        blockID:blockID,
        columnID: block.columnID,
        wallID: block.wallID,
        activityID: block.pointsTo,
        unitID: block.unitID,
        access: block.access,
        value: value, 
        incrementedBy: cU._id,
        incrementedAt: rightNow,
      }
      return SlideStars.insert(slideStar);
    }
  }
})