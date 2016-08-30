  /*****************************/
 /**** EDIT WORK PERIOD *******/
/*****************************/
/****MAKE ONE TEMPLATE ... add copycolor****/
var dateTimeFormat = "ddd, MMM D YYYY [at] h:mm a";

Template.editWorkPeriod.onRendered(function() {
  var instance = this;
  var $calIcon = instance.$('.startDatePicker .glyphicon-calendar');
  var wP = Template.currentData();
  var options = {
    showClose:  true,
    showClear: true,
    keepOpen: false,
    format: dateTimeFormat,
    toolbarPlacement: 'top',
    sideBySide: true,
    widgetParent: $calIcon,
    defaultDate: wP.startDate || false,
    maxDate: wP.endDate || false,
    useCurrent: false,
    keyBinds: {enter: function(widget) {
      if (widget.find('.datepicker').is(':visible')) {
        this.hide();
      } else {
        this.date(widget.find('.datepicker').val());
      }
    }}    
  }
  
  instance.$('.startDatePicker').datetimepicker(options);
  $calIcon = instance.$('.endDatePicker .glyphicon-calendar');
  options.widgetParent = $calIcon;
  options.defaultDate = wP.endDate || false;
  options.minDate = wP.startDate || false;
  delete options.maxDate;
  instance.$('.endDatePicker').datetimepicker(options);
})

Template.editWorkPeriod.events({
  'dp.change .startDatePicker': function(event,tmpl) {
    var wP = this;
    wP.sectionID = Meteor.selectedSectionId();
    var $endDatePicker = tmpl.$('.endDatePicker').data("DateTimePicker");
    if (event.date) {
      if ((event.oldDate === null) && (event.date.hours() == 0))
        event.date.hours(8);
      wP.startDate = event.date.toDate();
      Meteor.call('setWorkPeriod',wP,alertOnError);
      if ($endDatePicker)
        $endDatePicker.minDate(wP.startDate);  //link the pickers to ensure startDate < endDate
    } else {
      wP.startDate = null;
      Meteor.call('setWorkPeriod',wP,alertOnError);
      if ($endDatePicker)
        $endDatePicker.minDate(false); 
    }
  },
  'dp.change .endDatePicker': function(event,tmpl) {
    var wP = this;
    wP.sectionID = Meteor.selectedSectionId();
    var $startDatePicker = tmpl.$('.startDatePicker').data("DateTimePicker");    
    if (event.date) {
      if ((event.oldDate === null) && (event.date.hours() == 0))
        event.date.hours(16);
      wP.endDate = event.date.toDate();
      Meteor.call('setWorkPeriod',wP,alertOnError);
      if ($startDatePicker)
        $startDatePicker.maxDate(event.date.toDate()); //link the pickers to ensure startDate < endDate
    } else {
      wP.endDate = null;
      Meteor.call('setWorkPeriod',wP,alertOnError);
      if ($startDatePicker)
        $startDatePicker.maxDate(false);
    }
  },
  'click i.fa-copy': function(event,tmpl) {
    var wP = this;
    wP.sectionID = 'applyToAll';
    Meteor.call('setWorkPeriod',wP,alertOnError);
  }
})

Template.editWorkPeriod.helpers({
  formatDateTime: function(date) {
    return ((Match.test(date,Date)) && !dateIsNull(date)) ? moment(date).format(dateTimeFormat) : '_____';
  }
})

  /****************************/
 /**** NEW WORK PERIOD *******/
/****************************/

Template.newWorkPeriod.onRendered(function() {
  var instance = this;
  var $calIcon = instance.$('.startDatePicker .glyphicon-calendar');
  var options = {
    showClose:  true,
    showClear: true,
    keepOpen: false,
    format: dateTimeFormat,
    toolbarPlacement: 'top',
    sideBySide: true,
    widgetParent: $calIcon,
    useCurrent: false,
    keyBinds: {enter: function(widget) {
      if (widget.find('.datepicker').is(':visible')) {
        this.hide();
      } else {
        this.date(widget.find('.datepicker').val());
      }
    }}    
  }
  instance.$('.startDatePicker').datetimepicker(options);
 
  $calIcon = instance.$('.endDatePicker .glyphicon-calendar');
  options.widgetParent = $calIcon;
  options.minDate = false;
  delete options.maxDate;
  instance.$('.endDatePicker').datetimepicker(options);
})

Template.newWorkPeriod.events({
  'dp.change .startDatePicker': function(event,tmpl) {
    var activityID = (Activities.findOne(this._id)) ? this._id : null;
    var sectionID = Meteor.selectedSectionId();
    if ((activityID) && (sectionID)) {
      var wP = {
        activityID: activityID,
        sectionID: sectionID,
        endDate: null
      }
    
      var $endDatePicker = tmpl.$('.endDatePicker').data("DateTimePicker");
      if (event.date) {
        if (event.date.hours() == 0)
          event.date.hours(8);
        wP.startDate = event.date.toDate();
        Meteor.call('setWorkPeriod',wP,alertOnError);
        if ($endDatePicker)
          $endDatePicker.minDate(wP.startDate);  //link the pickers to ensure startDate < endDate
      } else {
        wP.startDate = null;
        Meteor.call('setWorkPeriod',wP,alertOnError);
        if ($endDatePicker)
          $endDatePicker.minDate(false); 
      }
    }
  },
  'dp.change .endDatePicker': function(event,tmpl) {
    var activityID = (Activities.findOne(this._id)) ? this._id : null;
    var sectionID = Meteor.selectedSectionId();
    if ((activityID) && (sectionID)) {
      var wP = {
        activityID: activityID,
        sectionID: sectionID,
        startDate: null
      }

      var $startDatePicker = tmpl.$('.startDatePicker').data("DateTimePicker");    
      if (event.date) {
        if (event.date.hours() == 0)
          event.date.hours(16);
        wP.endDate = event.date.toDate();
        Meteor.call('setWorkPeriod',wP,alertOnError);
        if ($startDatePicker)
          $startDatePicker.maxDate(event.date.toDate()); //link the pickers to ensure startDate < endDate
      } else {
        wP.endDate = null;
        Meteor.call('setWorkPeriod',wP,alertOnError);
        if ($startDatePicker)
          $startDatePicker.maxDate(false);
      }
    }
  }
})