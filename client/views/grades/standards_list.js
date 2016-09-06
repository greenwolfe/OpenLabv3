  /************************/
 /*** STANDARDS LIST  ****/
/************************/

Template.standardsList.onRendered(function() {
  $('.fa.fa-question-circle[data-toggle="tooltip"]').tooltip();
});

Template.standardsList.helpers({
  categories: function() {
    var selector = {};
    if (!editingMainPage())
      selector.visible = true; //show only visible categories
    return Categories.find(selector,{sort: {order: 1}});
  },
  sortableOpts: function() {
    return {
      draggable:'.categorytitle',
      handle: '.sortCategory',
      collection: 'Categories',
      selectField: 'app', //selects all categories
      selectValue: 'openlab', //as openlab is only allowed value of app field
      disabled: !editingMainPage() 
    }
  }
});

  /*************************/
 /**** CATEGORY TITLE  ****/
/*************************/

Template.categoryTitle.helpers({
  active: function() {
    var activeCategory = openlabSession.get('activeCategory');
    return (this._id == activeCategory) ? 'active' : '';
  },
  active2: function() {
    return (this._id == openlabSession.get('activeCategory2')) ? 'active2':'';
  },
  hidden: function() {
    var activeCategory = openlabSession.get('activeCategory');
    var activeCategory2 = openlabSession.get('activeCategory2');
    return ((this._id == activeCategory) || (this._id == activeCategory2)) ? '' : 'hidden';
  },
  percentExpected: function() { 
    return percentExpected(Meteor.selectedSectionId());
  },
  percentCompleted: function() { 
    var studentID = Meteor.impersonatedOrUserId();
    if (!Roles.userIsInRole(studentID,'student'))
      return 0;
    var selector = {
      categoryID: this._id,
      visible: true //only visible standards count
    }
    var standards = Standards.find(selector).fetch();
    var total = standards.length;
    if (total == 0)
      return 0;
    standards = standards.filter(function(standard) {
      var LoM = LevelsOfMastery.findOne({standardID:standard._id,studentID:studentID});
      if (!LoM) return false;
      var level = LoM.average.schoolyear; //edit to select grading period when available
      if (_.isArray(standard.scale)) {
        var index = standard.scale.indexOf(level);
        return (index == standard.scale.length - 1);
      } else {
        return (level*100/standard.scale > 88);
      }
    });
    return standards.length*100/total;
  },
  roundFlat: function() {
    var assessmentID = gradesPageSession.get('activeAssessmentID');
    if (!assessmentID)
      return '';
    var selector = {
      categoryID: this._id
    };
    if (!editingMainPage())
      selector.visible = true; //show only visible activities
    var standardIDs = _.pluck(Standards.find(selector,{sort: {order: 1}}).fetch(),'_id'); 
    if (!standardIDs.length)
      return 'flat';
    var assessmentStandardsCount = AssessmentStandards.find({assessmentID:assessmentID,standardID:{$in:standardIDs}}).count();
    return (assessmentStandardsCount) ? 'round' : 'flat';
  }
});

Template.categoryTitle.events({
  'click li > a': function(event,tmpl) {
    event.preventDefault();
    if (event.ctrlKey) {
      var activeCategory2 = openlabSession.get('activeCategory2');
      var activeCategory = openlabSession.get('activeCategory');
      if (tmpl.data._id == activeCategory2) {
        openlabSession.set('activeCategory2',null);
      } else if (tmpl.data._id == activeCategory){
        return;
      } else if ((activeCategory2) && (tmpl.data._id == activeCategory)) {
        openlabSession.set('activeCategory',activeCategory2);
        openlabSession.set('activeCategory2',null);
      } else {
        openlabSession.set('activeCategory2',tmpl.data._id);
      }
    } else {
      openlabSession.set('activeCategory',tmpl.data._id);
      if (tmpl.data._id == openlabSession.get('activeCategory2'))
        openlabSession.set('activeCategory2',null);
    }
  },
  'dragstart li > a': function(event,tmpl) {
    //bootstrap navs are draggable by default
    //disabling this behavior so you have to grab
    //the draggable handle to sort the categories
    event.preventDefault();
  }
})

  /*****************************/
 /** STANDARD LIST HEADER  ****/
/*****************************/

