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
* Timeout for Server-Requests
* @type {Number}
*/
var timeout = 10000;

/**
* User Class
* @type {String}
*/
var USERS = 'users';

/**
* Custom Class
* @type {String}
*/
var CLASSES = 'classes';

/**
* File Class
* @type {String}
*/
var FILES = 'files';

var PARSE_ERROR_BASE_URL_MISSING = "Please provide a valid Base URL as Endpoint";

var initdeferred;


/**
* Device Token for Push
* @type {[type]}
*/
var device_token = null;

/**
* [push_send description]
* @type {Boolean}
*/
var push_register = false;

var pushCallback;

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
						/*("Active User Restore: " + coll_statics.findOne({
						key : "active_user"
					}).value.first_name);*/

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
						active_user.me().then(function(response) {
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
				console.error("Please specify your FileType like image/jpeg");
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



		/**
		* Setup Push for Android and iOS
		* @param  {[type]} opts [description]
		* @return {[type]}      [description]
		*/
		initPush : function(opts){
			pushCallback = opts.callback;

			if(OS_IOS){

				//var deviceToken = null;

				// Check if the device is running iOS 8 or later
				if (Ti.Platform.name == "iPhone OS" && parseInt(Ti.Platform.version.split(".")[0]) >= 8) {

					// Wait for user settings to be registered before registering for push notifications
					Ti.App.iOS.addEventListener('usernotificationsettings', function registerForPush() {

						// Remove event listener once registered for push notifications
						Ti.App.iOS.removeEventListener('usernotificationsettings', registerForPush);

						Ti.Network.registerForPushNotifications({
							success: registerPushSuccess,
							error: registerPushError,
							callback: pushCallback
						});
					});

					// Register notification types to use
					Ti.App.iOS.registerUserNotificationSettings({
						types: [
							Ti.App.iOS.USER_NOTIFICATION_TYPE_ALERT,
							Ti.App.iOS.USER_NOTIFICATION_TYPE_SOUND,
							Ti.App.iOS.USER_NOTIFICATION_TYPE_BADGE
						]
					});
				}
				// For iOS 7 and earlier
				else {
					Ti.Network.registerForPushNotifications({
						// Specifies which notifications to receive
						types: [
							Ti.Network.NOTIFICATION_TYPE_BADGE,
							Ti.Network.NOTIFICATION_TYPE_ALERT,
							Ti.Network.NOTIFICATION_TYPE_SOUND
						],
						success: registerPushSuccess,
						error: registerPushError,
						callback: pushCallback
					});
				}

			}else{


				try{
				var FCM = require('ti.fcm');
				FCM.registerForPushNotifications({
					// The callback to invoke when a notification arrives.
					callback: function(e){
						pushCallback(e);
					},

					// The callback invoked when you have the device token.
					success: function(e){
						console.log("PUSH SUCCESS", e);
						registerPushSuccess(e);
					},

					// The callback invoked on some errors.
					error: function(e){
						console.log("PUSH ERROR");
						registerPushError("error");
					}
				});
			}catch(error){
				alert(error);
			}
				/*var TiGoosh = require('ti.goosh');
				TiGoosh.registerForPushNotifications({
				// The callback to invoke when a notification arrives.
				callback: pushCallback,

				// The callback invoked when you have the device token.
				success: registerPushSuccess,

				// The callback invoked on some errors.
				error: registerPushError
			});*/
		}
	},


	/**
	* Register Device with Parse Backend
	* @param  {[type]} opts [description]
	* @return {[type]}      [description]
	*/
	registerForPush : function(opts) {
		var cloudDefer = Q.defer();

		var params = {};
		params.url = base_url + "installations";
		params.type = "POST";
		params.options = {
			"deviceType": (OS_IOS) ? "ios" :"android",
			"deviceToken" : opts.token,
			"channels": [
				""
			]
		};

		if(OS_ANDROID){
			params.options["pushType"] =  "gcm";
			params.options["GCMSenderId"] = "561148704207";
		}


		var xhr = Titanium.Network.createHTTPClient({
		});

		xhr.onload = function(){
			console.log("PUSH REGISTER SUCCESS");
			cloudDefer.resolve( JSON.parse(this.responseText) );
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
	},

	/**
	* [runCloudCode description]
	* @param  {[type]} options [description]
	* @return {[type]}         [description]
	*/
	runCloudCode : function(params) {
		try {

			var cloudDefer = Q.defer();
			params.url = base_url + "functions/" + params.name;
			params.type = "POST";

			var xhr = Titanium.Network.createHTTPClient({
			});

			xhr.onload = function() {
				cloudDefer.resolve(JSON.parse(this.responseText).result);
			}

			xhr.onerror = function() {
				console.error(this.responseText);
			}
			// Set Timeout
			xhr.timeout = 5000;

			// Open Connection
			xhr.open("POST", params.url);

			if (session_token != null) {
				xhr.setRequestHeader("X-Parse-Session-Token", session_token);
			}

			// Set Headers required for Parse
			xhr.setRequestHeader("X-Parse-Application-Id", app_key);
			xhr.setRequestHeader("X-Parse-REST-API-Key", rest_key);
			xhr.setRequestHeader("Content-Type", "application/json");

			xhr.send(JSON.stringify(params.options));

			return cloudDefer.promise;
		} catch (error) {
			console.error(error);
		}
	}
};




/*
██████  ██    ██ ███████ ██   ██
██   ██ ██    ██ ██      ██   ██
██████  ██    ██ ███████ ███████
██      ██    ██      ██ ██   ██
██       ██████  ███████ ██   ██
*/

/**
* Called if a Push is received
* @return {[type]} [description]
*/
function callbackPush(e){

	if(e.inBackground){
		//pushInBackground(e.data);
	}else{
		//pushInForeground(e.data);
	}

}






/**
* Called if the Push is registered on Android or iOS
* @param  {[type]} e [description]
* @return {[type]}   [description]
*/
function registerPushSuccess(e){
	console.debug("Push ::: registerPushSuccess", e);

	// Set device_token
	if(OS_IOS){
		device_token = e.deviceToken;
	}else{
		device_token = e.deviceToken;
	}

	// Register for Push on Parse
	//if(!push_register){
	TiParse.registerForPush({
		token : device_token
	}).then(function(response){
		console.debug("REGISTER PUSH WITH PARSE SUCCESS ::: " + device_token);
	});
	push_register = true;
	//}

}


/**
* Error registering Push on Android or iOS
* @param  {[type]} e [description]
* @return {[type]}   [description]
*/
function registerPushError(e){
	console.debug("Push ::: registerPushError", e);
}



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
	Titanium.Network.addEventListener('change', onNetworkChange);

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

	db.deleteDatabase();
}

/**
* Handles Network Changes automaticly
* @param  {[type]} e [description]
* @return {[type]}   [description]
*/
function onNetworkChange(e) {
	console.debug("TRAINADOO :::: NETWORK CHANGE");
}

/*if (response.success) {
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
}*/

/**
* Get Models from Cache-Database
* @param  {[type]} params [description]
* @return {[type]}        [description]
*/
function readFromDatabase(params, _callback) {

	//console.log(params);
	try {

		if (params.className !== "users" && params.className !== undefined) {

			// Check if Collection is already available
			var _collection = db.getCollection(params.className);
			//console.log("_collection: " + _collection);
			//console.log("_collection: " + _collection.find());

			var results = _collection.find({
				//limit : 20,
				//skip : 0
			});

			// Callback
			_callback({
				code : 200,
				responseText : JSON.stringify(results)
			});
		}

	} catch(error) {
		console.error(error);
	}

}

/**
* Save Data to the local Database / Cache
* @return {[type]} [description]
*/
function saveToDatabase(params) {

	// Exclude Users
	if (params.className !== "users" && params.className !== undefined) {
		//console.debug("DATABASE :::: save to Database: " + params.className);

		// Check if Collection is already available
		var _collection = db.getCollection(params.className);
		if (_collection == null) {
			_collection = db.addCollection(params.className, {
				unique : ['objectId'],
				indices : ['objectId'],
				autoupdate : true
			});
		} else {
			//
		}

		// Parse Results to JSON
		var _json = JSON.parse(params.data).results;

		// Insert all Data to Local-Collection
		_.each(_json, function(item) {
			if (_collection.findOne({
				'objectId' : item.objectId
			})) {
				_collection.chain().find({
					'objectId' : item.objectId
				}).update(function updateCB(obj) {
					_.extend(obj, item);
					return item;
				});
			} else {
				//console.log("Not found item");
				_collection.insert(item);
			}
		});
	} // else
}// Fn

/**
* Saves a remote File to the device Filesystem
* @return {[type]} [description]
*/
function saveFileToCache(f_blob, f_name, f_extension) {
	// Blob
	var image = "";
	//event.media

	// Create a file name
	var filename = f_name + "." + f_extension;

	// Create the file in the application directory
	file = Titanium.Filesystem.getFile(Titanium.Filesystem.applicationDataDirectory, filename);

	// Write the image to the new file (image created from camera)
	file.write(image);

	console.log("FILE: " + file);

	/*images[i] = Ti.UI.createImageView({
	image: Titanium.Filesystem.applicationDataDirectory + Ti.Filesystem.separator + imageArray[i].image, // path to image at applicationDataDirectory
	width: 75,
	height: 96,
	left: pushleft + 5, // logic for positioning
	top: pushtop + 5, // logic for positioning
	store_id: imageArray[i].id
});*/

}

/**
* Download an Image from an URL
* @return {[type]} [description]
*/
function downloadImage(_url) {
	var downloadDefer = Q.defer();

	// Create XHR
	var xhr = Titanium.Network.createHTTPClient();
	xhr.onload = function() {
		var blob = this.responseText;
		//console.log("Blob: " + blob.length);
		downloadDefer.resolve(blob);
	}
	xhr.onerror = function() {
		downloadDefer.reject("Error");
	}
	xhr.open('GET', _url);
	xhr.send();

	return downloadDefer.promise;
}

// Download Image
/*downloadImage("https://pg-app-uiim3t3gldv0bbx8gdjyrshkwwjl27.s3.amazonaws.com/fff7ef994f6f9203f458d3f4d853565e_83.jpg").then(function(_blob) {
alert("Image downloaded")

// Save File to Cache
saveFileToCache(_blob, "test", "jpg");

});*/






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
	classNameUser : "_User"
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
	//console.log("-----------------------");
	//c/onsole.log("-------- Sync ---------");
	//console.log("-----------------------");

	// Type
	var type = methodMap[method];

	// Create Params Object
	var params = _.extend({}, options);

	// Payload
	var payload = model.toJSON();

	// Set Type
	params.type = options.requestMethod || type;

	// Set Classname for caching Purpose
	params.className = model.getClassName();

	// Custom URL
	params.url = (options.url ) ? base_url + params.url : base_url + model.url;

	// Extend the provided url params with those from the model config
	if (_.isObject(params.urlparams) || model.config.URLPARAMS) {
		params.urlparams = params.urlparams || {};
		_.extend(params.urlparams, _.isFunction(model.config.URLPARAMS) ? model.config.URLPARAMS() : model.config.URLPARAMS);
	}

	//console.log("Method: " + method);

	switch( method ) {

		/*
		########  ########    ###    ########
		##     ## ##         ## ##   ##     ##
		##     ## ##        ##   ##  ##     ##
		########  ######   ##     ## ##     ##
		##   ##   ##       ######### ##     ##
		##    ##  ##       ##     ## ##     ##
		##     ## ######## ##     ## ########
		*/
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
		if (params.customMethod) {
			params.type = "POST";
			var _url = base_url + "functions/" + params.customMethod;
			params.url = encodeData(params.customparams, _url);
			params.data = JSON.stringify(params.options);

			/*console.log("URL: " + params.url);
			console.log("URL: " + params.data);
			console.log(params.urlparams);
			console.log(params.customparams);
			console.log(JSON.stringify(params.options));*/
		}

		//
		// Execute HTTP Call
		//
		http_request(params, function(response) {

			try {
				if (params.customMethod && response.success) {
					var json = JSON.parse(response.responseText).result;


					_.each(json, function(item) {
						Alloy.Collections[params.collname].add(new M_Event(item));
					});
					Alloy.Collections[params.collname].trigger("change");


					deferred.resolve(json);
				} else {
					if (response.success) {

						//console.log(response.responseText);
						//console.log(model.parent)

						// Only try to parse parent Element if available in model AND App is online
						if (model.parent && Titanium.Network.online) {
							var res = JSON.parse(response.responseText)[model.parent];
						} else {
							var res = JSON.parse(response.responseText);
						}

						//console.log("RES: " + res);

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

			} catch(error) {
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

		//console.log("changes: ", params.changes );

		if (Object.size(params.changes) > 0) {
			var d = {};
			for (var c in params.changes) {
				d[c] = payload[c]
			}
			params.data = JSON.stringify(d);
		} else {
			params.data = {};//payload;
		}

		//console.log("Params: " , params);

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

		case "delete":
		// Detect if it should read a specified Model
		if (payload[model.idAttribute]) {
			params.url += "/" + payload[model.idAttribute];
		}

		// Make HTTP Call
		http_request(params, function(response) {
			if (response.success) {
				var res = JSON.parse(response.responseText);
				params.success(res);
				deferred.resolve(res);
			} else {
				params.error(response.responseText);
				deferred.reject();
			}
		});
		break;

	}// switch


	// Return Promise
	if (options.url == "login") {
		return loginDefer.promise;
		//}else if(options.url = "users/me"){
		//	return refreshDefer.promise;
	} else {
		return deferred.promise;
	}
}// fn

Object.size = function(obj) {
	var size = 0, key;
	for (key in obj) {
		if (obj.hasOwnProperty(key)) size++;
	}
	return size;
};

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

	//console.log("Options", options);

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

			//
			// Save Results to Database
			//
			saveToDatabase({
				className : options.className,
				data : this.responseText
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
		if (session_token != null) {
			xhr.setRequestHeader("X-Parse-Session-Token", session_token);
		}

		// Set Content-Type for POST & PUT Operations only
		xhr.setRequestHeader("Content-Type", "application/json");

		// Set Headers required for Parse Server
		xhr.setRequestHeader("X-Parse-Application-Id", app_key);
		xhr.setRequestHeader("X-Parse-REST-API-Key", rest_key);

		// Add custom Headers
		if (options.customHeader) {
			_.each(options.customHeader, function(rqh) {
				xhr.setRequestHeader(rqh.name, rqh.value);
			});
		}

		try {
			if (xhr.type === "PUT") {
				xhr.send(options.data);
			} else {
				xhr.send(options.data);
				//JSON.stringify(options.data)
			}
		} catch(error) {
			console.error(error);
		}

	} else {
		// Do offline Stuff
		// Handle Method to return data or store the POST/PUT/DELETE Requst

		readFromDatabase({
			className : options.className
		}, function(response) {
			try {
				callback({
					success : true,
					code : response.status,
					responseText : response.responseText,
				});
			} catch(error) {
				console.error(error);
			}

		});

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
var providerDefer;

Parse.Backbone.UserMixin = _.extend({}, SyncMixin, {
	idAttribute : 'objectId',
	config : {
		//
	},
	url : "users",
	initialize : function() {
		// Set Classname for caching and stuff
		this.className = this.url;
	},

	getClassName : function() {
		return this.className.toString();
	},

	register : function(params) {
		registerDefer = Q.defer();

		var opts = {};
		// Adjust URL
		//
		opts.url = base_url + "users";
		opts.type = "POST";

		// Parse Params to opts.data
		opts.data = '{';
		for( o in params){
			//if(o == "username"){
			//opts.data += '"'+o+'":"'+ params[o]+'"';
			//}else{
			opts.data += '"'+o+'":"'+ params[o]+'",';
			//}
		}

		//console.debug(opts.data.lastIndexOf(',') + ", " + opts.data.length);
		if(opts.data.lastIndexOf(',') == (opts.data.length-1) ){
			//console.debug("KILL KOMMA");
			opts.data = opts.data.substring(0, opts.data.length - 1);
		}

		opts.data += '}';
		//console.debug("Opts data: ", opts.data);

		// Call HTTP Request
		http_request(opts, function(response) {
			if (response.success) {
				onUserRegister(JSON.parse(response.responseText));
			} else {
				console.error(JSON.stringify(response));
				return registerDefer.reject(response.responseText);
			}
		});
		return registerDefer.promise;
	},

	/**
	* Register with Facebook
	* @param  {[type]} params [description]
	* @return {[type]}        [description]
	*/
	registerWithFacebook : function(params) {
		registerDefer = Q.defer();
		try{

			var opts = {};
			// Adjust URL
			//
			opts.url = base_url + "users";
			opts.type = "POST";

			// Data String
			//opts.data = '{"last_name":"' + params.last_name + '","first_name":"' + params.first_name + '","username":"' + params.username + '","authData" : {"facebook" : {"id" : "' + params.userid + '","access_token" :	"' + params.access_token + '","expiration_date" : "' + params.expiration_date + '"}}}';

			opts.data = {
				firstname : params["first_name"],
				lastname : params["last_name"],
				fullname : params["fullname"],
				username : params["username"],
				email : params["username"],
				authData : {
					facebook : {
						id : params["userid"],
						access_token : params["access_token"],
						expiration_date : params["expiration_date"]
					}
				}
			};
			// Parse the Object
			opts.data = JSON.stringify(opts.data);

		}catch(error){
			console.error(error);
		}


		// Make HTTP Request
		http_request(opts, function(response) {
			if (response.success) {
				onUserRegister(JSON.parse(response.responseText));
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
			if (response.success) {
				// Set session_token to null
				session_token = null;

				// Set active_user to null
				active_user = null;

				if(FACEBOOK){
					FACEBOOK.logout();
				}

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




function onUserRegister(model){
	// Set Active User
	active_user = new basic_userModel(model);

	// Set Session Token
	session_token = active_user.get('sessionToken');

	// Save Session in Database
	if (coll_statics.findOne({
		key : "session_token"
	})) {
		console.log("USER REGISTER Session token available --> Update");
		var o = coll_statics.findOne({
			key : "session_token"
		});
		o.value = session_token;
	} else {
		console.log("USER REGISTER Token is not available --> Create");
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

	registerDefer.resolve(active_user);
}




/**
* [onUserLogin description]
* @return {[type]} [description]
*/
function onUserLogin(model) {
	try{
		console.debug("onUserLogin");
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
	}catch(error){
		console.error(error);
	}
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
		this.className = this.url;

		// Set custom URL for Parse-Requests
		this.url = "classes/" + this.url;
	},
	getClassName : function() {
		return this.className.toString();
	}
});

Parse.Backbone.CollectionMixin = _.extend({}, SyncMixin, {
	idAttribute : 'objectId',
	parent : 'results',
	config : {
	},
	initialize : function() {
		// Set Classname for caching and stuff
		this.className = this.url;

		// Set custom URL for Parse-Requests
		this.url = "classes/" + this.url;
	},
	getClassName : function() {
		return this.className.toString();
	}
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
