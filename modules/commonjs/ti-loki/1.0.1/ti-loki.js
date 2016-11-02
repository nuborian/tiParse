(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.tiLoki = f()}})(function(){var define,module,exports;return (function e(t,n,r){function o(i,u){if(!n[i]){if(!t[i]){var a=typeof require=="function"&&require;if(!u&&a)return a.length===2?a(i,!0):a(i);if(s&&s.length===2)return s(i,!0);if(s)return s(i);var f=new Error("Cannot find module '"+i+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[i]={exports:{}};t[i][0].call(l.exports,function(e){var n=t[i][1][e];return o(n?n:e)},l,l.exports,e,t,n,r)}return n[i].exports}var i=Array.prototype.slice;Function.prototype.bind||Object.defineProperty(Function.prototype,"bind",{enumerable:!1,configurable:!0,writable:!0,value:function(e){function r(){return t.apply(this instanceof r&&e?this:e,n.concat(i.call(arguments)))}if(typeof this!="function")throw new TypeError("Function.prototype.bind - what is trying to be bound is not callable");var t=this,n=i.call(arguments,1);return r.prototype=Object.create(t.prototype),r.prototype.contructor=r,r}});var s=typeof require=="function"&&require;for(var u=0;u<r.length;u++)o(r[u]);return o})({1:[function(require,module,exports){
(function (console){
/*
  Loki IndexedDb Adapter (need to include this script to use it)

  Console Usage can be used for management/diagnostic, here are a few examples :
  adapter.getDatabaseList(); // with no callback passed, this method will log results to console
  adapter.saveDatabase('UserDatabase', JSON.stringify(myDb));
  adapter.loadDatabase('UserDatabase'); // will log the serialized db to console
  adapter.deleteDatabase('UserDatabase');
*/

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD
        define([], factory);
    } else if (typeof exports === 'object') {
        // Node, CommonJS-like
        module.exports = factory();
    } else {
        // Browser globals (root is window)
        root.LokiIndexedAdapter = factory();
    }
}(this, function () {
  return (function() {

    /**
     * Loki persistence adapter class for indexedDb.
     *     This class fulfills abstract adapter interface which can be applied to other storage methods. 
     *     Utilizes the included LokiCatalog app/key/value database for actual database persistence.
     *     Indexeddb is highly async, but this adapter has been made 'console-friendly' as well.
     *     Anywhere a callback is omitted, it should return results (if applicable) to console.
     *     IndexedDb storage is provided per-domain, so we implement app/key/value database to 
     *     allow separate contexts for separate apps within a domain.
     *
     * @example
     * var idbAdapter = new LokiIndexedAdapter('finance');
     *
     * @constructor LokiIndexedAdapter
     *
     * @param {string} appname - (Optional) Application name context can be used to distinguish subdomains, 'loki' by default
     */
    function LokiIndexedAdapter(appname)
    {
      this.app = 'loki';

      if (typeof (appname) !== 'undefined')
      {
        this.app = appname;
      }

      // keep reference to catalog class for base AKV operations
      this.catalog = null;

      if (!this.checkAvailability()) {
        throw new Error('indexedDB does not seem to be supported for your environment');
      }
    }

    /**
     * Used to check if adapter is available
     *
     * @returns {boolean} true if indexeddb is available, false if not.
     * @memberof LokiIndexedAdapter
     */
    LokiIndexedAdapter.prototype.checkAvailability = function()
    {
      if (typeof indexedDB !== 'undefined' && indexedDB) return true;

      return false;
    };

    /**
     * Retrieves a serialized db string from the catalog.
     *
     * @example
     * // LOAD
     * var idbAdapter = new LokiIndexedAdapter('finance');
     * var db = new loki('test', { adapter: idbAdapter });
     *   db.loadDatabase(function(result) {
     *   console.log('done');
     * });
     *
     * @param {string} dbname - the name of the database to retrieve.
     * @param {function} callback - callback should accept string param containing serialized db string.
     * @memberof LokiIndexedAdapter
     */
    LokiIndexedAdapter.prototype.loadDatabase = function(dbname, callback)
    {
      var appName = this.app;
      var adapter = this;

      // lazy open/create db reference so dont -need- callback in constructor
      if (this.catalog === null || this.catalog.db === null) {
        this.catalog = new LokiCatalog(function(cat) {
          adapter.catalog = cat;

          adapter.loadDatabase(dbname, callback);
        });

        return;
      }

      // lookup up db string in AKV db
      this.catalog.getAppKey(appName, dbname, function(result) {
        if (typeof (callback) === 'function') {
          if (result.id === 0) {
            callback(null);
            return;
          }
          callback(result.val);
        }
        else {
          // support console use of api
          console.log(result.val);
        }
      });
    };

    // alias
    LokiIndexedAdapter.prototype.loadKey = LokiIndexedAdapter.prototype.loadDatabase;

    /**
     * Saves a serialized db to the catalog.
     *
     * @example
     * // SAVE : will save App/Key/Val as 'finance'/'test'/{serializedDb}
     * var idbAdapter = new LokiIndexedAdapter('finance');
     * var db = new loki('test', { adapter: idbAdapter });
     * var coll = db.addCollection('testColl');
     * coll.insert({test: 'val'});
     * db.saveDatabase();  // could pass callback if needed for async complete
     *
     * @param {string} dbname - the name to give the serialized database within the catalog.
     * @param {string} dbstring - the serialized db string to save.
     * @param {function} callback - (Optional) callback passed obj.success with true or false
     * @memberof LokiIndexedAdapter
     */
    LokiIndexedAdapter.prototype.saveDatabase = function(dbname, dbstring, callback)
    {
      var appName = this.app;
      var adapter = this;

      function saveCallback(result) {
        if (result && result.success === true) {
          callback(null);
        }
        else {
          callback(new Error("Error saving database"));
        }
      }

      // lazy open/create db reference so dont -need- callback in constructor
      if (this.catalog === null || this.catalog.db === null) {
        this.catalog = new LokiCatalog(function(cat) {
          adapter.catalog = cat;

          // now that catalog has been initialized, set (add/update) the AKV entry
          cat.setAppKey(appName, dbname, dbstring, saveCallback);
        });

        return;
      }

      // set (add/update) entry to AKV database
      this.catalog.setAppKey(appName, dbname, dbstring, saveCallback);
    };

    // alias
    LokiIndexedAdapter.prototype.saveKey = LokiIndexedAdapter.prototype.saveDatabase;

    /**
     * Deletes a serialized db from the catalog.
     *
     * @example
     * // DELETE DATABASE
     * // delete 'finance'/'test' value from catalog
     * idbAdapter.deleteDatabase('test', function {
     *   // database deleted
     * });
     *
     * @param {string} dbname - the name of the database to delete from the catalog.
     * @param {function=} callback - (Optional) executed on database delete
     * @memberof LokiIndexedAdapter
     */
    LokiIndexedAdapter.prototype.deleteDatabase = function(dbname, callback)
    {
      var appName = this.app;
      var adapter = this;

      // lazy open/create db reference and pass callback ahead
      if (this.catalog === null || this.catalog.db === null) {
        this.catalog = new LokiCatalog(function(cat) {
          adapter.catalog = cat;

          adapter.deleteDatabase(dbname, callback);
        });

        return;
      }

      // catalog was already initialized, so just lookup object and delete by id
      this.catalog.getAppKey(appName, dbname, function(result) {
        var id = result.id;

        if (id !== 0) {
          adapter.catalog.deleteAppKey(id);
        }

        if (typeof (callback) === 'function') {
          callback();
        }
      });
    };

    // alias
    LokiIndexedAdapter.prototype.deleteKey = LokiIndexedAdapter.prototype.deleteDatabase;

    /**
     * Retrieves object array of catalog entries for current app.
     *
     * @example
     * idbAdapter.getDatabaseList(function(result) {
     *   // result is array of string names for that appcontext ('finance')
     *   result.forEach(function(str) {
     *     console.log(str);
     *   });
     * });
     *
     * @param {function} callback - should accept array of database names in the catalog for current app.
     * @memberof LokiIndexedAdapter
     */
    LokiIndexedAdapter.prototype.getDatabaseList = function(callback)
    {
      var appName = this.app;
      var adapter = this;

      // lazy open/create db reference so dont -need- callback in constructor
      if (this.catalog === null || this.catalog.db === null) {
        this.catalog = new LokiCatalog(function(cat) {
          adapter.catalog = cat;

          adapter.getDatabaseList(callback);
        });

        return;
      }

      // catalog already initialized
      // get all keys for current appName, and transpose results so just string array
      this.catalog.getAppKeys(appName, function(results) {
        var names = [];

        for(var idx = 0; idx < results.length; idx++) {
          names.push(results[idx].key);
        }

        if (typeof (callback) === 'function') {
          callback(names);
        }
        else {
          names.forEach(function(obj) {
            console.log(obj);
          });
        }
      });
    };

    // alias
    LokiIndexedAdapter.prototype.getKeyList = LokiIndexedAdapter.prototype.getDatabaseList;

    /**
     * Allows retrieval of list of all keys in catalog along with size
     *
     * @param {function} callback - (Optional) callback to accept result array.
     * @memberof LokiIndexedAdapter
     */
    LokiIndexedAdapter.prototype.getCatalogSummary = function(callback)
    {
      var appName = this.app;
      var adapter = this;

      // lazy open/create db reference
      if (this.catalog === null || this.catalog.db === null) {
        this.catalog = new LokiCatalog(function(cat) {
          adapter.catalog = cat;

          adapter.getCatalogSummary(callback);
        });

        return;
      }

      // catalog already initialized
      // get all keys for current appName, and transpose results so just string array
      this.catalog.getAllKeys(function(results) {
        var entries = [];
        var obj,
          size,
          oapp,
          okey,
          oval;

        for(var idx = 0; idx < results.length; idx++) {
          obj = results[idx];
          oapp = obj.app || '';
          okey = obj.key || '';
          oval = obj.val || '';

          // app and key are composited into an appkey column so we will mult by 2
          size = oapp.length * 2 + okey.length * 2 + oval.length + 1;

          entries.push({ "app": obj.app, "key": obj.key, "size": size });
        }

        if (typeof (callback) === 'function') {
          callback(entries);
        }
        else {
          entries.forEach(function(obj) {
            console.log(obj);
          });
        }
      });
    };

    /**
     * LokiCatalog - underlying App/Key/Value catalog persistence
     *    This non-interface class implements the actual persistence.
     *    Used by the IndexedAdapter class.
     */
    function LokiCatalog(callback)
    {
      this.db = null;
      this.initializeLokiCatalog(callback);
    }

    LokiCatalog.prototype.initializeLokiCatalog = function(callback) {
      var openRequest = indexedDB.open('LokiCatalog', 1);
      var cat = this;

      // If database doesn't exist yet or its version is lower than our version specified above (2nd param in line above)
      openRequest.onupgradeneeded = function(e) {
        var thisDB = e.target.result;
        if (thisDB.objectStoreNames.contains('LokiAKV')) {
          thisDB.deleteObjectStore('LokiAKV');
        }

        if(!thisDB.objectStoreNames.contains('LokiAKV')) {
          var objectStore = thisDB.createObjectStore('LokiAKV', { keyPath: 'id', autoIncrement:true });
          objectStore.createIndex('app', 'app', {unique:false});
          objectStore.createIndex('key', 'key', {unique:false});
          // hack to simulate composite key since overhead is low (main size should be in val field)
          // user (me) required to duplicate the app and key into comma delimited appkey field off object
          // This will allow retrieving single record with that composite key as well as
          // still supporting opening cursors on app or key alone
          objectStore.createIndex('appkey', 'appkey', {unique:true});
        }
      };

      openRequest.onsuccess = function(e) {
        cat.db = e.target.result;

        if (typeof (callback) === 'function') callback(cat);
      };

      openRequest.onerror = function(e) {
        throw e;
      };
    };

    LokiCatalog.prototype.getAppKey = function(app, key, callback) {
      var transaction = this.db.transaction(['LokiAKV'], 'readonly');
      var store = transaction.objectStore('LokiAKV');
      var index = store.index('appkey');
      var appkey = app + "," + key;
      var request = index.get(appkey);

      request.onsuccess = (function(usercallback) {
        return function(e) {
          var lres = e.target.result;

          if (lres === null || typeof(lres) === 'undefined') {
            lres = {
              id: 0,
              success: false
            };
          }

          if (typeof(usercallback) === 'function') {
            usercallback(lres);
          }
          else {
            console.log(lres);
          }
        };
      })(callback);

      request.onerror = (function(usercallback) {
        return function(e) {
          if (typeof(usercallback) === 'function') {
            usercallback({ id: 0, success: false });
          }
          else {
            throw e;
          }
        };
      })(callback);
    };

    LokiCatalog.prototype.getAppKeyById = function (id, callback, data) {
      var transaction = this.db.transaction(['LokiAKV'], 'readonly');
      var store = transaction.objectStore('LokiAKV');
      var request = store.get(id);

      request.onsuccess = (function(data, usercallback){
        return function(e) {
          if (typeof(usercallback) === 'function') {
            usercallback(e.target.result, data);
          }
          else {
            console.log(e.target.result);
          }
        };
      })(data, callback);
    };

    LokiCatalog.prototype.setAppKey = function (app, key, val, callback) {
      var transaction = this.db.transaction(['LokiAKV'], 'readwrite');
      var store = transaction.objectStore('LokiAKV');
      var index = store.index('appkey');
      var appkey = app + "," + key;
      var request = index.get(appkey);

      // first try to retrieve an existing object by that key
      // need to do this because to update an object you need to have id in object, otherwise it will append id with new autocounter and clash the unique index appkey
      request.onsuccess = function(e) {
        var res = e.target.result;

        if (res === null || res === undefined) {
          res = {
            app:app,
            key:key,
            appkey: app + ',' + key,
            val:val
          };
        }
        else {
          res.val = val;
        }

        var requestPut = store.put(res);

        requestPut.onerror = (function(usercallback) {
          return function(e) {
            if (typeof(usercallback) === 'function') {
              usercallback({ success: false });
            }
            else {
              console.error('LokiCatalog.setAppKey (set) onerror');
              console.error(request.error);
            }
          };

        })(callback);

        requestPut.onsuccess = (function(usercallback) {
          return function(e) {
            if (typeof(usercallback) === 'function') {
              usercallback({ success: true });
            }
          };
        })(callback);
      };

      request.onerror = (function(usercallback) {
        return function(e) {
          if (typeof(usercallback) === 'function') {
            usercallback({ success: false });
          }
          else {
            console.error('LokiCatalog.setAppKey (get) onerror');
            console.error(request.error);
          }
        };
      })(callback);
    };

    LokiCatalog.prototype.deleteAppKey = function (id, callback) {
      var transaction = this.db.transaction(['LokiAKV'], 'readwrite');
      var store = transaction.objectStore('LokiAKV');
      var request = store.delete(id);

      request.onsuccess = (function(usercallback) {
        return function(evt) {
          if (typeof(usercallback) === 'function') usercallback({ success: true });
        };
      })(callback);

      request.onerror = (function(usercallback) {
        return function(evt) {
          if (typeof(usercallback) === 'function') {
            usercallback(false);
          }
          else {
            console.error('LokiCatalog.deleteAppKey raised onerror');
            console.error(request.error);
          }
        };
      })(callback);
    };

    LokiCatalog.prototype.getAppKeys = function(app, callback) {
      var transaction = this.db.transaction(['LokiAKV'], 'readonly');
      var store = transaction.objectStore('LokiAKV');
      var index = store.index('app');

      // We want cursor to all values matching our (single) app param
      var singleKeyRange = IDBKeyRange.only(app);

      // To use one of the key ranges, pass it in as the first argument of openCursor()/openKeyCursor()
      var cursor = index.openCursor(singleKeyRange);

      // cursor internally, pushing results into this.data[] and return
      // this.data[] when done (similar to service)
      var localdata = [];

      cursor.onsuccess = (function(data, callback) {
        return function(e) {
          var cursor = e.target.result;
          if (cursor) {
            var currObject = cursor.value;

            data.push(currObject);

            cursor.continue();
          }
          else {
            if (typeof(callback) === 'function') {
              callback(data);
            }
            else {
              console.log(data);
            }
          }
        };
      })(localdata, callback);

      cursor.onerror = (function(usercallback) {
        return function(e) {
          if (typeof(usercallback) === 'function') {
            usercallback(null);
          }
          else {
            console.error('LokiCatalog.getAppKeys raised onerror');
            console.error(e);
          }
        };
      })(callback);

    };

    // Hide 'cursoring' and return array of { id: id, key: key }
    LokiCatalog.prototype.getAllKeys = function (callback) {
      var transaction = this.db.transaction(['LokiAKV'], 'readonly');
      var store = transaction.objectStore('LokiAKV');
      var cursor = store.openCursor();

      var localdata = [];

      cursor.onsuccess = (function(data, callback) {
        return function(e) {
          var cursor = e.target.result;
          if (cursor) {
            var currObject = cursor.value;

            data.push(currObject);

            cursor.continue();
          }
          else {
            if (typeof(callback) === 'function') {
              callback(data);
            }
            else {
              console.log(data);
            }
          }
        };
      })(localdata, callback);

      cursor.onerror = (function(usercallback) {
        return function(e) {
          if (typeof(usercallback) === 'function') usercallback(null);
        };
      })(callback);

    };

    return LokiIndexedAdapter;

  }());
}));

}).call(this,require("--console--"))
},{"--console--":11}],2:[function(require,module,exports){
(function (global,console,clearInterval,__argument0,__argument1,__argument2,__argument3,setInterval,setTimeout){
/**
 * LokiJS
 * @author Joe Minichino <joe.minichino@gmail.com>
 *
 * A lightweight document oriented javascript database
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define([], factory);
  } else if (typeof exports === 'object') {
    // CommonJS
    module.exports = factory();
  } else {
    // Browser globals
    root.loki = factory();
  }
}(this, function () {

  return (function () {
    'use strict';

    var hasOwnProperty = Object.prototype.hasOwnProperty;

    var Utils = {
      copyProperties: function (src, dest) {
        var prop;
        for (prop in src) {
          dest[prop] = src[prop];
        }
      },
      // used to recursively scan hierarchical transform step object for param substitution
      resolveTransformObject: function (subObj, params, depth) {
        var prop,
          pname;

        if (typeof depth !== 'number') {
          depth = 0;
        }

        if (++depth >= 10) return subObj;

        for (prop in subObj) {
          if (typeof subObj[prop] === 'string' && subObj[prop].indexOf("[%lktxp]") === 0) {
            pname = subObj[prop].substring(8);
            if (params.hasOwnProperty(pname)) {
              subObj[prop] = params[pname];
            }
          } else if (typeof subObj[prop] === "object") {
            subObj[prop] = Utils.resolveTransformObject(subObj[prop], params, depth);
          }
        }

        return subObj;
      },
      // top level utility to resolve an entire (single) transform (array of steps) for parameter substitution
      resolveTransformParams: function (transform, params) {
        var idx,
          clonedStep,
          resolvedTransform = [];

        if (typeof params === 'undefined') return transform;

        // iterate all steps in the transform array
        for (idx = 0; idx < transform.length; idx++) {
          // clone transform so our scan and replace can operate directly on cloned transform
          clonedStep = JSON.parse(JSON.stringify(transform[idx]));
          resolvedTransform.push(Utils.resolveTransformObject(clonedStep, params));
        }

        return resolvedTransform;
      }
    };

    /** Helper function for determining 'less-than' conditions for ops, sorting, and binary indices.
     *     In the future we might want $lt and $gt ops to use their own functionality/helper.
     *     Since binary indices on a property might need to index [12, NaN, new Date(), Infinity], we
     *     need this function (as well as gtHelper) to always ensure one value is LT, GT, or EQ to another.
     */
    function ltHelper(prop1, prop2, equal) {
      var cv1, cv2;

      // 'falsy' and Boolean handling
      if (!prop1 || !prop2 || prop1 === true || prop2 === true) {
        if ((prop1 === true || prop1 === false) && (prop2 === true || prop2 === false)) {
          if (equal) {
            return prop1 === prop2;
          } else {
            if (prop1) {
              return false;
            } else {
              return prop2;
            }
          }
        }

        if (prop2 === undefined || prop2 === null || prop1 === true || prop2 === false) {
          return equal;
        }
        if (prop1 === undefined || prop1 === null || prop1 === false || prop2 === true) {
          return true;
        }
      }

      if (prop1 === prop2) {
        return equal;
      }

      if (prop1 < prop2) {
        return true;
      }

      if (prop1 > prop2) {
        return false;
      }

      // not strict equal nor less than nor gt so must be mixed types, convert to string and use that to compare
      cv1 = prop1.toString();
      cv2 = prop2.toString();

      if (cv1 == cv2) {
        return equal;
      }

      if (cv1 < cv2) {
        return true;
      }

      return false;
    }

    function gtHelper(prop1, prop2, equal) {
      var cv1, cv2;

      // 'falsy' and Boolean handling
      if (!prop1 || !prop2 || prop1 === true || prop2 === true) {
        if ((prop1 === true || prop1 === false) && (prop2 === true || prop2 === false)) {
          if (equal) {
            return prop1 === prop2;
          } else {
            if (prop1) {
              return !prop2;
            } else {
              return false;
            }
          }
        }

        if (prop1 === undefined || prop1 === null || prop1 === false || prop2 === true) {
          return equal;
        }
        if (prop2 === undefined || prop2 === null || prop1 === true || prop2 === false) {
          return true;
        }
      }

      if (prop1 === prop2) {
        return equal;
      }

      if (prop1 > prop2) {
        return true;
      }

      if (prop1 < prop2) {
        return false;
      }

      // not strict equal nor less than nor gt so must be mixed types, convert to string and use that to compare
      cv1 = prop1.toString();
      cv2 = prop2.toString();

      if (cv1 == cv2) {
        return equal;
      }

      if (cv1 > cv2) {
        return true;
      }

      return false;
    }

    function sortHelper(prop1, prop2, desc) {
      if (prop1 === prop2) {
        return 0;
      }

      if (ltHelper(prop1, prop2, false)) {
        return (desc) ? (1) : (-1);
      }

      if (gtHelper(prop1, prop2, false)) {
        return (desc) ? (-1) : (1);
      }

      // not lt, not gt so implied equality-- date compatible
      return 0;
    }

    /**
     * compoundeval() - helper function for compoundsort(), performing individual object comparisons
     *
     * @param {array} properties - array of property names, in order, by which to evaluate sort order
     * @param {object} obj1 - first object to compare
     * @param {object} obj2 - second object to compare
     * @returns {integer} 0, -1, or 1 to designate if identical (sortwise) or which should be first
     */
    function compoundeval(properties, obj1, obj2) {
      var res = 0;
      var prop, field;
      for (var i = 0, len = properties.length; i < len; i++) {
        prop = properties[i];
        field = prop[0];
        res = sortHelper(obj1[field], obj2[field], prop[1]);
        if (res !== 0) {
          return res;
        }
      }
      return 0;
    }

    /**
     * dotSubScan - helper function used for dot notation queries.
     *
     * @param {object} root - object to traverse
     * @param {array} paths - array of properties to drill into
     * @param {function} fun - evaluation function to test with
     * @param {any} value - comparative value to also pass to (compare) fun
     */
    function dotSubScan(root, paths, fun, value) {
      var path = paths[0];
      if (typeof root === 'undefined' || root === null || !root.hasOwnProperty(path)) {
        return false;
      }

      var valueFound = false;
      var element = root[path];
      if (Array.isArray(element)) {
        var index;
        for (index in element) {
          valueFound = valueFound || dotSubScan(element[index], paths.slice(1, paths.length), fun, value);
          if (valueFound === true) {
            break;
          }
        }
      } else if (typeof element === 'object') {
        valueFound = dotSubScan(element, paths.slice(1, paths.length), fun, value);
      } else {
        valueFound = fun(element, value);
      }

      return valueFound;
    }

    function containsCheckFn(a) {
      if (typeof a === 'string' || Array.isArray(a)) {
        return function (b) {
          return a.indexOf(b) !== -1;
        };
      } else if (typeof a === 'object' && a !== null) {
        return function (b) {
          return hasOwnProperty.call(a, b);
        };
      }
      return null;
    }

    function doQueryOp(val, op) {
      for (var p in op) {
        if (hasOwnProperty.call(op, p)) {
          return LokiOps[p](val, op[p]);
        }
      }
      return false;
    }

    var LokiOps = {
      // comparison operators
      // a is the value in the collection
      // b is the query value
      $eq: function (a, b) {
        return a === b;
      },

      // abstract/loose equality
      $aeq: function (a, b) {
        return a == b;
      },

      $ne: function (a, b) {
        // ecma 5 safe test for NaN
        if (b !== b) {
          // ecma 5 test value is not NaN
          return (a === a);
        }

        return a !== b;
      },

      $dteq: function (a, b) {
        if (ltHelper(a, b, false)) {
          return false;
        }
        return !gtHelper(a, b, false);
      },

      $gt: function (a, b) {
        return gtHelper(a, b, false);
      },

      $gte: function (a, b) {
        return gtHelper(a, b, true);
      },

      $lt: function (a, b) {
        return ltHelper(a, b, false);
      },

      $lte: function (a, b) {
        return ltHelper(a, b, true);
      },

      $in: function (a, b) {
        return b.indexOf(a) !== -1;
      },

      $nin: function (a, b) {
        return b.indexOf(a) === -1;
      },

      $keyin: function (a, b) {
        return a in b;
      },

      $nkeyin: function (a, b) {
        return !(a in b);
      },

      $definedin: function (a, b) {
        return b[a] !== undefined;
      },

      $undefinedin: function (a, b) {
        return b[a] === undefined;
      },

      $regex: function (a, b) {
        return b.test(a);
      },

      $containsString: function (a, b) {
        return (typeof a === 'string') && (a.indexOf(b) !== -1);
      },

      $containsNone: function (a, b) {
        return !LokiOps.$containsAny(a, b);
      },

      $containsAny: function (a, b) {
        var checkFn = containsCheckFn(a);
        if (checkFn !== null) {
          return (Array.isArray(b)) ? (b.some(checkFn)) : (checkFn(b));
        }
        return false;
      },

      $contains: function (a, b) {
        var checkFn = containsCheckFn(a);
        if (checkFn !== null) {
          return (Array.isArray(b)) ? (b.every(checkFn)) : (checkFn(b));
        }
        return false;
      },

      $type: function (a, b) {
        var type = typeof a;
        if (type === 'object') {
          if (Array.isArray(a)) {
            type = 'array';
          } else if (a instanceof Date) {
            type = 'date';
          }
        }
        return (typeof b !== 'object') ? (type === b) : doQueryOp(type, b);
      },

      $size: function (a, b) {
        if (Array.isArray(a)) {
          return (typeof b !== 'object') ? (a.length === b) : doQueryOp(a.length, b);
        }
        return false;
      },

      $len: function (a, b) {
        if (typeof a === 'string') {
          return (typeof b !== 'object') ? (a.length === b) : doQueryOp(a.length, b);
        }
        return false;
      },

      $where: function (a, b) {
        return b(a) === true;
      },

      // field-level logical operators
      // a is the value in the collection
      // b is the nested query operation (for '$not')
      //   or an array of nested query operations (for '$and' and '$or')
      $not: function (a, b) {
        return !doQueryOp(a, b);
      },

      $and: function (a, b) {
        for (var idx = 0, len = b.length; idx < len; idx += 1) {
          if (!doQueryOp(a, b[idx])) {
            return false;
          }
        }
        return true;
      },

      $or: function (a, b) {
        for (var idx = 0, len = b.length; idx < len; idx += 1) {
          if (doQueryOp(a, b[idx])) {
            return true;
          }
        }
        return false;
      }
    };

    // making indexing opt-in... our range function knows how to deal with these ops :
    var indexedOpsList = ['$eq', '$aeq', '$dteq', '$gt', '$gte', '$lt', '$lte'];

    function clone(data, method) {
      var cloneMethod = method || 'parse-stringify',
        cloned;

      switch (cloneMethod) {
      case "parse-stringify":
        cloned = JSON.parse(JSON.stringify(data));
        break;
      case "jquery-extend-deep":
        cloned = jQuery.extend(true, {}, data);
        break;
      case "shallow":
        cloned = Object.create(data.prototype || null);
        Object.keys(data).map(function (i) {
          cloned[i] = data[i];
        });
        break;
      default:
        break;
      }

      //if (cloneMethod === 'parse-stringify') {
      //  cloned = JSON.parse(JSON.stringify(data));
      //}
      return cloned;
    }

    function cloneObjectArray(objarray, method) {
      var i,
        result = [];

      if (method == "parse-stringify") {
        return clone(objarray, method);
      }

      i = objarray.length - 1;

      for (; i <= 0; i--) {
        result.push(clone(objarray[i], method));
      }

      return result;
    }

    function localStorageAvailable() {
      try {
        return (window && window.localStorage !== undefined && window.localStorage !== null);
      } catch (e) {
        return false;
      }
    }


    /**
     * LokiEventEmitter is a minimalist version of EventEmitter. It enables any
     * constructor that inherits EventEmitter to emit events and trigger
     * listeners that have been added to the event through the on(event, callback) method
     *
     * @constructor LokiEventEmitter
     */
    function LokiEventEmitter() {}

    /**
     * @prop {hashmap} events - a hashmap, with each property being an array of callbacks
     * @memberof LokiEventEmitter
     */
    LokiEventEmitter.prototype.events = {};

    /**
     * @prop {boolean} asyncListeners - boolean determines whether or not the callbacks associated with each event
     * should happen in an async fashion or not
     * Default is false, which means events are synchronous
     * @memberof LokiEventEmitter
     */
    LokiEventEmitter.prototype.asyncListeners = false;

    /**
     * on(eventName, listener) - adds a listener to the queue of callbacks associated to an event
     * @param {string} eventName - the name of the event to listen to
     * @param {function} listener - callback function of listener to attach
     * @returns {int} the index of the callback in the array of listeners for a particular event
     * @memberof LokiEventEmitter
     */
    LokiEventEmitter.prototype.on = function (eventName, listener) {
      var event = this.events[eventName];
      if (!event) {
        event = this.events[eventName] = [];
      }
      event.push(listener);
      return listener;
    };

    /**
     * emit(eventName, data) - emits a particular event
     * with the option of passing optional parameters which are going to be processed by the callback
     * provided signatures match (i.e. if passing emit(event, arg0, arg1) the listener should take two parameters)
     * @param {string} eventName - the name of the event
     * @param {object=} data - optional object passed with the event
     * @memberof LokiEventEmitter
     */
    LokiEventEmitter.prototype.emit = function (eventName, data) {
      var self = this;
      if (eventName && this.events[eventName]) {
        this.events[eventName].forEach(function (listener) {
          if (self.asyncListeners) {
            setTimeout(function () {
              listener(data);
            }, 1);
          } else {
            listener(data);
          }

        });
      } else {
        throw new Error('No event ' + eventName + ' defined');
      }
    };

    /**
     * removeListener() - removes the listener at position 'index' from the event 'eventName'
     * @param {string} eventName - the name of the event which the listener is attached to
     * @param {function} listener - the listener callback function to remove from emitter
     * @memberof LokiEventEmitter
     */
    LokiEventEmitter.prototype.removeListener = function (eventName, listener) {
      if (this.events[eventName]) {
        var listeners = this.events[eventName];
        listeners.splice(listeners.indexOf(listener), 1);
      }
    };

    /**
     * Loki: The main database class
     * @constructor Loki
     * @implements LokiEventEmitter
     * @param {string} filename - name of the file to be saved to
     * @param {object=} options - (Optional) config options object
     * @param {string} options.env - override environment detection as 'NODEJS', 'BROWSER', 'CORDOVA'
     * @param {boolean} options.verbose - enable console output (default is 'false')
     * @param {boolean} options.autosave - enables autosave
     * @param {int} options.autosaveInterval - time interval (in milliseconds) between saves (if dirty)
     * @param {boolean} options.autoload - enables autoload on loki instantiation
     * @param {function} options.autoloadCallback - user callback called after database load
     * @param {adapter} options.adapter - an instance of a loki persistence adapter
     */
    function Loki(filename, options) {
      this.filename = filename || 'loki.db';
      this.collections = [];

      // persist version of code which created the database to the database.
      // could use for upgrade scenarios
      this.databaseVersion = 1.1;
      this.engineVersion = 1.1;

      // autosave support (disabled by default)
      // pass autosave: true, autosaveInterval: 6000 in options to set 6 second autosave
      this.autosave = false;
      this.autosaveInterval = 5000;
      this.autosaveHandle = null;

      this.options = {};

      // currently keeping persistenceMethod and persistenceAdapter as loki level properties that
      // will not or cannot be deserialized.  You are required to configure persistence every time
      // you instantiate a loki object (or use default environment detection) in order to load the database anyways.

      // persistenceMethod could be 'fs', 'localStorage', or 'adapter'
      // this is optional option param, otherwise environment detection will be used
      // if user passes their own adapter we will force this method to 'adapter' later, so no need to pass method option.
      this.persistenceMethod = null;

      // retain reference to optional (non-serializable) persistenceAdapter 'instance'
      this.persistenceAdapter = null;

      // enable console output if verbose flag is set (disabled by default)
      this.verbose = options && options.hasOwnProperty('verbose') ? options.verbose : false;

      this.events = {
        'init': [],
        'loaded': [],
        'flushChanges': [],
        'close': [],
        'changes': [],
        'warning': []
      };

      var getENV = function () {
        // if (typeof global !== 'undefined' && (global.android || global.NSObject)) {
        //   //If no adapter is set use the default nativescript adapter
        //   if (!options.adapter) {
        //     var LokiNativescriptAdapter = require('./loki-nativescript-adapter');
        //     options.adapter=new LokiNativescriptAdapter();
        //   }
        //   return 'NATIVESCRIPT'; //nativescript
        // }

        if (typeof window === 'undefined') {
          return 'NODEJS';
        }

        if (typeof global !== 'undefined' && global.window) {
          return 'NODEJS'; //node-webkit
        }

        if (typeof document !== 'undefined') {
          if (document.URL.indexOf('http://') === -1 && document.URL.indexOf('https://') === -1) {
            return 'CORDOVA';
          }
          return 'BROWSER';
        }
        return 'CORDOVA';
      };

      // refactored environment detection due to invalid detection for browser environments.
      // if they do not specify an options.env we want to detect env rather than default to nodejs.
      // currently keeping two properties for similar thing (options.env and options.persistenceMethod)
      //   might want to review whether we can consolidate.
      if (options && options.hasOwnProperty('env')) {
        this.ENV = options.env;
      } else {
        this.ENV = getENV();
      }

      // not sure if this is necessary now that i have refactored the line above
      if (this.ENV === 'undefined') {
        this.ENV = 'NODEJS';
      }

      //if (typeof (options) !== 'undefined') {
      this.configureOptions(options, true);
      //}

      this.on('init', this.clearChanges);

    }

    // db class is an EventEmitter
    Loki.prototype = new LokiEventEmitter();

    // experimental support for browserify's abstract syntax scan to pick up dependency of indexed adapter.
    // Hopefully, once this hits npm a browserify require of lokijs should scan the main file and detect this indexed adapter reference.
    Loki.prototype.getIndexedAdapter = function () {
      var adapter;

      if (typeof require === 'function') {
        adapter = require("./loki-indexed-adapter.js");
      }

      return adapter;
    };


    /**
     * Allows reconfiguring database options
     *
     * @param {object} options - configuration options to apply to loki db object
     * @param {string} options.env - override environment detection as 'NODEJS', 'BROWSER', 'CORDOVA'
     * @param {boolean} options.verbose - enable console output (default is 'false')
     * @param {boolean} options.autosave - enables autosave
     * @param {int} options.autosaveInterval - time interval (in milliseconds) between saves (if dirty)
     * @param {boolean} options.autoload - enables autoload on loki instantiation
     * @param {function} options.autoloadCallback - user callback called after database load
     * @param {adapter} options.adapter - an instance of a loki persistence adapter
     * @param {boolean} initialConfig - (internal) true is passed when loki ctor is invoking
     * @memberof Loki
     */
    Loki.prototype.configureOptions = function (options, initialConfig) {
      var defaultPersistence = {
          'NODEJS': 'fs',
          'BROWSER': 'localStorage',
          'CORDOVA': 'localStorage'
        },
        persistenceMethods = {
          'fs': LokiFsAdapter,
          'localStorage': LokiLocalStorageAdapter
        };

      this.options = {};

      this.persistenceMethod = null;
      // retain reference to optional persistence adapter 'instance'
      // currently keeping outside options because it can't be serialized
      this.persistenceAdapter = null;

      // process the options
      if (typeof (options) !== 'undefined') {
        this.options = options;


        if (this.options.hasOwnProperty('persistenceMethod')) {
          // check if the specified persistence method is known
          if (typeof (persistenceMethods[options.persistenceMethod]) == 'function') {
            this.persistenceMethod = options.persistenceMethod;
            this.persistenceAdapter = new persistenceMethods[options.persistenceMethod]();
          }
          // should be throw an error here, or just fall back to defaults ??
        }

        // if user passes adapter, set persistence mode to adapter and retain persistence adapter instance
        if (this.options.hasOwnProperty('adapter')) {
          this.persistenceMethod = 'adapter';
          this.persistenceAdapter = options.adapter;
          this.options.adapter = null;
        }


        // if they want to load database on loki instantiation, now is a good time to load... after adapter set and before possible autosave initiation
        if (options.autoload && initialConfig) {
          // for autoload, let the constructor complete before firing callback
          var self = this;
          setTimeout(function () {
            self.loadDatabase(options, options.autoloadCallback);
          }, 1);
        }

        if (this.options.hasOwnProperty('autosaveInterval')) {
          this.autosaveDisable();
          this.autosaveInterval = parseInt(this.options.autosaveInterval, 10);
        }

        if (this.options.hasOwnProperty('autosave') && this.options.autosave) {
          this.autosaveDisable();
          this.autosave = true;

          if (this.options.hasOwnProperty('autosaveCallback')) {
            this.autosaveEnable(options, options.autosaveCallback);
          } else {
            this.autosaveEnable();
          }
        }
      } // end of options processing

      // if by now there is no adapter specified by user nor derived from persistenceMethod: use sensible defaults
      if (this.persistenceAdapter === null) {
        this.persistenceMethod = defaultPersistence[this.ENV];
        if (this.persistenceMethod) {
          this.persistenceAdapter = new persistenceMethods[this.persistenceMethod]();
        }
      }

    };

    /**
     * Shorthand method for quickly creating and populating an anonymous collection.
     *    This collection is not referenced internally so upon losing scope it will be garbage collected.
     *
     * @example
     * var results = new loki().anonym(myDocArray).find({'age': {'$gt': 30} });
     *
     * @param {Array} docs - document array to initialize the anonymous collection with
     * @param {object} options - configuration object, see {@link Loki#addCollection} options
     * @returns {Collection} New collection which you can query or chain
     * @memberof Loki
     */
    Loki.prototype.anonym = function (docs, options) {
      var collection = new Collection('anonym', options);
      collection.insert(docs);

      if (this.verbose)
        collection.console = console;

      return collection;
    };

    /**
     * Adds a collection to the database.
     * @param {string} name - name of collection to add
     * @param {object=} options - (optional) options to configure collection with.
     * @param {array} options.unique - array of property names to define unique constraints for
     * @param {array} options.exact - array of property names to define exact constraints for
     * @param {array} options.indices - array property names to define binary indexes for
     * @param {boolean} options.asyncListeners - default is false
     * @param {boolean} options.disableChangesApi - default is true
     * @param {boolean} options.autoupdate - use Object.observe to update objects automatically (default: false)
     * @param {boolean} options.clone - specify whether inserts and queries clone to/from user
     * @param {string} options.cloneMethod - 'parse-stringify' (default), 'jquery-extend-deep', 'shallow'
     * @param {int} options.ttlInterval - time interval for clearing out 'aged' documents; not set by default.
     * @returns {Collection} a reference to the collection which was just added
     * @memberof Loki
     */
    Loki.prototype.addCollection = function (name, options) {
      var collection = new Collection(name, options);
      this.collections.push(collection);

      if (this.verbose)
        collection.console = console;

      return collection;
    };

    Loki.prototype.loadCollection = function (collection) {
      if (!collection.name) {
        throw new Error('Collection must have a name property to be loaded');
      }
      this.collections.push(collection);
    };

    /**
     * Retrieves reference to a collection by name.
     * @param {string} collectionName - name of collection to look up
     * @returns {Collection} Reference to collection in database by that name, or null if not found
     * @memberof Loki
     */
    Loki.prototype.getCollection = function (collectionName) {
      var i,
        len = this.collections.length;

      for (i = 0; i < len; i += 1) {
        if (this.collections[i].name === collectionName) {
          return this.collections[i];
        }
      }

      // no such collection
      this.emit('warning', 'collection ' + collectionName + ' not found');
      return null;
    };

    Loki.prototype.listCollections = function () {

      var i = this.collections.length,
        colls = [];

      while (i--) {
        colls.push({
          name: this.collections[i].name,
          type: this.collections[i].objType,
          count: this.collections[i].data.length
        });
      }
      return colls;
    };

    /**
     * Removes a collection from the database.
     * @param {string} collectionName - name of collection to remove
     * @memberof Loki
     */
    Loki.prototype.removeCollection = function (collectionName) {
      var i,
        len = this.collections.length;

      for (i = 0; i < len; i += 1) {
        if (this.collections[i].name === collectionName) {
          var tmpcol = new Collection(collectionName, {});
          var curcol = this.collections[i];
          for (var prop in curcol) {
            if (curcol.hasOwnProperty(prop) && tmpcol.hasOwnProperty(prop)) {
              curcol[prop] = tmpcol[prop];
            }
          }
          this.collections.splice(i, 1);
          return;
        }
      }
    };

    Loki.prototype.getName = function () {
      return this.name;
    };

    /**
     * serializeReplacer - used to prevent certain properties from being serialized
     *
     */
    Loki.prototype.serializeReplacer = function (key, value) {
      switch (key) {
      case 'autosaveHandle':
      case 'persistenceAdapter':
      case 'constraints':
        return null;
      default:
        return value;
      }
    };

    /**
     * Serialize database to a string which can be loaded via {@link Loki#loadJSON}
     *
     * @returns {string} Stringified representation of the loki database.
     * @memberof Loki
     */
    Loki.prototype.serialize = function () {
      return JSON.stringify(this, this.serializeReplacer);
    };
    // alias of serialize
    Loki.prototype.toJson = Loki.prototype.serialize;

    /**
     * Inflates a loki database from a serialized JSON string
     *
     * @param {string} serializedDb - a serialized loki database string
     * @param {object} options - apply or override collection level settings
     * @memberof Loki
     */
    Loki.prototype.loadJSON = function (serializedDb, options) {
      var dbObject;
      if (serializedDb.length === 0) {
        dbObject = {};
      } else {
        dbObject = JSON.parse(serializedDb);
      }

      this.loadJSONObject(dbObject, options);
    };

    /**
     * Inflates a loki database from a JS object
     *
     * @param {object} dbObject - a serialized loki database string
     * @param {object} options - apply or override collection level settings
     * @memberof Loki
     */
    Loki.prototype.loadJSONObject = function (dbObject, options) {
      var i = 0,
        len = dbObject.collections ? dbObject.collections.length : 0,
        coll,
        copyColl,
        clen,
        j;

      this.name = dbObject.name;

      // restore database version
      this.databaseVersion = 1.0;
      if (dbObject.hasOwnProperty('databaseVersion')) {
        this.databaseVersion = dbObject.databaseVersion;
      }

      this.collections = [];

      for (i; i < len; i += 1) {
        coll = dbObject.collections[i];
        copyColl = this.addCollection(coll.name);

        copyColl.transactional = coll.transactional;
        copyColl.asyncListeners = coll.asyncListeners;
        copyColl.disableChangesApi = coll.disableChangesApi;
        copyColl.cloneObjects = coll.cloneObjects;
        copyColl.cloneMethod = coll.cloneMethod || "parse-stringify";
        copyColl.autoupdate = coll.autoupdate;

        // load each element individually
        clen = coll.data.length;
        j = 0;
        if (options && options.hasOwnProperty(coll.name)) {

          var loader = options[coll.name].inflate ? options[coll.name].inflate : Utils.copyProperties;

          for (j; j < clen; j++) {
            var collObj = new(options[coll.name].proto)();
            loader(coll.data[j], collObj);
            copyColl.data[j] = collObj;
            copyColl.addAutoUpdateObserver(collObj);
          }
        } else {

          for (j; j < clen; j++) {
            copyColl.data[j] = coll.data[j];
            copyColl.addAutoUpdateObserver(copyColl.data[j]);
          }
        }

        copyColl.maxId = (coll.data.length === 0) ? 0 : coll.maxId;
        copyColl.idIndex = coll.idIndex;
        if (typeof (coll.binaryIndices) !== 'undefined') {
          copyColl.binaryIndices = coll.binaryIndices;
        }
        if (typeof coll.transforms !== 'undefined') {
          copyColl.transforms = coll.transforms;
        }

        copyColl.ensureId();

        // regenerate unique indexes
        copyColl.uniqueNames = [];
        if (coll.hasOwnProperty("uniqueNames")) {
          copyColl.uniqueNames = coll.uniqueNames;
          for (j = 0; j < copyColl.uniqueNames.length; j++) {
            copyColl.ensureUniqueIndex(copyColl.uniqueNames[j]);
          }
        }

        // in case they are loading a database created before we added dynamic views, handle undefined
        if (typeof (coll.DynamicViews) === 'undefined') continue;

        // reinflate DynamicViews and attached Resultsets
        for (var idx = 0; idx < coll.DynamicViews.length; idx++) {
          var colldv = coll.DynamicViews[idx];

          var dv = copyColl.addDynamicView(colldv.name, colldv.options);
          dv.resultdata = colldv.resultdata;
          dv.resultsdirty = colldv.resultsdirty;
          dv.filterPipeline = colldv.filterPipeline;

          dv.sortCriteria = colldv.sortCriteria;
          dv.sortFunction = null;

          dv.sortDirty = colldv.sortDirty;
          dv.resultset.filteredrows = colldv.resultset.filteredrows;
          dv.resultset.searchIsChained = colldv.resultset.searchIsChained;
          dv.resultset.filterInitialized = colldv.resultset.filterInitialized;

          dv.rematerialize({
            removeWhereFilters: true
          });
        }
      }
    };

    /**
     * Emits the close event. In autosave scenarios, if the database is dirty, this will save and disable timer.
     * Does not actually destroy the db.
     *
     * @param {function=} callback - (Optional) if supplied will be registered with close event before emitting.
     * @memberof Loki
     */
    Loki.prototype.close = function (callback) {
      // for autosave scenarios, we will let close perform final save (if dirty)
      // For web use, you might call from window.onbeforeunload to shutdown database, saving pending changes
      if (this.autosave) {
        this.autosaveDisable();
        if (this.autosaveDirty()) {
          this.saveDatabase(callback);
          callback = undefined;
        }
      }

      if (callback) {
        this.on('close', callback);
      }
      this.emit('close');
    };

    /**-------------------------+
    | Changes API               |
    +--------------------------*/

    /**
     * The Changes API enables the tracking the changes occurred in the collections since the beginning of the session,
     * so it's possible to create a differential dataset for synchronization purposes (possibly to a remote db)
     */

    /**
     * (Changes API) : takes all the changes stored in each
     * collection and creates a single array for the entire database. If an array of names
     * of collections is passed then only the included collections will be tracked.
     *
     * @param {array=} optional array of collection names. No arg means all collections are processed.
     * @returns {array} array of changes
     * @see private method createChange() in Collection
     * @memberof Loki
     */
    Loki.prototype.generateChangesNotification = function (arrayOfCollectionNames) {
      function getCollName(coll) {
        return coll.name;
      }
      var changes = [],
        selectedCollections = arrayOfCollectionNames || this.collections.map(getCollName);

      this.collections.forEach(function (coll) {
        if (selectedCollections.indexOf(getCollName(coll)) !== -1) {
          changes = changes.concat(coll.getChanges());
        }
      });
      return changes;
    };

    /**
     * (Changes API) - stringify changes for network transmission
     * @returns {string} string representation of the changes
     * @memberof Loki
     */
    Loki.prototype.serializeChanges = function (collectionNamesArray) {
      return JSON.stringify(this.generateChangesNotification(collectionNamesArray));
    };

    /**
     * (Changes API) : clears all the changes in all collections.
     * @memberof Loki
     */
    Loki.prototype.clearChanges = function () {
      this.collections.forEach(function (coll) {
        if (coll.flushChanges) {
          coll.flushChanges();
        }
      });
    };

    /*------------------+
    | PERSISTENCE       |
    -------------------*/


    /** there are two build in persistence adapters for internal use
     * fs             for use in Nodejs type environments
     * localStorage   for use in browser environment
     * defined as helper classes here so its easy and clean to use
     */

    /**
     * A loki persistence adapter which persists using node fs module
     * @constructor LokiFsAdapter
     */
    function LokiFsAdapter() {
      this.fs = require('fs');
    }

    /**
     * loadDatabase() - Load data from file, will throw an error if the file does not exist
     * @param {string} dbname - the filename of the database to load
     * @param {function} callback - the callback to handle the result
     * @memberof LokiFsAdapter
     */
    LokiFsAdapter.prototype.loadDatabase = function loadDatabase(dbname, callback) {
      this.fs.readFile(dbname, {
        encoding: 'utf8'
      }, function readFileCallback(err, data) {
        if (err) {
          callback(new Error(err));
        } else {
          callback(data);
        }
      });
    };

    /**
     * saveDatabase() - save data to file, will throw an error if the file can't be saved
     * might want to expand this to avoid dataloss on partial save
     * @param {string} dbname - the filename of the database to load
     * @param {function} callback - the callback to handle the result
     * @memberof LokiFsAdapter
     */
    LokiFsAdapter.prototype.saveDatabase = function saveDatabase(dbname, dbstring, callback) {
      this.fs.writeFile(dbname, dbstring, callback);
    };

    /**
     * deleteDatabase() - delete the database file, will throw an error if the
     * file can't be deleted
     * @param {string} dbname - the filename of the database to delete
     * @param {function} callback - the callback to handle the result
     * @memberof LokiFsAdapter
     */
    LokiFsAdapter.prototype.deleteDatabase = function deleteDatabase(dbname, callback) {
      this.fs.unlink(dbname, function deleteDatabaseCallback(err) {
        if (err) {
          callback(new Error(err));
        } else {
          callback();
        }
      });
    };


    /**
     * A loki persistence adapter which persists to web browser's local storage object
     * @constructor LokiLocalStorageAdapter
     */
    function LokiLocalStorageAdapter() {}

    /**
     * loadDatabase() - Load data from localstorage
     * @param {string} dbname - the name of the database to load
     * @param {function} callback - the callback to handle the result
     * @memberof LokiLocalStorageAdapter
     */
    LokiLocalStorageAdapter.prototype.loadDatabase = function loadDatabase(dbname, callback) {
      if (localStorageAvailable()) {
        callback(localStorage.getItem(dbname));
      } else {
        callback(new Error('localStorage is not available'));
      }
    };

    /**
     * saveDatabase() - save data to localstorage, will throw an error if the file can't be saved
     * might want to expand this to avoid dataloss on partial save
     * @param {string} dbname - the filename of the database to load
     * @param {function} callback - the callback to handle the result
     * @memberof LokiLocalStorageAdapter
     */
    LokiLocalStorageAdapter.prototype.saveDatabase = function saveDatabase(dbname, dbstring, callback) {
      if (localStorageAvailable()) {
        localStorage.setItem(dbname, dbstring);
        callback(null);
      } else {
        callback(new Error('localStorage is not available'));
      }
    };

    /**
     * deleteDatabase() - delete the database from localstorage, will throw an error if it
     * can't be deleted
     * @param {string} dbname - the filename of the database to delete
     * @param {function} callback - the callback to handle the result
     * @memberof LokiLocalStorageAdapter
     */
    LokiLocalStorageAdapter.prototype.deleteDatabase = function deleteDatabase(dbname, callback) {
      if (localStorageAvailable()) {
        localStorage.removeItem(dbname);
        callback(null);
      } else {
        callback(new Error('localStorage is not available'));
      }
    };

    /**
     * Handles loading from file system, local storage, or adapter (indexeddb)
     *    This method utilizes loki configuration options (if provided) to determine which
     *    persistence method to use, or environment detection (if configuration was not provided).
     *
     * @param {object} options - not currently used (remove or allow overrides?)
     * @param {function=} callback - (Optional) user supplied async callback / error handler
     * @memberof Loki
     */
    Loki.prototype.loadDatabase = function (options, callback) {
      var cFun = callback || function (err, data) {
          if (err) {
            throw err;
          }
        },
        self = this;

      // the persistenceAdapter should be present if all is ok, but check to be sure.
      if (this.persistenceAdapter !== null) {

        this.persistenceAdapter.loadDatabase(this.filename, function loadDatabaseCallback(dbString) {
          if (typeof (dbString) === 'string') {
            var parseSuccess = false;
            try {
              self.loadJSON(dbString, options || {});
              parseSuccess = true;
            } catch (err) {
              cFun(err);
            }
            if (parseSuccess) {
              cFun(null);
              self.emit('loaded', 'database ' + self.filename + ' loaded');
            }
          } else {
            // if adapter has returned an js object (other than null or error) attempt to load from JSON object
            if (typeof (dbString) === "object" && dbString !== null && !(dbString instanceof Error)) {
              self.loadJSONObject(dbString, options || {});
              cFun(null); // return null on success
              self.emit('loaded', 'database ' + self.filename + ' loaded');
            } else {
              // error from adapter (either null or instance of error), pass on to 'user' callback
              cFun(dbString);
            }
          }
        });

      } else {
        cFun(new Error('persistenceAdapter not configured'));
      }
    };

    /**
     * Handles saving to file system, local storage, or adapter (indexeddb)
     *    This method utilizes loki configuration options (if provided) to determine which
     *    persistence method to use, or environment detection (if configuration was not provided).
     *
     * @param {function=} callback - (Optional) user supplied async callback / error handler
     * @memberof Loki
     */
    Loki.prototype.saveDatabase = function (callback) {
      var cFun = callback || function (err) {
          if (err) {
            throw err;
          }
          return;
        },
        self = this;

      // the persistenceAdapter should be present if all is ok, but check to be sure.
      if (this.persistenceAdapter !== null) {
        // check if the adapter is requesting (and supports) a 'reference' mode export
        if (this.persistenceAdapter.mode === "reference" && typeof this.persistenceAdapter.exportDatabase === "function") {
          // filename may seem redundant but loadDatabase will need to expect this same filename
          this.persistenceAdapter.exportDatabase(this.filename, this, function exportDatabaseCallback(err) {
            self.autosaveClearFlags();
            cFun(err);
          });
        }
        // otherwise just pass the serialized database to adapter
        else {
          this.persistenceAdapter.saveDatabase(this.filename, self.serialize(), function saveDatabasecallback(err) {
            self.autosaveClearFlags();
            cFun(err);
          });
        }
      } else {
        cFun(new Error('persistenceAdapter not configured'));
      }
    };

    // alias
    Loki.prototype.save = Loki.prototype.saveDatabase;

    /**
     * Handles deleting a database from file system, local
     *    storage, or adapter (indexeddb)
     *    This method utilizes loki configuration options (if provided) to determine which
     *    persistence method to use, or environment detection (if configuration was not provided).
     *
     * @param {object} options - not currently used (remove or allow overrides?)
     * @param {function=} callback - (Optional) user supplied async callback / error handler
     * @memberof Loki
     */
    Loki.prototype.deleteDatabase = function (options, callback) {
      var cFun = callback || function (err, data) {
        if (err) {
          throw err;
        }
      };

      // the persistenceAdapter should be present if all is ok, but check to be sure.
      if (this.persistenceAdapter !== null) {
        this.persistenceAdapter.deleteDatabase(this.filename, function deleteDatabaseCallback(err) {
          cFun(err);
        });
      } else {
        cFun(new Error('persistenceAdapter not configured'));
      }
    };

    /**
     * autosaveDirty - check whether any collections are 'dirty' meaning we need to save (entire) database
     *
     * @returns {boolean} - true if database has changed since last autosave, false if not.
     */
    Loki.prototype.autosaveDirty = function () {
      for (var idx = 0; idx < this.collections.length; idx++) {
        if (this.collections[idx].dirty) {
          return true;
        }
      }

      return false;
    };

    /**
     * autosaveClearFlags - resets dirty flags on all collections.
     *    Called from saveDatabase() after db is saved.
     *
     */
    Loki.prototype.autosaveClearFlags = function () {
      for (var idx = 0; idx < this.collections.length; idx++) {
        this.collections[idx].dirty = false;
      }
    };

    /**
     * autosaveEnable - begin a javascript interval to periodically save the database.
     *
     * @param {object} options - not currently used (remove or allow overrides?)
     * @param {function=} callback - (Optional) user supplied async callback
     */
    Loki.prototype.autosaveEnable = function (options, callback) {
      this.autosave = true;

      var delay = 5000,
        self = this;

      if (typeof (this.autosaveInterval) !== 'undefined' && this.autosaveInterval !== null) {
        delay = this.autosaveInterval;
      }

      this.autosaveHandle = setInterval(function autosaveHandleInterval() {
        // use of dirty flag will need to be hierarchical since mods are done at collection level with no visibility of 'db'
        // so next step will be to implement collection level dirty flags set on insert/update/remove
        // along with loki level isdirty() function which iterates all collections to see if any are dirty

        if (self.autosaveDirty()) {
          self.saveDatabase(callback);
        }
      }, delay);
    };

    /**
     * autosaveDisable - stop the autosave interval timer.
     *
     */
    Loki.prototype.autosaveDisable = function () {
      if (typeof (this.autosaveHandle) !== 'undefined' && this.autosaveHandle !== null) {
        clearInterval(this.autosaveHandle);
        this.autosaveHandle = null;
      }
    };


    /**
     * Resultset class allowing chainable queries.  Intended to be instanced internally.
     *    Collection.find(), Collection.where(), and Collection.chain() instantiate this.
     *
     * @example
     *    mycollection.chain()
     *      .find({ 'doors' : 4 })
     *      .where(function(obj) { return obj.name === 'Toyota' })
     *      .data();
     *
     * @constructor Resultset
     * @param {Collection} collection - The collection which this Resultset will query against.
     * @param {Object=} options - Object containing one or more options.
     * @param {string} options.queryObj - Optional mongo-style query object to initialize resultset with.
     * @param {function} options.queryFunc - Optional javascript filter function to initialize resultset with.
     * @param {bool} options.firstOnly - Optional boolean used by collection.findOne().
     */
    function Resultset(collection, options) {
      options = options || {};

      options.queryObj = options.queryObj || null;
      options.queryFunc = options.queryFunc || null;
      options.firstOnly = options.firstOnly || false;

      // retain reference to collection we are querying against
      this.collection = collection;

      // if chain() instantiates with null queryObj and queryFunc, so we will keep flag for later
      this.searchIsChained = (!options.queryObj && !options.queryFunc);
      this.filteredrows = [];
      this.filterInitialized = false;

      // if user supplied initial queryObj or queryFunc, apply it
      if (typeof (options.queryObj) !== "undefined" && options.queryObj !== null) {
        return this.find(options.queryObj, options.firstOnly);
      }
      if (typeof (options.queryFunc) !== "undefined" && options.queryFunc !== null) {
        return this.where(options.queryFunc);
      }

      // otherwise return unfiltered Resultset for future filtering
      return this;
    }

    /**
     * reset() - Reset the resultset to its initial state.
     *
     * @returns {Resultset} Reference to this resultset, for future chain operations.
     */
    Resultset.prototype.reset = function () {
      if (this.filteredrows.length > 0) {
        this.filteredrows = [];
      }
      this.filterInitialized = false;
      return this;
    };

    /**
     * toJSON() - Override of toJSON to avoid circular references
     *
     */
    Resultset.prototype.toJSON = function () {
      var copy = this.copy();
      copy.collection = null;
      return copy;
    };

    /**
     * Allows you to limit the number of documents passed to next chain operation.
     *    A resultset copy() is made to avoid altering original resultset.
     *
     * @param {int} qty - The number of documents to return.
     * @returns {Resultset} Returns a copy of the resultset, limited by qty, for subsequent chain ops.
     * @memberof Resultset
     */
    Resultset.prototype.limit = function (qty) {
      // if this is chained resultset with no filters applied, we need to populate filteredrows first
      if (this.searchIsChained && !this.filterInitialized && this.filteredrows.length === 0) {
        this.filteredrows = this.collection.prepareFullDocIndex();
      }

      var rscopy = new Resultset(this.collection);
      rscopy.filteredrows = this.filteredrows.slice(0, qty);
      rscopy.filterInitialized = true;
      return rscopy;
    };

    /**
     * Used for skipping 'pos' number of documents in the resultset.
     *
     * @param {int} pos - Number of documents to skip; all preceding documents are filtered out.
     * @returns {Resultset} Returns a copy of the resultset, containing docs starting at 'pos' for subsequent chain ops.
     * @memberof Resultset
     */
    Resultset.prototype.offset = function (pos) {
      // if this is chained resultset with no filters applied, we need to populate filteredrows first
      if (this.searchIsChained && !this.filterInitialized && this.filteredrows.length === 0) {
        this.filteredrows = this.collection.prepareFullDocIndex();
      }

      var rscopy = new Resultset(this.collection);
      rscopy.filteredrows = this.filteredrows.slice(pos);
      rscopy.filterInitialized = true;
      return rscopy;
    };

    /**
     * copy() - To support reuse of resultset in branched query situations.
     *
     * @returns {Resultset} Returns a copy of the resultset (set) but the underlying document references will be the same.
     * @memberof Resultset
     */
    Resultset.prototype.copy = function () {
      var result = new Resultset(this.collection);

      if (this.filteredrows.length > 0) {
        result.filteredrows = this.filteredrows.slice();
      }
      result.filterInitialized = this.filterInitialized;

      return result;
    };

    /**
     * Alias of copy()
     * @memberof Resultset
     */
    Resultset.prototype.branch = Resultset.prototype.copy;

    /**
     * transform() - executes a named collection transform or raw array of transform steps against the resultset.
     *
     * @param transform {(string|array)} - name of collection transform or raw transform array
     * @param parameters {object=} - (Optional) object property hash of parameters, if the transform requires them.
     * @returns {Resultset} either (this) resultset or a clone of of this resultset (depending on steps)
     * @memberof Resultset
     */
    Resultset.prototype.transform = function (transform, parameters) {
      var idx,
        step,
        rs = this;

      // if transform is name, then do lookup first
      if (typeof transform === 'string') {
        if (this.collection.transforms.hasOwnProperty(transform)) {
          transform = this.collection.transforms[transform];
        }
      }

      // either they passed in raw transform array or we looked it up, so process
      if (typeof transform !== 'object' || !Array.isArray(transform)) {
        throw new Error("Invalid transform");
      }

      if (typeof parameters !== 'undefined') {
        transform = Utils.resolveTransformParams(transform, parameters);
      }

      for (idx = 0; idx < transform.length; idx++) {
        step = transform[idx];

        switch (step.type) {
        case "find":
          rs.find(step.value);
          break;
        case "where":
          rs.where(step.value);
          break;
        case "simplesort":
          rs.simplesort(step.property, step.desc);
          break;
        case "compoundsort":
          rs.compoundsort(step.value);
          break;
        case "sort":
          rs.sort(step.value);
          break;
        case "limit":
          rs = rs.limit(step.value);
          break; // limit makes copy so update reference
        case "offset":
          rs = rs.offset(step.value);
          break; // offset makes copy so update reference
        case "map":
          rs = rs.map(step.value);
          break;
        case "eqJoin":
          rs = rs.eqJoin(step.joinData, step.leftJoinKey, step.rightJoinKey, step.mapFun);
          break;
          // following cases break chain by returning array data so make any of these last in transform steps
        case "mapReduce":
          rs = rs.mapReduce(step.mapFunction, step.reduceFunction);
          break;
          // following cases update documents in current filtered resultset (use carefully)
        case "update":
          rs.update(step.value);
          break;
        case "remove":
          rs.remove();
          break;
        default:
          break;
        }
      }

      return rs;
    };

    /**
     * User supplied compare function is provided two documents to compare. (chainable)
     * @example
     *    rslt.sort(function(obj1, obj2) {
     *      if (obj1.name === obj2.name) return 0;
     *      if (obj1.name > obj2.name) return 1;
     *      if (obj1.name < obj2.name) return -1;
     *    });
     *
     * @param {function} comparefun - A javascript compare function used for sorting.
     * @returns {Resultset} Reference to this resultset, sorted, for future chain operations.
     * @memberof Resultset
     */
    Resultset.prototype.sort = function (comparefun) {
      // if this is chained resultset with no filters applied, just we need to populate filteredrows first
      if (this.searchIsChained && !this.filterInitialized && this.filteredrows.length === 0) {
        this.filteredrows = this.collection.prepareFullDocIndex();
      }

      var wrappedComparer =
        (function (userComparer, data) {
          return function (a, b) {
            return userComparer(data[a], data[b]);
          };
        })(comparefun, this.collection.data);

      this.filteredrows.sort(wrappedComparer);

      return this;
    };

    /**
     * Simpler, loose evaluation for user to sort based on a property name. (chainable).
     *    Sorting based on the same lt/gt helper functions used for binary indices.
     *
     * @param {string} propname - name of property to sort by.
     * @param {bool=} isdesc - (Optional) If true, the property will be sorted in descending order
     * @returns {Resultset} Reference to this resultset, sorted, for future chain operations.
     * @memberof Resultset
     */
    Resultset.prototype.simplesort = function (propname, isdesc) {
      // if this is chained resultset with no filters applied, just we need to populate filteredrows first
      if (this.searchIsChained && !this.filterInitialized && this.filteredrows.length === 0) {
        this.filteredrows = this.collection.prepareFullDocIndex();
      }

      if (typeof (isdesc) === 'undefined') {
        isdesc = false;
      }

      var wrappedComparer =
        (function (prop, desc, data) {
          return function (a, b) {
            return sortHelper(data[a][prop], data[b][prop], desc);
          };
        })(propname, isdesc, this.collection.data);

      this.filteredrows.sort(wrappedComparer);

      return this;
    };

    /**
     * Allows sorting a resultset based on multiple columns.
     * @example
     * // to sort by age and then name (both ascending)
     * rs.compoundsort(['age', 'name']);
     * // to sort by age (ascending) and then by name (descending)
     * rs.compoundsort(['age', ['name', true]);
     *
     * @param {array} properties - array of property names or subarray of [propertyname, isdesc] used evaluate sort order
     * @returns {Resultset} Reference to this resultset, sorted, for future chain operations.
     * @memberof Resultset
     */
    Resultset.prototype.compoundsort = function (properties) {
      if (properties.length === 0) {
        throw new Error("Invalid call to compoundsort, need at least one property");
      }

      var prop;
      if (properties.length === 1) {
        prop = properties[0];
        if (Array.isArray(prop)) {
          return this.simplesort(prop[0], prop[1]);
        }
        return this.simplesort(prop, false);
      }

      // unify the structure of 'properties' to avoid checking it repeatedly while sorting
      for (var i = 0, len = properties.length; i < len; i += 1) {
        prop = properties[i];
        if (!Array.isArray(prop)) {
          properties[i] = [prop, false];
        }
      }

      // if this is chained resultset with no filters applied, just we need to populate filteredrows first
      if (this.searchIsChained && !this.filterInitialized && this.filteredrows.length === 0) {
        this.filteredrows = this.collection.prepareFullDocIndex();
      }

      var wrappedComparer =
        (function (props, data) {
          return function (a, b) {
            return compoundeval(props, data[a], data[b]);
          };
        })(properties, this.collection.data);

      this.filteredrows.sort(wrappedComparer);

      return this;
    };

    /**
     * calculateRange() - Binary Search utility method to find range/segment of values matching criteria.
     *    this is used for collection.find() and first find filter of resultset/dynview
     *    slightly different than get() binary search in that get() hones in on 1 value,
     *    but we have to hone in on many (range)
     * @param {string} op - operation, such as $eq
     * @param {string} prop - name of property to calculate range for
     * @param {object} val - value to use for range calculation.
     * @returns {array} [start, end] index array positions
     */
    Resultset.prototype.calculateRange = function (op, prop, val) {
      var rcd = this.collection.data;
      var index = this.collection.binaryIndices[prop].values;
      var min = 0;
      var max = index.length - 1;
      var mid = 0;

      // when no documents are in collection, return empty range condition
      if (rcd.length === 0) {
        return [0, -1];
      }

      var minVal = rcd[index[min]][prop];
      var maxVal = rcd[index[max]][prop];

      // if value falls outside of our range return [0, -1] to designate no results
      switch (op) {
      case '$eq':
      case '$aeq':
        if (ltHelper(val, minVal, false) || gtHelper(val, maxVal, false)) {
          return [0, -1];
        }
        break;
      case '$dteq':
        if (ltHelper(val, minVal, false) || gtHelper(val, maxVal, false)) {
          return [0, -1];
        }
        break;
      case '$gt':
        if (gtHelper(val, maxVal, true)) {
          return [0, -1];
        }
        break;
      case '$gte':
        if (gtHelper(val, maxVal, false)) {
          return [0, -1];
        }
        break;
      case '$lt':
        if (ltHelper(val, minVal, true)) {
          return [0, -1];
        }
        if (ltHelper(maxVal, val, false)) {
          return [0, rcd.length - 1];
        }
        break;
      case '$lte':
        if (ltHelper(val, minVal, false)) {
          return [0, -1];
        }
        if (ltHelper(maxVal, val, true)) {
          return [0, rcd.length - 1];
        }
        break;
      }

      // hone in on start position of value
      while (min < max) {
        mid = (min + max) >> 1;

        if (ltHelper(rcd[index[mid]][prop], val, false)) {
          min = mid + 1;
        } else {
          max = mid;
        }
      }

      var lbound = min;

      // do not reset min, as the upper bound cannot be prior to the found low bound
      max = index.length - 1;

      // hone in on end position of value
      while (min < max) {
        mid = (min + max) >> 1;

        if (ltHelper(val, rcd[index[mid]][prop], false)) {
          max = mid;
        } else {
          min = mid + 1;
        }
      }

      var ubound = max;

      var lval = rcd[index[lbound]][prop];
      var uval = rcd[index[ubound]][prop];

      switch (op) {
      case '$eq':
        if (lval !== val) {
          return [0, -1];
        }
        if (uval !== val) {
          ubound--;
        }

        return [lbound, ubound];
      case '$dteq':
        if (lval > val || lval < val) {
          return [0, -1];
        }
        if (uval > val || uval < val) {
          ubound--;
        }

        return [lbound, ubound];


      case '$gt':
        if (ltHelper(uval, val, true)) {
          return [0, -1];
        }

        return [ubound, rcd.length - 1];

      case '$gte':
        if (ltHelper(lval, val, false)) {
          return [0, -1];
        }

        return [lbound, rcd.length - 1];

      case '$lt':
        if (lbound === 0 && ltHelper(lval, val, false)) {
          return [0, 0];
        }
        return [0, lbound - 1];

      case '$lte':
        if (uval !== val) {
          ubound--;
        }

        if (ubound === 0 && ltHelper(uval, val, false)) {
          return [0, 0];
        }
        return [0, ubound];

      default:
        return [0, rcd.length - 1];
      }
    };

    /**
     * findOr() - oversee the operation of OR'ed query expressions.
     *    OR'ed expression evaluation runs each expression individually against the full collection,
     *    and finally does a set OR on each expression's results.
     *    Each evaluation can utilize a binary index to prevent multiple linear array scans.
     *
     * @param {array} expressionArray - array of expressions
     * @returns {Resultset} this resultset for further chain ops.
     */
    Resultset.prototype.findOr = function (expressionArray) {
      var fr = null,
        fri = 0,
        frlen = 0,
        docset = [],
        idxset = [],
        idx = 0,
        origCount = this.count();

      // If filter is already initialized, then we query against only those items already in filter.
      // This means no index utilization for fields, so hopefully its filtered to a smallish filteredrows.
      for (var ei = 0, elen = expressionArray.length; ei < elen; ei++) {
        // we need to branch existing query to run each filter separately and combine results
        fr = this.branch().find(expressionArray[ei]).filteredrows;
        frlen = fr.length;
        // if the find operation did not reduce the initial set, then the initial set is the actual result
        if (frlen === origCount) {
          return this;
        }

        // add any document 'hits'
        for (fri = 0; fri < frlen; fri++) {
          idx = fr[fri];
          if (idxset[idx] === undefined) {
            idxset[idx] = true;
            docset.push(idx);
          }
        }
      }

      this.filteredrows = docset;
      this.filterInitialized = true;

      return this;
    };
    Resultset.prototype.$or = Resultset.prototype.findOr;

    /**
     * findAnd() - oversee the operation of AND'ed query expressions.
     *    AND'ed expression evaluation runs each expression progressively against the full collection,
     *    internally utilizing existing chained resultset functionality.
     *    Only the first filter can utilize a binary index.
     *
     * @param {array} expressionArray - array of expressions
     * @returns {Resultset} this resultset for further chain ops.
     */
    Resultset.prototype.findAnd = function (expressionArray) {
      // we have already implementing method chaining in this (our Resultset class)
      // so lets just progressively apply user supplied and filters
      for (var i = 0, len = expressionArray.length; i < len; i++) {
        if (this.count() === 0) {
          return this;
        }
        this.find(expressionArray[i]);
      }
      return this;
    };
    Resultset.prototype.$and = Resultset.prototype.findAnd;

    /**
     * Used for querying via a mongo-style query object.
     *
     * @param {object} query - A mongo-style query object used for filtering current results.
     * @param {boolean=} firstOnly - (Optional) Used by collection.findOne()
     * @returns {Resultset} this resultset for further chain ops.
     * @memberof Resultset
     */
    Resultset.prototype.find = function (query, firstOnly) {
      if (this.collection.data.length === 0) {
        if (this.searchIsChained) {
          this.filteredrows = [];
          this.filterInitialized = true;
          return this;
        }
        return [];
      }

      var queryObject = query || 'getAll',
        p,
        property,
        queryObjectOp,
        operator,
        value,
        key,
        searchByIndex = false,
        result = [],
        index = null;

      // if this was note invoked via findOne()
      firstOnly = firstOnly || false;

      if (typeof queryObject === 'object') {
        for (p in queryObject) {
          if (hasOwnProperty.call(queryObject, p)) {
            property = p;
            queryObjectOp = queryObject[p];
            break;
          }
        }
      }

      // apply no filters if they want all
      if (!property || queryObject === 'getAll') {
        // Chained queries can just do coll.chain().data() but let's
        // be versatile and allow this also coll.chain().find().data()

        // If a chained search, simply leave everything as-is.
        // Note: If no filter at this point, it will be properly
        // created by the follow-up queries or sorts that need it.
        // If not chained, then return the collection data array copy.
        return (this.searchIsChained) ? (this) : (this.collection.data.slice());
      }

      // injecting $and and $or expression tree evaluation here.
      if (property === '$and' || property === '$or') {
        if (this.searchIsChained) {
          this[property](queryObjectOp);

          // for chained find with firstonly,
          if (firstOnly && this.filteredrows.length > 1) {
            this.filteredrows = this.filteredrows.slice(0, 1);
          }

          return this;
        } else {
          // our $and operation internally chains filters
          result = this.collection.chain()[property](queryObjectOp).data();

          // if this was coll.findOne() return first object or empty array if null
          // since this is invoked from a constructor we can't return null, so we will
          // make null in coll.findOne();
          if (firstOnly) {
            return (result.length === 0) ? ([]) : (result[0]);
          }

          // not first only return all results
          return result;
        }
      }

      // see if query object is in shorthand mode (assuming eq operator)
      if (queryObjectOp === null || (typeof queryObjectOp !== 'object' || queryObjectOp instanceof Date)) {
        operator = '$eq';
        value = queryObjectOp;
      } else if (typeof queryObjectOp === 'object') {
        for (key in queryObjectOp) {
          if (hasOwnProperty.call(queryObjectOp, key)) {
            operator = key;
            value = queryObjectOp[key];
            break;
          }
        }
      } else {
        throw new Error('Do not know what you want to do.');
      }

      // for regex ops, precompile
      if (operator === '$regex') {
        if (Array.isArray(value)) {
          value = new RegExp(value[0], value[1]);
        } else if (!(value instanceof RegExp)) {
          value = new RegExp(value);
        }
      }

      // if user is deep querying the object such as find('name.first': 'odin')
      var usingDotNotation = (property.indexOf('.') !== -1);

      // if an index exists for the property being queried against, use it
      // for now only enabling for non-chained query (who's set of docs matches index)
      // or chained queries where it is the first filter applied and prop is indexed
      var doIndexCheck = !usingDotNotation &&
        (!this.searchIsChained || !this.filterInitialized);

      if (doIndexCheck && this.collection.binaryIndices[property] &&
        indexedOpsList.indexOf(operator) !== -1) {
        // this is where our lazy index rebuilding will take place
        // basically we will leave all indexes dirty until we need them
        // so here we will rebuild only the index tied to this property
        // ensureIndex() will only rebuild if flagged as dirty since we are not passing force=true param
        this.collection.ensureIndex(property);

        searchByIndex = true;
        index = this.collection.binaryIndices[property];
      }

      // the comparison function
      var fun = LokiOps[operator];

      // "shortcut" for collection data
      var t = this.collection.data;
      // filter data length
      var i = 0;

      // Query executed differently depending on :
      //    - whether it is chained or not
      //    - whether the property being queried has an index defined
      //    - if chained, we handle first pass differently for initial filteredrows[] population
      //
      // For performance reasons, each case has its own if block to minimize in-loop calculations

      // If not a chained query, bypass filteredrows and work directly against data
      if (!this.searchIsChained) {
        if (!searchByIndex) {
          i = t.length;

          if (firstOnly) {
            if (usingDotNotation) {
              property = property.split('.');
              while (i--) {
                if (dotSubScan(t[i], property, fun, value)) {
                  return (t[i]);
                }
              }
            } else {
              while (i--) {
                if (fun(t[i][property], value)) {
                  return (t[i]);
                }
              }
            }

            return [];
          }

          // if using dot notation then treat property as keypath such as 'name.first'.
          // currently supporting dot notation for non-indexed conditions only
          if (usingDotNotation) {
            property = property.split('.');
            while (i--) {
              if (dotSubScan(t[i], property, fun, value)) {
                result.push(t[i]);
              }
            }
          } else {
            while (i--) {
              if (fun(t[i][property], value)) {
                result.push(t[i]);
              }
            }
          }
        } else {
          // searching by binary index via calculateRange() utility method
          var seg = this.calculateRange(operator, property, value);

          // not chained so this 'find' was designated in Resultset constructor
          // so return object itself
          if (firstOnly) {
            if (seg[1] !== -1) {
              return t[index.values[seg[0]]];
            }
            return [];
          }

          for (i = seg[0]; i <= seg[1]; i++) {
            result.push(t[index.values[i]]);
          }
        }

        // not a chained query so return result as data[]
        return result;
      }


      // Otherwise this is a chained query

      var filter, rowIdx = 0;

      // If the filteredrows[] is already initialized, use it
      if (this.filterInitialized) {
        filter = this.filteredrows;
        i = filter.length;

        // currently supporting dot notation for non-indexed conditions only
        if (usingDotNotation) {
          property = property.split('.');
          while (i--) {
            rowIdx = filter[i];
            if (dotSubScan(t[rowIdx], property, fun, value)) {
              result.push(rowIdx);
            }
          }
        } else {
          while (i--) {
            rowIdx = filter[i];
            if (fun(t[rowIdx][property], value)) {
              result.push(rowIdx);
            }
          }
        }
      }
      // first chained query so work against data[] but put results in filteredrows
      else {
        // if not searching by index
        if (!searchByIndex) {
          i = t.length;

          if (usingDotNotation) {
            property = property.split('.');
            while (i--) {
              if (dotSubScan(t[i], property, fun, value)) {
                result.push(i);
              }
            }
          } else {
            while (i--) {
              if (fun(t[i][property], value)) {
                result.push(i);
              }
            }
          }
        } else {
          // search by index
          var segm = this.calculateRange(operator, property, value);

          for (i = segm[0]; i <= segm[1]; i++) {
            result.push(index.values[i]);
          }
        }

        this.filterInitialized = true; // next time work against filteredrows[]
      }

      this.filteredrows = result;
      return this;
    };


    /**
     * where() - Used for filtering via a javascript filter function.
     *
     * @param {function} fun - A javascript function used for filtering current results by.
     * @returns {Resultset} this resultset for further chain ops.
     * @memberof Resultset
     */
    Resultset.prototype.where = function (fun) {
      var viewFunction,
        result = [];

      if ('function' === typeof fun) {
        viewFunction = fun;
      } else {
        throw new TypeError('Argument is not a stored view or a function');
      }
      try {
        // if not a chained query then run directly against data[] and return object []
        if (!this.searchIsChained) {
          var i = this.collection.data.length;

          while (i--) {
            if (viewFunction(this.collection.data[i]) === true) {
              result.push(this.collection.data[i]);
            }
          }

          // not a chained query so returning result as data[]
          return result;
        }
        // else chained query, so run against filteredrows
        else {
          // If the filteredrows[] is already initialized, use it
          if (this.filterInitialized) {
            var j = this.filteredrows.length;

            while (j--) {
              if (viewFunction(this.collection.data[this.filteredrows[j]]) === true) {
                result.push(this.filteredrows[j]);
              }
            }

            this.filteredrows = result;

            return this;
          }
          // otherwise this is initial chained op, work against data, push into filteredrows[]
          else {
            var k = this.collection.data.length;

            while (k--) {
              if (viewFunction(this.collection.data[k]) === true) {
                result.push(k);
              }
            }

            this.filteredrows = result;
            this.filterInitialized = true;

            return this;
          }
        }
      } catch (err) {
        throw err;
      }
    };

    /**
     * count() - returns the number of documents in the resultset.
     *
     * @returns {number} The number of documents in the resultset.
     * @memberof Resultset
     */
    Resultset.prototype.count = function () {
      if (this.searchIsChained && this.filterInitialized) {
        return this.filteredrows.length;
      }
      return this.collection.count();
    };

    /**
     * Terminates the chain and returns array of filtered documents
     *
     * @param {object=} options - allows specifying 'forceClones' and 'forceCloneMethod' options.
     * @param {boolean} options.forceClones - Allows forcing the return of cloned objects even when
     *        the collection is not configured for clone object.
     * @param {string} options.forceCloneMethod - Allows overriding the default or collection specified cloning method.
     *        Possible values include 'parse-stringify', 'jquery-extend-deep', and 'shallow'
     *
     * @returns {array} Array of documents in the resultset
     * @memberof Resultset
     */
    Resultset.prototype.data = function (options) {
      var result = [],
        data = this.collection.data,
        len,
        i,
        method;

      options = options || {};

      // if this is chained resultset with no filters applied, just return collection.data
      if (this.searchIsChained && !this.filterInitialized) {
        if (this.filteredrows.length === 0) {
          // determine whether we need to clone objects or not
          if (this.collection.cloneObjects || options.forceClones) {
            len = data.length;
            method = options.forceCloneMethod || this.collection.cloneMethod;

            for (i = 0; i < len; i++) {
              result.push(clone(data[i], method));
            }
            return result;
          }
          // otherwise we are not cloning so return sliced array with same object references
          else {
            return data.slice();
          }
        } else {
          // filteredrows must have been set manually, so use it
          this.filterInitialized = true;
        }
      }

      var fr = this.filteredrows;
      len = fr.length;

      if (this.collection.cloneObjects || options.forceClones) {
        method = options.forceCloneMethod || this.collection.cloneMethod;
        for (i = 0; i < len; i++) {
          result.push(clone(data[fr[i]], method));
        }
      } else {
        for (i = 0; i < len; i++) {
          result.push(data[fr[i]]);
        }
      }
      return result;
    };

    /**
     * Used to run an update operation on all documents currently in the resultset.
     *
     * @param {function} updateFunction - User supplied updateFunction(obj) will be executed for each document object.
     * @returns {Resultset} this resultset for further chain ops.
     * @memberof Resultset
     */
    Resultset.prototype.update = function (updateFunction) {

      if (typeof (updateFunction) !== "function") {
        throw new TypeError('Argument is not a function');
      }

      // if this is chained resultset with no filters applied, we need to populate filteredrows first
      if (this.searchIsChained && !this.filterInitialized && this.filteredrows.length === 0) {
        this.filteredrows = this.collection.prepareFullDocIndex();
      }

      var len = this.filteredrows.length,
        rcd = this.collection.data;

      for (var idx = 0; idx < len; idx++) {
        // pass in each document object currently in resultset to user supplied updateFunction
        updateFunction(rcd[this.filteredrows[idx]]);

        // notify collection we have changed this object so it can update meta and allow DynamicViews to re-evaluate
        this.collection.update(rcd[this.filteredrows[idx]]);
      }

      return this;
    };

    /**
     * Removes all document objects which are currently in resultset from collection (as well as resultset)
     *
     * @returns {Resultset} this (empty) resultset for further chain ops.
     * @memberof Resultset
     */
    Resultset.prototype.remove = function () {

      // if this is chained resultset with no filters applied, we need to populate filteredrows first
      if (this.searchIsChained && !this.filterInitialized && this.filteredrows.length === 0) {
        this.filteredrows = this.collection.prepareFullDocIndex();
      }

      this.collection.remove(this.data());

      this.filteredrows = [];

      return this;
    };

    /**
     * data transformation via user supplied functions
     *
     * @param {function} mapFunction - this function accepts a single document for you to transform and return
     * @param {function} reduceFunction - this function accepts many (array of map outputs) and returns single value
     * @returns {value} The output of your reduceFunction
     * @memberof Resultset
     */
    Resultset.prototype.mapReduce = function (mapFunction, reduceFunction) {
      try {
        return reduceFunction(this.data().map(mapFunction));
      } catch (err) {
        throw err;
      }
    };

    /**
     * eqJoin() - Left joining two sets of data. Join keys can be defined or calculated properties
     * eqJoin expects the right join key values to be unique.  Otherwise left data will be joined on the last joinData object with that key
     * @param {Array} joinData - Data array to join to.
     * @param {(string|function)} leftJoinKey - Property name in this result set to join on or a function to produce a value to join on
     * @param {(string|function)} rightJoinKey - Property name in the joinData to join on or a function to produce a value to join on
     * @param {function=} mapFun - (Optional) A function that receives each matching pair and maps them into output objects - function(left,right){return joinedObject}
     * @returns {Resultset} A resultset with data in the format [{left: leftObj, right: rightObj}]
     * @memberof Resultset
     */
    Resultset.prototype.eqJoin = function (joinData, leftJoinKey, rightJoinKey, mapFun) {

      var leftData = [],
        leftDataLength,
        rightData = [],
        rightDataLength,
        key,
        result = [],
        leftKeyisFunction = typeof leftJoinKey === 'function',
        rightKeyisFunction = typeof rightJoinKey === 'function',
        joinMap = {};

      //get the left data
      leftData = this.data();
      leftDataLength = leftData.length;

      //get the right data
      if (joinData instanceof Resultset) {
        rightData = joinData.data();
      } else if (Array.isArray(joinData)) {
        rightData = joinData;
      } else {
        throw new TypeError('joinData needs to be an array or result set');
      }
      rightDataLength = rightData.length;

      //construct a lookup table

      for (var i = 0; i < rightDataLength; i++) {
        key = rightKeyisFunction ? rightJoinKey(rightData[i]) : rightData[i][rightJoinKey];
        joinMap[key] = rightData[i];
      }

      if (!mapFun) {
        mapFun = function (left, right) {
          return {
            left: left,
            right: right
          };
        };
      }

      //Run map function over each object in the resultset
      for (var j = 0; j < leftDataLength; j++) {
        key = leftKeyisFunction ? leftJoinKey(leftData[j]) : leftData[j][leftJoinKey];
        result.push(mapFun(leftData[j], joinMap[key] || {}));
      }

      //return return a new resultset with no filters
      this.collection = new Collection('joinData');
      this.collection.insert(result);
      this.filteredrows = [];
      this.filterInitialized = false;

      return this;
    };

    Resultset.prototype.map = function (mapFun) {
      var data = this.data().map(mapFun);
      //return return a new resultset with no filters
      this.collection = new Collection('mappedData');
      this.collection.insert(data);
      this.filteredrows = [];
      this.filterInitialized = false;

      return this;
    };

    /**
     * DynamicView class is a versatile 'live' view class which can have filters and sorts applied.
     *    Collection.addDynamicView(name) instantiates this DynamicView object and notifies it
     *    whenever documents are add/updated/removed so it can remain up-to-date. (chainable)
     *
     * @example
     * var mydv = mycollection.addDynamicView('test');  // default is non-persistent
     * mydv.applyFind({ 'doors' : 4 });
     * mydv.applyWhere(function(obj) { return obj.name === 'Toyota'; });
     * var results = mydv.data();
     *
     * @constructor DynamicView
     * @implements LokiEventEmitter
     * @param {Collection} collection - A reference to the collection to work against
     * @param {string} name - The name of this dynamic view
     * @param {object=} options - (Optional) Pass in object with 'persistent' and/or 'sortPriority' options.
     * @param {boolean} options.persistent - indicates if view is to main internal results array in 'resultdata'
     * @param {string} options.sortPriority - 'passive' (sorts performed on call to data) or 'active' (after updates)
     * @param {number} options.minRebuildInterval - minimum rebuild interval (need clarification to docs here)
     * @see {@link Collection#addDynamicView} to construct instances of DynamicView
     */
    function DynamicView(collection, name, options) {
      this.collection = collection;
      this.name = name;
      this.rebuildPending = false;
      this.options = options || {};

      if (!this.options.hasOwnProperty('persistent')) {
        this.options.persistent = false;
      }

      // 'persistentSortPriority':
      // 'passive' will defer the sort phase until they call data(). (most efficient overall)
      // 'active' will sort async whenever next idle. (prioritizes read speeds)
      if (!this.options.hasOwnProperty('sortPriority')) {
        this.options.sortPriority = 'passive';
      }

      if (!this.options.hasOwnProperty('minRebuildInterval')) {
        this.options.minRebuildInterval = 1;
      }

      this.resultset = new Resultset(collection);
      this.resultdata = [];
      this.resultsdirty = false;

      this.cachedresultset = null;

      // keep ordered filter pipeline
      this.filterPipeline = [];

      // sorting member variables
      // we only support one active search, applied using applySort() or applySimpleSort()
      this.sortFunction = null;
      this.sortCriteria = null;
      this.sortDirty = false;

      // for now just have 1 event for when we finally rebuilt lazy view
      // once we refactor transactions, i will tie in certain transactional events

      this.events = {
        'rebuild': []
      };
    }

    DynamicView.prototype = new LokiEventEmitter();


    /**
     * rematerialize() - intended for use immediately after deserialization (loading)
     *    This will clear out and reapply filterPipeline ops, recreating the view.
     *    Since where filters do not persist correctly, this method allows
     *    restoring the view to state where user can re-apply those where filters.
     *
     * @param {Object=} options - (Optional) allows specification of 'removeWhereFilters' option
     * @returns {DynamicView} This dynamic view for further chained ops.
     * @memberof DynamicView
     * @fires DynamicView.rebuild
     */
    DynamicView.prototype.rematerialize = function (options) {
      var fpl,
        fpi,
        idx;

      options = options || {};

      this.resultdata = [];
      this.resultsdirty = true;
      this.resultset = new Resultset(this.collection);

      if (this.sortFunction || this.sortCriteria) {
        this.sortDirty = true;
      }

      if (options.hasOwnProperty('removeWhereFilters')) {
        // for each view see if it had any where filters applied... since they don't
        // serialize those functions lets remove those invalid filters
        fpl = this.filterPipeline.length;
        fpi = fpl;
        while (fpi--) {
          if (this.filterPipeline[fpi].type === 'where') {
            if (fpi !== this.filterPipeline.length - 1) {
              this.filterPipeline[fpi] = this.filterPipeline[this.filterPipeline.length - 1];
            }

            this.filterPipeline.length--;
          }
        }
      }

      // back up old filter pipeline, clear filter pipeline, and reapply pipeline ops
      var ofp = this.filterPipeline;
      this.filterPipeline = [];

      // now re-apply 'find' filterPipeline ops
      fpl = ofp.length;
      for (idx = 0; idx < fpl; idx++) {
        this.applyFind(ofp[idx].val);
      }

      // during creation of unit tests, i will remove this forced refresh and leave lazy
      this.data();

      // emit rebuild event in case user wants to be notified
      this.emit('rebuild', this);

      return this;
    };

    /**
     * branchResultset() - Makes a copy of the internal resultset for branched queries.
     *    Unlike this dynamic view, the branched resultset will not be 'live' updated,
     *    so your branched query should be immediately resolved and not held for future evaluation.
     *
     * @param {(string|array=)} transform - Optional name of collection transform, or an array of transform steps
     * @param {object=} parameters - optional parameters (if optional transform requires them)
     * @returns {Resultset} A copy of the internal resultset for branched queries.
     * @memberof DynamicView
     */
    DynamicView.prototype.branchResultset = function (transform, parameters) {
      var rs = this.resultset.branch();

      if (typeof transform === 'undefined') {
        return rs;
      }

      return rs.transform(transform, parameters);
    };

    /**
     * toJSON() - Override of toJSON to avoid circular references
     *
     */
    DynamicView.prototype.toJSON = function () {
      var copy = new DynamicView(this.collection, this.name, this.options);

      copy.resultset = this.resultset;
      copy.resultdata = []; // let's not save data (copy) to minimize size
      copy.resultsdirty = true;
      copy.filterPipeline = this.filterPipeline;
      copy.sortFunction = this.sortFunction;
      copy.sortCriteria = this.sortCriteria;
      copy.sortDirty = this.sortDirty;

      // avoid circular reference, reapply in db.loadJSON()
      copy.collection = null;

      return copy;
    };

    /**
     * removeFilters() - Used to clear pipeline and reset dynamic view to initial state.
     *     Existing options should be retained.
     * @memberof DynamicView
     */
    DynamicView.prototype.removeFilters = function () {
      this.rebuildPending = false;
      this.resultset.reset();
      this.resultdata = [];
      this.resultsdirty = false;

      this.cachedresultset = null;

      // keep ordered filter pipeline
      this.filterPipeline = [];

      // sorting member variables
      // we only support one active search, applied using applySort() or applySimpleSort()
      this.sortFunction = null;
      this.sortCriteria = null;
      this.sortDirty = false;
    };

    /**
     * applySort() - Used to apply a sort to the dynamic view
     * @example
     * dv.applySort(function(obj1, obj2) {
     *   if (obj1.name === obj2.name) return 0;
     *   if (obj1.name > obj2.name) return 1;
     *   if (obj1.name < obj2.name) return -1;
     * });
     *
     * @param {function} comparefun - a javascript compare function used for sorting
     * @returns {DynamicView} this DynamicView object, for further chain ops.
     * @memberof DynamicView
     */
    DynamicView.prototype.applySort = function (comparefun) {
      this.sortFunction = comparefun;
      this.sortCriteria = null;

      this.queueSortPhase();

      return this;
    };

    /**
     * applySimpleSort() - Used to specify a property used for view translation.
     * @example
     * dv.applySimpleSort("name");
     *
     * @param {string} propname - Name of property by which to sort.
     * @param {boolean=} isdesc - (Optional) If true, the sort will be in descending order.
     * @returns {DynamicView} this DynamicView object, for further chain ops.
     * @memberof DynamicView
     */
    DynamicView.prototype.applySimpleSort = function (propname, isdesc) {
      this.sortCriteria = [
        [propname, isdesc || false]
      ];
      this.sortFunction = null;

      this.queueSortPhase();

      return this;
    };

    /**
     * applySortCriteria() - Allows sorting a resultset based on multiple columns.
     * @example
     * // to sort by age and then name (both ascending)
     * dv.applySortCriteria(['age', 'name']);
     * // to sort by age (ascending) and then by name (descending)
     * dv.applySortCriteria(['age', ['name', true]);
     * // to sort by age (descending) and then by name (descending)
     * dv.applySortCriteria(['age', true], ['name', true]);
     *
     * @param {array} properties - array of property names or subarray of [propertyname, isdesc] used evaluate sort order
     * @returns {DynamicView} Reference to this DynamicView, sorted, for future chain operations.
     * @memberof DynamicView
     */
    DynamicView.prototype.applySortCriteria = function (criteria) {
      this.sortCriteria = criteria;
      this.sortFunction = null;

      this.queueSortPhase();

      return this;
    };

    /**
     * startTransaction() - marks the beginning of a transaction.
     *
     * @returns {DynamicView} this DynamicView object, for further chain ops.
     */
    DynamicView.prototype.startTransaction = function () {
      this.cachedresultset = this.resultset.copy();

      return this;
    };

    /**
     * commit() - commits a transaction.
     *
     * @returns {DynamicView} this DynamicView object, for further chain ops.
     */
    DynamicView.prototype.commit = function () {
      this.cachedresultset = null;

      return this;
    };

    /**
     * rollback() - rolls back a transaction.
     *
     * @returns {DynamicView} this DynamicView object, for further chain ops.
     */
    DynamicView.prototype.rollback = function () {
      this.resultset = this.cachedresultset;

      if (this.options.persistent) {
        // for now just rebuild the persistent dynamic view data in this worst case scenario
        // (a persistent view utilizing transactions which get rolled back), we already know the filter so not too bad.
        this.resultdata = this.resultset.data();

        this.emit('rebuild', this);
      }

      return this;
    };


    /**
     * Implementation detail.
     * _indexOfFilterWithId() - Find the index of a filter in the pipeline, by that filter's ID.
     *
     * @param {(string|number)} uid - The unique ID of the filter.
     * @returns {number}: index of the referenced filter in the pipeline; -1 if not found.
     */
    DynamicView.prototype._indexOfFilterWithId = function (uid) {
      if (typeof uid === 'string' || typeof uid === 'number') {
        for (var idx = 0, len = this.filterPipeline.length; idx < len; idx += 1) {
          if (uid === this.filterPipeline[idx].uid) {
            return idx;
          }
        }
      }
      return -1;
    };

    /**
     * Implementation detail.
     * _addFilter() - Add the filter object to the end of view's filter pipeline and apply the filter to the resultset.
     *
     * @param {object} filter - The filter object. Refer to applyFilter() for extra details.
     */
    DynamicView.prototype._addFilter = function (filter) {
      this.filterPipeline.push(filter);
      this.resultset[filter.type](filter.val);
    };

    /**
     * reapplyFilters() - Reapply all the filters in the current pipeline.
     *
     * @returns {DynamicView} this DynamicView object, for further chain ops.
     */
    DynamicView.prototype.reapplyFilters = function () {
      this.resultset.reset();

      this.cachedresultset = null;
      if (this.options.persistent) {
        this.resultdata = [];
        this.resultsdirty = true;
      }

      var filters = this.filterPipeline;
      this.filterPipeline = [];

      for (var idx = 0, len = filters.length; idx < len; idx += 1) {
        this._addFilter(filters[idx]);
      }

      if (this.sortFunction || this.sortCriteria) {
        this.queueSortPhase();
      } else {
        this.queueRebuildEvent();
      }

      return this;
    };

    /**
     * applyFilter() - Adds or updates a filter in the DynamicView filter pipeline
     *
     * @param {object} filter - A filter object to add to the pipeline.
     *    The object is in the format { 'type': filter_type, 'val', filter_param, 'uid', optional_filter_id }
     * @returns {DynamicView} this DynamicView object, for further chain ops.
     * @memberof DynamicView
     */
    DynamicView.prototype.applyFilter = function (filter) {
      var idx = this._indexOfFilterWithId(filter.uid);
      if (idx >= 0) {
        this.filterPipeline[idx] = filter;
        return this.reapplyFilters();
      }

      this.cachedresultset = null;
      if (this.options.persistent) {
        this.resultdata = [];
        this.resultsdirty = true;
      }

      this._addFilter(filter);

      if (this.sortFunction || this.sortCriteria) {
        this.queueSortPhase();
      } else {
        this.queueRebuildEvent();
      }

      return this;
    };

    /**
     * applyFind() - Adds or updates a mongo-style query option in the DynamicView filter pipeline
     *
     * @param {object} query - A mongo-style query object to apply to pipeline
     * @param {(string|number)=} uid - Optional: The unique ID of this filter, to reference it in the future.
     * @returns {DynamicView} this DynamicView object, for further chain ops.
     * @memberof DynamicView
     */
    DynamicView.prototype.applyFind = function (query, uid) {
      this.applyFilter({
        type: 'find',
        val: query,
        uid: uid
      });
      return this;
    };

    /**
     * applyWhere() - Adds or updates a javascript filter function in the DynamicView filter pipeline
     *
     * @param {function} fun - A javascript filter function to apply to pipeline
     * @param {(string|number)=} uid - Optional: The unique ID of this filter, to reference it in the future.
     * @returns {DynamicView} this DynamicView object, for further chain ops.
     * @memberof DynamicView
     */
    DynamicView.prototype.applyWhere = function (fun, uid) {
      this.applyFilter({
        type: 'where',
        val: fun,
        uid: uid
      });
      return this;
    };

    /**
     * removeFilter() - Remove the specified filter from the DynamicView filter pipeline
     *
     * @param {(string|number)} uid - The unique ID of the filter to be removed.
     * @returns {DynamicView} this DynamicView object, for further chain ops.
     * @memberof DynamicView
     */
    DynamicView.prototype.removeFilter = function (uid) {
      var idx = this._indexOfFilterWithId(uid);
      if (idx < 0) {
        throw new Error("Dynamic view does not contain a filter with ID: " + uid);
      }

      this.filterPipeline.splice(idx, 1);
      this.reapplyFilters();
      return this;
    };

    /**
     * count() - returns the number of documents representing the current DynamicView contents.
     *
     * @returns {number} The number of documents representing the current DynamicView contents.
     * @memberof DynamicView
     */
    DynamicView.prototype.count = function () {
      if (this.options.persistent) {
        return this.resultdata.length;
      }
      return this.resultset.count();
    };

    /**
     * data() - resolves and pending filtering and sorting, then returns document array as result.
     *
     * @returns {array} An array of documents representing the current DynamicView contents.
     * @memberof DynamicView
     */
    DynamicView.prototype.data = function () {
      // using final sort phase as 'catch all' for a few use cases which require full rebuild
      if (this.sortDirty || this.resultsdirty) {
        this.performSortPhase({
          suppressRebuildEvent: true
        });
      }
      return (this.options.persistent) ? (this.resultdata) : (this.resultset.data());
    };

    /**
     * queueRebuildEvent() - When the view is not sorted we may still wish to be notified of rebuild events.
     *     This event will throttle and queue a single rebuild event when batches of updates affect the view.
     */
    DynamicView.prototype.queueRebuildEvent = function () {
      if (this.rebuildPending) {
        return;
      }
      this.rebuildPending = true;

      var self = this;
      setTimeout(function () {
        if (self.rebuildPending) {
          self.rebuildPending = false;
          self.emit('rebuild', self);
        }
      }, this.options.minRebuildInterval);
    };

    /**
     * queueSortPhase : If the view is sorted we will throttle sorting to either :
     *    (1) passive - when the user calls data(), or
     *    (2) active - once they stop updating and yield js thread control
     */
    DynamicView.prototype.queueSortPhase = function () {
      // already queued? exit without queuing again
      if (this.sortDirty) {
        return;
      }
      this.sortDirty = true;

      var self = this;
      if (this.options.sortPriority === "active") {
        // active sorting... once they are done and yield js thread, run async performSortPhase()
        setTimeout(function () {
          self.performSortPhase();
        }, this.options.minRebuildInterval);
      } else {
        // must be passive sorting... since not calling performSortPhase (until data call), lets use queueRebuildEvent to
        // potentially notify user that data has changed.
        this.queueRebuildEvent();
      }
    };

    /**
     * performSortPhase() - invoked synchronously or asynchronously to perform final sort phase (if needed)
     *
     */
    DynamicView.prototype.performSortPhase = function (options) {
      // async call to this may have been pre-empted by synchronous call to data before async could fire
      if (!this.sortDirty && !this.resultsdirty) {
        return;
      }

      options = options || {};

      if (this.sortDirty) {
        if (this.sortFunction) {
          this.resultset.sort(this.sortFunction);
        } else if (this.sortCriteria) {
          this.resultset.compoundsort(this.sortCriteria);
        }

        this.sortDirty = false;
      }

      if (this.options.persistent) {
        // persistent view, rebuild local resultdata array
        this.resultdata = this.resultset.data();
        this.resultsdirty = false;
      }

      if (!options.suppressRebuildEvent) {
        this.emit('rebuild', this);
      }
    };

    /**
     * evaluateDocument() - internal method for (re)evaluating document inclusion.
     *    Called by : collection.insert() and collection.update().
     *
     * @param {int} objIndex - index of document to (re)run through filter pipeline.
     * @param {bool} isNew - true if the document was just added to the collection.
     */
    DynamicView.prototype.evaluateDocument = function (objIndex, isNew) {
      // if no filter applied yet, the result 'set' should remain 'everything'
      if (!this.resultset.filterInitialized) {
        if (this.options.persistent) {
          this.resultdata = this.resultset.data();
        }
        // need to re-sort to sort new document
        if (this.sortFunction || this.sortCriteria) {
          this.queueSortPhase();
        } else {
          this.queueRebuildEvent();
        }
        return;
      }

      var ofr = this.resultset.filteredrows;
      var oldPos = (isNew) ? (-1) : (ofr.indexOf(+objIndex));
      var oldlen = ofr.length;

      // creating a 1-element resultset to run filter chain ops on to see if that doc passes filters;
      // mostly efficient algorithm, slight stack overhead price (this function is called on inserts and updates)
      var evalResultset = new Resultset(this.collection);
      evalResultset.filteredrows = [objIndex];
      evalResultset.filterInitialized = true;
      var filter;
      for (var idx = 0, len = this.filterPipeline.length; idx < len; idx++) {
        filter = this.filterPipeline[idx];
        evalResultset[filter.type](filter.val);
      }

      // not a true position, but -1 if not pass our filter(s), 0 if passed filter(s)
      var newPos = (evalResultset.filteredrows.length === 0) ? -1 : 0;

      // wasn't in old, shouldn't be now... do nothing
      if (oldPos === -1 && newPos === -1) return;

      // wasn't in resultset, should be now... add
      if (oldPos === -1 && newPos !== -1) {
        ofr.push(objIndex);

        if (this.options.persistent) {
          this.resultdata.push(this.collection.data[objIndex]);
        }

        // need to re-sort to sort new document
        if (this.sortFunction || this.sortCriteria) {
          this.queueSortPhase();
        } else {
          this.queueRebuildEvent();
        }

        return;
      }

      // was in resultset, shouldn't be now... delete
      if (oldPos !== -1 && newPos === -1) {
        if (oldPos < oldlen - 1) {
          // http://dvolvr.davidwaterston.com/2013/06/09/restating-the-obvious-the-fastest-way-to-truncate-an-array-in-javascript/comment-page-1/
          ofr[oldPos] = ofr[oldlen - 1];
          ofr.length = oldlen - 1;

          if (this.options.persistent) {
            this.resultdata[oldPos] = this.resultdata[oldlen - 1];
            this.resultdata.length = oldlen - 1;
          }
        } else {
          ofr.length = oldlen - 1;

          if (this.options.persistent) {
            this.resultdata.length = oldlen - 1;
          }
        }

        // in case changes to data altered a sort column
        if (this.sortFunction || this.sortCriteria) {
          this.queueSortPhase();
        } else {
          this.queueRebuildEvent();
        }

        return;
      }

      // was in resultset, should still be now... (update persistent only?)
      if (oldPos !== -1 && newPos !== -1) {
        if (this.options.persistent) {
          // in case document changed, replace persistent view data with the latest collection.data document
          this.resultdata[oldPos] = this.collection.data[objIndex];
        }

        // in case changes to data altered a sort column
        if (this.sortFunction || this.sortCriteria) {
          this.queueSortPhase();
        } else {
          this.queueRebuildEvent();
        }

        return;
      }
    };

    /**
     * removeDocument() - internal function called on collection.delete()
     */
    DynamicView.prototype.removeDocument = function (objIndex) {
      // if no filter applied yet, the result 'set' should remain 'everything'
      if (!this.resultset.filterInitialized) {
        if (this.options.persistent) {
          this.resultdata = this.resultset.data();
        }
        // in case changes to data altered a sort column
        if (this.sortFunction || this.sortCriteria) {
          this.queueSortPhase();
        } else {
          this.queueRebuildEvent();
        }
        return;
      }

      var ofr = this.resultset.filteredrows;
      var oldPos = ofr.indexOf(+objIndex);
      var oldlen = ofr.length;
      var idx;

      if (oldPos !== -1) {
        // if not last row in resultdata, swap last to hole and truncate last row
        if (oldPos < oldlen - 1) {
          ofr[oldPos] = ofr[oldlen - 1];
          ofr.length = oldlen - 1;

          if (this.options.persistent) {
            this.resultdata[oldPos] = this.resultdata[oldlen - 1];
            this.resultdata.length = oldlen - 1;
          }
        }
        // last row, so just truncate last row
        else {
          ofr.length = oldlen - 1;

          if (this.options.persistent) {
            this.resultdata.length = oldlen - 1;
          }
        }

        // in case changes to data altered a sort column
        if (this.sortFunction || this.sortCriteria) {
          this.queueSortPhase();
        } else {
          this.queueRebuildEvent();
        }
      }

      // since we are using filteredrows to store data array positions
      // if they remove a document (whether in our view or not),
      // we need to adjust array positions -1 for all document array references after that position
      oldlen = ofr.length;
      for (idx = 0; idx < oldlen; idx++) {
        if (ofr[idx] > objIndex) {
          ofr[idx]--;
        }
      }
    };

    /**
     * mapReduce() - data transformation via user supplied functions
     *
     * @param {function} mapFunction - this function accepts a single document for you to transform and return
     * @param {function} reduceFunction - this function accepts many (array of map outputs) and returns single value
     * @returns The output of your reduceFunction
     * @memberof DynamicView
     */
    DynamicView.prototype.mapReduce = function (mapFunction, reduceFunction) {
      try {
        return reduceFunction(this.data().map(mapFunction));
      } catch (err) {
        throw err;
      }
    };


    /**
     * Collection class that handles documents of same type
     * @constructor Collection
     * @implements LokiEventEmitter
     * @param {string} name - collection name
     * @param {(array|object)=} options - (optional) array of property names to be indicized OR a configuration object
     * @param {array} options.unique - array of property names to define unique constraints for
     * @param {array} options.exact - array of property names to define exact constraints for
     * @param {array} options.indices - array property names to define binary indexes for
     * @param {boolean} options.asyncListeners - default is false
     * @param {boolean} options.disableChangesApi - default is true
     * @param {boolean} options.autoupdate - use Object.observe to update objects automatically (default: false)
     * @param {boolean} options.clone - specify whether inserts and queries clone to/from user
     * @param {string} options.cloneMethod - 'parse-stringify' (default), 'jquery-extend-deep', 'shallow'
     * @param {int} options.ttlInterval - time interval for clearing out 'aged' documents; not set by default.
     * @see {@link Loki#addCollection} for normal creation of collections
     */
    function Collection(name, options) {
      // the name of the collection

      this.name = name;
      // the data held by the collection
      this.data = [];
      this.idIndex = []; // index of id
      this.binaryIndices = {}; // user defined indexes
      this.constraints = {
        unique: {},
        exact: {}
      };

      // unique contraints contain duplicate object references, so they are not persisted.
      // we will keep track of properties which have unique contraint applied here, and regenerate on load
      this.uniqueNames = [];

      // transforms will be used to store frequently used query chains as a series of steps
      // which itself can be stored along with the database.
      this.transforms = {};

      // the object type of the collection
      this.objType = name;

      // in autosave scenarios we will use collection level dirty flags to determine whether save is needed.
      // currently, if any collection is dirty we will autosave the whole database if autosave is configured.
      // defaulting to true since this is called from addCollection and adding a collection should trigger save
      this.dirty = true;

      // private holders for cached data
      this.cachedIndex = null;
      this.cachedBinaryIndex = null;
      this.cachedData = null;
      var self = this;

      /* OPTIONS */
      options = options || {};

      // exact match and unique constraints
      if (options.hasOwnProperty('unique')) {
        if (!Array.isArray(options.unique)) {
          options.unique = [options.unique];
        }
        options.unique.forEach(function (prop) {
          self.uniqueNames.push(prop); // used to regenerate on subsequent database loads
          self.constraints.unique[prop] = new UniqueIndex(prop);
        });
      }

      if (options.hasOwnProperty('exact')) {
        options.exact.forEach(function (prop) {
          self.constraints.exact[prop] = new ExactIndex(prop);
        });
      }

      // is collection transactional
      this.transactional = options.hasOwnProperty('transactional') ? options.transactional : false;

      // options to clone objects when inserting them
      this.cloneObjects = options.hasOwnProperty('clone') ? options.clone : false;

      // default clone method (if enabled) is parse-stringify
      this.cloneMethod = options.hasOwnProperty('cloneMethod') ? options.cloneMethod : "parse-stringify";

      // option to make event listeners async, default is sync
      this.asyncListeners = options.hasOwnProperty('asyncListeners') ? options.asyncListeners : false;

      // disable track changes
      this.disableChangesApi = options.hasOwnProperty('disableChangesApi') ? options.disableChangesApi : true;

      // option to observe objects and update them automatically, ignored if Object.observe is not supported
      this.autoupdate = options.hasOwnProperty('autoupdate') ? options.autoupdate : false;

      //option to activate a cleaner daemon - clears "aged" documents at set intervals.
      this.ttl = {
        age: null,
        ttlInterval: null,
        daemon: null
      };
      this.setTTL(options.ttl || -1, options.ttlInterval);

      // currentMaxId - change manually at your own peril!
      this.maxId = 0;

      this.DynamicViews = [];

      // events
      this.events = {
        'insert': [],
        'update': [],
        'pre-insert': [],
        'pre-update': [],
        'close': [],
        'flushbuffer': [],
        'error': [],
        'delete': [],
        'warning': []
      };

      // changes are tracked by collection and aggregated by the db
      this.changes = [];

      // initialize the id index
      this.ensureId();
      var indices = [];
      // initialize optional user-supplied indices array ['age', 'lname', 'zip']
      if (options && options.indices) {
        if (Object.prototype.toString.call(options.indices) === '[object Array]') {
          indices = options.indices;
        } else if (typeof options.indices === 'string') {
          indices = [options.indices];
        } else {
          throw new TypeError('Indices needs to be a string or an array of strings');
        }
      }

      for (var idx = 0; idx < indices.length; idx++) {
        this.ensureIndex(indices[idx]);
      }

      function observerCallback(changes) {

        var changedObjects = typeof Set === 'function' ? new Set() : [];

        if (!changedObjects.add)
          changedObjects.add = function (object) {
            if (this.indexOf(object) === -1)
              this.push(object);
            return this;
          };

        changes.forEach(function (change) {
          changedObjects.add(change.object);
        });

        changedObjects.forEach(function (object) {
          if (!hasOwnProperty.call(object, '$loki'))
            return self.removeAutoUpdateObserver(object);
          try {
            self.update(object);
          } catch (err) {}
        });
      }

      this.observerCallback = observerCallback;

      /*
       * This method creates a clone of the current status of an object and associates operation and collection name,
       * so the parent db can aggregate and generate a changes object for the entire db
       */
      function createChange(name, op, obj) {
        self.changes.push({
          name: name,
          operation: op,
          obj: JSON.parse(JSON.stringify(obj))
        });
      }

      // clear all the changes
      function flushChanges() {
        self.changes = [];
      }

      this.getChanges = function () {
        return self.changes;
      };

      this.flushChanges = flushChanges;

      /**
       * If the changes API is disabled make sure only metadata is added without re-evaluating everytime if the changesApi is enabled
       */
      function insertMeta(obj) {
        if (!obj) {
          return;
        }
        if (!obj.meta) {
          obj.meta = {};
        }

        obj.meta.created = (new Date()).getTime();
        obj.meta.revision = 0;
      }

      function updateMeta(obj) {
        if (!obj) {
          return;
        }
        obj.meta.updated = (new Date()).getTime();
        obj.meta.revision += 1;
      }

      function createInsertChange(obj) {
        createChange(self.name, 'I', obj);
      }

      function createUpdateChange(obj) {
        createChange(self.name, 'U', obj);
      }

      function insertMetaWithChange(obj) {
        insertMeta(obj);
        createInsertChange(obj);
      }

      function updateMetaWithChange(obj) {
        updateMeta(obj);
        createUpdateChange(obj);
      }


      /* assign correct handler based on ChangesAPI flag */
      var insertHandler, updateHandler;

      function setHandlers() {
        insertHandler = self.disableChangesApi ? insertMeta : insertMetaWithChange;
        updateHandler = self.disableChangesApi ? updateMeta : updateMetaWithChange;
      }

      setHandlers();

      this.setChangesApi = function (enabled) {
        self.disableChangesApi = !enabled;
        setHandlers();
      };
      /**
       * built-in events
       */
      this.on('insert', function insertCallback(obj) {
        insertHandler(obj);
      });

      this.on('update', function updateCallback(obj) {
        updateHandler(obj);
      });

      this.on('delete', function deleteCallback(obj) {
        if (!self.disableChangesApi) {
          createChange(self.name, 'R', obj);
        }
      });

      this.on('warning', function (warning) {
        self.console.warn(warning);
      });
      // for de-serialization purposes
      flushChanges();
    }

    Collection.prototype = new LokiEventEmitter();

    Collection.prototype.console = {
      log: function () {},
      warn: function () {},
      error: function () {},
    };

    Collection.prototype.addAutoUpdateObserver = function (object) {
      if (!this.autoupdate || typeof Object.observe !== 'function')
        return;

      Object.observe(object, this.observerCallback, ['add', 'update', 'delete', 'reconfigure', 'setPrototype']);
    };

    Collection.prototype.removeAutoUpdateObserver = function (object) {
      if (!this.autoupdate || typeof Object.observe !== 'function')
        return;

      Object.unobserve(object, this.observerCallback);
    };

    /**
     * Adds a named collection transform to the collection
     * @param {string} name - name to associate with transform
     * @param {array} transform - an array of transformation 'step' objects to save into the collection
     * @memberof Collection
     */
    Collection.prototype.addTransform = function (name, transform) {
      if (this.transforms.hasOwnProperty(name)) {
        throw new Error("a transform by that name already exists");
      }

      this.transforms[name] = transform;
    };

    /**
     * Updates a named collection transform to the collection
     * @param {string} name - name to associate with transform
     * @param {object} transform - a transformation object to save into collection
     * @memberof Collection
     */
    Collection.prototype.setTransform = function (name, transform) {
      this.transforms[name] = transform;
    };

    /**
     * Removes a named collection transform from the collection
     * @param {string} name - name of collection transform to remove
     * @memberof Collection
     */
    Collection.prototype.removeTransform = function (name) {
      delete this.transforms[name];
    };

    Collection.prototype.byExample = function (template) {
      var k, obj, query;
      query = [];
      for (k in template) {
        if (!template.hasOwnProperty(k)) continue;
        query.push((
          obj = {},
          obj[k] = template[k],
          obj
        ));
      }
      return {
        '$and': query
      };
    };

    Collection.prototype.findObject = function (template) {
      return this.findOne(this.byExample(template));
    };

    Collection.prototype.findObjects = function (template) {
      return this.find(this.byExample(template));
    };

    /*----------------------------+
    | TTL daemon                  |
    +----------------------------*/
    Collection.prototype.ttlDaemonFuncGen = function () {
      var collection = this;
      var age = this.ttl.age;
      return function ttlDaemon() {
        var now = Date.now();
        var toRemove = collection.chain().where(function daemonFilter(member) {
          var timestamp = member.meta.updated || member.meta.created;
          var diff = now - timestamp;
          return age < diff;
        });
        toRemove.remove();
      };
    };

    Collection.prototype.setTTL = function (age, interval) {
      if (age < 0) {
        clearInterval(this.ttl.daemon);
      } else {
        this.ttl.age = age;
        this.ttl.ttlInterval = interval;
        this.ttl.daemon = setInterval(this.ttlDaemonFuncGen(), interval);
      }
    };

    /*----------------------------+
    | INDEXING                    |
    +----------------------------*/

    /**
     * create a row filter that covers all documents in the collection
     */
    Collection.prototype.prepareFullDocIndex = function () {
      var len = this.data.length;
      var indexes = new Array(len);
      for (var i = 0; i < len; i += 1) {
        indexes[i] = i;
      }
      return indexes;
    };

    /**
     * Ensure binary index on a certain field
     * @param {string} property - name of property to create binary index on
     * @param {boolean=} force - (Optional) flag indicating whether to construct index immediately
     * @memberof Collection
     */
    Collection.prototype.ensureIndex = function (property, force) {
      // optional parameter to force rebuild whether flagged as dirty or not
      if (typeof (force) === 'undefined') {
        force = false;
      }

      if (property === null || property === undefined) {
        throw new Error('Attempting to set index without an associated property');
      }

      if (this.binaryIndices[property] && !force) {
        if (!this.binaryIndices[property].dirty) return;
      }

      var index = {
        'name': property,
        'dirty': true,
        'values': this.prepareFullDocIndex()
      };
      this.binaryIndices[property] = index;

      var wrappedComparer =
        (function (p, data) {
          return function (a, b) {
            var objAp = data[a][p],
              objBp = data[b][p];
            if (objAp !== objBp) {
              if (ltHelper(objAp, objBp, false)) return -1;
              if (gtHelper(objAp, objBp, false)) return 1;
            }
            return 0;
          };
        })(property, this.data);

      index.values.sort(wrappedComparer);
      index.dirty = false;

      this.dirty = true; // for autosave scenarios
    };

    Collection.prototype.getSequencedIndexValues = function (property) {
      var idx, idxvals = this.binaryIndices[property].values;
      var result = "";

      for (idx = 0; idx < idxvals.length; idx++) {
        result += " [" + idx + "] " + this.data[idxvals[idx]][property];
      }

      return result;
    };

    Collection.prototype.ensureUniqueIndex = function (field) {
      var index = this.constraints.unique[field];
      if (!index) {
        // keep track of new unique index for regenerate after database (re)load.
        if (this.uniqueNames.indexOf(field) == -1) {
          this.uniqueNames.push(field);
        }
      }

      // if index already existed, (re)loading it will likely cause collisions, rebuild always
      this.constraints.unique[field] = index = new UniqueIndex(field);
      this.data.forEach(function (obj) {
        index.set(obj);
      });
      return index;
    };

    /**
     * Ensure all binary indices
     */
    Collection.prototype.ensureAllIndexes = function (force) {
      var key, bIndices = this.binaryIndices;
      for (key in bIndices) {
        if (hasOwnProperty.call(bIndices, key)) {
          this.ensureIndex(key, force);
        }
      }
    };

    Collection.prototype.flagBinaryIndexesDirty = function () {
      var key, bIndices = this.binaryIndices;
      for (key in bIndices) {
        if (hasOwnProperty.call(bIndices, key)) {
          bIndices[key].dirty = true;
        }
      }
    };

    Collection.prototype.flagBinaryIndexDirty = function (index) {
      if (this.binaryIndices[index])
        this.binaryIndices[index].dirty = true;
    };

    /**
     * Quickly determine number of documents in collection (or query)
     * @param {object=} query - (optional) query object to count results of
     * @returns {number} number of documents in the collection
     * @memberof Collection
     */
    Collection.prototype.count = function (query) {
      if (!query) {
        return this.data.length;
      }

      return this.chain().find(query).filteredrows.length;
    };

    /**
     * Rebuild idIndex
     */
    Collection.prototype.ensureId = function () {
      var len = this.data.length,
        i = 0;

      this.idIndex = [];
      for (i; i < len; i += 1) {
        this.idIndex.push(this.data[i].$loki);
      }
    };

    /**
     * Rebuild idIndex async with callback - useful for background syncing with a remote server
     */
    Collection.prototype.ensureIdAsync = function (callback) {
      this.async(function () {
        this.ensureId();
      }, callback);
    };

    /**
     * Add a dynamic view to the collection
     * @param {string} name - name of dynamic view to add
     * @param {object=} options - (optional) options to configure dynamic view with
     * @param {boolean} options.persistent - indicates if view is to main internal results array in 'resultdata'
     * @param {string} options.sortPriority - 'passive' (sorts performed on call to data) or 'active' (after updates)
     * @param {number} options.minRebuildInterval - minimum rebuild interval (need clarification to docs here)
     * @returns {DynamicView} reference to the dynamic view added
     * @memberof Collection
     **/

    Collection.prototype.addDynamicView = function (name, options) {
      var dv = new DynamicView(this, name, options);
      this.DynamicViews.push(dv);

      return dv;
    };

    /**
     * Remove a dynamic view from the collection
     * @param {string} name - name of dynamic view to remove
     * @memberof Collection
     **/
    Collection.prototype.removeDynamicView = function (name) {
      for (var idx = 0; idx < this.DynamicViews.length; idx++) {
        if (this.DynamicViews[idx].name === name) {
          this.DynamicViews.splice(idx, 1);
        }
      }
    };

    /**
     * Look up dynamic view reference from within the collection
     * @param {string} name - name of dynamic view to retrieve reference of
     * @returns {DynamicView} A reference to the dynamic view with that name
     * @memberof Collection
     **/
    Collection.prototype.getDynamicView = function (name) {
      for (var idx = 0; idx < this.DynamicViews.length; idx++) {
        if (this.DynamicViews[idx].name === name) {
          return this.DynamicViews[idx];
        }
      }

      return null;
    };

    /**
     * find and update: pass a filtering function to select elements to be updated
     * and apply the updatefunctino to those elements iteratively
     * @param {function} filterFunction - filter function whose results will execute update
     * @param {function} updateFunction - update function to run against filtered documents
     * @memberof Collection
     */
    Collection.prototype.findAndUpdate = function (filterFunction, updateFunction) {
      var results = this.where(filterFunction),
        i = 0,
        obj;
      try {
        for (i; i < results.length; i++) {
          obj = updateFunction(results[i]);
          this.update(obj);
        }

      } catch (err) {
        this.rollback();
        this.console.error(err.message);
      }
    };

    /**
     * Adds object(s) to collection, ensure object(s) have meta properties, clone it if necessary, etc.
     * @param {(object|array)} doc - the document (or array of documents) to be inserted
     * @returns {(object|array)} document or documents inserted
     * @memberof Collection
     */
    Collection.prototype.insert = function (doc) {
      if (!Array.isArray(doc)) {
        return this.insertOne(doc);
      }

      // holder to the clone of the object inserted if collections is set to clone objects
      var obj;
      var results = [];
      for (var i = 0, len = doc.length; i < len; i++) {
        obj = this.insertOne(doc[i]);
        if (!obj) {
          return undefined;
        }
        results.push(obj);
      }
      return results.length === 1 ? results[0] : results;
    };

    /**
     * Adds a single object, ensures it has meta properties, clone it if necessary, etc.
     * @param {object} doc - the document to be inserted
     * @returns {object} document or 'undefined' if there was a problem inserting it
     * @memberof Collection
     */
    Collection.prototype.insertOne = function (doc) {
      var err = null;
      if (typeof doc !== 'object') {
        err = new TypeError('Document needs to be an object');
      } else if (doc === null) {
        err = new TypeError('Object cannot be null');
      }

      if (err !== null) {
        this.emit('error', err);
        throw err;
      }

      // if configured to clone, do so now... otherwise just use same obj reference
      var obj = this.cloneObjects ? clone(doc, this.cloneMethod) : doc;

      if (typeof obj.meta === 'undefined') {
        obj.meta = {
          revision: 0,
          created: 0
        };
      }

      this.emit('pre-insert', obj);
      if (!this.add(obj)) {
        return undefined;
      }

      this.addAutoUpdateObserver(obj);
      this.emit('insert', obj);
      return obj;
    };

    /**
     * Empties the collection.
     * @memberof Collection
     */
    Collection.prototype.clear = function () {
      this.data = [];
      this.idIndex = [];
      this.binaryIndices = {};
      this.cachedIndex = null;
      this.cachedBinaryIndex = null;
      this.cachedData = null;
      this.maxId = 0;
      this.DynamicViews = [];
      this.dirty = true;
    };

    /**
     * Updates an object and notifies collection that the document has changed.
     * @param {object} doc - document to update within the collection
     * @memberof Collection
     */
    Collection.prototype.update = function (doc) {
      this.flagBinaryIndexesDirty();

      if (Array.isArray(doc)) {
        var k = 0,
          len = doc.length;
        for (k; k < len; k += 1) {
          this.update(doc[k]);
        }
        return;
      }

      // verify object is a properly formed document
      if (!hasOwnProperty.call(doc, '$loki')) {
        throw new Error('Trying to update unsynced document. Please save the document first by using insert() or addMany()');
      }
      try {
        this.startTransaction();
        var arr = this.get(doc.$loki, true),
          obj,
          position,
          self = this;

        obj = arr[0]; // -internal- obj ref
        position = arr[1]; // position in data array

        if (!arr) {
          throw new Error('Trying to update a document not in collection.');
        }
        this.emit('pre-update', doc);

        Object.keys(this.constraints.unique).forEach(function (key) {
          self.constraints.unique[key].update(obj, doc);
        });

        // operate the update
        this.data[position] = doc;

        if (obj !== doc) {
          this.addAutoUpdateObserver(doc);
        }

        // now that we can efficiently determine the data[] position of newly added document,
        // submit it for all registered DynamicViews to evaluate for inclusion/exclusion
        for (var idx = 0; idx < this.DynamicViews.length; idx++) {
          this.DynamicViews[idx].evaluateDocument(position, false);
        }

        this.idIndex[position] = obj.$loki;

        this.commit();
        this.dirty = true; // for autosave scenarios
        this.emit('update', doc);
        return doc;
      } catch (err) {
        this.rollback();
        this.console.error(err.message);
        this.emit('error', err);
        throw (err); // re-throw error so user does not think it succeeded
      }
    };

    /**
     * Add object to collection
     */
    Collection.prototype.add = function (obj) {
      // if parameter isn't object exit with throw
      if ('object' !== typeof obj) {
        throw new TypeError('Object being added needs to be an object');
      }
      // if object you are adding already has id column it is either already in the collection
      // or the object is carrying its own 'id' property.  If it also has a meta property,
      // then this is already in collection so throw error, otherwise rename to originalId and continue adding.
      if (typeof (obj.$loki) !== 'undefined') {
        throw new Error('Document is already in collection, please use update()');
      }

      this.flagBinaryIndexesDirty();

      /*
       * try adding object to collection
       */
      try {
        this.startTransaction();
        this.maxId++;

        if (isNaN(this.maxId)) {
          this.maxId = (this.data[this.data.length - 1].$loki + 1);
        }

        obj.$loki = this.maxId;
        obj.meta.version = 0;

        var key, constrUnique = this.constraints.unique;
        for (key in constrUnique) {
          if (hasOwnProperty.call(constrUnique, key)) {
            constrUnique[key].set(obj);
          }
        }

        // add new obj id to idIndex
        this.idIndex.push(obj.$loki);

        // add the object
        this.data.push(obj);

        // now that we can efficiently determine the data[] position of newly added document,
        // submit it for all registered DynamicViews to evaluate for inclusion/exclusion
        var addedPos = this.data.length - 1;
        var dvlen = this.DynamicViews.length;
        for (var i = 0; i < dvlen; i++) {
          this.DynamicViews[i].evaluateDocument(addedPos, true);
        }

        this.commit();
        this.dirty = true; // for autosave scenarios

        return (this.cloneObjects) ? (clone(obj, this.cloneMethod)) : (obj);
      } catch (err) {
        this.rollback();
        this.console.error(err.message);
        this.emit('error', err);
        throw (err); // re-throw error so user does not think it succeeded
      }
    };


    /**
     * Remove all documents matching supplied filter object
     * @param {object} query - query object to filter on
     * @memberof Collection
     */
    Collection.prototype.removeWhere = function (query) {
      var list;
      if (typeof query === 'function') {
        list = this.data.filter(query);
      } else {
        list = new Resultset(this, {
          queryObj: query
        });
      }
      this.remove(list);
    };

    Collection.prototype.removeDataOnly = function () {
      this.remove(this.data.slice());
    };

    /**
     * Remove a document from the collection
     * @param {object} doc - document to remove from collection
     * @memberof Collection
     */
    Collection.prototype.remove = function (doc) {
      if (typeof doc === 'number') {
        doc = this.get(doc);
      }

      if ('object' !== typeof doc) {
        throw new Error('Parameter is not an object');
      }
      if (Array.isArray(doc)) {
        var k = 0,
          len = doc.length;
        for (k; k < len; k += 1) {
          this.remove(doc[k]);
        }
        return;
      }

      if (!hasOwnProperty.call(doc, '$loki')) {
        throw new Error('Object is not a document stored in the collection');
      }

      this.flagBinaryIndexesDirty();

      try {
        this.startTransaction();
        var arr = this.get(doc.$loki, true),
          // obj = arr[0],
          position = arr[1];
        var self = this;
        Object.keys(this.constraints.unique).forEach(function (key) {
          if (doc[key] !== null && typeof doc[key] !== 'undefined') {
            self.constraints.unique[key].remove(doc[key]);
          }
        });
        // now that we can efficiently determine the data[] position of newly added document,
        // submit it for all registered DynamicViews to remove
        for (var idx = 0; idx < this.DynamicViews.length; idx++) {
          this.DynamicViews[idx].removeDocument(position);
        }

        this.data.splice(position, 1);
        this.removeAutoUpdateObserver(doc);

        // remove id from idIndex
        this.idIndex.splice(position, 1);

        this.commit();
        this.dirty = true; // for autosave scenarios
        this.emit('delete', arr[0]);
        delete doc.$loki;
        delete doc.meta;
        return doc;

      } catch (err) {
        this.rollback();
        this.console.error(err.message);
        this.emit('error', err);
        return null;
      }
    };

    /*---------------------+
    | Finding methods     |
    +----------------------*/

    /**
     * Get by Id - faster than other methods because of the searching algorithm
     * @param {int} id - $loki id of document you want to retrieve
     * @param {boolean} returnPosition - if 'true' we will return [object, position]
     * @returns {(object|array|null)} Object reference if document was found, null if not,
     *     or an array if 'returnPosition' was passed.
     * @memberof Collection
     */
    Collection.prototype.get = function (id, returnPosition) {
      var retpos = returnPosition || false,
        data = this.idIndex,
        max = data.length - 1,
        min = 0,
        mid = (min + max) >> 1;

      id = typeof id === 'number' ? id : parseInt(id, 10);

      if (isNaN(id)) {
        throw new TypeError('Passed id is not an integer');
      }

      while (data[min] < data[max]) {
        mid = (min + max) >> 1;

        if (data[mid] < id) {
          min = mid + 1;
        } else {
          max = mid;
        }
      }

      if (max === min && data[min] === id) {
        if (retpos) {
          return [this.data[min], min];
        }
        return this.data[min];
      }
      return null;

    };

    /**
     * Retrieve doc by Unique index
     * @param {string} field - name of uniquely indexed property to use when doing lookup
     * @param {value} value - unique value to search for
     * @returns {object} document matching the value passed
     * @memberof Collection
     */
    Collection.prototype.by = function (field, value) {
      var self;
      if (value === undefined) {
        self = this;
        return function (value) {
          return self.by(field, value);
        };
      }

      var result = this.constraints.unique[field].get(value);
      if (!this.cloneObjects) {
        return result;
      } else {
        return clone(result, this.cloneMethod);
      }
    };

    /**
     * Find one object by index property, by property equal to value
     * @param {object} query - query object used to perform search with
     * @returns {(object|null)} First matching document, or null if none
     * @memberof Collection
     */
    Collection.prototype.findOne = function (query) {
      // Instantiate Resultset and exec find op passing firstOnly = true param
      var result = new Resultset(this, {
        queryObj: query,
        firstOnly: true
      });
      if (Array.isArray(result) && result.length === 0) {
        return null;
      } else {
        if (!this.cloneObjects) {
          return result;
        } else {
          return clone(result, this.cloneMethod);
        }
      }
    };

    /**
     * Chain method, used for beginning a series of chained find() and/or view() operations
     * on a collection.
     *
     * @param {array} transform - Ordered array of transform step objects similar to chain
     * @param {object} parameters - Object containing properties representing parameters to substitute
     * @returns {Resultset} (this) resultset, or data array if any map or join functions where called
     * @memberof Collection
     */
    Collection.prototype.chain = function (transform, parameters) {
      var rs = new Resultset(this);

      if (typeof transform === 'undefined') {
        return rs;
      }

      return rs.transform(transform, parameters);
    };

    /**
     * Find method, api is similar to mongodb.
     * for more complex queries use [chain()]{@link Collection#chain} or [where()]{@link Collection#where}.
     * @example {@tutorial Query Examples}
     * @param {object} query - 'mongo-like' query object
     * @returns {array} Array of matching documents
     * @memberof Collection
     */
    Collection.prototype.find = function (query) {
      if (typeof (query) === 'undefined') {
        query = 'getAll';
      }

      var results = new Resultset(this, {
        queryObj: query
      });
      if (!this.cloneObjects) {
        return results;
      } else {
        return cloneObjectArray(results, this.cloneMethod);
      }
    };

    /**
     * Find object by unindexed field by property equal to value,
     * simply iterates and returns the first element matching the query
     */
    Collection.prototype.findOneUnindexed = function (prop, value) {
      var i = this.data.length,
        doc;
      while (i--) {
        if (this.data[i][prop] === value) {
          doc = this.data[i];
          return doc;
        }
      }
      return null;
    };

    /**
     * Transaction methods
     */

    /** start the transation */
    Collection.prototype.startTransaction = function () {
      if (this.transactional) {
        this.cachedData = clone(this.data, this.cloneMethod);
        this.cachedIndex = this.idIndex;
        this.cachedBinaryIndex = this.binaryIndices;

        // propagate startTransaction to dynamic views
        for (var idx = 0; idx < this.DynamicViews.length; idx++) {
          this.DynamicViews[idx].startTransaction();
        }
      }
    };

    /** commit the transation */
    Collection.prototype.commit = function () {
      if (this.transactional) {
        this.cachedData = null;
        this.cachedIndex = null;
        this.cachedBinaryIndex = null;

        // propagate commit to dynamic views
        for (var idx = 0; idx < this.DynamicViews.length; idx++) {
          this.DynamicViews[idx].commit();
        }
      }
    };

    /** roll back the transation */
    Collection.prototype.rollback = function () {
      if (this.transactional) {
        if (this.cachedData !== null && this.cachedIndex !== null) {
          this.data = this.cachedData;
          this.idIndex = this.cachedIndex;
          this.binaryIndices = this.cachedBinaryIndex;
        }

        // propagate rollback to dynamic views
        for (var idx = 0; idx < this.DynamicViews.length; idx++) {
          this.DynamicViews[idx].rollback();
        }
      }
    };

    // async executor. This is only to enable callbacks at the end of the execution.
    Collection.prototype.async = function (fun, callback) {
      setTimeout(function () {
        if (typeof fun === 'function') {
          fun();
          callback();
        } else {
          throw new TypeError('Argument passed for async execution is not a function');
        }
      }, 0);
    };

    /**
     * Query the collection by supplying a javascript filter function.
     * @example
     * var results = coll.where(function(obj) {
     *   return obj.legs === 8;
     * });
     *
     * @param {function} fun - filter function to run against all collection docs
     * @returns {array} all documents which pass your filter function
     * @memberof Collection
     */
    Collection.prototype.where = function (fun) {
      var results = new Resultset(this, {
        queryFunc: fun
      });
      if (!this.cloneObjects) {
        return results;
      } else {
        return cloneObjectArray(results, this.cloneMethod);
      }
    };

    /**
     * Map Reduce operation
     *
     * @param {function} mapFunction - function to use as map function
     * @param {function} reduceFunction - function to use as reduce function
     * @returns {data} The result of your mapReduce operation
     * @memberof Collection
     */
    Collection.prototype.mapReduce = function (mapFunction, reduceFunction) {
      try {
        return reduceFunction(this.data.map(mapFunction));
      } catch (err) {
        throw err;
      }
    };

    /**
     * Join two collections on specified properties
     *
     * @param {array} joinData - array of documents to 'join' to this collection
     * @param {string} leftJoinProp - property name in collection
     * @param {string} rightJoinProp - property name in joinData
     * @param {function=} mapFun - (Optional) map function to use
     * @returns {Resultset} Result of the mapping operation
     * @memberof Collection
     */
    Collection.prototype.eqJoin = function (joinData, leftJoinProp, rightJoinProp, mapFun) {
      // logic in Resultset class
      return new Resultset(this).eqJoin(joinData, leftJoinProp, rightJoinProp, mapFun);
    };

    /* ------ STAGING API -------- */
    /**
     * stages: a map of uniquely identified 'stages', which hold copies of objects to be
     * manipulated without affecting the data in the original collection
     */
    Collection.prototype.stages = {};

    /**
     * (Staging API) create a stage and/or retrieve it
     * @memberof Collection
     */
    Collection.prototype.getStage = function (name) {
      if (!this.stages[name]) {
        this.stages[name] = {};
      }
      return this.stages[name];
    };
    /**
     * a collection of objects recording the changes applied through a commmitStage
     */
    Collection.prototype.commitLog = [];

    /**
     * (Staging API) create a copy of an object and insert it into a stage
     * @memberof Collection
     */
    Collection.prototype.stage = function (stageName, obj) {
      var copy = JSON.parse(JSON.stringify(obj));
      this.getStage(stageName)[obj.$loki] = copy;
      return copy;
    };

    /**
     * (Staging API) re-attach all objects to the original collection, so indexes and views can be rebuilt
     * then create a message to be inserted in the commitlog
     * @param {string} stageName - name of stage
     * @param {string} message
     * @memberof Collection
     */
    Collection.prototype.commitStage = function (stageName, message) {
      var stage = this.getStage(stageName),
        prop,
        timestamp = new Date().getTime();

      for (prop in stage) {

        this.update(stage[prop]);
        this.commitLog.push({
          timestamp: timestamp,
          message: message,
          data: JSON.parse(JSON.stringify(stage[prop]))
        });
      }
      this.stages[stageName] = {};
    };

    Collection.prototype.no_op = function () {
      return;
    };

    /**
     * @memberof Collection
     */
    Collection.prototype.extract = function (field) {
      var i = 0,
        len = this.data.length,
        isDotNotation = isDeepProperty(field),
        result = [];
      for (i; i < len; i += 1) {
        result.push(deepProperty(this.data[i], field, isDotNotation));
      }
      return result;
    };

    /**
     * @memberof Collection
     */
    Collection.prototype.max = function (field) {
      return Math.max.apply(null, this.extract(field));
    };

    /**
     * @memberof Collection
     */
    Collection.prototype.min = function (field) {
      return Math.min.apply(null, this.extract(field));
    };

    /**
     * @memberof Collection
     */
    Collection.prototype.maxRecord = function (field) {
      var i = 0,
        len = this.data.length,
        deep = isDeepProperty(field),
        result = {
          index: 0,
          value: undefined
        },
        max;

      for (i; i < len; i += 1) {
        if (max !== undefined) {
          if (max < deepProperty(this.data[i], field, deep)) {
            max = deepProperty(this.data[i], field, deep);
            result.index = this.data[i].$loki;
          }
        } else {
          max = deepProperty(this.data[i], field, deep);
          result.index = this.data[i].$loki;
        }
      }
      result.value = max;
      return result;
    };

    /**
     * @memberof Collection
     */
    Collection.prototype.minRecord = function (field) {
      var i = 0,
        len = this.data.length,
        deep = isDeepProperty(field),
        result = {
          index: 0,
          value: undefined
        },
        min;

      for (i; i < len; i += 1) {
        if (min !== undefined) {
          if (min > deepProperty(this.data[i], field, deep)) {
            min = deepProperty(this.data[i], field, deep);
            result.index = this.data[i].$loki;
          }
        } else {
          min = deepProperty(this.data[i], field, deep);
          result.index = this.data[i].$loki;
        }
      }
      result.value = min;
      return result;
    };

    /**
     * @memberof Collection
     */
    Collection.prototype.extractNumerical = function (field) {
      return this.extract(field).map(parseBase10).filter(Number).filter(function (n) {
        return !(isNaN(n));
      });
    };

    /**
     * Calculates the average numerical value of a property
     *
     * @param {string} field - name of property in docs to average
     * @returns {number} average of property in all docs in the collection
     * @memberof Collection
     */
    Collection.prototype.avg = function (field) {
      return average(this.extractNumerical(field));
    };

    /**
     * Calculate standard deviation of a field
     * @memberof Collection
     * @param {string} field
     */
    Collection.prototype.stdDev = function (field) {
      return standardDeviation(this.extractNumerical(field));
    };

    /**
     * @memberof Collection
     * @param {string} field
     */
    Collection.prototype.mode = function (field) {
      var dict = {},
        data = this.extract(field);
      data.forEach(function (obj) {
        if (dict[obj]) {
          dict[obj] += 1;
        } else {
          dict[obj] = 1;
        }
      });
      var max,
        prop, mode;
      for (prop in dict) {
        if (max) {
          if (max < dict[prop]) {
            mode = prop;
          }
        } else {
          mode = prop;
          max = dict[prop];
        }
      }
      return mode;
    };

    /**
     * @memberof Collection
     * @param {string} field - property name
     */
    Collection.prototype.median = function (field) {
      var values = this.extractNumerical(field);
      values.sort(sub);

      var half = Math.floor(values.length / 2);

      if (values.length % 2) {
        return values[half];
      } else {
        return (values[half - 1] + values[half]) / 2.0;
      }
    };

    /**
     * General utils, including statistical functions
     */
    function isDeepProperty(field) {
      return field.indexOf('.') !== -1;
    }

    function parseBase10(num) {
      return parseFloat(num, 10);
    }

    function isNotUndefined(obj) {
      return obj !== undefined;
    }

    function add(a, b) {
      return a + b;
    }

    function sub(a, b) {
      return a - b;
    }

    function median(values) {
      values.sort(sub);
      var half = Math.floor(values.length / 2);
      return (values.length % 2) ? values[half] : ((values[half - 1] + values[half]) / 2.0);
    }

    function average(array) {
      return (array.reduce(add, 0)) / array.length;
    }

    function standardDeviation(values) {
      var avg = average(values);
      var squareDiffs = values.map(function (value) {
        var diff = value - avg;
        var sqrDiff = diff * diff;
        return sqrDiff;
      });

      var avgSquareDiff = average(squareDiffs);

      var stdDev = Math.sqrt(avgSquareDiff);
      return stdDev;
    }

    function deepProperty(obj, property, isDeep) {
      if (isDeep === false) {
        // pass without processing
        return obj[property];
      }
      var pieces = property.split('.'),
        root = obj;
      while (pieces.length > 0) {
        root = root[pieces.shift()];
      }
      return root;
    }

    function binarySearch(array, item, fun) {
      var lo = 0,
        hi = array.length,
        compared,
        mid;
      while (lo < hi) {
        mid = (lo + hi) >> 1;
        compared = fun.apply(null, [item, array[mid]]);
        if (compared === 0) {
          return {
            found: true,
            index: mid
          };
        } else if (compared < 0) {
          hi = mid;
        } else {
          lo = mid + 1;
        }
      }
      return {
        found: false,
        index: hi
      };
    }

    function BSonSort(fun) {
      return function (array, item) {
        return binarySearch(array, item, fun);
      };
    }

    function KeyValueStore() {}

    KeyValueStore.prototype = {
      keys: [],
      values: [],
      sort: function (a, b) {
        return (a < b) ? -1 : ((a > b) ? 1 : 0);
      },
      setSort: function (fun) {
        this.bs = new BSonSort(fun);
      },
      bs: function () {
        return new BSonSort(this.sort);
      },
      set: function (key, value) {
        var pos = this.bs(this.keys, key);
        if (pos.found) {
          this.values[pos.index] = value;
        } else {
          this.keys.splice(pos.index, 0, key);
          this.values.splice(pos.index, 0, value);
        }
      },
      get: function (key) {
        return this.values[binarySearch(this.keys, key, this.sort).index];
      }
    };

    function UniqueIndex(uniqueField) {
      this.field = uniqueField;
      this.keyMap = {};
      this.lokiMap = {};
    }
    UniqueIndex.prototype.keyMap = {};
    UniqueIndex.prototype.lokiMap = {};
    UniqueIndex.prototype.set = function (obj) {
      var fieldValue = obj[this.field];
      if (fieldValue !== null && typeof (fieldValue) !== 'undefined') {
        if (this.keyMap[fieldValue]) {
          throw new Error('Duplicate key for property ' + this.field + ': ' + fieldValue);
        } else {
          this.keyMap[fieldValue] = obj;
          this.lokiMap[obj.$loki] = fieldValue;
        }
      }
    };
    UniqueIndex.prototype.get = function (key) {
      return this.keyMap[key];
    };

    UniqueIndex.prototype.byId = function (id) {
      return this.keyMap[this.lokiMap[id]];
    };
    /**
     * Updates a document's unique index given an updated object.
     * @param  {Object} obj Original document object
     * @param  {Object} doc New document object (likely the same as obj)
     */
    UniqueIndex.prototype.update = function (obj, doc) {
      if (this.lokiMap[obj.$loki] !== doc[this.field]) {
        var old = this.lokiMap[obj.$loki];
        this.set(doc);
        // make the old key fail bool test, while avoiding the use of delete (mem-leak prone)
        this.keyMap[old] = undefined;
      } else {
        this.keyMap[obj[this.field]] = doc;
      }
    };
    UniqueIndex.prototype.remove = function (key) {
      var obj = this.keyMap[key];
      if (obj !== null && typeof obj !== 'undefined') {
        this.keyMap[key] = undefined;
        this.lokiMap[obj.$loki] = undefined;
      } else {
        throw new Error('Key is not in unique index: ' + this.field);
      }
    };
    UniqueIndex.prototype.clear = function () {
      this.keyMap = {};
      this.lokiMap = {};
    };

    function ExactIndex(exactField) {
      this.index = {};
      this.field = exactField;
    }

    // add the value you want returned to the key in the index
    ExactIndex.prototype = {
      set: function add(key, val) {
        if (this.index[key]) {
          this.index[key].push(val);
        } else {
          this.index[key] = [val];
        }
      },

      // remove the value from the index, if the value was the last one, remove the key
      remove: function remove(key, val) {
        var idxSet = this.index[key];
        for (var i in idxSet) {
          if (idxSet[i] == val) {
            idxSet.splice(i, 1);
          }
        }
        if (idxSet.length < 1) {
          this.index[key] = undefined;
        }
      },

      // get the values related to the key, could be more than one
      get: function get(key) {
        return this.index[key];
      },

      // clear will zap the index
      clear: function clear(key) {
        this.index = {};
      }
    };

    function SortedIndex(sortedField) {
      this.field = sortedField;
    }

    SortedIndex.prototype = {
      keys: [],
      values: [],
      // set the default sort
      sort: function (a, b) {
        return (a < b) ? -1 : ((a > b) ? 1 : 0);
      },
      bs: function () {
        return new BSonSort(this.sort);
      },
      // and allow override of the default sort
      setSort: function (fun) {
        this.bs = new BSonSort(fun);
      },
      // add the value you want returned  to the key in the index
      set: function (key, value) {
        var pos = binarySearch(this.keys, key, this.sort);
        if (pos.found) {
          this.values[pos.index].push(value);
        } else {
          this.keys.splice(pos.index, 0, key);
          this.values.splice(pos.index, 0, [value]);
        }
      },
      // get all values which have a key == the given key
      get: function (key) {
        var bsr = binarySearch(this.keys, key, this.sort);
        if (bsr.found) {
          return this.values[bsr.index];
        } else {
          return [];
        }
      },
      // get all values which have a key < the given key
      getLt: function (key) {
        var bsr = binarySearch(this.keys, key, this.sort);
        var pos = bsr.index;
        if (bsr.found) pos--;
        return this.getAll(key, 0, pos);
      },
      // get all values which have a key > the given key
      getGt: function (key) {
        var bsr = binarySearch(this.keys, key, this.sort);
        var pos = bsr.index;
        if (bsr.found) pos++;
        return this.getAll(key, pos, this.keys.length);
      },

      // get all vals from start to end
      getAll: function (key, start, end) {
        var results = [];
        for (var i = start; i < end; i++) {
          results = results.concat(this.values[i]);
        }
        return results;
      },
      // just in case someone wants to do something smart with ranges
      getPos: function (key) {
        return binarySearch(this.keys, key, this.sort);
      },
      // remove the value from the index, if the value was the last one, remove the key
      remove: function (key, value) {
        var pos = binarySearch(this.keys, key, this.sort).index;
        var idxSet = this.values[pos];
        for (var i in idxSet) {
          if (idxSet[i] == value) idxSet.splice(i, 1);
        }
        if (idxSet.length < 1) {
          this.keys.splice(pos, 1);
          this.values.splice(pos, 1);
        }
      },
      // clear will zap the index
      clear: function () {
        this.keys = [];
        this.values = [];
      }
    };


    Loki.LokiOps = LokiOps;
    Loki.Collection = Collection;
    Loki.KeyValueStore = KeyValueStore;
    Loki.persistenceAdapters = {
      fs: LokiFsAdapter,
      localStorage: LokiLocalStorageAdapter
    };
    return Loki;
  }());

}));

}).call(this,require("--global--"),require("--console--"),require("--timers--").clearInterval,arguments[3],arguments[4],arguments[5],arguments[6],require("--timers--").setInterval,require("--timers--").setTimeout)
},{"--console--":11,"--global--":5,"--timers--":7,"./loki-indexed-adapter.js":1,"fs":12}],3:[function(require,module,exports){

/*------------------+
| ADAPTER           |
-------------------*/

/**
 * A loki persistence adapter which persists using node fs module
 * @constructor LokiTitaniumAdapter
 */
function LokiTitaniumAdapter() {
  this.databases = {};
}

/**
 * _getFile() - Get the file reference, or create a new one
 * @param {string} dbname - the filename of the database to load
 * @memberof LokiTitaniumAdapter
 */
LokiTitaniumAdapter.prototype._getFile = function _getFile(dbname) {
    if (this.databases[dbname]) {
      return this.databases[dbname];
    }

    this.databases[dbname] = Ti.Filesystem.getFile(
      Ti.Filesystem.applicationDataDirectory, dbname);

    return this.databases[dbname];

  };

/**
 * loadDatabase() - Load data from file, will throw an error if the file does not exist
 * @param {string} dbname - the filename of the database to load
 * @param {function} callback - the callback to handle the result
 * @memberof LokiTitaniumAdapter
 */
LokiTitaniumAdapter.prototype.loadDatabase = function loadDatabase(dbname, callback) {
    var file = this._getFile(dbname);

    if (!file.exists()) {
      return callback(new Error('File not exists'));
    }

    callback(file.read().toString());

  };

/**
 * saveDatabase() - save data to file, will throw an error if the file can't be saved
 * might want to expand this to avoid dataloss on partial save
 * @param {string} dbname - the filename of the database to load
 * @param {function} callback - the callback to handle the result
 * @memberof LokiTitaniumAdapter
 */
LokiTitaniumAdapter.prototype.saveDatabase = function saveDatabase(dbname, dbstring, callback) {
    var file = this._getFile(dbname);

    try {
      file.write(dbstring)
      callback();
    }
    catch (ex) {
      callback(ex);
    }
  };

/**
 * deleteDatabase() - delete the database file, will throw an error if the
 * file can't be deleted
 * @param {string} dbname - the filename of the database to delete
 * @param {function} callback - the callback to handle the result
 * @memberof LokiTitaniumAdapter
 */
LokiTitaniumAdapter.prototype.deleteDatabase = function deleteDatabase(dbname, callback) {
    var file = this._getFile(dbname);

    if (!file.exists()) {
      return callback(new Error('File not exists'));
    }

    try {
      file.deleteFile();
      callback();
    }
    catch (ex) {
      callback(ex);
    }

  };

module.exports = LokiTitaniumAdapter;

},{}],4:[function(require,module,exports){

/*------------------+
| LOKI              |
-------------------*/

var Loki                = require('lokijs');
var LokiTitaniumAdapter = require('./loki-titanium-adapter');

function TiLoki(dbname, options) {
  options = options || {};

  if (!options.adapter) {
    options.adapter = new LokiTitaniumAdapter();
  }

  return new Loki(dbname, options);
}

module.exports = TiLoki;

},{"./loki-titanium-adapter":3,"lokijs":2}],5:[function(require,module,exports){

module.exports = (function () { return this; })();

module.exports.location = {};

},{}],6:[function(require,module,exports){
(function (setTimeout){
/* global Ti:true, Titanium:true */

var process = module.exports = {};

process.nextTick = function nextTick(fn) {
  setTimeout(fn, 0);
};

process.title = 'titanium';
process.titanium = true;
process.env = {};
process.argv = [];

process.binding = function (name) {
  throw new Error('process.binding is not supported');
};

process.cwd = function () {
  return '/';
};

process.chdir = function (dir) {
  throw new Error('process.chdir is not supported');
};

process.stdout = {};
process.stderr = {};

process.stdout.write = function (msg) {
  Ti.API.info(msg);
};

process.stderr.write = function (msg) {
  Ti.API.error(msg);
};

'addEventListener removeEventListener removeListener hasEventListener fireEvent emit on off'.split(' ').forEach(function (name) {
  process[ name ] = noop;
});

function noop() {}

}).call(this,require("--timers--").setTimeout)
},{"--timers--":7}],7:[function(require,module,exports){
(function (global){

module.exports.clearInterval = clearInterval;
module.exports.clearTimeout = clearTimeout;
module.exports.setInterval = setInterval;
module.exports.setTimeout = setTimeout;

// See https://html.spec.whatwg.org/multipage/webappapis.html#dom-windowtimers-cleartimeout

function clearInterval(intervalId) {
  try {
    return global.clearInterval(intervalId);
  }
  catch (e) {
    // Do nothing
    return undefined;
  }
}

function clearTimeout(timeoutId) {
  try {
    return global.clearTimeout(timeoutId);
  }
  catch (e) {
    // Do nothing
    return undefined;
  }
}

function setInterval(func, delay) {
  var args = [];
  for (var i = 2, l = arguments.length; i < l; ++i) {
    args[ i - 2 ] = arguments[ i ];
  }

  return global.setInterval(function () {
    func.apply(this, args);
  }, +delay);
}

function setTimeout(func, delay) {
  var args = [];
  for (var i = 2, l = arguments.length; i < l; ++i) {
    args[ i - 2 ] = arguments[ i ];
  }

  return global.setTimeout(function () {
    func.apply(this, args);
  }, +delay);
}

}).call(this,require("--global--"))
},{"--global--":5}],8:[function(require,module,exports){
// http://wiki.commonjs.org/wiki/Unit_Testing/1.0
//
// THIS IS NOT TESTED NOR LIKELY TO WORK OUTSIDE V8!
//
// Originally from narwhal.js (http://narwhaljs.org)
// Copyright (c) 2009 Thomas Robinson <280north.com>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the 'Software'), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
// ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

// when used in node, this will actually load the util module we depend on
// versus loading the builtin util module as happens otherwise
// this is a bug in node module loading as far as I am concerned
var util = require('util/');

var pSlice = Array.prototype.slice;
var hasOwn = Object.prototype.hasOwnProperty;

// 1. The assert module provides functions that throw
// AssertionError's when particular conditions are not met. The
// assert module must conform to the following interface.

var assert = module.exports = ok;

// 2. The AssertionError is defined in assert.
// new assert.AssertionError({ message: message,
//                             actual: actual,
//                             expected: expected })

assert.AssertionError = function AssertionError(options) {
  this.name = 'AssertionError';
  this.actual = options.actual;
  this.expected = options.expected;
  this.operator = options.operator;
  if (options.message) {
    this.message = options.message;
    this.generatedMessage = false;
  } else {
    this.message = getMessage(this);
    this.generatedMessage = true;
  }
  var stackStartFunction = options.stackStartFunction || fail;

  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, stackStartFunction);
  }
  else {
    // non v8 browsers so we can have a stacktrace
    var err = new Error();
    if (err.stack) {
      var out = err.stack;

      // try to strip useless frames
      var fn_name = stackStartFunction.name;
      var idx = out.indexOf('\n' + fn_name);
      if (idx >= 0) {
        // once we have located the function frame
        // we need to strip out everything before it (and its line)
        var next_line = out.indexOf('\n', idx + 1);
        out = out.substring(next_line + 1);
      }

      this.stack = out;
    }
  }
};