Template.standardListHeader.helpers({
  colWidth: function() {
    return openlabSession.get('activeCategory2') ? 'col-md-6' : 'col-md-12';
  },
  bgsuccess: function() {
    return openlabSession.get('activeCategory2') ? 'bgsuccess' : 'bgprimary';
  },
  bgprimary: function() {
    //return 'bgprimary';
    return openlabSession.get('activeCategory2') ? 'bgprimary' : '';
  },
  percentExpected: function() { 
    return percentExpected(Meteor.selectedSectionId());
  },
  percentCompleted: function() { 
    var studentID = Meteor.impersonatedOrUserId();
    if (!Roles.userIsInRole(studentID,'student'))
      return 0;
    var selector = {
      categoryID: this._id,
      visible: true //only visible standards count
    }
    var standards = Standards.find(selector).fetch();
    var total = standards.length;
    if (total == 0)
      return 0;
    standards = standards.filter(function(standard) {
      var LoM = LevelsOfMastery.findOne({standardID:standard._id,studentID:studentID});
      if (!LoM) return false;
      var level = LoM.average.schoolyear; //edit to select grading period when available
      if (_.isArray(standard.scale)) {
        var index = standard.scale.indexOf(level);
        return (index == standard.scale.length - 1);
      } else {
        return (level*100/standard.scale > 88);
      }
    });
    return standards.length*100/total;
  }
});


  /*************************/
 /** STANDARD LIST  *******/
/*************************/

Template.standardList.helpers({
  colWidth: function() {
    return openlabSession.get('activeCategory2') ? 'col-md-6' : 'col-md-12';
  },
  standards0: function() {
    var selector = {
      categoryID: this._id
    };
    if (!editingMainPage())
      selector.visible = true; //show only visible activities
    return Standards.find(selector,{sort: {order: 1}}); 
  },
  standards2: function() {
    var activeCategory2 = openlabSession.get('activeCategory2');
    var selector = {
      categoryID: this._id
    };
    if (!editingMainPage())
      selector.visible = true; //show only visible activities
    return Standards.find(selector,{sort: {order: 1}}); 
  },
  bgsuccess: function() {
    return openlabSession.get('activeCategory2') ? 'bgsuccess' : '';
  },
  bgprimary: function() {
    //return 'bgprimary';
    return openlabSession.get('activeCategory2') ? 'bgprimary' : '';
  },
  sortableOpts2: function() {
    var activeCategory2 = openlabSession.get('activeCategory2');
    return {
      draggable:'.sItem',
      handle: '.sortStandard',
      group: 'standardColumn',
      collection: 'Standards',
      selectField: 'categoryID',
      selectValue: activeCategory2,
      disabled: !editingMainPage() //currently not working
      //disabled: (!Session.get('editedWall')), //!= this.wallID to apply to a single wall 
    }    
  },
  sortableOpts: function() {
    return {
      draggable:'.sItem',
      handle: '.sortStandard',
      group: 'standardColumn',
      collection: 'Standards',
      selectField: 'categoryID',
      selectValue: this._id,
      //disabled: !editingMainPage() //currently not working
      //disabled: (!Session.get('editedWall')), //!= this.wallID to apply to a single wall 
    }
  }
});


  /*************************/
 /** STANDARD ITEM  *******/
/*************************/

var dateTimeFormat = "ddd, MMM D YYYY [at] h:mm a";

Template.standardItem.onRendered(function() {
  instance = this;
  instance.$('[data-toggle="tooltip"]').tooltip();
})

Template.standardItem.helpers({
  latestLoM: function() {
    var studentID = Meteor.impersonatedOrUserId();
    var standard = this;
    if (!studentID || !standard)
      return false;
    return LevelsOfMastery.findOne({ 
      studentID:studentID,
      standardID:standard._id,
      visible:true },{
      sort:{submitted:-1}
    });
  },
  standardDate: function() {
    var selector = {standardID:this.standardID};
    var sectionID = Meteor.selectedSectionId();
    if (sectionID) {
      selector.sectionID = sectionID;
      var standardDate = StandardDates.findOne(selector);
    } else {
      var standardDate = StandardDates.findOne(selector,{sort:{masteryExpected:-1}});
    }
    if ((standardDate) && (standardDate.masteryExpected < wayWayInTheFuture()))
      return standardDate;
    return '';
  },
  upcomingExpected: function() {
    var today = new Date();
    var aWeekFromNow = moment().add(1,'week').toDate();
    if ((today < this.masteryExpected) && (this.masteryExepcted < aWeekFromNow))
      return 'upcoming';
    if (this.masteryExpected < today)
      return 'expected';
    return '';
  },
  formatDateTime: function(date) {
    return ((Match.test(date,Date)) && !dateIsNull(date)) ? moment(date).format(dateTimeFormat) : '_____';
  },
  roundFlat: function() {
    var assessmentID = gradesPageSession.get('activeAssessmentID');
    if (!assessmentID)
      return '';
    var assessmentStandard = AssessmentStandards.findOne({assessmentID:assessmentID,standardID:this._id});
    return (assessmentStandard) ? 'round' : 'flat';
  }
});

