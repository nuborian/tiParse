# **tiParse**
---

# Overview

Parse lib for Appcelerator Titanium - iOS & Android

I am using the [open source Parse-Server](https://github.com/ParsePlatform/parse-server "open source Parse-Server") in some of my Titanium Apps so i needed a way to access my data easily and with ease.
I've looked at some other projects like [RESTe](https://github.com/jasonkneen/RESTe) or the Kinvey Backbone SDK to get an idea of how i want to structure my stuff.

The result is a small lib which allows access to Parse with all the stuff we love like Backbone Models and Collections support.
Besides that it supports caching using [LokiDB](https://github.com/ianko/ti-loki) (coming soon)


The lib based on a "active_user" lifecycle. So after you init the lib and logged in with a specific user every call uses the specific session_token to authenticate.

---

# **Dependencies**:
- [LokiDB](https://github.com/ianko/ti-loki) (Database for caching and store session_token & active_user)
- [Q.js](https://github.com/kriskowal/q) (Promises)



# **Features**
- ## *User*
	- Login
    - Logout
	- Registration
	- Refreshing ( "me" )
    - Retrieve the active_user
    
- ## *Data*
	- CRUD Operations (Create, Read, Update, Delete);
    - Query for Data (urlparams at the moment, functions for more comfort are in the pipeline)
    
- ## *Files*
	- Full Support for Uploading Files
    
- ## *Push*
	- Push-Support is coming in V 1.1.0
	

# **Parse Server**
At the moment I am using [Sashido](https://www.sashido.io/) for hosting my Parse-Server. I really can recommand you to try their service. If you do - maybe use [Refferal](https://www.sashido.io/?ref=1z7e4LDdRN) ;) Of course you can setup your own installation on Providers like AWS, Heroku etc. At least it's a great starting point to develop your new Application.
	
---

# **Examples**

```

// Parse Init
TiParse.init({
  base_url : "https://www.yourparseserver.com/1/)",
  app_key : "your_app_key",
  rest_key : "your_rest_key",
  usermodel : M_User
}).then(function(active_user){
  if( active_user ){
    console.log("I am already available - Jeah :)");
  }else{
    var user = new M_User();
    user.login({
      username : "username",
      password : "password"
    }).then(function(response){
      console.log("Login success - Jeah :)")
    });
  }
});
```

Your alloy.js should look similar to this:

```
var Q = require('q');
var TiParse = require('TiParse');

/**
 * User-Model
 */
var M_User = Backbone.Model.extend({
  // Custom Functions and Properties
  //fullname : function(){
  //  return this.get('first_name') + " " + this.get("last_name");
  //}
});
_.extend(M_User.prototype, TiParse.Backbone.UserMixin);
```

As you can see, I've created a global Reference to "my" User-Model. You can extend it with custom functions and properties as you need them. In this case there is a commented function to get the fullname of an user based on his/her first_name and last_name attributes.
This way you can modify your Base Classes at one place and use them anywhere in your application.

---


# **Releases**
- ###1.0.0 (02.11.2016)
	- **inital Release**
	- **Basic Support for User Functions**
	- **Basic Support for Data Functions**