// assert.AssertionError instanceof Error
util.inherits(assert.AssertionError, Error);

function replacer(key, value) {
  if (util.isUndefined(value)) {
    return '' + value;
  }
  if (util.isNumber(value) && !isFinite(value)) {
    return value.toString();
  }
  if (util.isFunction(value) || util.isRegExp(value)) {
    return value.toString();
  }
  return value;
}

function truncate(s, n) {
  if (util.isString(s)) {
    return s.length < n ? s : s.slice(0, n);
  } else {
    return s;
  }
}

function getMessage(self) {
  return truncate(JSON.stringify(self.actual, replacer), 128) + ' ' +
         self.operator + ' ' +
         truncate(JSON.stringify(self.expected, replacer), 128);
}

// At present only the three keys mentioned above are used and
// understood by the spec. Implementations or sub modules can pass
// other keys to the AssertionError's constructor - they will be
// ignored.

// 3. All of the following functions must throw an AssertionError
// when a corresponding condition is not met, with a message that
// may be undefined if not provided.  All assertion methods provide
// both the actual and expected values to the assertion error for
// display purposes.

function fail(actual, expected, message, operator, stackStartFunction) {
  throw new assert.AssertionError({
    message: message,
    actual: actual,
    expected: expected,
    operator: operator,
    stackStartFunction: stackStartFunction
  });
}

