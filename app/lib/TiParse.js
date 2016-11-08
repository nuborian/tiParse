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
* The custom User Model to use in all cases
* @type {[type]}
*/
var basic_userModel = null;

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
var timeout = 10000;

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

				// Check if a custom UserModel is provided
				if (options.usermodel == null) {
					errorCaller("Provide a usermodel please");
					deferred.reject("Provide a usermodel please");
					return;
				}

				// Set Base Options
				base_url = options.base_url;
				app_key = options.app_key;
				rest_key = options.rest_key;
				basic_userModel = options.usermodel;

				// Setup Loki Database
				setupLokiDatabase().then(function() {
					console.debug("TiParse :::::: Assign Keys");
					//
					// Check Session Token
					//
					if (coll_statics.findOne({
						key : "session_token"
					})) {
						console.debug("TiParse :::::: Session Token is available");

						// Restore Session_token from Database
						session_token = coll_statics.findOne({
							key : "session_token"
						}).value;

						// Restore active_user from Database
						console.log("Active User Restore: " + coll_statics.findOne({
							key : "active_user"
						}).value.first_name);

						active_user = new basic_userModel(coll_statics.findOne({
							key : "active_user"
						}).value);

						//
						// Check Online-Status
						//
						if (Titanium.Network.online) {
							//
							// Update Active User
							//
							active_user.me().then(function(response){
								initdeferred.resolve(active_user);
							});
						} else {
							initdeferred.resolve(active_user);
						}
					} else {
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
			uploadFile : function(options) {
				var deferred = Q.defer();

				if (!options.filename) {
					console.error("Please provide a filename");
				}
				if (!options.filedata) {
					console.error("Please provide a valid File");
				}
				if (!options.filetype) {
					console.error("Please specify your FileType");
				}
				if (!options.extension) {
					console.error("Please specify your File extension like png, jpg, txt, etc.");
				}

				// Set Params for Files
				var params = {};
				params.type = "POST";
				params.url = base_url + "files/" + options.filename + "." + options.extension;
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

			registerPush : function() {
				// Logic for Register Push
			},


			/**
			* [runCloudCode description]
			* @param  {[type]} options [description]
			* @return {[type]}         [description]
			*/
			runCloudCode : function(params){
				try {


					var cloudDefer = Q.defer();
					params.url = base_url + "functions/" + params.name;
					params.type = "POST";

					var xhr = Titanium.Network.createHTTPClient({
					});

					xhr.onload = function(){
						cloudDefer.resolve( JSON.parse(this.responseText).result );
					}

					xhr.onerror = function(){
						console.error(this.responseText);
					}


					// Set Timeout
					xhr.timeout = 5000;

					// Open Connection
					xhr.open("POST", params.url);

					if(session_token != null){
						xhr.setRequestHeader("X-Parse-Session-Token", session_token);
					}

					// Set Headers required for Parse
					xhr.setRequestHeader("X-Parse-Application-Id", app_key);
					xhr.setRequestHeader("X-Parse-REST-API-Key", rest_key);
					xhr.setRequestHeader("Content-Type", "application/json");



					xhr.send( JSON.stringify(params.options) );

					return cloudDefer.promise;
				} catch (error) {
					console.error(error);
				}
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
			db = new Loki('loki.db', {
				autoload : true,
				autoloadCallback : loadHandler,
				autosave : true,
				autosaveInterval : 10000,
			});

			// Return Promise
			return dbDefer.promise;
		}

		function loadHandler() {
			coll_statics = db.getCollection('tiparse');
			if (coll_statics == null) {
				coll_statics = db.addCollection('tiparse');
			} else {
				//
			}

			// Resolve
			dbDefer.resolve();
		}

		/**
		* [deleteDatabase Delete the Database]
		* @return {[type]} [description]
		*/
		function deleteDatabase() {
			db.removeCollection('tiparse');
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

		Parse.Backbone.sync = function(method, model, options) {
			var deferred = Q.defer();
			console.log("-----------------------");
			console.log("-------- Sync ---------");
			console.log("-----------------------");

			//console.log("MODEL: " + JSON.stringify(model));

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
				case "read":

				// Detect if it should read a specified Model
				if (payload[model.idAttribute] && params.ignoreModelID !== true && params.url.indexOf("users/me") === -1) {
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

				// Custom Endpoints for fetch Method
		    if(params.customMethod){
		      params.type = "POST";
		      var _url = base_url + "functions/" + params.customMethod;
		      params.url = encodeData(params.urlparams, _url);
		      params.data = JSON.stringify(params.options);
		    }


				//
				// Execute HTTP Call
				//
				http_request(params, function(response) {
					try{
						//console.log(response);
					if(params.customMethod && response.success){
							var json = JSON.parse(response.responseText).result;
			        _.each(json, function(item){
			          Alloy.Collections[params.collname].add( new M_Event(item));
			        });

			        Alloy.Collections[params.collname].trigger("change");
			        deferred.resolve(json);
					}else{
						if (response.success) {
							if (model.parent) {
								var res = JSON.parse(response.responseText)[model.parent];
							} else {
								var res = JSON.parse(response.responseText);
							}

							// Write to local Database
							//db_write_Cache(params.class, res);
							params.success(res);

							if (params.skipPromise) {
								//
							} else {
								deferred.resolve(res);
							}
						} else {
							params.error(response);
							deferred.reject(response);
						}
					}

				}catch(error){
							console.error(error);
						}

				});

				break;

				// -------------------------------------------------------
				//
				// CREATE - POST
				//
				// -------------------------------------------------------
				case "create":
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
						deferred.resolve(res);
					} else {
						var err = JSON.parse(response.responseText);
						params.error(err);
						deferred.reject(err);
					}
				});
				break;

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

				//params.data = JSON.stringify(payload);

				if(Object.size(params.changes) > 0){
		      var d = {};
		      for (var c in params.changes){
		        d[c] = payload[c]
		      }
		      params.data = JSON.stringify(d);
		    }else{
		      params.data = payload;	//JSON.stringify(payload);
		    }


				console.log("params.data:" + params.data);


				// Make HTTP Call
				http_request(params, function(response) {
					if (response.success) {
						var res = JSON.parse(response.responseText);
						params.success(res);
						deferred.resolve(res);
					} else {
						//var err = JSON.parse(response.responseText);
						params.error("err");
						deferred.reject("err");
					}
				});
				break;

			}// switch


			// Return Promise
			if(options.url == "login"){
				return loginDefer.promise;
				//}else if(options.url = "users/me"){
				//	return refreshDefer.promise;
			}else{
				return deferred.promise;
			}
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
			//console.log("call http_request with URL: " + options.url);

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
					callback({
						success : false,
						code : this.status,
						responseText : this.responseText,
					});
				}
				// Set Timeout for each Request
				xhr.timeout = timeout;


				// Open a new Connection
				xhr.open(options.type, options.url);


				// Set Session-Token Header, if available
				//console.log("Session-Token: " + session_token);
				if (session_token != null) {
					xhr.setRequestHeader("X-Parse-Session-Token", session_token);
				}

				// Set Content-Type for POST & PUT Operations only
				//if (options.type == "POST" || options.type == "PUT") {
					xhr.setRequestHeader("Content-Type", "application/json");
				//}

				// Set Headers required for Parse Server
				xhr.setRequestHeader("X-Parse-Application-Id", app_key);
				xhr.setRequestHeader("X-Parse-REST-API-Key", rest_key);

				// Add custom Headers
				if (options.customHeader) {
					_.each(options.customHeader, function(rqh) {
						xhr.setRequestHeader(rqh.name, rqh.value);
					});
				}


				console.log("Options: ", options)
				//console.log( "data: " + JSON.stringify(options.data));

				if(xhr.type === "PUT"){
					xhr.send(options.data);
					//xhr.send( JSON.stringify(options.data));
				}else{
					xhr.send(options.data);
				}
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
		var registerDefer;
		var logoutDefer;

		Parse.Backbone.UserMixin = _.extend({}, SyncMixin, {
			idAttribute : 'objectId',
			config : {
				//
			},
			url : "users",

			register : function(params) {
				registerDefer = Q.defer();

				var opts = {};
				// Adjust URL
				//
				opts.url = base_url + "users";
				opts.type = "POST";

				// Params
				opts.data = '{"username":"' + params.username + '","password":"' + params.password + '"}';

				http_request(opts, function(response) {
					if (_response.success) {
						var res = JSON.parse(response.responseText);
						//onUserRegistration();
						registerDefer.resolve(res);
					} else {
						console.error(response.responseText);
						return registerDefer.reject(response.responseText);
					}
				});

				return registerDefer.promise;
			},

			/**
			* [login description]
			* @param  {[type]} params [description]
			* @return {[type]}        [description]
			*/
			login : function(params) {
				loginDefer = Q.defer();

				if (params.username == null || params.password == null) {
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
				opts.error = function(error) {
					console.error(error)
				}
				// Adjust URL
				opts.url = base_url + "login";
				opts.type = "GET";
				opts.url = encodeData(opts.urlparams, opts.url);

				// Make HTTP Call
				http_request(opts, function(response) {
					if (response.success) {
						onUserLogin(JSON.parse(response.responseText));
					} else {
						console.error(response.responseText)
						loginDefer.reject("error");
					}
				});
				return loginDefer.promise;
			},

			/**
			* Logouts the active_user
			* @return {[type]} [description]
			*/
			logout : function() {
				logoutDefer = Q.defer();

				var opts = {};

				// Adjust URL
				opts.url = base_url + "logout";
				opts.type = "POST";

				//
				// Make HTTP Call
				//
				http_request(opts, function(response) {
					if (_response.success) {

						// Set session_token to null
						session_token = null;

						// Set active_user to null
						active_user = null;

						// Delete Database after Logout
						deleteDatabase();

						logoutDefer.resolve();
					} else {
						console.error(response.responseText);
						return logoutDefer.reject(response.responseText);
					}
				});

				return logoutDefer.promise;
			},

			/**
			* Refreshes the active_user and return it
			* @return {[type]} [description]
			*/
			me : function() {
				//refreshDefer = Q.defer();

				// Opts
				var opts = {};

				// Success Handler
				opts.success = onRefreshUser;
				//opts.skipPromise = true;

				// Adjust URL
				opts.url = "users/me";
				//opts.type = "GET";

				return Backbone.Model.prototype.fetch.call(this, opts);
			},

			save : function(attrs, options) {
				var opts = options || {};

				// Classname
				opts.classname = "user";

				// Return Method
				return Backbone.Model.prototype.save.call(this, attrs, opts);
			}

		});

		/**
		* [onUserLogin description]
		* @return {[type]} [description]
		*/
		function onUserLogin(model) {

			//console.log("login", model);


			// Set Active User
			active_user = new basic_userModel(model);

			// Set Session Token
			session_token = active_user.get('sessionToken');

			// Save Session in Database
			if (coll_statics.findOne({
				key : "session_token"
			})) {
				console.log("Session token available --> Update");
				var o = coll_statics.findOne({
					key : "session_token"
				});
				o.value = session_token;
			} else {
				console.log("Session token is not available");
				coll_statics.insert({
					key : "session_token",
					value : session_token
				});
			}

			// Save active_user in Database
			if (coll_statics.findOne({
				key : "active_user"
			})) {
				var o = coll_statics.findOne({
					key : "active_user"
				});
				o.value = model;
			} else {
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
		function onRefreshUser(model, response, options) {

			// Update Active User in Properties
			var o = coll_statics.findOne({
				key : "active_user"
			});
			o.value = model.attributes;

			// Manually trigger a change each time me was called, even if no change is available
			active_user.trigger('change', model);
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
