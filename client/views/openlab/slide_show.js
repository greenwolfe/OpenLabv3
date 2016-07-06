  /********************/
 /**** SLIDE SHOW ****/
/********************/

Template.slideShow.onCreated(function() {
  instance = this;
  instance.slideIDs = new ReactiveVar([]);
  instance.activeSlideID = new ReactiveVar(null);
  instance.resetActiveSlide = new ReactiveVar(true);
})

/* slide show onRendered */
Template.slideShow.onRendered(function() {
  instance = this;
  instance.autorun(function() {
    var unitID = openlabSession.get('activeUnit');
    var studentID = Meteor.impersonatedOrUserId();
    var sectionID = Meteor.selectedSectionId();
    var studentOrSectionID = null;
    if (Roles.userIsInRole(studentID,['student'])) {
      studentOrSectionID = studentID;
    } else if (Roles.userIsInRole(studentID,'teacher')) {
      studentOrSectionID = sectionID || studentID;
    }
    if (unitID && studentOrSectionID) {
      instance.subscribe('slides',studentOrSectionID,unitID,function() { //things to do only when a new subscription is first ready
        instance.resetActiveSlide.set(true);  //slides not sorted yet, so can't set active slide, notify next code segment
        Meteor.subscribe('blockTextForSlides',studentOrSectionID,unitID);
      }); 

      if (instance.subscriptionsReady()) {  //things to do when a new subscription is first ready, or when items are changed or added to an existing subscription
        var selector = {
          unitID: unitID,
          type: {$in: ['text','file','embed']}
        };
        if (Roles.userIsInRole(studentID,'teacher')) {
          if (sectionID) {
            selector.$or = [{createdFor:sectionID}, //if viewing a section, draw in blocks posted to its walls
                      {access:{$in:[studentID]}}];  //also draw in blocks with this particular teacher ID in the access field (which means the teacher selected it for his/her stack of slides)
          } else {
            selector.access = {$in:[studentID]};
          }
        } else if (Roles.userIsInRole(studentID,'student')) {
          selector.access = {$in: [studentID]};
        } 
        var slideIDs = _.pluck(Blocks.find(selector).fetch(),'_id');
        slideIDs =  slideIDs.sort(function(slideID1,slideID2) {
          var star1 = SlideStars.findOne({blockID:slideID1,userID:studentID}) || {value:8};
          var star2 = SlideStars.findOne({blockID:slideID2,userID:studentID}) || {value:8};
          if (star1.value != star2.value) {
            return star2.value - star1.value;
          } else { 
            var slide1 = Blocks.findOne(slideID1);
            var slide2 = Blocks.findOne(slideID2);
            return slide2.modifiedOn - slide1.modifiedOn;
          }
        })
        instance.slideIDs.set(slideIDs)
        if (instance.resetActiveSlide.get()) {
          instance.activeSlideID.set(slideIDs[0]);
          instance.resetActiveSlide.set(false);
        }
      }
    } //else {
//      instance.slideIDs.set([]);
//      instance.activeSlideID.set(null);
//      instance.resetActiveSlide.set(false);
//    }        
  });
});

/* slide show helpers */
Template.slideShow.helpers({
  slidesCount: function() {
    var instance = Template.instance();
    return instance.slideIDs.get().length;
  },
  slideNumber: function() {
    var instance = Template.instance();
    var activeSlideID = instance.activeSlideID.get();
    var slideIDs = instance.slideIDs.get();
    return slideIDs.indexOf(activeSlideID) + 1;
  },
  activeSlide: function() {
    var instance = Template.instance();
    var activeSlideID = instance.activeSlideID.get();
    return Blocks.findOne(activeSlideID);
  },
  stars: function() {
    var cU = Meteor.impersonatedOrUserId();
    var slideStar = SlideStars.findOne({blockID:this._id,userID:cU});
    slideStar = slideStar || {
        userID: cU,
        blockID: this._id,
        value: 0
      }
    delete slideStar._id;
    var stars = [];
    [1,2,3,4,5,6,7].forEach(function(i) {
      var s = _.clone(slideStar);
      s.index = i;
      stars.push(s);
    });
    return stars;
  },
  yellow: function() {
    return (this.index <= this.value) ? 'yellow' : '';
  },
  teacherStars: function() {
    var cU = Meteor.userId();
    if (!Roles.userIsInRole(cU,'teacher') || !Meteor.impersonatedId())
      return '';
    var slideStar = SlideStars.findOne({blockID:this._id,userID:cU});
    slideStar = slideStar || {
        userID: cU,
        blockID: this._id,
        value: 0
      }
    delete slideStar._id;
    var stars = [];
    [1,2,3,4,5,6,7].forEach(function(i) {
      var s = _.clone(slideStar);
      s.index = i;
      stars.push(s);
    });
    return stars;
  },
  yellow: function() {
    return (this.index <= this.value) ? 'yellow' : '';
  }       
})

Template.slideShow.events({
  'click i.fa-star': function(event,tmpl) {
    var star = this;
    Meteor.call('setSlideStar',star.userID,star.blockID,star.index,alertOnError);
  },
  'click i.fa-step-forward': function(event,tmpl) {
    var slideIDs = tmpl.slideIDs.get();
    var activeSlideID = tmpl.activeSlideID.get();
    var index = slideIDs.indexOf(activeSlideID);
    if (index < slideIDs.length - 1)
      tmpl.activeSlideID.set(slideIDs[index + 1]);
  },
  'click i.fa-step-backward': function(event,tmpl) {
    var slideIDs = tmpl.slideIDs.get();
    var activeSlideID = tmpl.activeSlideID.get();
    var index = slideIDs.indexOf(activeSlideID);
    if (index > 0)
      tmpl.activeSlideID.set(slideIDs[index - 1]);
  },
  'click i.fa-fast-backward': function(event,tmpl) {
    var slideIDs = tmpl.slideIDs.get();
    tmpl.activeSlideID.set(slideIDs[0]);
  }
})