// EXTENSION! allows for well behaved errors defined elsewhere.
assert.fail = fail;

// 4. Pure assertion tests whether a value is truthy, as determined
// by !!guard.
// assert.ok(guard, message_opt);
// This statement is equivalent to assert.equal(true, !!guard,
// message_opt);. To test strictly for the value true, use
// assert.strictEqual(true, guard, message_opt);.

function ok(value, message) {
  if (!value) fail(value, true, message, '==', assert.ok);
}
assert.ok = ok;

// 5. The equality assertion tests shallow, coercive equality with
// ==.
// assert.equal(actual, expected, message_opt);

assert.equal = function equal(actual, expected, message) {
  if (actual != expected) fail(actual, expected, message, '==', assert.equal);
};

// 6. The non-equality assertion tests for whether two objects are not equal
// with != assert.notEqual(actual, expected, message_opt);

assert.notEqual = function notEqual(actual, expected, message) {
  if (actual == expected) {
    fail(actual, expected, message, '!=', assert.notEqual);
  }
};

// 7. The equivalence assertion tests a deep equality relation.
// assert.deepEqual(actual, expected, message_opt);

assert.deepEqual = function deepEqual(actual, expected, message) {
  if (!_deepEqual(actual, expected)) {
    fail(actual, expected, message, 'deepEqual', assert.deepEqual);
  }
};

