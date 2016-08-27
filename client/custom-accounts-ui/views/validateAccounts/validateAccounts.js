Template._renderedInstancesOfEditProfileForm = [];

Template.onRendered(function() {
  if (this.view.name == "Template.editProfileForm") {
    Template._renderedInstancesOfEditProfileForm.push(this);
  }
})

Template.onDestroyed(function() {
  if (this.view.name == "Template.editProfileForm") {
    var i = Template._renderedInstancesOfEditProfileForm.indexOf(this);
    if (i > -1) {
      Template._renderedInstancesOfEditProfileForm.splice(i, 1);
    }
  }
})

Template.validateAccounts.helpers({
  helpMessages: function() { 
    return [
      "Edit each user's profile to correct any errors before sending an email (<a href='#' class='glyphicon glyphicon-send'></a>) allowing them to validate their account.",
      'For all users, make sure the e-mail they submitted is the same one they registered with the school.',
      'For students, check that they have requested the correct section.',
      'After ensuring parents and advisors are allowed to observe the students they have requested, click the verify button (<a href="#" class="glyphicon glyphicon-ok"></a>) to permit access.',
      "If the student's name is not found, make sure the student has an account, and the parent/advisor entered the student's name exactly as the student did when creating their account.  After successfully submitting a new request, you can delete the old one.",
      'When you are sure all of the information is valid, click the send button (<a href="#" class="glyphicon glyphicon-send"></a>).  The user will receive an e-mail with a link returning them to this web site and allowing them to set their password.  They cannot log in until they have a password.',
      'You do not have to send a validation email again if a parent or advisor is already validated and has just requested to observe another student.'
    ]
  },
  users: function() {
    var users = Meteor.users.find().fetch();
    users = users.filter(function(user) {
      var verified = false;
      //require at least one verified email
      if ('emails' in user) {
        user.emails.forEach(function(email) {
          verified = verified || email.verified;
        });
      } else { //emails haven't come through yet, don't show
        verified = true;
      }
      //require all childrenOrAdvisees verified
      if (Roles.userIsInRole(user,'parentOrAdvisor')) {
         if ('childrenOrAdvisees' in user) {
          user.childrenOrAdvisees.forEach(function(student) {
            verified = verified && student.verified;
          });
        } else { //childrenOrAdvisees hasn't come through yet, don't show
          verified = true;
        }
      }
      return !verified;  //keep only users without a verified email
    })
    return users;
  }
})

Template.validateAccounts.events({
  'click button#login-buttons-send-all-vemails': function(event,template) {
    event.stopPropagation();
    Template._renderedInstancesOfEditProfileForm.forEach(function(tmpl) {
      console.log('sending e-mail for ' + tmpl.data.username);
      var user = tmpl.data;
      Meteor.call('sendEnrollmentEmail',user._id,function(error) {
        if (error) {
          tmpl.Session.set('message',{type:'danger',text:error.reason || 'Could not send enrollment e-mail.  Unknown error.'});
        } else {
          tmpl.Session.set('message',{type:'success',text:'Enrollment e-mail sent.'});
        }
      });
    })
  }
})