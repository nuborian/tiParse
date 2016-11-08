var Q = require('q');
var TiParse = require('TiParse');



var M_User = Backbone.Model.extend({
  // Custom Functions and Properties
  fullname : function(){
    return this.get('first_name') + " " + this.get("last_name");
  }
});
_.extend(M_User.prototype, TiParse.Backbone.UserMixin);