function _deepEqual(actual, expected) {
  // 7.1. All identical values are equivalent, as determined by ===.
  if (actual === expected) {
    return true;

  } else if (util.isBuffer(actual) && util.isBuffer(expected)) {
    if (actual.length != expected.length) return false;

    for (var i = 0; i < actual.length; i++) {
      if (actual[i] !== expected[i]) return false;
    }

    return true;

  // 7.2. If the expected value is a Date object, the actual value is
  // equivalent if it is also a Date object that refers to the same time.
  } else if (util.isDate(actual) && util.isDate(expected)) {
    return actual.getTime() === expected.getTime();

  // 7.3 If the expected value is a RegExp object, the actual value is
  // equivalent if it is also a RegExp object with the same source and
  // properties (`global`, `multiline`, `lastIndex`, `ignoreCase`).
  } else if (util.isRegExp(actual) && util.isRegExp(expected)) {
    return actual.source === expected.source &&
           actual.global === expected.global &&
           actual.multiline === expected.multiline &&
           actual.lastIndex === expected.lastIndex &&
           actual.ignoreCase === expected.ignoreCase;

  // 7.4. Other pairs that do not both pass typeof value == 'object',
  // equivalence is determined by ==.
  } else if (!util.isObject(actual) && !util.isObject(expected)) {
    return actual == expected;

  // 7.5 For all other Object pairs, including Array objects, equivalence is
  // determined by having the same number of owned properties (as verified
  // with Object.prototype.hasOwnProperty.call), the same set of keys
  // (although not necessarily the same order), equivalent values for every
  // corresponding key, and an identical 'prototype' property. Note: this
  // accounts for both named and indexed properties on Arrays.
  } else {
    return objEquiv(actual, expected);
  }
}

