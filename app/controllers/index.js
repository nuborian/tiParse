// Parse Setup
TiParse.init({
  base_url : "htttps://www.yourparseserver.com/1/)",
  app_key : "your_app_key",
  rest_key : "your_rest_key",
  usermodel : M_User
}).then(function(active_user){

  if( active_user ){

    console.log("I am already available - Jeah :)");

  }else{
    var user = new UserModel();

    user.login({
      username : "username",
      password : "password"
    }).then(function(response){
      console.log("Login success - Jeah :)")
    });

  }

});
