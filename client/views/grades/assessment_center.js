  /***************************/
 /**** ASSESSMENT CENTER ****/
/***************************/

Template.assessmentCenter.onCreated(function() {
  instance = this;
  instance.assessmentIDs = new ReactiveVar([]);
  instance.resetActiveAssessment = new ReactiveVar(true);
  instance.limit = new ReactiveVar(5);
  instance.loaded = new ReactiveVar(0);
})