function isArguments(object) {
  return Object.prototype.toString.call(object) == '[object Arguments]';
}

function objEquiv(a, b) {
  if (util.isNullOrUndefined(a) || util.isNullOrUndefined(b))
    return false;
  // an identical 'prototype' property.
  if (a.prototype !== b.prototype) return false;
  // if one is a primitive, the other must be same
  if (util.isPrimitive(a) || util.isPrimitive(b)) {
    return a === b;
  }
  var aIsArgs = isArguments(a),
      bIsArgs = isArguments(b);
  if ((aIsArgs && !bIsArgs) || (!aIsArgs && bIsArgs))
    return false;
  if (aIsArgs) {
    a = pSlice.call(a);
    b = pSlice.call(b);
    return _deepEqual(a, b);
  }
  var ka = objectKeys(a),
      kb = objectKeys(b),
      key, i;
  // having the same number of owned properties (keys incorporates
  // hasOwnProperty)
  if (ka.length != kb.length)
    return false;
  //the same set of keys (although not necessarily the same order),
  ka.sort();
  kb.sort();
  //~~~cheap key test
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] != kb[i])
      return false;
  }
  //equivalent values for every corresponding key, and
  //~~~possibly expensive deep test
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!_deepEqual(a[key], b[key])) return false;
  }
  return true;
}

