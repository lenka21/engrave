var validationUrl;
var validate;
var accountId;
var tokenId;
var apiKey;

var LogLevels = {DEBUG:0, INFO:1, WARN:2, ERROR:3};
var logLevel = LogLevels.DEBUG;

function log(level, object){
	if (level >= logLevel){
		console.log (object);
	}	
}
			
function onIdentification(operation){
	log(LogLevels.INFO ,"[SSO IFRAME] fire event onidentification");

	domain = "*";
	
	postMessageToListeners (operation,domain);
}

function onLogout(){
	log(LogLevels.INFO ,"[SSO IFRAME] fire event onlogout ");

	//var domain = getGetParam2("domain");
	//if (!domain || domain=="")
	domain = "*";
	log(LogLevels.DEBUG,"[SSO IFRAME] postMessage to: "+ domain);
	var operation = {action:"sso.onlogout"};
	
	postMessageToListeners (operation,domain);
}

function onLoad(){
	log(LogLevels.INFO ,"[SSO IFRAME] fire event onload ");

	domain = "*";

	log(LogLevels.DEBUG,"[SSO IFRAME] postMessage to: "+ domain);
	var operation = {action:"sso.onload"};

	postMessageToListeners (operation,domain);
}

function postMessageToListeners (operation, domain){
	log(LogLevels.DEBUG,"[SSO IFRAME] postMessage "+operation.action+" to: "+ domain);
	if (window.attachEvent) {   // IE before version 9f
		window.parent.postMessage(JSON.stringify(operation), domain);	
	} else {
		window.parent.postMessage(operation, domain);	
	}
}



function doLogout(){
	log(LogLevels.INFO,"[SSO IFRAME] logout ");
	localStorage.removeItem(tokenId);
	
	onLogout();
}

function doLogin(jwt){
	log(LogLevels.INFO,"[SSO IFRAME] login");
	localStorage.setItem(tokenId,jwt);
}

function localStorageHandler(e) {
	
  	log(LogLevels.DEBUG,'[SSO IFRAME] Successfully communicate with other tab');
  	var jwtsso = localStorage.getItem(tokenId);
  	if (jwtsso){
		validateJWT (jwtsso);
	} else {
		onLogout();
	}
}
function localStorageHandlerIE8(e) {
  	log(LogLevels.DEBUG,'[SSO IFRAME] Successfully communicate with other tab IE8');
  	
	// var jwtsso = localStorage.getItem(tokenId); ->  old value in IE
	// timeout waiting IE8 browser to update the new value
	setTimeout(function(){
			var jwtsso = localStorage.getItem(tokenId); // new value
			if (jwtsso){
			validateJWT (jwtsso);
		} else {
			onLogout();
		}
	 }, 1); // delay
}


function listener(event){

	log(LogLevels.DEBUG,"[SSO IFRAME] received event ");  

	var data = event.data; //Chrome, firefox, IE11 , etc
	if (event.data && !event.data.action){ //<=IE8 & IE9 porque no soporta JSON en objetos de mensaje
		data  =  eval('(' + event.data+ ')');
	}  
			
	if(data.hasOwnProperty('action'))	{
		log(LogLevels.DEBUG,"[SSO IFRAME] received event "+data.action);
		var action = data.action;
		if (action == 'logout'){
			doLogout();
		} else if (action == 'login'){
			if (data.hasOwnProperty('jwt')){
				doLogin(data.jwt);
			}
		}
	} else {
		log(LogLevels.WARN,"[SSO IFRAME] received unknown event ");
	}
}

function validateJWT(jwtsso){
	validateJWTRemote(jwtsso);
}

