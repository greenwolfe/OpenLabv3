Todos = new Meteor.Collection('Todos');
Todos.check = {};

Todos.check.userCanEdit = function(todoOrID,studentID) {
  check(todoOrID,Match.OneOf(Match.idString,
    Match.ObjectIncluding ({
      calendarEventID: Match.Optional(Match.idString),  //must have one and only one of these three
      assessmentID: Match.Optional(Match.idString),  //must have one and only one of these three
      projectID: Match.Optional(Match.idString)  //must have one and only one of these three      
    })
  ));
  check(studentID,match.idString);
  var todo =  (_.isObject(todoOrID)) ? todoOrId : Todos.findOne(todoOrID);
  if (!todo)
    return false;
  if (Roles.userIsInRole(studentID,'teacher'))
    return true;
  if (!Roles.userIsInRole(studentID,'student'))
    return false;

  var calendarEvent = CalendarEvents.findOne(todo.calendarEventID);
  var assessment = Assessments.findOne(todo.assessmentID);
  var project = Projects.findOne(todo.projectID);
  if (!calendarEvent && !assessment && !project)
    return false;
  if (calendarEvent) 
    return (_.contains(calendarEvent.participants,studentID));
  if (assessment)
    return (assessment.createdFor == studentID);
  if (project) //update once projects are developed
    return false;
}