// 8. The non-equivalence assertion tests for any deep inequality.
// assert.notDeepEqual(actual, expected, message_opt);

assert.notDeepEqual = function notDeepEqual(actual, expected, message) {
  if (_deepEqual(actual, expected)) {
    fail(actual, expected, message, 'notDeepEqual', assert.notDeepEqual);
  }
};

// 9. The strict equality assertion tests strict equality, as determined by ===.
// assert.strictEqual(actual, expected, message_opt);

assert.strictEqual = function strictEqual(actual, expected, message) {
  if (actual !== expected) {
    fail(actual, expected, message, '===', assert.strictEqual);
  }
};

// 10. The strict non-equality assertion tests for strict inequality, as
// determined by !==.  assert.notStrictEqual(actual, expected, message_opt);

assert.notStrictEqual = function notStrictEqual(actual, expected, message) {
  if (actual === expected) {
    fail(actual, expected, message, '!==', assert.notStrictEqual);
  }
};

function expectedException(actual, expected) {
  if (!actual || !expected) {
    return false;
  }

  if (Object.prototype.toString.call(expected) == '[object RegExp]') {
    return expected.test(actual);
  } else if (actual instanceof expected) {
    return true;
  } else if (expected.call({}, actual) === true) {
    return true;
  }

  return false;
}

