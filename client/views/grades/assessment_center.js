  /***************************/
 /**** ASSESSMENT CENTER ****/
/***************************/

Template.assessmentCenter.onCreated(function() {
  var instance = this;
  instance.assessmentIDs = new ReactiveVar([]);
  //gradesPageSession.activeAssessmentID
  instance.pastDate = new ReactiveVar(moment().subtract(2,'weeks').toDate());
  instance.futureDate = new ReactiveVar(moment().add(2,'weeks').toDate());
})

  //NOTE: set limits on datepickers so can't select a date that
  //excludes the assessment currently being viewed
Template.assessmentCenter.onRendered(function() {
  instance = this;

  instance.autorun(function() { //subscribe and then fill assessmentIDs list
    var cU = Meteor.userId();
    var siteID = Site.findOne()._id;
    var studentID = Meteor.impersonatedOrUserId();
    var sectionID = Meteor.selectedSectionId();
    var pastDate = instance.pastDate.get();
    var futureDate = instance.futureDate.get();
    if ((pastDate) && (futureDate))
      instance.subscribe('assessments',pastDate,futureDate,studentID);

    if (instance.subscriptionsReady()) { //change list of assessmentIDs accordingly
      //find _ids of all assessments to which user has access
      if (Roles.userIsInRole(cU,'teacher')) {
        if (studentID) {
          var selector = {createdFor:{$in:[siteID,studentID]}};
        } else {
          var selector = {createdFor:siteID};
        }
      } else { //student or parent
        if (studentID) {
          var selector = {$or:[
            {createdFor:siteID,visible:true},
            {createdFor:studentID}
          ]}
        } else {
          var selector = {createdFor:siteID,visible:true};
        }
      }
      var assessmentIDs = _.pluck(Assessments.find(selector,{fields:{_id:1}}).fetch(),'_id');
      //sort them in ascending order by date
      selector = {assessmentID:{$in:assessmentIDs}};
      if (sectionID)
        selector.sectionID = sectionID;   
      assessmentIDs = _.pluck(AssessmentDates.find(selector,{fields:{assessmentID:1}},{sort:{testDate:1}}).fetch(),'assessmentID');
      assessmentIDs = _.unique(assessmentIDs);
      instance.assessmentIDs.set(assessmentIDs);
    }
  })

  instance.autorun(function() { //reset activeAssessmentID if necessary
    if (instance.subscriptionsReady()) { 
      var assessmentIDs = instance.assessmentIDs.get(); 
      var activeAssessmentID = gradesPageSession.get('activeAssessmentID');

      if ((!activeAssessmentID) || !_.contains(assessmentIDs,activeAssessmentID)) {
        var today = moment().hours(0).minutes(0).seconds(0).toDate();
        selector = {  //search for nearest upcoming assessment
          testDate: {$gte:today},
          assessmentID: {$in:assessmentIDs}
        }
        var sectionID = Meteor.selectedSectionId();
        if (sectionID)
          selector.sectionID = sectionID;
        var assessmentDate = AssessmentDates.findOne(selector,{sort:{testDate:1}});
        if (!assessmentDate) { //else search for most recent past assessment
          today = moment().hours(23).minutes(59).seconds(59).toDate();
          selector.testDate = {$lte:today};
          assessmentDate = AssessmentDates.findOne(selector,{sort:{testDate:-1}});
        }
        //find both and choose whichever is closest to today's date instead?
        var activeAssessmentID = (assessmentDate) ? assessmentDate.assessmentID : null;
        gradesPageSession.set('activeAssessmentID',activeAssessmentID);
      }
    }
  })
})

Template.assessmentCenter.helpers({
  assessmentsCount: function() {
    var instance = Template.instance();
    return instance.assessmentIDs.get().length;
  },
  assessmentNumber: function() {
    var instance = Template.instance();
    var activeAssessmentID = gradesPageSession.get('activeAssessmentID');
    var assessmentIDs = instance.assessmentIDs.get();
    return assessmentIDs.indexOf(activeAssessmentID) + 1;
  },
  viewingAsStudent: function() {
    var studentID = Meteor.impersonatedOrUserId();
    return Roles.userIsInRole(studentID,'student');
  }
})