Template.standardItem.events({
  'click p.sItem.flat': function(event,tmpl) {
    var addingStandards = gradesPageSession.get('addingStandards');
    var assessmentID = gradesPageSession.get('activeAssessmentID'); 
    if (!addingStandards || !assessmentID)
      return;
    Meteor.call('assessmentAddStandard',{
      assessmentID: assessmentID,
      standardID: this._id
    },alertOnError);
  },
  'click p.sItem.round': function(event,tmpl) {
    var addingStandards = gradesPageSession.get('addingStandards');
    var assessmentID = gradesPageSession.get('activeAssessmentID'); 
    if (!addingStandards || !assessmentID)
      return;
    var assessmentStandard = AssessmentStandards.findOne({
      assessmentID: assessmentID,
      standardID: this._id
    });
    if (assessmentStandard) {
      Meteor.call('assessmentRemoveStandard',assessmentStandard._id,alertOnError);
    }
  }  
})

  /*************************************/
 /**** LoM BADGE FOR STANDARD ITEM ****/
/*************************************/

Template.LoMbadgeForStandardItem.onRendered(function() {
  instance = this;
  var $tooltipElements = instance.$('[data-toggle="tooltip"]');
  $tooltipElements.tooltip(); 
})

Template.LoMbadgeForStandardItem.helpers({
  LoMAveragecolorcode: function() {
    var studentID = Meteor.impersonatedOrUserId();
    var LoM = this;
    if (!LoM) return '';
    var standard = Standards.findOne(LoM.standardID);
    if (!studentID || !standard)
      return '';
    return Meteor.LoMcolorcode(LoM.average['schoolyear'],standard.scale);
    //update for grading period when available
  },
  LoMAveragetext: function() {
    var studentID = Meteor.impersonatedOrUserId();
    var LoM = this;
    if (!LoM) return '';
    var standard = Standards.findOne(LoM.standardID);
    if (!studentID || !standard)
      return '';
    if (_.isArray(standard.scale))
      return LoM.average['schoolyear']; //update for grading period when available 
    return +LoM.average['schoolyear'].toFixed(2) + ' out of ' + standard.scale;
  },
  latestComment: function() {
    var studentID = Meteor.impersonatedOrUserId();
    var LoM = this;
    if (!LoM) return '';
    var standard = Standards.findOne(LoM.standardID);
    if (!studentID || !standard)
      return '';
    var justTheText = _.str.clean(
      _.str.stripTags(
        _.unescapeHTML(
          LoM.comment.replace(/&nbsp;/g,'')
    )));
    if (justTheText) {
      var comment = "<span class='h5'>Latest Comment:</span> " + LoM.comment;
    } else {
      var comment = "<span class='h5'>No Comment:</span> Teacher left no comment on most recent assessment.";
    }
    var humanizedScaleHelp = (_.isFinite(standard.scale)) ? '0 to ' + standard.scale : standard.scaleHelp;
    return "<div class='text-left'>" + comment + "<hr class='no-margin no-pad'>" + humanizedScaleHelp + "</div>";
  }
})

  /*************************/
 /*** NEW STANDARD  *******/
/*************************/

Template.newStandard.helpers({
  fixedFields: function() {
    return {categoryID:this._id}
  }
})

  /**********************/
 /*** UTILITIES  *******/
/**********************/

var percentExpected = function(sectionID) { 
  var selector = {
    categoryID: this._id,
    visible: true //only visible standards count
  }
  var standardIDs = _.pluck(Standards.find(selector,{fields:{_id:1}}).fetch(),'_id'); 
  var total = standardIDs.length;
  if (total == 0)
    return 0;
  var today = new Date();
  selector = {
    standardID:{$in:standardIDs},
    masteryExpected:{$lt:today}
  };
  if (sectionID) {
    selector.sectionID = sectionID;
    var expected = StandardDates.find(selector).count();
  } else {
    standardIDs = _.pluck(StandardDates.find(selector,{fields:{standardID:1}}).fetch(),'standardID');
    standardIDs = _.unique(standardIDs);
    var expected = standardIDs.length;
  }

  return expected*100/total;
};

var percentCompleted = function() { 
  var studentID = Meteor.impersonatedOrUserId();
  if (!Roles.userIsInRole(studentID,'student'))
    return 0;
  var selector = {
    categoryID: this._id,
    visible: true //only visible standards count
  }
  var standards = Standards.find(selector).fetch();
  var total = standards.length;
  if (total == 0)
    return 0;
  standards = standards.filter(function(standard) {
    var LoM = LevelsOfMastery.findOne({standardID:standard._id,studentID:studentID});
    if (!LoM) return false;
    var level = LoM.average.schoolyear; //edit to select grading period when available
    if (_.isArray(standard.scale)) {
      var index = standard.scale.indexOf(level);
      return (index == standard.scale.length - 1);
    } else {
      return (level*100/standard.scale > 88);
    }
  });
  return standards.length*100/total;
}