function _throws(shouldThrow, block, expected, message) {
  var actual;

  if (util.isString(expected)) {
    message = expected;
    expected = null;
  }

  try {
    block();
  } catch (e) {
    actual = e;
  }

  message = (expected && expected.name ? ' (' + expected.name + ').' : '.') +
            (message ? ' ' + message : '.');

  if (shouldThrow && !actual) {
    fail(actual, expected, 'Missing expected exception' + message);
  }

  if (!shouldThrow && expectedException(actual, expected)) {
    fail(actual, expected, 'Got unwanted exception' + message);
  }

  if ((shouldThrow && actual && expected &&
      !expectedException(actual, expected)) || (!shouldThrow && actual)) {
    throw actual;
  }
}

// 11. Expected to throw an error:
// assert.throws(block, Error_opt, message_opt);

assert.throws = function(block, /*optional*/error, /*optional*/message) {
  _throws.apply(this, [true].concat(pSlice.call(arguments)));
};

// EXTENSION! This is annoying to write outside this module.
assert.doesNotThrow = function(block, /*optional*/message) {
  _throws.apply(this, [false].concat(pSlice.call(arguments)));
};

assert.ifError = function(err) { if (err) {throw err;}};

var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) {
    if (hasOwn.call(obj, key)) keys.push(key);
  }
  return keys;
};

},{"util/":14}],9:[function(require,module,exports){
module.exports = now

function now() {
    return new Date().getTime()
}

},{}],10:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],11:[function(require,module,exports){
var util = require("util");
var now = require("date-now");

var _console = {};
var times = {};

var functions = [
	['log','info'],
	['info','info'],
	['warn','warn'],
	['error','error']
];

functions.forEach(function(tuple) {
	_console[tuple[0]] = function() {
		Ti.API[tuple[1]](util.format.apply(util, arguments));
	};
});

_console.time = function(label) {
	times[label] = now();
};

_console.timeEnd = function(label) {
	var time = times[label];
	if (!time) {
		throw new Error("No such label: " + label);
	}

	var duration = now() - time;
	_console.log(label + ": " + duration + "ms");
};

_console.trace = function() {
	var err = new Error();
	err.name = "Trace";
	err.message = util.format.apply(null, arguments);
	_console.error(err.stack);
};

_console.dir = function(object) {
	_console.log(util.inspect(object) + "\n");
};

_console.assert = function(expression) {
	if (!expression) {
		var arr = Array.prototype.slice.call(arguments, 1);
		require("assert").ok(false, util.format.apply(null, arr));
	}
};

module.exports = _console;

},{"assert":8,"date-now":9,"util":14}],12:[function(require,module,exports){
(function (setTimeout){
var $F = Ti.Filesystem,
	fs = exports,
	util = require('util');

var IS_ANDROID = Ti.Platform.osname === 'android';

var MODE_MAP = {};
MODE_MAP['r'] = MODE_MAP['r+'] = MODE_MAP['rs'] = MODE_MAP['rs+'] = $F.MODE_READ;
MODE_MAP['w'] = MODE_MAP['w+'] = MODE_MAP['wx'] = MODE_MAP['wx+'] = $F.MODE_WRITE;
MODE_MAP['a'] = MODE_MAP['a+'] = MODE_MAP['ax'] = MODE_MAP['ax+'] = $F.MODE_APPEND;

fs.Stats = function Stats(path) {
	this.__file = null;
	this.dev = 0;
	this.ino = 0;
	this.nlink = 0;
	this.uid = 0;
	this.gid = 0;
	this.rdev = 0;
	this.size = 0;
	this.blksize = 4096;
	this.blocks = 8;
	this.ctime = this.atime = this.mtime = 0;

	if (path) {
		this.__file = $F.getFile(path);
		if (!this.__file.exists()) {
			throw new Error('file does not exist');
		}

		this.size = this.__file.size;
		this.mode = 0;
		this.ctime = new Date(this.__file.createTimestamp());
		this.atime = this.mtime = new Date(this.__file.modificationTimestamp());
	}
};

fs.Stats.prototype.isDirectory = function(property) {
	return this.__file.isDirectory();
};

fs.Stats.prototype.isFile = function(property) {
	return this.__file.isFile();
};

fs.Stats.prototype.isBlockDevice = function(property) {
	return false;
};

fs.Stats.prototype.isCharacterDevice = function(property) {
	return false;
};

fs.Stats.prototype.isSymbolicLink = function(property) {
	return this.__file.symbolicLink;
};

fs.Stats.prototype.isFIFO = function(property) {
	return false;
};

fs.Stats.prototype.isSocket = function(property) {
	return false;
};

fs.exists = function exists(path, callback) {
	setTimeout(function() {
		return callback(fs.existsSync(path));
	}, 0);
};

fs.existsSync = function existsSync(path) {
	return $F.getFile(path).exists();
};

fs.readFile = function readFile(path, options, callback_) {
	var callback = maybeCallback(arguments[arguments.length-1]);
	if (!options || util.isFunction(options)) {
		options = { encoding: null, flag: 'r' };
	} else if (util.isString(options)) {
		options = { encoding: options, flag: 'r' };
	} else if (!util.isObject(options)) {
		throw new TypeError('Bad arguments');
	}

	var encoding = options.encoding,
		flag = options.flag || 'r';
	assertEncoding(options.encoding);

	fs.open(path, flag, function(err, fd) {
		if (err) { return callback(err); }
		fs.fstat(fd, function(err, stats) {
			if (err) { return callback(err); }
			var buffer = Ti.createBuffer({length:stats.size});
			fs.read(fd, buffer, function(err, data) {
				if (err) { return callback(err); }
				fs.close(fd, function(err) {
					if (err) { return callback(err); }
					return callback(err, encoding ? convertBuffer(buffer, encoding) : buffer);
				});
			});
		});
	});
};

fs.readFileSync = function readFileSync(path, options) {
	if (!options) {
		options = { encoding: null, flag: 'r' };
	} else if (util.isString(options)) {
		options = { encoding: options, flag: 'r' };
	} else if (!util.isObject(options)) {
		throw new TypeError('Bad arguments');
	}

	var encoding = options.encoding,
		flag = options.flag || 'r';
	assertEncoding(options.encoding);

	var fd = fs.openSync(path, flag /*, mode */),
		size = fs.fstatSync(fd).size,
		buffer = Ti.createBuffer({length:size});

	fs.readSync(fd, buffer);
	fs.closeSync(fd);

	return encoding ? convertBuffer(buffer, encoding) : buffer;
};

fs.close = function close(fd, callback) {
	setTimeout(function() {
		var err = null;
		try {
			fd.close();
		} catch (e) {
			err = e;
		}
		return callback(err);
	}, 0);
};

fs.closeSync = function closeSync(fd) {
	fd.close();
};

fs.open = function open(path, flags, mode, callback) {
	callback = maybeCallback(arguments[arguments.length-1]);
	if (!mode || util.isFunction(mode)) {
		mode = null;
	}

	setTimeout(function() {
		var fd = null,
			err = null;
		try {
			fd = fs.openSync(path, flags, mode);
		} catch (e) {
			err = e;
		}
		return callback(err, fd);
	}, 0);
};

fs.openSync = function openSync(path, flags, mode) {
	var tiMode = assertFlags(flags),
		file = $F.getFile(path),
		fd = file.open(tiMode);
	fd.__path = path;
	return fd;
};

fs.read = function read(fd, buffer, offset, length, position, callback) {
	// position is not handled in Titanium streams
	callback = maybeCallback(arguments[arguments.length-1]);
	if (util.isFunction(position)) { position = undefined; }
	if (util.isFunction(length)) { length = undefined; }
	if (util.isFunction(offset)) { offset = undefined; }

	// TODO: This should be Ti.Stream.read(), but it doesn't appear to do
	// anything when targeting a FileStream, despite the docs.
	setTimeout(function() {
		var bytes = null,
			err = null;
		try {
			bytes = fs.readSync(fd, buffer, offset, length, position);
		} catch (e) {
			err = e;
		}
		return callback(err, bytes, buffer);
	}, 0);
};

// Android improperly handles undefined args passed to offset and/or length
if (IS_ANDROID) {
	fs.readSync = function readSync(fd, buffer, offset, length, position) {
		if (offset == null && length == null) {
			return fd.read(buffer);
		} else {
			return fd.read(buffer, offset, length);
		}
	};
} else {
	fs.readSync = function readSync(fd, buffer, offset, length, position) {
		return fd.read(buffer, offset, length);
	};
}

fs.write = function write(fd, buffer, offset, length, position, callback) {
	// position is not handled in Titanium streams
	callback = maybeCallback(arguments[arguments.length-1]);
	if (util.isFunction(position)) { position = undefined; }
	if (util.isFunction(length)) { length = undefined; }
	if (util.isFunction(offset)) { offset = undefined; }

	// TODO: This should be Ti.Stream.write(), but it doesn't appear to do
	// anything when targeting a FileStream, despite the docs.
	setTimeout(function() {
		var bytes = null,
			err = null;
		try {
			bytes = fs.writeSync(fd, buffer, offset, length, position);
		} catch (e) {
			err = e;
		}
		return callback(err, bytes, buffer);
	}, 0);
};

// Android improperly handles undefined args passed to offset and/or length
if (IS_ANDROID) {
	fs.writeSync = function writeSync(fd, buffer, offset, length, position) {
		if (offset == null && length == null) {
			return fd.write(buffer);
		} else {
			return fd.write(buffer, offset, length);
		}
	};
} else {
	fs.writeSync = function writeSync(fd, buffer, offset, length, position) {
		return fd.write(buffer, offset, length);
	};
}

fs.rename = function rename(oldPath, newPath, callback) {
	setTimeout(function() {
		var err = null,
			good = false;
		try {
			good = $F.getFile(oldPath).move(newPath);
			if (!good) {
				err = new Error('could not move file');
			}
		} catch (e) {
			err = e;
		}
		return callback(err);
	}, 0);
};

fs.renameSync = function renameSync(oldPath, newPath) {
	$F.getFile(oldPath).move(newPath);
};

fs.truncate = function truncate(path, len, callback) {
	callback = maybeCallback(arguments[arguments.length-1]);
	if (!len || util.isFunction(len)) {
		len = 0;
	}

	if (len) {
		fs.open(path, 'r', function(err, fd) {
			if (err) { return callback(err); }
			var buffer = Ti.createBuffer({length:len});
			fs.read(fd, buffer, 0, len, function(err, bytes, buffer) {
				if (err) { return callback(err); }
				fs.close(fd, function(err) {
					if (err) { return callback(err); }
					fs.writeFile(path, buffer, callback);
				});
			});
		});
	} else {
		fs.writeFile(path, '', callback);
	}
};

fs.truncateSync = function truncateSync(path, len) {
	len = len || 0;
	if (len) {
		var fd = fs.openSync(path, 'r'),
			buffer = Ti.createBuffer({length:len});
		fs.readSync(fd, buffer, 0, len);
		fs.closeSync(fd);
		fs.writeFileSync(path, buffer);
	} else {
		fs.writeFileSync(path, '');
	}
};

fs.ftruncate = function ftruncate(fd, len, callback) {
	if (!fd.__path) {
		throw new Error('invalid file descriptor');
	}

	callback = maybeCallback(arguments[arguments.length-1]);
	if (!len || util.isFunction(len)) {
		len = 0;
	}

	if (len) {
		var buffer = Ti.createBuffer({length:len});
		fs.open(fd.__path, 'r', function(err, fd2) {
			if (err) { return callback(err); }
			fs.read(fd2, buffer, 0, len, function(err, bytes, buffer) {
				if (err) { return callback(err); }
				fs.close(fd2, function(err) {
					if (err) { return callback(err); }
					fs.writeFile(fd.__path, buffer, callback);
				});
			});
		});
	} else {
		fs.writeFile(fd.__path, '', callback);
	}
};

fs.ftruncateSync = function ftruncateSync(fd, len) {
	len = len || 0;
	if (!fd.__path) {
		throw new Error('invalid file descriptor');
	}

	if (len) {
		var buffer = Ti.createBuffer({length:len}),
			fd2 = fs.openSync(fd.__path, 'r');
		fs.readSync(fd2, buffer, 0, len);
		fs.closeSync(fd2);
		fs.writeFileSync(fd.__path, buffer);
	} else {
		fs.writeFileSync(fd.__path, '');
	}
};

fs.rmdir = function rmdir(path, callback) {
	setTimeout(function() {
		var err = null;
		try {
			if (!$F.getFile(path).deleteDirectory()) {
				err = new Error('could not delete directory');
			}
		} catch (e) {
			err = e;
		}
		return callback(err);
	}, 0);
};

fs.rmdirSync = function rmdirSync(path) {
	if (!$F.getFile(path).deleteDirectory()) {
		throw new Error('could not delete directory');
	}
};

if (IS_ANDROID) {
	fs.mkdir = function mkdir(path, mode, callback) {
		callback = maybeCallback(arguments[arguments.length-1]);
		setTimeout(function() {
			var err = null;
			try {
				$F.getFile(path).createDirectory();
				if (!$F.getFile(path).exists()) {
					throw new Error('could not create directory');
				}
			} catch (e) {
				err = e;
			}
			return callback(err);
		}, 0);
	};
} else {
	fs.mkdir = function mkdir(path, mode, callback) {
		callback = maybeCallback(arguments[arguments.length-1]);
		setTimeout(function() {
			var err = null;
			try {
				if (!$F.getFile(path).createDirectory()) {
					err = new Error('could not create directory');
				}
			} catch (e) {
				err = e;
			}
			return callback(err);
		}, 0);
	};
}

if (IS_ANDROID) {
	fs.mkdirSync = function mkdirSync(path, mode) {
		$F.getFile(path).createDirectory();
		if (!$F.getFile(path).exists()) {
			throw new Error('could not create directory');
		}
	};
} else {
	fs.mkdirSync = function mkdirSync(path, mode) {
		if (!$F.getFile(path).createDirectory()) {
			throw new Error('could not create directory');
		}
	};
}

fs.readdir = function readdir(path, callback) {
	setTimeout(function() {
		var files = [],
			err = null;
		try {
			files = fs.readdirSync(path);
		} catch (e) {
			err = e;
		}
		return callback(err, files);
	}, 0);
};

fs.readdirSync = function readdirSync(path) {
	return $F.getFile(path).getDirectoryListing();
};

fs.fstat = function fstat(fd, callback) {
	setTimeout(function() {
		var stats = null,
			err = null;
		try {
			stats = fs.fstatSync(fd);
		} catch (e) {
			err = e;
		}
		return callback(err, stats);
	}, 0);
};

fs.lstat = function lstat(path, callback) {
	setTimeout(function() {
		var stats = null,
			err = null;
		try {
			stats = fs.lstatSync(path);
		} catch (e) {
			err = e;
		}
		return callback(err, stats);
	}, 0);
};

fs.stat = function stat(path, callback) {
	setTimeout(function() {
		var stats = null,
			err = null;
		try {
			stats = fs.statSync(path);
		} catch (e) {
			err = e;
		}
		return callback(err, stats);
	}, 0);
};

fs.fstatSync = function fstatSync(fd) {
	if (fd.__path) {
		return fs.statSync(fd.__path);
	} else {
		throw new Error('invalid file descriptor');
	}
};

fs.lstatSync = function lstatSync(path) {
	return fs.statSync(path);
};

fs.statSync = function statSync(path) {
	return new fs.Stats(path);
};

fs.readlink = function readlink(path, callback) {
	setTimeout(function() {
		var result = null,
			err = null;
		try {
			result = fs.readlinkSync(path);
		} catch (e) {
			err = e;
		}
		return callback(err, result);
	}, 0);
};

fs.readlinkSync = function readlinkSync(path) {
	var file = $F.getFile(path);
	if (!file.symbolicLink) {
		throw new Error('invalid argument \'' + path  +'\'');
	}
	return file.resolve();
};

fs.unlink = function unlink(path, callback) {
	setTimeout(function() {
		var err = null;
		try {
			fs.unlinkSync(path);
		} catch (e) {
			err = e;
		}
		return callback(err);
	}, 0);
};

fs.unlinkSync = function unlinkSync(path) {
	var file = $F.getFile(path);
	if (file.isFile() || file.symbolicLink) {
		if (!file.deleteFile()) {
			throw new Error('unable to delete file');
		}
	} else {
		throw new Error('operation not permitted \'' + path + '\'');
	}
};

fs.writeFile = function writeFile(path, data, options, callback) {
	callback = maybeCallback(arguments[arguments.length-1]);
	if (!options || util.isFunction(options)) {
		options = {};
	}

	setTimeout(function() {
		var err = null;
		try {
			fs.writeFileSync(path, data, options);
		} catch (e) {
			err = e;
		}
		return callback(err);
	}, 0);
};

fs.writeFileSync = function writeFileSync(path, data, options) {
	options = options || {};
	var encoding = options.encoding || 'utf8',
		fd = fs.openSync(path, 'w'),
		buffer;

	if (data.apiName === 'Ti.Buffer') {
		buffer = data;
	} else {
		buffer = Ti.createBuffer({value:data});
	}
	fs.writeSync(fd, buffer);
	fs.closeSync(fd);
};

fs.appendFile = function appendFile(path, data, options, callback_) {
	var callback = maybeCallback(arguments[arguments.length-1]);
	if (!options || util.isFunction(options)) {
		options = {};
	}

	setTimeout(function() {
		var err = null;
		try {
			fs.appendFileSync(path, data, options);
		} catch (e) {
			err = e;
		}
		return callback(err);
	}, 0);
};

fs.appendFileSync = function appendFileSync(path, data, options) {
	options = options || {};
	var encoding = options.encoding || 'utf8',
		fd = fs.openSync(path, 'a'),
		buffer;

	if (data.apiName === 'Ti.Buffer') {
		buffer = data;
	} else {
		buffer = Ti.createBuffer({value:data});
	}
	fs.writeSync(fd, buffer);
	fs.closeSync(fd);
};

// var splitRootRe = /^[\/]*/;
// var nextPartRe = /(.*?)(?:[\/]+|$)/g;
fs.realpathSync = function realpathSync(p, cache) {
	return $F.getFile(p).resolve();

	// p = $F.getFile(p).resolve();

	// if (cache && Object.prototype.hasOwnProperty.call(cache, p)) {
	// 	return cache[p];
	// }

	// var original = p,
	// 	seenLinks = {},
	// 	knownHard = {};

	// // current character position in p
	// var pos;
	// // the partial path so far, including a trailing slash if any
	// var current;
	// // the partial path without a trailing slash (except when pointing at a root)
	// var base;
	// // the partial path scanned in the previous round, with slash
	// var previous;

	// start();

	// function start() {
	// 	// Skip over roots
	// 	var m = splitRootRe.exec(p);
	// 	pos = m[0].length;
	// 	current = m[0];
	// 	base = m[0];
	// 	previous = '';
	// }

	// // walk down the path, swapping out linked pathparts for their real
 //  // values
 //  // NB: p.length changes.
 //  while (pos < p.length) {
 //    // find the next part
 //    nextPartRe.lastIndex = pos;
 //    var result = nextPartRe.exec(p);
 //    previous = current;
 //    current += result[0];
 //    base = previous + result[1];
 //    pos = nextPartRe.lastIndex;

 //    // continue if not a symlink
 //    if (knownHard[base] || (cache && cache[base] === base)) {
 //      continue;
 //    }

 //    var resolvedLink;
 //    if (cache && Object.prototype.hasOwnProperty.call(cache, base)) {
 //      // some known symbolic link.  no need to stat again.
 //      resolvedLink = cache[base];
 //    } else {
 //      var stat = fs.lstatSync(base);
 //      if (!stat.isSymbolicLink()) {
 //        knownHard[base] = true;
 //        if (cache) cache[base] = base;
 //        continue;
 //      }

 //      fs.statSync(base);
 //      var linkTarget = fs.readlinkSync(base);
 //      resolvedLink = pathModule.resolve(previous, linkTarget);
 //      // track this, if given a cache.
 //      if (cache) cache[base] = resolvedLink;
 //    }

 //    // resolve the link, then start over
 //    p = pathModule.resolve(resolvedLink, p.slice(pos));
 //    start();
 //  }

 //  if (cache) cache[original] = p;

 //  return p;
};

fs.realpath = function realpath(p, cache, cb) {
	cb = maybeCallback(arguments[arguments.length-1]);
	if (!cache || util.isFunction(cache)) {
		cache = {};
	}

	setTimeout(function() {
		var err = null,
			res = null;
		try {
			res = fs.realpathSync(p, cache);
		} catch (e) {
			err = e;
		}
		return cb(err, res);
	}, 0);
};

fs.createReadStream = function createReadStream(path, options) {
	throw new Error('createReadStream not implemented');
};

fs.ReadStream = function ReadStream(path, options) {
	throw new Error('ReadStream not implemented');
};

fs.FileReadStream = function FileReadStream(path, options) {
	throw new Error('FileReadStream not implemented');
};

fs.createWriteStream = function createWriteStream(path, options) {
	throw new Error('createWriteStream not implemented');
};

fs.WriteStream = function WriteStream(path, options) {
	throw new Error('WriteStream not implemented');
};

fs.FileWriteStream = function FileWriteStream(path, options) {
	throw new Error('FileWriteStream not implemented');
};

// no-ops
fs.fsync = function fsync(fd, callback) { return callback(); };
fs.fsyncSync = function fsyncSync(fd) {};
fs.fchmod = function fchmod(fd, mode, callback) { return callback(); };
fs.fchmodSync = function fchmodSync(fd, mode) {};
fs.lchmod = function lchmod(path, mode, callback) { return callback(); };
fs.lchmodSync = function lchmodSync(path, mode) {};
fs.chmod = function chmod(path, mode, callback) { return callback(); };
fs.chmodSync = function chmodSync(path, mode) {};
fs.lchown = function lchown(path, uid, gid, callback) { return callback(); };
fs.lchownSync = function lchownSync(path, uid, gid) {};
fs.fchown = function fchown(fd, uid, gid, callback) { return callback(); };
fs.fchownSync = function fchownSync(fd, uid, gid) {};
fs.chown = function chown(path, uid, gid, callback) { return callback(); };
fs.chownSync = function chownSync(path, uid, gid) {};
fs.symlink = function symlink(destination, path, type_, callback) {
	return maybeCallback(arguments[arguments.length-1])();
};
fs.symlinkSync = function symlinkSync(destination, path, type) {};
fs.link = function link(srcpath, dstpath, callback) { return callback(); };
fs.linkSync = function linkSync(srcpath, dstpath) {};
fs.watch = function watch(filename) {};
fs.watchFile = function watchFile(filename) {};
fs.unwatchFile = function unwatchFile(filename, listener) {};
fs.utimes = function utimes(path, atime, mtime, callback) { return callback(); };
fs.utimesSync = function utimesSync(path, atime, mtime) {};
fs.futimes = function futimes(fd, atime, mtime, callback) { return callback(); };
fs.futimesSync = function futimesSync(fd, atime, mtime) {};

// helpers
function maybeCallback(o) {
	return o && util.isFunction(o) ? o : function(err) {
		if (err) { throw err; }
	};
}

function assertFlags(flags) {
	var tiMode = MODE_MAP[flags];
	if (tiMode == null) {
		throw new Error('Unknown file open flag: ' + flags);
	}
	return tiMode;
}

var ENCODINGS = ['ascii','utf8','utf-8','base64','binary'];
function assertEncoding(encoding) {
	if (encoding && ENCODINGS.indexOf(encoding.toLowerCase()) === -1) {
		throw new Error('Unknown encoding: ' + encoding);
	}
}

function convertBuffer(buffer, encoding) {
	switch(encoding.toLowerCase()) {
		case 'ascii':
		case 'binary':
			var ret = '';
			for (var i = 0; i < buffer.length; i++) {
				ret += String.fromCharCode(Ti.Codec.decodeNumber({
					source: buffer,
					type: Ti.Codec.TYPE_BYTE,
					position: i
				}));
			}
			return ret;
		case 'utf8':
		case 'utf-8':
			return buffer.toString();
		case 'base64':
			return Ti.Utils.base64encode(buffer.toString()).toString();
		default:
			throw new Error('Unknown encoding: ' + encoding);
	}
}

}).call(this,require("--timers--").setTimeout)
},{"--timers--":7,"util":14}],13:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],14:[function(require,module,exports){
(function (process,global,console){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require("--process--"),require("--global--"),require("--console--"))
},{"--console--":11,"--global--":5,"--process--":6,"./support/isBuffer":13,"inherits":10}]},{},[4])(4)
});