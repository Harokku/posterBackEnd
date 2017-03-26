var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var moment = require('moment');

// mongoose init
var mongoose = require('mongoose');
mongoose.connect('mongodb://rosy:password@ds159507.mlab.com:59507/insubria_aps');
var Shift = require('./models/shift');

var index = require('./routes/index');
var users = require('./routes/users');

// Google sheets api auth process
var fs = require('fs');
var readline = require('readline');
var google = require('googleapis');
var googleAuth = require('google-auth-library');
var dataToPost;

// Sopes definition
var SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE) +  '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'sheets.googleapis.com.crishiftposter.json';

// Load client secret from local file
function postToGoogle(){
    fs.readFile('client-secret.json', function processClientSecrets(err, content) {
        if (err) {
            console.log('Error loading client secret file:' + err);
            return;
        }
        // Authorize a client with the loaded credential than call the google sheet api
        authorize(JSON.parse(content), postStamp);
    });
}
/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
    var clientSecret = credentials.installed.client_secret;
    var clientId = credentials.installed.client_id;
    var redirectUrl = credentials.installed.redirect_uris[0];
    var auth = new googleAuth();
    var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, function (err, token) {
        if (err) {
          getNewToken(oauth2Client, callback);
        } else {
          oauth2Client.credentials = JSON.parse(token);
          callback(oauth2Client);
        }
    });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oauth2Client, callback) {
    var authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES
    });
    console.log('Authorize this app by visiting this url: ', authUrl);
    var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.question('Enter the code from that page here: ', function(code) {
        rl.close();
        oauth2Client.getToken(code, function(err, token) {
            if (err) {
                console.log('Error while trying to retrieve access token', err);
                return;
            }
            oauth2Client.credentials = token;
            storeToken(token);
            callback(oauth2Client);
        });
    });
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
    try {
        fs.mkdirSync(TOKEN_DIR);
    } catch (err) {
        if (err.code != 'EEXIST') {
            throw err;
        }
    }
    fs.writeFile(TOKEN_PATH, JSON.stringify(token));
    console.log('Token stored to ' + TOKEN_PATH);
}

/**
 * Test function to check API functionality
 * @param auth: the auth token
 */
function listStamps(auth) {
    var sheets = google.sheets('v4');
    sheets.spreadsheets.values.get({
        auth: auth,
        spreadsheetId: '1O9qCXZ5KWq2KEPjE-3Tz1SIxy-B8_3iqIgn-udAFMyI',
        range: 'TimbratureScaricate!A1:C'
    }, function (err, response) {
        if (err) {
            console.log('The API returned and error: ' + err);
            return;
        }
        var rows = response.values;
        if (rows.length == 0) {
            console.log('No data found.');
        } else {
            console.log('Numero Badge, Tipo timbratura:');
            for (var i = 0; i < rows.length; i++) {
                var row = rows[i];
                // Print columns B and C, which correspond to indices 1 and 2.
                console.log('%s, %s', row[1], row[2]);
            }
        }
        });
}


function postStamp(authClient) {
    var sheets = google.sheets('v4');
    sheets.spreadsheets.values.append({
        auth: authClient,
        spreadsheetId: '1O9qCXZ5KWq2KEPjE-3Tz1SIxy-B8_3iqIgn-udAFMyI',
        range: 'TimbratureScaricate!A2:E',
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        resource: {
            range: 'TimbratureScaricate!A2:E',
            majorDimension: "ROWS",
            values: [
                [dataToPost._id, dataToPost.badge, '',moment(dataToPost.entertime).format('D/M/YYYY hh.mm.ss'),moment(dataToPost.exittime).format('D/M/YYYY hh.mm.ss')]
            ]
        }
    }, function (err, response) {
        if (err) {
            console.log('The API returned an error' + err);
            return;
        }
        console.log(JSON.stringify(response));
    });
}

// TODO: Compete post code

// Normal express definition
var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

/*app.use('/', index);
app.use('/users', users);*/


// routes definition
var router = express.Router();

router.use(function (req, res, next) {
    // log to console that a client connected
    console.log('Requested a shift route');
    next();
});

router.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin","*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
})

// demo route to check endpoint status
router.get('/', function (req, res) {
    console.log("Responded woth json!")
    res.json({ message: 'All working here!'});
});

// post an enter at /shift/enter
router.route('/enter')
    .post(function(req, res) {
         var shiftenter = new Shift();
         shiftenter.badge = req.body.badge;
         shiftenter.entertime = new Date(Date.now());

        shiftenter.save(function (err) {
            if (err)
                throw err;

            res.json({ message: 'Enter time marked' });
        });
    });

// post an exit at /shift/exit
router.route('/exit')
    .post(function (req, res) {
        // set today and tomorrow date to check for already present stamp
        var yesterday = new Date(Date.now());
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0,0,0,0);
        var today = new Date(Date.now());
        today.setHours(0,0,0,0);
        var tomorrow = new Date(Date.now());
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(23,59,59,59);

        /** check if user have marked the entrance,
         *  if TRUE: mark the exit
         *  if FALSE: drop the request
         */
        // TODO: Implement a filter to check if exittime is empty.
        Shift.find({ badge: req.body.badge, entertime: {"$gte": yesterday, "$lt": tomorrow }, exittime: { $exists: false} }).sort({ 'entertime': -1 }).limit(1).exec(function (err, shiftPost) {
            if (err)
                throw err;

            console.log(shiftPost[0]);
            console.log(typeof shiftPost[0]);
            if (typeof shiftPost[0] === 'undefined') {
                res.json({message: 'No enter mark found, unable to mark the exit!'});
                return;
            }

            shiftPost = shiftPost[0];
            shiftPost.exittime = new Date(Date.now());
            console.log(shiftPost);
            dataToPost = shiftPost;
            console.log(moment(dataToPost.entertime).format('D/M/YYYY hh.mm.ss'));
            shiftPost.save(function (err) {
                if (err)
                    throw err;

                res.json({ message: 'Exit time marked' });
            });
            postToGoogle();
        });
    });

app.use('/shift', router);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
