/**
* @author Nico Barelmann
*/

var Loki = require('ti-loki');

/**
* [db Instance of Loki Database]
* @type {[type]}
*/
var db = null;

/**
* [dbDefer description]
* @type {[type]}
*/
var dbDefer = null;

/**
* [db_statics Basic Collection used for handling Session, active_user etc.]
* @type {[type]}
*/
var coll_statics = null;

/**
* URL of the Parse-Server Instance
* @type {String}
*/
var base_url = "";

/**
* App Key indifiing your Parse Application
* @type {String}
*/
var app_key = "";

/**
* Rest Key to Call REST Endpoints
* @type {String}
*/
var rest_key = "";

/**
* Represents the acitve logged in User
* @type {[type]}
*/
var active_user = null;

/**
* Session-Token for the active User
* @type {String}
*/
var session_token = null;

/**
* Method Map for passing CRUD Operations
* @type {Object}
*/
var methodMap = {
  'create' : 'POST',
  'read' : 'GET',
  'update' : 'PUT',
  'delete' : 'DELETE'
};



/**
* [timeout description]
* @type {Number}
*/
var timeout = 5000;

var USERS = 'users';
var CLASSES = 'classes';
var FILES = 'files';

var PARSE_ERROR_BASE_URL_MISSING = "Please provide a valid Base URL as Endpoint";





var initdeferred;





