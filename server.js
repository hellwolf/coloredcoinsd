if(process.env.NODE_ENV && process.env.NODE_ENV == 'QA')
  console.log=function() {}

var express = require('express');
var config = require("./config");
var bodyParser = require('body-parser');
var cors = require('cors')
var ua = require('universal-analytics'); 


var fs = require('fs');
var log4js = require('log4js');

var consoleLogger = log4js.getLogger('console');
var logentries = require('le_node');
var controllers = require('./controllers');
var _ = require('lodash')

var log = logentries.logger({
  token: process.env.LETOKEN
})


// stup file logger if on elastic
if(fs.existsSync('/var/log/nodejs.log')) {
  log4js.loadAppender('file');
  log4js.addAppender(log4js.appenders.file('/var/log/nodejs.log'), 'eblog');
  consoleLogger = log4js.getLogger('eblog');
}


if(!process.env.NODE_ENV || process.env.NODE_ENV != 'QA') {
  console.log=(function() {
    var orig=console.log;
    return function() {
        consoleLogger.debug.apply(consoleLogger, Array.prototype.slice.call(arguments));
        if(process.env.LETOKEN)
        {
          var args =  Array.prototype.slice.call(arguments);
          args.unshift('info');
          log.log.apply(log, (args.length==2 && typeof(args[1])=='object') ? _.clone(args, true) : args);
        }
    };
  })();  
}

if(!process.env.NODE_ENV || process.env.NODE_ENV != 'QA') {
  console.error=(function() {
  var orig=console.error;
  return function() {
      consoleLogger.error.apply(consoleLogger, Array.prototype.slice.call(arguments));
       if(process.env.LETOKEN)
      {
        var args =  Array.prototype.slice.call(arguments);
        args.unshift('err');
        orig(args);
        log.log.apply(log, (args.length==2 && typeof(args[1])=='object') ? _.clone(args, true) : args);
      }
    };
  })();
}

String.prototype.endsWith = function(suffix) {
    return this.indexOf(suffix, this.length - suffix.length) !== -1;
};
  

if(!process.env.LETOKEN) {
  console.error("No Logentries token found in enviorment");
}
else{
   console.log("Logentries logging active");
}

var app = express();

var whitelist = ['coloredcoins.org', 'colu.co'];
var corsOptions = {
  origin: function(origin, callback){
    var originIsWhitelisted = whitelist.some(function (neddle) {
      return origin && origin.endsWith(neddle)
    })
    console.log('checking whitelist: ' + originIsWhitelisted + ' for: ' + origin)
    callback(null, originIsWhitelisted);
  }
};

app.use(cors(corsOptions));    

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

var accountId = config.analytics.accountId;
if (accountId){
  app.use(ua.middleware(config.analytics.accountId, {cookieName: '_ga'}));  
}




  
controllers.register(app);

var docs_handler = express.static(__dirname + '/node_modules/swagger-node-express/swagger-ui');
app.get(/^\/docs(\/.*)?$/, function (req, res, next) {
    if (req.url === '/docs') { // express static barfs on root url w/o trailing slash
        req.url = "/" + req.url.substr('/docs'.length);
    }
    else {
      req.url = req.url.substr('/docs'.length);
    }
    
    return docs_handler(req, res, next);
});


var options = {
    setHeaders: function (res, path, stat) {
        res.set('Content-Type', 'application/json; charset=utf-8');
    }
};


app.get('/headers', function (req,res,next) {
 console.log(req.headers)
 res.status(200).send({done: true})
})

app.use('/metadata', express.static(__dirname + '/static/metadata', options));
app.use('/doc',express.static(__dirname + '/doc'))
app.use('/',express.static(__dirname + '/doc'))

app.use(function (err, req, res, next) {
    if (err) {
        console.log('Global Error', err);
        res.send(400,"not valid json");
    }
});

app.listen(process.env.PORT || 8080);