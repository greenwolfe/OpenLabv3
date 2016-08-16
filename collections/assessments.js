Assessments = new Meteor.Collection('Assessments');

/*
  make collection standardsForAssessment items will point 
  to assessment and standard and have an order parameter
  on assessment page, do a sortable1c on standardsForAssessment,
  and inside that, call the specific standard for presentation

  auto-create an activity whose pointTo field points back to
  the grades page with this particular assessment visible
  how to pass in the unit for it???  units and activities are not loaded on the grades page?
  so must load them for this page just in order to link?
  option to create on standards page, but then have to load assessments in order to choose one
*/
Meteor.methods({
  insertAssessment: function(linkedUnit) {
    check(assessment,{
       //what to pass in, anything?
    })
  }
});