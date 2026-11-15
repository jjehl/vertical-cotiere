module.exports={routes:[
  {method:'POST',path:'/registrations/activate',handler:'course-registration.activate',config:{auth:false}},
  {method:'GET',path:'/registrations',handler:'course-registration.catalog',config:{auth:false}},
  {method:'POST',path:'/registrations/checkout',handler:'course-registration.checkout',config:{auth:{scope:['api::course-registration.course-registration.checkout']}}},
  {method:'POST',path:'/registrations/status',handler:'course-registration.status',config:{auth:{scope:['api::course-registration.course-registration.status']}}},
  {method:'POST',path:'/registrations/helloasso',handler:'course-registration.webhook',config:{auth:false}},
]};
