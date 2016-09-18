  /*****************************/
 /**** EDIT WORK PERIOD *******/
/*****************************/
/****MAKE ONE TEMPLATE ... add copycolor****/
/*** or justSet field in object itself, which 
determines whether initial copyColor is white or red
read in the oncreated,set initial copy color, then set
to false ****/
var dateTimeFormat = "ddd, MMM D YYYY [at] h:mm a";

Template.editWorkPeriod.onCreated(function() {
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
    var $startDatePicker = tmpl.$('.startDatePicker').data("DateTimePicker");
    if (event.date) {
      if (!_.isDate(wP.startDate) || !event.date.isSame(wP.startDate,'second')) {
        if ((event.oldDate === null) && ((event.date.hours() == 0) || (event.date.milliseconds() == 314)))
          return $startDatePicker.date(event.date.hours(8).startOf('hour'));
        wP.startDate = event.date.milliseconds(0).toDate();
        Meteor.call('setWorkPeriod',wP,function(error,id) {
          if (error) {
            alert(error.reason);
          } else {
            tmpl.copyColor.set('blue');
          }
        });
        if ($endDatePicker)
          $endDatePicker.minDate(event.date.milliseconds(314).toDate());  //link the pickers to ensure startDate < endDate
      }
    } else if (wP.startDate) {
      wP.startDate = null;
      Meteor.call('setWorkPeriod',wP,alertOnError);
      if ($endDatePicker)
        $endDatePicker.minDate(false); 
    }
  },
  'dp.change .endDatePicker': function(event,tmpl) {
    var wP = this;
    wP.sectionID = Meteor.selectedSectionId();
    var $endDatePicker = tmpl.$('.endDatePicker').data("DateTimePicker");
    var $startDatePicker = tmpl.$('.startDatePicker').data("DateTimePicker");
    if (event.date) {
      if (!_.isDate(wP.endDate) || !event.date.isSame(wP.endDate,'second')) {
        if ((event.oldDate === null) && ((event.date.hours() == 0) || (event.date.milliseconds() == 314)))
          return $endDatePicker.date(event.date.hours(16).startOf('hour'));
        wP.endDate = event.date.milliseconds(0).toDate();
        Meteor.call('setWorkPeriod',wP,function(error,id) {
          if (error) {
            alert(error.reason);
          } else {
            tmpl.copyColor.set('blue');
          }
        });
        if ($startDatePicker)
          $startDatePicker.maxDate(event.date.milliseconds(314)); //link the pickers to ensure startDate < endDate
      }
    } else if (wP.endDate) {
      wP.endDate = null;
      Meteor.call('setWorkPeriod',wP,alertOnError);
      if ($startDatePicker)
        $startDatePicker.maxDate(false);
    }
  },
  'click i.fa-copy': function(event,tmpl) {
    var wP = this;
    wP.sectionID = 'applyToAll';
    Meteor.call('setWorkPeriod',wP,function(error,id) {
      if (error) {
        alert(error.reason);
      } else {
        tmpl.copyColor.set('green');
      }
    });
  }
})

Template.editWorkPeriod.helpers({
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
  }
})