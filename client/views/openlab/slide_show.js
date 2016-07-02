  /********************/
 /**** SLIDE SHOW ****/
/********************/

Template.slideShow.onCreated(function() {
  instance = this;
  instance.slidesReady = new ReactiveVar(false);
  instance.slideIDs = new ReactiveVar([]);
  instance.activeSlideID = new ReactiveVar(null);
  instance.resetActiveSlide = new ReactiveVar(true);
})

/* slide show onRendered */
Template.slideShow.onRendered(function() {
  instance = this;
  instance.autorun(function() {
    var unitID = openlabSession.get('activeUnit');
    if (unitID) {
      var studentID = Meteor.impersonatedOrUserId();
      if (Roles.userIsInRole(studentID,'teacher')) {
        var sectionID = Meteor.selectedSectionId();
        if (sectionID) {
          instance.slidesReady.set(false);
          instance.subscribe('slides',sectionID,unitID,function() {
            instance.slidesReady.set(true);
            instance.resetActiveSlide.set(true);
          });
        } else {
          instance.slidesReady.set(false);
          instance.subscribe('slides',studentID,unitID,function() {
            instance.slidesReady.set(true);
            instance.resetActiveSlide.set(true);
          });         
        }
      } else if (Roles.userIsInRole(studentID,'student')) {
        instance.slidesReady.set(false);
        instance.subscribe('slides',studentID,unitID,function() {
          instance.slidesReady.set(true);
          instance.resetActiveSlide.set(true);
        });
      }
    }
  });

  instance.autorun(function() {
    var unitID = openlabSession.get('activeUnit');
    var studentID = Meteor.impersonatedOrUserId();
    var slidesReady = Template.instance().slidesReady.get();
    if (slidesReady && unitID && studentID && Roles.userIsInRole(studentID,['teacher','student'])) {
      var selector = {
        unitID: unitID,
        type: {$in: ['text','file','embed']}
      };
      if (Roles.userIsInRole(studentID,'teacher')) {
        var sectionID = Meteor.selectedSectionId();
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
      slideIDs =  slideIDs.sort(function(slide1,slide2) {
        var star1 = SlideStars.findOne({blockID:slide1,userID:studentID}) || {value:8};
        var star2 = SlideStars.findOne({blockID:slide2,userID:studentID}) || {value:8};
        if (star1.value != star2.value) {
          return star2.value - star1.value;
        } else { //REVERSE???
          return slide2.modifiedOn - slide1.modifiedOn;
        }
      })
      instance.slideIDs.set(slideIDs)
      if (instance.resetActiveSlide.get()) {
        instance.activeSlideID.set(slideIDs[0]);
        instance.resetActiveSlide.set(false);
      }
    } else {
      instance.slideIDs.set([]);
      instance.activeSlideID.set(null);
      instance.resetActiveSlide.set(false);
    }
  });
});

/* slide show helpers */
Template.slideShow.helpers({
  slidesReady: function() {
    var instance = Template.instance();
    return instance.slidesReady.get();
  },
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
  }
})