function validateJWTRemote(jwtsso){
	log(LogLevels.DEBUG,"[SSO IFRAME] Remote validation of JWT with url: "+validationUrl+ " accountId:"+ accountId+ " apiKey:"+apiKey);
	
	jwt = new JWT(jwtsso);
	var rest = new RestClient(validationUrl);
	
	/*
	 POST validationUrl
	 jwt={jwtsso}
	 
	 Expected JSON response {status:SUCCESS,sub:yourUserId, jwt:newTokenIfNeeded, eidentifier:username, name:fullname, email:useremail, ... }
	 or {AuthenticationOperation: {status:SUCCESS,sub:...} }
	 */
	rest.validateJWT(jwtsso, 
	   function (obj){
			var operation = obj;
			if (obj.AuthenticationOperation){
				operation = obj.AuthenticationOperation;
			}
			log(LogLevels.DEBUG,"[SSO IFRAME] Validating token "+operation.valid);
			
			if (operation.valid == true) {
				log(LogLevels.INFO,"[SSO IFRAME] token is valid ");
				if (operation.jwt && operation.jwt != jwtsso){
					log(LogLevels.INFO,"[SSO IFRAME] Backend issued a new JWT. Replace current token");
					doLogin(operation.jwt);
				} else  {
					operation.jwt = jwtsso;
				}
				
				operation.action = "sso.onidentification";
				
				//Identification successful. Fire onIdentification event
				onIdentification(operation);
				
			} else {
				localStorage.removeItem(tokenId);
				log(LogLevels.ERROR,"[SSO IFRAME] invalid token: "+operation.error);
			}
			//Authentication process finish. //fire onload event
			onLoad();
	  },
	  function(err) {
		log(LogLevels.DEBUG,err);
	  });

}

function parseJWTLocal(jwtsso){
	log(LogLevels.INFO,"[SSO IFRAME] Local parse of JWT (no signature validation)");
	try{
		var jwt = new JWT(jwtsso);
		var payload = jwt.payload();
		
		if (jwt.isExpired())
			throw ("JWT expired");
		
		//We have not validated. So UNKNOWN
		payload.status = 'UNKNOWN';
		payload.action = "sso.onidentification";
		payload.jwt = jwtsso;
		
		//Identification finished. Fire onIdentification event
		onIdentification(payload);
	
	} catch (err){
		//Bad token. remove it
		localStorage.removeItem(tokenId);
		log(LogLevels.ERROR,"[SSO IFRAME] invalid token: "+err);
	}	
	//Authentication process finish. //fire onload event
	onLoad();
}

function ready(){
	var jwtsso = localStorage.getItem(tokenId);

	log(LogLevels.INFO,"[SSO IFRAME] ready");
	if (jwtsso){
		validateJWT (jwtsso);
	} else {
		//OnLoad must be the last method invocation. Invoked head or from validateJWT after token validation 
		onLoad();
	}	
}	

function init(config){
	//Listener for localStorage changes of ssls.sso.jwt.[accountId] tokens
	if (window.addEventListener) {
		// Normal browsers
		window.addEventListener("storage", localStorageHandler, false);
	} else {
	  	// for IE (why make your life more difficult)
		//Adem�s hay que suscribierse al documento y no al windows
		//Y para acabar de tocar los huevos, localStorage.getItem devuelve el valor viejo y no el nuevo. Por supuesto el evento no lleva la informacion
		//window.attachEvent("onstorage", localStorageHandlerIE8);
		document.attachEvent("onstorage", localStorageHandlerIE8);
		
	};		
	
	//Iframe message listener from SSO clients
	if (window.addEventListener){
		addEventListener("message", listener, false);
	} else {
		attachEvent("onmessage", listener);
	}
	
	//onLoad document listener
	if (window.addEventListener) {
		// W3C standard
	  window.addEventListener('load', ready, false); // NB **not** 'onload'
	} else if (window.attachEvent){
		 // Microsoft
	  window.attachEvent('onload', ready);
	}
	
	validationUrl = config.validationUrl;
	validate = config.validate;
	accountId = config.accountId;
	tokenId = config.tokenId;
	apiKey = config.apiKey;
	log(LogLevels.INFO,"[SSO IFRAME] inited");
}

//init();
		