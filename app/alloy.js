var Q = require('q');
var TiParse = require('TiParse');



/**
 * User-Model
 */
var UserModel = Backbone.Model.extend({
  // Custom Functions
  //fullname : function(){
  //  return this.get('first_name') + " " + this.get("last_name");
  //}
});
_.extend(UserModel.prototype, TiParse.Backbone.UserMixin);