Meteor.methods({
  insertTodo: function(todo) {
    check(todo, {
      calendarEventID: Match.Optional(Match.idString),  //must have one and only one of these three
      assessmentID: Match.Optional(Match.idString),  //must have one and only one of these three
      projectID: Match.Optional(Match.idString),  //must have one and only one of these three
      text: Match.nonEmptyString

      /* not passed in, will be filled automatically below
      deadline: Match.OneOf(Date,null),
      completed: Match.Boolean, //false
      order: Match.Integer, //inserted after the last one in the list
      createdBy: Match.idString,  //current user
      createdOn: Match.Optional(Date),  //today's date
      modifiedBy: Match.Optional(Match.idString), //current user
      modifiedOn: Match.Optional(Date),           //current date
      checkedCorICby: Match.Optional(Match.idString), //checked Complete or InComplete ... current user
      checkedCorICon: Match.Optional(Date)
      */
    })
    todo.completed = false;
    var today = new Date();
    todo.createdOn = today;
    todo.modifiedOn = today;
    todo.checkedCorICon = today;
    todo.deadline = today; //might be modified below 

    var cU = Meteor.user(); //currentUser
    if (!cU)  
      throw new Meteor.Error('notLoggedIn', "You must be logged in to insert a todo item.");
    if (Roles.userIsInRole(cU,'parentOrAdvisor'))
      throw new Meteor.Error('parentNotAllowed', "Parents may only observe.  They cannot create new content.");
    if (!Roles.userIsInRole(cU,['student','teacher']))
      throw new Meteor.Error('notStudentOrTeacher','Only teachers and students may insert a todo item.'); 
    todo.createdBy = cU._id;
    todo.modifiedBy = cU._id;
    todo.checkedCorICby = cU._id;

    var calendarEvent = CalendarEvents.findOne(todo.calendarEventID);
    var assessment = Assessments.findOne(todo.assessmentID);
    var project = Projects.findOne(todo.projectID);
    if (!calendarEvent && !assessment && !project)
      throw new Meteor.Error('nothingToLinkTo','Cannot insert to do item.  Did not find a calendar event, assessment, or project to link it to');
    if (Roles.userIsInRole(cU,'student') && !Todos.check.userCanEdit(cU,todo)) {
      throw new Meteor.Error('studentCannot Edit',"This student does not have rights to insert a new todo item in this calendar event, assessment or project.");
    }

    if (calendarEvent) {
      var lastTodo = Todos.findOne({calendarEventID: todo.calendarEventID},{
        fields:{order:1},
        sort:{order:-1},
        limit:1
      });
      todo.order = (lastTodo) ? lastTodo.order + 1 : 0;
      var numberOfTodoItems =  Todos.find({calendarEventID: todo.calendarEventID}).count() + 1;

      return Todos.insert(todo,function(error,id){
        if (error) return;
        CalendarEvents.update(calendarEvent._id,{$set:{numberOfTodoItems:numberOfTodoItems}});
      })
    }

    if (assessment) {
      var lastTodo = Todos.findOne({assessmentID: todo.assessmentID},{
        fields:{order:1},
        sort:{order:-1},
        limit:1
      });
      todo.order = (lastTodo) ? lastTodo.order + 1 : 0;
      return Todos.insert(todo);
    }

    if (project) { //edit once projects are defined
      return;
    }


  },

  updateTodo: function(newTodo) {
    check(newTodo,{
      _id: Match.idString,
      text: Match.Optional(String),
      deadline: Match.Optional(Match.OneOf(Date,null)),
      // fields below will be ignored if passed in
      calendarEventID: Match.Optional(Match.idString),  //must have one and only one of these three
      assessmentID: Match.Optional(Match.idString),  //must have one and only one of these three
      projectID: Match.Optional(Match.idString),  //must have one and only one of these three
      completed: Match.Optional(Match.Boolean), //false
      order: Match.Optional(Match.Integer), //inserted after the last one in the list
      createdBy: Match.Optional(Match.idString),  //current user
      createdOn: Match.Optional(Match.Optional(Date)),  //today's date
      modifiedBy: Match.Optional(Match.Optional(Match.idString)), //current user
      modifiedOn: Match.Optional(Match.Optional(Date)),           //current date
      checkedCorICby: Match.Optional(Match.Optional(Match.idString)), //checked Complete or InComplete ... current user
      checkedCorICon: Match.Optional(Match.Optional(Date))
    })

    var cU = Meteor.user(); //currentUser
    if (!cU)  
      throw new Meteor.Error('notLoggedIn', "You must be logged in to update a todo item.");
    if (Roles.userIsInRole(cU,'parentOrAdvisor'))
      throw new Meteor.Error('parentNotAllowed', "Parents may only observe.  They cannot create new content.");
    if (!Roles.userIsInRole(cU,['student','teacher']))
      throw new Meteor.Error('notStudentOrTeacher','Only teachers and students may update a todo item.'); 

    var todo = Todos.findOne(newTodo._id);
    if (!todo)
      throw new Meteor.Error('todoNotFound',"Cannot update todo item.  Todo item not found.");

    var calendarEvent = CalendarEvents.findOne(todo.calendarEventID);
    var assessment = Assessments.findOne(todo.assessmentID);
    var project = Projects.findOne(todo.projectID);
    if (!calendarEvent && !assessment && !project)
      throw new Meteor.Error('nothingToLinkTo','Cannot update to do item.  Did not find a calendar event, assessment, or project to link it to');
    if (Roles.userIsInRole(cU,'student') && !Todos.check.userCanEdit(cU,newTodo._id)) {
      throw new Meteor.Error('studentCannotEdit',"This student does not have rights to edit a new todo item in this calendar event, assessment or project.");
    }

    var returnVal = 0;
    if ('deadline' in newTodo) {
      returnVal = Todos.update(newTodo._id,{$set:{
        deadline:newTodo.deadline,
        modifiedBy: cU._id,
        modifiedOn: new Date()
      }});
    }
    if ('text' in newTodo) {
      if (_.trim(_.stripTags(newTodo.text))) {
        return Todos.update(newTodo._id,{$set:{
          text:newTodo.text,
          modifiedBy: cU._id,
          modifiedOn: new Date()
        }});
      } else { //delete todo
        if (calendarEvent) {
          var ids = _.pluck(Todos.find({calendarEventID:todo.calendarEventID,order:{$gt: todo.order}},{fields: {_id: 1}}).fetch(), '_id');
          if (calendarEvent.numberOfTodoItems < 2)
            throw new Meteor.Error('needAtLeastOneTodo',"Cannot delete the last todo item.  Calendar events must have at leaast one.");
        } else if (assessment) {
          var ids = _.pluck(Todos.find({assessmentID:todo.assessmentID,order:{$gt: todo.order}},{fields: {_id: 1}}).fetch(), '_id');
        } else if (project) {
          var ids = _.pluck(Todos.find({projectID:todo.projectID,order:{$gt: todo.order}},{fields: {_id: 1}}).fetch(), '_id');
        }
        return Todos.remove(todo._id,function(error,id) {
          if (error) return;
          if (calendarEvent.numberOfTodoItems > 1)
            CalendarEvents.update(calendarEvent._id,{$inc:{numberOfTodoItems:-1}});
          if (todo.completed && (calendarEvent.numberTodosCompleted > 0)) {
            CalendarEvents.update(calendarEvent._id,{$inc:{numberTodosCompleted:-1}});
          }
          Todos.update({_id: {$in: ids}}, {$inc: {order:-1}}, {multi: true});
        }) 
      }
    }
    return returnVal;
  },
  markTodoComplete: function(todoID) {
    check(todoID,Match.idString);

    var cU = Meteor.user(); //currentUser
    if (!cU)  
      throw new Meteor.Error('notLoggedIn', "You must be logged in to update a todo item.");
    if (Roles.userIsInRole(cU,'parentOrAdvisor'))
      throw new Meteor.Error('parentNotAllowed', "Parents may only observe.  They cannot create new content.");
    if (!Roles.userIsInRole(cU,['student','teacher']))
      throw new Meteor.Error('notStudentOrTeacher','Only teachers and students may update a todo item.'); 

    var todo = Todos.findOne(todoID);
    if (!todo)
      throw new Meteor.Error('todoNotFound',"Cannot update todo item.  Todo item not found.");

    var calendarEvent = CalendarEvents.findOne(todo.calendarEventID);
    var assessment = Assessments.findOne(todo.assessmentID);
    var project = Projects.findOne(todo.projectID);
    if (!calendarEvent && !assessment && !project)
      throw new Meteor.Error('nothingToLinkTo','Cannot update to do item.  Did not find a calendar event, assessment, or project to link it to');
    if (Roles.userIsInRole(cU,'student') && !Todos.check.userCanEdit(cU,newTodo._id)) {
      throw new Meteor.Error('studentCannotEdit',"This student does not have rights to mark a to do item complete for this calendar event, assessment or project.");
    }

    if (!todo.completed) {
      var today = new Date();
      if (calendarEvent) {
        var numUpdated = Todos.update(todoID,{$set:{
          completed:true,
          checkedCorICby: cU,
          checkedCorICon: today
        }},function(error,id) {
          if (error) return;
          if (calendarEvent.numberTodosCompleted < calendarEvent.numberOfTodoItems) {
            CalendarEvents.update(calendarEvent._id,{$inc:{numberTodosCompleted:1}});
          } else {
            throw new Meteor.Error('alreadyCompleted','Error updating total of completed items.  Calendar event says all todo items are already completed.');
          }
        })
        return numUpdated;
      }

      if (assessment) {
        return Todos.update(todoID,{$set:{
          completed:true,
          checkedCorICby: cU,
          checkedCorICon: today
        }});
      }      
    } else  {
      return 0;
    }
  },
  markTodoIncomplete: function(todoID) {
    check(todoID,Match.idString);

    var cU = Meteor.user(); //currentUser
    if (!cU)  
      throw new Meteor.Error('notLoggedIn', "You must be logged in to update a todo item.");
    if (Roles.userIsInRole(cU,'parentOrAdvisor'))
      throw new Meteor.Error('parentNotAllowed', "Parents may only observe.  They cannot create new content.");
    if (!Roles.userIsInRole(cU,['student','teacher']))
      throw new Meteor.Error('notStudentOrTeacher','Only teachers and students may update a todo item.'); 

    var todo = Todos.findOne(todoID);
    if (!todo)
      throw new Meteor.Error('todoNotFound',"Cannot update todo item.  Todo item not found.");

    var calendarEvent = CalendarEvents.findOne(todo.calendarEventID);
    var assessment = Assessments.findOne(todo.assessmentID);
    var project = Projects.findOne(todo.projectID);
    if (!calendarEvent && !assessment && !project)
      throw new Meteor.Error('nothingToLinkTo','Cannot update to do item.  Did not find a calendar event, assessment, or project to link it to');
    if (Roles.userIsInRole(cU,'student') && !Todos.check.userCanEdit(cU,newTodo._id)) {
      throw new Meteor.Error('studentCannotEdit',"This student does not have rights to edit a new todo item in this calendar event, assessment or project.");
    }

    if (todo.completed) {
      if (calendarEvent) {
        var numUpdated = Todos.update(todoID,{$set:{
          completed:true,
          checkedCorICby: cU,
          checkedCorICon: today
        }},function(error,id) {
          if (error) return;
          if (calendarEvent.numberTodosCompleted > 0) {
            CalendarEvents.update(calendarEvent._id,{$inc:{numberTodosCompleted:-1}});
          } else {
            throw new Meteor.Error('noneCompleted','Error updating total of completed items.  Calendar event says none are completed yet.');
          }
        })
        return numUpdated;
      }

      if (assessment) {
        return Todos.update(todoID,{$set:{
          completed:true,
          checkedCorICby: cU,
          checkedCorICon: today
        }});
      }
    } else  {
      return 0;
    }
  }
})