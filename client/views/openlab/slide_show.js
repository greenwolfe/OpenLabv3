  /********************/
 /**** SLIDE SHOW ****/
/********************/

Template.slideShow.onCreated(function() {
  instance = this;
  instance.slideIDs = new ReactiveVar([]);
  instance.activeSlideID = new ReactiveVar(null);
  instance.resetActiveSlide = new ReactiveVar(true);
  instance.limit = new ReactiveVar(5);
  instance.loaded = new ReactiveVar(0);
})

/* slide show onRendered */
Template.slideShow.onRendered(function() {
  instance = this;

  instance.autorun(function() {  //whenever a new set of slides is requested
    var unitID = openlabSession.get('activeUnit');
    var studentID = Meteor.impersonatedOrUserId();
    var sectionID = Meteor.selectedSectionId();
    instance.limit.set(5);
    instance.loaded.set(0);
    instance.resetActiveSlide.set(true);
  })

  instance.autorun(function() {  
    var unitID = openlabSession.get('activeUnit');
    var studentID = Meteor.impersonatedOrUserId();
    var sectionID = Meteor.selectedSectionId();
    var limit = instance.limit.get();
    var studentOrSectionID = null;
    if (Roles.userIsInRole(studentID,['student'])) {
      studentOrSectionID = studentID;
    } else if (Roles.userIsInRole(studentID,'teacher')) {
      studentOrSectionID = sectionID || studentID;
    }
    if (unitID && studentOrSectionID) {
      instance.subscribe('slides',studentOrSectionID,unitID,limit,function() { //things to do only when a new subscription is first ready
        instance.loaded.set(limit);
      }); 

      if (instance.subscriptionsReady()) {  //things to do when a new subscription is first ready, or when items are changed or added to an existing subscription
        var selector = {
          unitID: unitID,
          type: {$in: ['text','file','embed']}
        };
        var slideIDs = [];
        var userID = studentOrSectionID;
        var cU = Meteor.userId();
        if (Roles.userIsInRole(studentOrSectionID,'student')) {
          if (Roles.userIsInRole(cU,'parentOrAdvisor')) { //not
            selector.wallType = 'student';
            selector.access = {$in: [studentOrSectionID]}; 
            slideIDs = _.pluck(Blocks.find(selector,{fields:{_id:1}}).fetch(),'_id'); 
          } else {
            if (Roles.userIsInRole(cU,'teacher')) {
              selector.access = {$in: [studentOrSectionID,cU]};
            } else {
              selector.access = {$in: [studentOrSectionID]};
            }
          }
          slideIDs = _.pluck(Blocks.find(selector,{fields:{_id:1}}).fetch(),'_id'); 
        } else if (Roles.userIsInRole(cU,'teacher')) { //and are not impersonating a student
          userID = cU;
          selector.$or = [{createdFor:studentOrSectionID}, //if viewing a section, draw in blocks posted to its walls
                          {access:{$in:[cU]}}];  //also draw in blocks with this particular teacher ID in the access field (which means the teacher selected it for his/her stack of slides)
          slideIDs = _.pluck(Blocks.find(selector,{fields:{_id:1}}).fetch(),'_id'); 
        }

        slideIDs =  slideIDs.sort(function(slideID1,slideID2) {
          var star1 = SlideStars.findOne({blockID:slideID1,userID:userID}) || {value:8};
          var star2 = SlideStars.findOne({blockID:slideID2,userID:userID}) || {value:8};
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
    }        
  });
});

/* slide show helpers */
Template.slideShow.helpers({
  slidesCount: function() {
    var instance = Template.instance();
    return instance.slideIDs.get().length;
  },
  hasMoreSlides: function() {
    var instance = Template.instance();
    return (instance.slideIDs.get().length >= instance.limit.get());
  },
  displayingLastSlide: function() {
    var instance = Template.instance();
    var activeSlideID = instance.activeSlideID.get();
    var slideIDs = instance.slideIDs.get();
    return (slideIDs.indexOf(activeSlideID) + 1 == slideIDs.length);    
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
  },
  'click i.fa-fast-forward': function(event,tmpl) {
    var slideIDs = tmpl.slideIDs.get();
    tmpl.activeSlideID.set(_.last(slideIDs));
  },
  'click i.fa-plus-square-o': function(event,tmpl) {
    var limit = tmpl.limit.get();
    tmpl.limit.set(limit + 5);
  }
})