Template.assessmentCenter.events({
  'click .createAssessment': function(event,tmpl) {
    event.preventDefault();
    Meteor.call('insertAssessment',Site.findOne()._id,function(error,id) {
      if (error) {
        alert(error.reason);
      } else {
        var assessmentIDs = tmpl.assessmentIDs.get();
        tmpl.assessmentIDs.set(_.union(assessmentIDs,[id]));
        gradesPageSession.set('activeAssessmentID',id);
      }
    });
  },
  'click .createReassessment': function(event,tmpl) {
    event.preventDefault();
    Meteor.call('insertAssessment',Meteor.impersonatedOrUserId(),function(error,id) {
      if (error) {
        alert(error.reason);
      } else {
        var assessmentIDs = tmpl.assessmentIDs.get();
        tmpl.assessmentIDs.set(_.union(assessmentIDs,[id]));
        gradesPageSession.set('activeAssessmentID',id);
      }
    });
  },
  'click i.fa-step-forward': function(event,tmpl) {
    var assessmentIDs = tmpl.assessmentIDs.get();
    var activeAssessmentID = gradesPageSession.get('activeAssessmentID');
    var index = assessmentIDs.indexOf(activeAssessmentID);
    if (index < assessmentIDs.length - 1)
      gradesPageSession.set('activeAssessmentID',assessmentIDs[index + 1]);
  },
  'click i.fa-step-backward': function(event,tmpl) {
    var assessmentIDs = tmpl.assessmentIDs.get();
    var activeAssessmentID = gradesPageSession.get('activeAssessmentID');
    var index = assessmentIDs.indexOf(activeAssessmentID);
    if (index > 0)
      gradesPageSession.set('activeAssessmentID',assessmentIDs[index - 1]);
  },
  'click i.fa-fast-backward': function(event,tmpl) {
    var assessmentIDs = tmpl.assessmentIDs.get();
    gradesPageSession.set('activeAssessmentID',assessmentIDs[0]);
  },
  'click i.fa-fast-forward': function(event,tmpl) {
    var assessmentIDs = tmpl.assessmentIDs.get();
    gradesPageSession.set('activeAssessmentID',_.last(assessmentIDs));
  }
})

  /********************/
 /**** ASSESSMENT ****/
/********************/

var dateTimeFormat = "ddd, MMM D YYYY [at] h:mm a";

Template.assessment.onCreated(function() {
  var instance = this;
  instance.editingAssessment = new ReactiveVar(false);
})

Template.assessment.helpers({
  editingAssessment: function() {
    var instance = Template.instance();
    return instance.editingAssessment.get();
  },
  canEditAssessment: function() {
    var cU = Meteor.userId();
    return (
      (Roles.userIsInRole(cU,'teacher'))  ||
     (Roles.userIsInRole(cU,'student') && (cU == this.createdFor))
    )
  },
  editDone: function() {
    var instance = Template.instance();
    var editingAssessment = instance.editingAssessment.get();
    var cU = Meteor.userId();
    if (Roles.userIsInRole(cU,'teacher')) 
      return (editingAssessment) ? 'Done' : 'Edit';
    if (Roles.userIsInRole(cU,'student') && (cU == this.createdFor))
      return (editingAssessment) ? 'Done' : 'Edit';
  },
  assessmentDate: function() {
    var sectionID = Meteor.selectedSectionId();
    if (sectionID) {
      return AssessmentDates.findOne({
        assessmentID:this._id,
        sectionID:sectionID
      })
    } else {
      return AssessmentDates.findOne({
        assessmentID:this._id
      },{
        sort:{testDate:1}
      });
    }
  },
  formatDateTime: function(date) {
    return ((Match.test(date,Date)) && !dateIsNull(date)) ? moment(date).format(dateTimeFormat) : '_____';
  },
  unit: function() {
    return Units.findOne(this.unitID);
  },
  units: function() {
    return Units.find({visible:true});
  }
})

Template.assessment.events({
  'click .editAssessment.Done': function(event,tmpl) {
    tmpl.editingAssessment.set(false);
  },
  'click .editAssessment.Edit': function(event,tmpl) {
    tmpl.editingAssessment.set(true);
  }
})

  /************************/
 /**** NO ASSESSMENTS ****/
/************************/

Template.noAssessments.helpers({
  viewingAsStudent: function() {
    var studentID = Meteor.impersonatedOrUserId();
    return Roles.userIsInRole(studentID,'student');
  }  
})

