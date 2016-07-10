  /**********************/
 /******* HELPERS ******/
/**********************/
var validateFiles = function(files) {
  //??? file upload fails unless this line is in the validate
  //so long as it is, I was able to return anything, boolean, true or false or null or an error message
  //and validate still worked, even if there was not chance of reaching
  //the statement below.  
  //without this line, nothing I return seems to allow the file to upload
  return (_.max(_.pluck(files,'size')) < 1e8); //100MB
}


  /**********************/
 /******* SUMMARY ******/
/**********************/

//modelSummary onCreated
Template.modelSummary.onCreated(function() {

})

//modelSummary onRendered
Template.modelSummary.onRendered(function() {
  var instance = this;
  instance.autorun(function() {
    var studentID = Meteor.impersonatedOrUserId();
    var activeUnit = Template.currentData();
    var unitID = ((activeUnit) && ('_id' in activeUnit)) ? activeUnit._id : '';
    if (studentID && unitID) {
      Meteor.call('insertSummary',{studentID:studentID,unitID:unitID},alertOnError);
      instance.subscribe('summary',studentID,unitID);
      instance.subscribe('fileForSummary',studentID,unitID);
    }
  })
})

var dateTimeFormat = "[at] h:mm a MM[/]DD[/]YY";

//modelSummary helpers
Template.modelSummary.helpers({
  summary: function() {
    var studentID = Meteor.impersonatedOrUserId();
    if (('_id' in this) && (studentID))
      return Summaries.findOne({unitID:this._id,studentID:studentID});
  },
  linkedActivity: function() {
    var activity = Activities.findOne(this.activityID);
    if (activity) {
      activity.inSummaryHeader = true;
      return activity;
    }
    //null activity to hold place for dropdown list for teacher
    var cU = Meteor.userId();
    if (Roles.userIsInRole(cU,'teacher')) {
      return {
        _id: '',
        inSummaryHeader: true,
        pointsTo: '',
        title: 'Associate this model summary with an activity.',
        unitID: openlabSession.get('activeUnit'),
        tag: '',
        visible: true,
        order: 0,
        suborder: 0,
        wallOrder: ['teacher','student','group','section'],
        wallVisible: {teacher:true,student:true,group:true,section:true},
      }
    }
  },
  title: function() {
    var unit = Units.findOne(this.unitID);
    if (unit) {
      var name = unit.longname || unit.title;
      return 'Summary for ' + name;
    }
  },
  image: function() {
    return Files.findOne({summaryID:this._id});
  },
  isImage: function() {
    return (_.str.contains(this.type,'image'));
  },
  webSizePath: function() {
    var path = this.path;
    var pathArray = path.split('/');
    pathArray.splice(-1,0,'webSize');
    return pathArray.join('/');
  },
  processUpload: function() { //passed to insertFile method to create object referring to file
    var summaryID = this._id;
    var studentID = this.studentID;
    var unitID = this.unitID;
    return {
      finished: function(index, file, tmpl) {
        file.summaryID = summaryID;
        file.studentID = studentID;
        file.unitID = unitID;
        console.log(file);
        var fileId = Meteor.call('insertSummaryFile',file,alertOnError);
      },
      validate: validateFiles
    }
  },
  //path = /username/[unit/'summary','conceptMap']/date 
  formData: function() { //passed to tomi:uploadserver to create file path
    var path = '';
    var name;
    /* username */
    var cU = Meteor.impersonatedOrUserId(); 
    if (cU) name = _.str.slugify(Meteor.user(cU).username);
    if (name) path += '/' + name;
    /* unit */
    var unit = Units.findOne(this.unitID);
    var site = Site.findOne(this.unitID);
    if (unit) {
      name = (unit) ? _.str.slugify(unit.title) : '';
      if (name) path += '/' + name + '/summary';
    } else if (site) {
      path += '/conceptMap';
    }
    /* date */
    path += '/' + moment().format('DDMMMYYYY');
    return {path:path};
  },
  formatDateTime: function(date) {
    return ((Match.test(date,Date)) && !dateIsNull(date)) ? moment(date).format(dateTimeFormat) : '_____';
  }
})

//modelSummary events
Template.modelSummary.events({
  'click .deleteSummaryImage': function(event,tmpl) {
    if (confirm('Are you sure you want to delete the current image?')) {
      Meteor.call('deleteSummaryFile', this._id,alertOnError);
    }
  }
})