(function() {

  var parseFn = function() {

    // Create Main Parse Object
    var Parse = {

      /**
      * [init description]
      * @param  {[type]} options [description]
      * @return {[type]}         [description]
      */
      init : function(options) {
        initdeferred = Q.defer();

        // Check Base-URL is available
        if (options.base_url == null) {
          errorCaller(PARSE_ERROR_BASE_URL_MISSING);
          deferred.reject(PARSE_ERROR_REST_KEY_MISSING);
          return;
        }

        // Check Rest Key is available
        if (options.rest_key == null) {
          errorCaller(PARSE_ERROR_REST_KEY_MISSING);
          deferred.reject(PARSE_ERROR_REST_KEY_MISSING);
          return;
        }

        // Check App Key is available
        if (options.app_key == null) {
          errorCaller(PARSE_ERROR_REST_KEY_MISSING);
          deferred.reject(PARSE_ERROR_REST_KEY_MISSING);
          return;
        }

        // Set Base Options
        base_url = options.base_url;
        app_key = options.app_key;
        rest_key = options.rest_key;

        // Setup Loki Database
        setupLokiDatabase().then(function(){
          console.debug("TiParse :::::: Assign Keys");
          //
          // Check Session Token
          //
          if( coll_statics.findOne({key : "session_token"}) ){
            console.debug("TiParse :::::: Session Token is available");

            // Restore Session_token from Database
            session_token = coll_statics.findOne({key : "session_token"}).value;

            // Restore active_user from Database
            //var UserModel = Backbone.Model.extend({});
            //_.extend(UserModel.prototype, Parse.Backbone.UserMixin);
            active_user = new UserModel(coll_statics.findOne({key : "active_user"}).value);

            //
            // Check Online-Status
            //
            if( Titanium.Network.online ){
              //console.log("active_user: " + JSON.stringify(active_user ));
              //
              // Update Active User
              //
              //active_user.me().then(function(response){
              initdeferred.resolve(active_user);
              //});
            }else{
              initdeferred.resolve(active_user);
            }
          }else{
            console.debug("TiParse :::::: No Session Token available");
            initdeferred.resolve(null);
          }
        });


      // Return
      return initdeferred.promise;
    },


    /**
    * Upload a new File to Parse-Server
    * @param  {[type]} options [description]
    * @return {[type]}         [description]
    */
    uploadFile : function(options){
      var deferred = Q.defer();

      if(!options.filename){
        console.error("Please provide a filename");
      }
      if(!options.filedata){
        console.error("Please provide a valid File");
      }
      if(!options.filetype){
        console.error("Please specify your FileType");
      }
      if(!options.extension){
        console.error("Please specify your File extension like png, jpg, txt, etc.");
      }


      // Set Params for Files
      var params = {};
      params.type = "POST";
      params.url = base_url + "files/"+options.filename + "." +options.extension;
      params.data = options.filedata;
      params.customheader = [options.filetype];

      // Make HTTP Request
      http_request(params, function(response) {
        if (response.success) {
          var res = JSON.parse(response.responseText);

          // Call Success
          return deferred.resolve(res);
        } else {
          var err = JSON.parse(response.responseText);
          params.error(err);
          return deferred.reject(err);
        }
      });

      return deferred.promise;
    },


    registerPush : function(){
      // Logic for Register Push
    }

  };




  /*
  ██████   █████  ████████  █████  ██████   █████  ███████ ███████
  ██   ██ ██   ██    ██    ██   ██ ██   ██ ██   ██ ██      ██
  ██   ██ ███████    ██    ███████ ██████  ███████ ███████ █████
  ██   ██ ██   ██    ██    ██   ██ ██   ██ ██   ██      ██ ██
  ██████  ██   ██    ██    ██   ██ ██████  ██   ██ ███████ ███████
  */

  /**
  * [setupLokiDatabase description]
  * @return {[type]} [description]
  */
  function setupLokiDatabase() {
    dbDefer = Q.defer();

    // Listen for Network Changes
    //Titanium.Network.addEventListener('change', onNetworkChange);

    // Create new Loki Database
    db = new Loki('loki.db',{
      autoload: true,
      autoloadCallback : loadHandler,
      autosave: true,
      autosaveInterval: 10000,
    });

    // Return Promise
    return dbDefer.promise;
  }

  function loadHandler(){
    coll_statics = db.getCollection('tiparse');
    if (coll_statics == null) {
      coll_statics = db.addCollection('tiparse');
    }else{
      //
    }

    // Resolve
    dbDefer.resolve();
  }











  /*
  ██████   █████   ██████ ██   ██ ██████   ██████  ███    ██ ███████
  ██   ██ ██   ██ ██      ██  ██  ██   ██ ██    ██ ████   ██ ██
  ██████  ███████ ██      █████   ██████  ██    ██ ██ ██  ██ █████
  ██   ██ ██   ██ ██      ██  ██  ██   ██ ██    ██ ██  ██ ██ ██
  ██████  ██   ██  ██████ ██   ██ ██████   ██████  ██   ████ ███████
  */



  Parse.Backbone = {
    getActiveUser : function() {
      return active_user;
    },
  }







  /*
  ███████ ██    ██ ███    ██  ██████
  ██       ██  ██  ████   ██ ██
  ███████   ████   ██ ██  ██ ██
  ██    ██    ██  ██ ██ ██
  ███████    ██    ██   ████  ██████
  */

  //Backbone.sync = function(method, model, options) {
  Parse.Backbone.sync = function(method, model, options) {
    var deferred = Q.defer();
    console.log("-----------------------");
    console.log("-------- Sync ---------");
    console.log("-----------------------");
    try {

      // Type
      var type = methodMap[method];

      // Create Params Object
      var params = _.extend({}, options);

      // Payload
      var payload = model.toJSON();

      // Set Type
      params.type = options.requestMethod || type;

      // Set Classname for caching Purpose
      params.classname = options.classname;

      // Custom URL
      params.url = (options.url ) ? base_url + params.url : base_url + model.url;

      // Extend the provided url params with those from the model config
      if (_.isObject(params.urlparams) || model.config.URLPARAMS) {
        params.urlparams = params.urlparams || {};
        _.extend(params.urlparams, _.isFunction(model.config.URLPARAMS) ? model.config.URLPARAMS() : model.config.URLPARAMS);
      }

      switch( method ) {

        // -------------------------------------------------------
        //
        // READ - GET
        //
        // -------------------------------------------------------
        case "read": {

          // Detect if it should read a specified Model
          if (payload[model.idAttribute] && params.ignoreModelID !== true) {
            params.url += "/" + payload[model.idAttribute];
          }



          // build url with parameters, if needed
          if (params.urlparams) {
            params.url = encodeData(params.urlparams, params.url);
          }
          if (!params.urlparams && params.type !== "POST" && params.data) {
            // If we have set optional parameters on the request we should use it
            // when params.urlparams fails/is empty.
            params.url = encodeData(params.data, params.url);
          }


          //
          // Execute HTTP Call
          //
          http_request(params, function(response) {
            // Success
            if (response.success) {
              if (model.parent) {
                var res = JSON.parse(response.responseText)[model.parent];
              } else {
                var res = JSON.parse(response.responseText);
              }
              // Call Success for triggering Events by Backbone
              params.success(res);
              if (params.skipPromise) {
                //
              } else {
                return deferred.resolve(res);
              }
            } else {
              return deferred.reject(response.responseText);
            }
          });
        }// 'read' case






        // -------------------------------------------------------
        //
        // CREATE - POST
        //
        // -------------------------------------------------------
        case "create": {
          // Add data
          //if (payload.filedata) {
          //  params.data = payload.filedata;
          //} else {
          params.data = JSON.stringify(payload);
          //}

          //
          // Make HTTP Call
          //
          http_request(params, function(response) {
            if (response.success) {
              var res = JSON.parse(response.responseText);

              // Call Success
              params.success(res);
              return deferred.resolve(res);
            } else {
              var err = JSON.parse(response.responseText);
              params.error(err);
              return deferred.reject(err);
            }
          });
        } // 'create' case


        // -------------------------------------------------------
        //
        // UPDATE - PUT
        //
        // -------------------------------------------------------
        case "update":

        // Detect if it should read a specified Model
        if (payload[model.idAttribute]) {
          params.url += "/" + payload[model.idAttribute];
        }

        //
        // Only send new/changes Fields
        //
        //TODO: Detect which values changed and only upload them
        /*if(Object.size(params.changes) > 0){
        var d = {};
        for (var c in params.changes){
        d[c] = payload[c]
      }
      params.data = JSON.stringify(d);
    }else{
    params.data = JSON.stringify(payload);
  }*/
  params.data = JSON.stringify(payload);

  // Make HTTP Call
  http_request(params, function(response) {
    if (response.success) {
      var res = JSON.parse(response.responseText);
      params.success(res);
      return deferred.resolve(res);
    } else {
      //var err = JSON.parse(response.responseText);
      params.error("err");
      return deferred.reject("err");
    }
  });
  break;


} // switch

} catch(error) {
  console.error(error);
}





return deferred.promise;
}// fn





/*
██   ██ ████████ ████████ ██████      ██████  ███████  ██████  ██    ██ ███████ ███████ ████████
██   ██    ██       ██    ██   ██     ██   ██ ██      ██    ██ ██    ██ ██      ██         ██
███████    ██       ██    ██████      ██████  █████   ██    ██ ██    ██ █████   ███████    ██
██   ██    ██       ██    ██          ██   ██ ██      ██ ▄▄ ██ ██    ██ ██           ██    ██
██   ██    ██       ██    ██          ██   ██ ███████  ██████   ██████  ███████ ███████    ██
▀▀
*/
/**
* Helper Function to easily make HTTP Requests
* @param  {[type]}   options  [description]
* @param  {Function} callback [description]
* @return {[type]}            [description]
*/
function http_request(options, callback) {

  // Check if Internet Connection is available, otherwise use local Data
  if (Titanium.Network.online) {

    // Create new Client
    var xhr = Titanium.Network.createHTTPClient();

    // Request is successfull
    xhr.onload = function() {
      callback({
        success : true,
        code : this.status,
        responseText : this.responseText,
      });
    }
    // Request failed
    xhr.onerror = function() {
      console.error(this.responseText);
      console.error(this.status);
    }
    // Set Timeout for each Request
    xhr.timeout = timeout;

    // Open a new Connection
    xhr.open(options.type, options.url);

    // Set Session-Token Header, if available
    if (session_token != null) {
      xhr.setRequestHeader("X-Parse-Session-Token", session_token);
    }

    // Set Content-Type for POST & PUT Operations only
    if( xhr.type === "POST" || xhr.type === "PUT"){
      xhr.setRequestHeader("Content-Type", "application/json");
    }

    // Set Headers required for Parse
    xhr.setRequestHeader("X-Parse-Application-Id", app_key);
    xhr.setRequestHeader("X-Parse-REST-API-Key", rest_key);

    // Add custom Headers
    if (options.customHeader) {
      _.each(options.customHeader, function(rqh) {
        xhr.setRequestHeader(rqh.name, rqh.value);
      });
    }


    // Send the request
    xhr.send(options.data);
  } else {
    // Do offline Stuff
    // Handle Method to return data or store the POST/PUT/DELETE Requst

  }
}





/*
███    ███ ██ ██   ██ ██ ███    ██
████  ████ ██  ██ ██  ██ ████   ██
██ ████ ██ ██   ███   ██ ██ ██  ██
██  ██  ██ ██  ██ ██  ██ ██  ██ ██
██      ██ ██ ██   ██ ██ ██   ████
*/



var SyncMixin = {
  sync : function() {
    return Parse.Backbone.sync.apply(this, arguments);
  }
};


/*
██    ██ ███████ ███████ ██████
██    ██ ██      ██      ██   ██
██    ██ ███████ █████   ██████
██    ██      ██ ██      ██   ██
██████  ███████ ███████ ██   ██
*/

var loginDefer;
var refreshDefer;


Parse.Backbone.UserMixin = _.extend({}, SyncMixin, {
  idAttribute : 'objectId',
  config : {
    //
  },
  url : "users",


  /**
  * [login description]
  * @param  {[type]} params [description]
  * @return {[type]}        [description]
  */
  login : function(params){
    loginDefer = Q.defer();

    if(params.username == null || params.password == null){
      deferred.reject();
    }

    // Opts
    var opts = {};

    // Params
    opts.urlparams = {
      username : params.username,
      password : params.password
    };

    opts.success = onUserLogin;
    opts.error = function(error){
      console.error(error)
    }

    // Adjust URL
    opts.url = base_url + "login";
    opts.type = "GET";
    opts.url = encodeData(opts.urlparams, opts.url);

    // Make HTTP Call
    http_request(opts, function(response) {
      if(response.success){
        onUserLogin(JSON.parse(response.responseText));
      }else{
        console.error(response.responseText)
        loginDefer.reject("error");
      }
    });
    return loginDefer.promise;
  },

  /**
   * Refreshes the active_user and return it
   * @return {[type]} [description]
   */
  me : function() {
    refreshDefer = Q.defer();

    // Opts
    var opts = {};

    // Success Handler
    opts.success = onRefreshUser;

    // Adjust URL
    opts.url = base_url + "users/me";
    opts.type = "GET";

    // Return Method
    // Make HTTP Call
    http_request(opts, function(response) {
      if(response.success){
        onRefreshUser(JSON.parse(response.responseText));
      }else{
        console.error(response.responseText)
        refreshDefer.reject("error");
      }
    });
    return refreshDefer.promise;
  },




});


/**
* [onUserLogin description]
* @return {[type]} [description]
*/
function onUserLogin(model) {

  // Set Active User
  //v/ar UserModel = Backbone.Model.extend({});
  //_.extend(UserModel.prototype, Parse.Backbone.UserMixin);
  active_user = new UserModel(model);

  // Set Session Token
  session_token = active_user.get('sessionToken');


  // Save Session in Database
  if( coll_statics.findOne({key : "session_token"}) ){
    console.log("Session token available --> Update");
    var o = coll_statics.findOne({key : "session_token"});
    o.value = session_token;
  }else {
    console.log("Session token is not available");
    coll_statics.insert({
      key : "session_token",
      value : session_token
    });
  }


  // Save active_user in Database
  if( coll_statics.findOne({key : "active_user"}) ){
    var o = coll_statics.findOne({key : "active_user"});
    o.value = model;
  }else {
    coll_statics.insert({
      key : "active_user",
      value : model
    });
  }

  loginDefer.resolve(active_user);
}


/**
* [onRefreshUser description]
* @param  {[type]} model    [description]
*/
function onRefreshUser(model) {
  // Update Active User in Properties
  var o = coll_statics.findOne({key : "active_user"});
  o.value = model;


  //var UserModel = Backbone.Model.extend({});
  //_.extend(UserModel.prototype, Parse.Backbone.UserMixin);
  active_user = new UserModel(model);

  refreshDefer.resolve(active_user);
}


/*
███    ███  ██████  ██████  ███████ ██
████  ████ ██    ██ ██   ██ ██      ██
██ ████ ██ ██    ██ ██   ██ █████   ██
██  ██  ██ ██    ██ ██   ██ ██      ██
██      ██  ██████  ██████  ███████ ███████
*/



Parse.Backbone.ModelMixin = _.extend({}, SyncMixin, {
  idAttribute : 'objectId',
  config : {
  },
  initialize : function() {
    // Set Classname for caching and stuff
    this.classname = this.url;

    // Set custom URL for Parse-Requests
    this.url = "classes/" + this.url;
  }
});


Parse.Backbone.CollectionMixin = _.extend({}, SyncMixin, {
  idAttribute : 'objectId',
  parent : 'results',
  config : {
  },
  initialize : function() {
    // Set Classname for caching and stuff
    this.classname = this.url;

    // Set custom URL for Parse-Requests
    this.url = "classes/" + this.url;
  },
});










function encodeData(obj, url) {
  var str = [];
  for (var p in obj) {
    str.push(Ti.Network.encodeURIComponent(p) + "=" + Ti.Network.encodeURIComponent(obj[p]));
  }
  if (_.indexOf(url, "?") == -1) {
    return url + "?" + str.join("&");
  } else {
    return url + "&" + str.join("&");
  }
}








return Parse;
}
var Parse = parseFn();
module.exports = Parse;
})();