Template.noAssessments.events({
  'click button.createAssessment': function(event,tmpl) {
    event.preventDefault();
    event.stopPropagation();
    var siteID = Site.findOne()._id;
    Meteor.call('insertAssessment',siteID,function(error,id) {
      if (error) {
        alert(error.reason);
      } else {
        gradesPageSession.set('activeAssessmentID',id);
      }
    });
  },
  'click .createReassessment': function(event,tmpl) {
    event.preventDefault();
    event.stopPropagation();
    Meteor.call('insertAssessment',Meteor.impersonatedOrUserId(),function(error,id) {
      if (error) {
        alert(error.reason);
      } else {
        gradesPageSession.set('activeAssessmentID',id);
      }
    });
  }
})

  /******************************/
 /**** EDIT ASSESSMENT DATE ****/
/******************************/

var dateTimeFormat = "ddd, MMM D YYYY [at] h:mm a";

Template.editAssessmentDate.onCreated(function() {
  var instance = this;
  instance.copyColor = new ReactiveVar('');
  instance.copyMessage = new ReactiveVar('Copy start date and/or deadline to all sections.');

  instance.autorun(function() {
    if (instance.copyColor.get() == 'green') {
      instance.copyMessage.set("Start date and/or deadline copied to all sections.");
    } else {
      instance.copyMessage.set("Copy start date and/or deadline to all sections.");
    }
  });
})

Template.editAssessmentDate.onRendered(function() {
  var instance = this;
  var $calIcon = instance.$('.testDatePicker .glyphicon-calendar');
  var aD = Template.currentData();
  var options = {
    showClose:  true,
    showClear: true,
    keepOpen: false,
    format: dateTimeFormat,
    toolbarPlacement: 'top',
    sideBySide: true,
    widgetParent: $calIcon,
    defaultDate: aD.testDate || false,
    useCurrent: false,
    keyBinds: {enter: function(widget) {
      if (widget.find('.datepicker').is(':visible')) {
        this.hide();
      } else {
        this.date(widget.find('.datepicker').val());
      }
    }}
  }
  instance.$('.testDatePicker').datetimepicker(options);
})

Template.editAssessmentDate.helpers({
  assessmentDate: function() {
    var sectionID = Meteor.currentSectionId();
    if (sectionID) {
      return AssessmentDates.findOne({
        assessmentID:this._id,
        sectionID:sectionID
      })
    } else {
      return AssessmentDates.findOne({
        assessmentID:this._id
      },{
        sort:{testDate:1}
      });
    }
  },
  formatDateTime: function(date) {
    return ((Match.test(date,Date)) && !dateIsNull(date)) ? moment(date).format(dateTimeFormat) : '_____';
  },
  copyColor: function() {
    var instance = Template.instance();
    return instance.copyColor.get();
  },
  copyMessage: function() {
    var instance = Template.instance();
    return instance.copyMessage.get();
  },
  isReassessment: function() {
    return Meteor.users.find(this.createdFor).count();
  },
  section: function() {
    return Meteor.selectedSectionId();
  }
})

Template.editAssessmentDate.events({
  'dp.change .testDatePicker': function(event,tmpl) {
    var aD = this;
    if (event.date && !event.date.isSame(aD.testDate,'second')) {
      aD.testDate = event.date.toDate();
      Meteor.call('setAssessmentDate',aD,function(error,id) {
        if (error) {
          alert(error.reason);
        } else {
          tmpl.copyColor.set('blue');
        }
      });
    } 
  },
  'click i.fa-copy': function(event,tmpl) {
    var aD = this;
    aD.sectionID = 'applyToAll';
    Meteor.call('setAssessmentDate',aD,function(error,id) {
      if (error) {
        alert(error.reason);
      } else {
        tmpl.copyColor.set('green');
      }
    });
  }
})

  /***********************/
 /**** UNIT SELECTOR ****/
/***********************/

Template.unitSelector.helpers({
  'bgPrimary': function() {
    var assessment = Template.parentData();
    return (assessment.unitID == this._id) ? 'bg-primary' : '';
  }
})

Template.unitSelector.events({
  'click .unitSelector': function(event,tmpl) {
    event.preventDefault();
    var assessment = Template.parentData();

    Meteor.call('updateAssessment',{
      _id: assessment._id,
      unitID: this._id
    });
  }
})