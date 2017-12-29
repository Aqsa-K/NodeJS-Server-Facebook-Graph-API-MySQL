//Facebook Graph API + MySQl + NodeJS 
//Works for mulitple pages and displays and updates their likes in the local database

//Require settings
var http                = require("https");         //to generate the http request
var events              = require("events");        //to fire and catch events
var url                 = require("url");           //to get request url
var mysql               = require('mysql');         //to access the local mySQL database

var statusCode;                                     //This is to keep track of status of request - if it has been succesful or not

//Connecting to MySQL database
var connection = mysql.createConnection({
    host: 'localhost',          //because we are running server locally
    user: 'root',               //user name to acces database
    password: 'MySQLLocal',     //password to access database
    database:'FBPageLikesSchema'    //name of your database
});

connection.connect();           //Connect to database


// Input variables
var ping_int            = 2000;                     //seconds
var waitTime            = 1;                        // minutes
var throttle_int        = 1000 * 60 * waitTime;     // for readability - with the current setting, if a request fails then the program will wait for 60 seconds before retrying
var r                   = {};

// Facebook
var data_host           = 'graph.facebook.com';     //because we will use graph API to get data from our facebook pages

// Build variables
var result_emitter      = new events.EventEmitter();        //to fire and catch certain events

// Listen for updates
var Event_Handler_data = function(outcome) {
    if (outcome === 200) { //if statusCode is 200 then means all is okay
        setTimeout( main, ping_int ); // call the main function again after 2 seconds - This will carry out the whole process of requesting and updating again
    }
    // The response failed, throttle requests
    else {
        var reqDate = new Date();
        console.log("Throttle connection for " + throttle_int + "ms (" + waitTime + "mins). " + reqDate);
        setTimeout( main, throttle_int ); // if response failed, then call the main event after 1 min instead of 2 seconds - to be sure the issue/connection is restored
    }
}

//if error occurs, log it
var Event_Handler_error = function(error) {
    console.log("A result_emitter error has been caught");
    console.log("Carry on...");
    }


result_emitter.on("data", Event_Handler_data) //attach the event "data" to Event_Handler_data - when "data" is emitted it will be handled by 'Event_Handler_data'
result_emitter.on("error", Event_Handler_error) //attach the event "error" to Event_Handler_error - when "error" is emitted it will be handled by 'Event_Handler_error'


// The major chunk of the server:
function get_data(httpOptions, Page_ID) {

    var reqDate = new Date();                   //to keep track of 'date' of request
    var request = http.request( httpOptions );

    request.addListener("response", function(response) { //add listener to request to listen for any response to the request


        response.setEncoding('utf8');
        var body = ""; //initialize body

        response.addListener("data", function(data) {   // add listener to catch the data in response - once the data is received , the response.end() will automatically be called
            body += data;                               //add data received in response to body
            console.log("body.....: " + body)           // log the data received
        });

        response.addListener("end", function() { // listen for the response.end() function, when response ends, this function will execute

            var obj        = JSON.parse(body);         //parse the JSON string to create a JavaScript object described by the string - now the individual content can be accessed
            var result      = obj.fan_count;           //get the fan_count

                // Define variable for old value stored in database
                 var old_value           = 0;

                //getting old fan_count value from the database
                var query = connection.query('select Counter_Likes from counter_states where (Page_ID=? and Platform_ID=?) ',[Page_ID,1], function(err, result){
                        if(err){
                            console.error(err);
                            return;
                        }
                        //You can think of the query returning results in rows and each row data will be a json object.Hence, We will pick the 0th row (result[0]) and then access Counter_Likes in that row
                        old_value       = result[0].Counter_Likes;
                        console.log("old_value: " + old_value);         //print the old value on console
                });


                // If the new value is different than the last time we checked, update the fan_count value in the database
                if (result !== old_value) {
                    console.log("new_value: " + result);                //print the new value on the console

                    //update value in the database
                    var query = connection.query('update counter_states set Counter_Likes = ? where (Page_ID = ? and Platform_ID = ?)', [result , Page_ID, '1'], function(err, result){
                        if(err){
                            console.error(err);
                            return;
                        }
                        console.log('Value Updated in Database')
                    });

                }
            statusCode = response.statusCode;
            console.log("statusCode: " + statusCode);                   // print statusCode on console

            if(statusCode!== 200){                                      //if statusCode is not equal to 200, means everything is not okay, then fire the event 'error' which will be caught by Event_Handler_error
                result_emitter.emit("error", statusCode)                //emit/fire "error" along with the statusCode
            }
        });
        
    });
    request.end();
}


//Traversing the database and for each Page, get the parameters and assign to variables, request new value for fan_count and update in database
function main(){
    console.log("inside main");
    var query = connection.query('select Page_ID, Profile_ID, App_ID, App_Secret from pages_platforms', function(err, result){
        if(err){
            console.error(err);
            return;
        }

        var i  = result.length; // This will be equal to the number of json objects returned (also equal to the no of rows of database returned)

        for(var x=0; x<i; x++){
            assign_variables(result, x);
        }
        result_emitter.emit("data", statusCode); //Firing the event "data", and passing the statusCode as argument. This event fired will be caught by the Event_Handler_data and statusCode will be passed to the event handler function 
    });
    
}

function assign_variables(r,x){
console.log("Page_ID is " + r[x].Page_ID); // This will print the Page_ID in console

//assigning page specific variables which are stored in our local database
app_id          = r[x].App_ID;                                  //You will get App_ID using Graph API, you can then store it in the database
secret_key      = r[x].App_Secret;                              //You will get App_Secret using Graph API, you can then store it in the databas
page_id         = r[x].Profile_ID;                              //You will get Profile_ID from facebook - you must have access to the page to get the page_id/Profile_ID, you can then store it in the database
data_path       = '/' + 'v2.8' + '/' + page_id +'?access_token=' + app_id + '|' + secret_key + '&fields=' + 'fan_count';        //This is the format of path for the request. Here we are just getting data for a single field 'fan_count' but You can also get multiple fields 
httpOptions     = { host: data_host, port: 443, path: data_path, method: 'GET' };       
//host is Facebook (Graph API)
//port to hit is 443(being used by remote Facebook Graph server), that's where facebook Graph is listening for requests.
//data_path is the url
//method is GET because we want to 'get' some information 

console.log("httpoptions "+ httpOptions.host);
console.log(data_path);

get_data(httpOptions, r[x].Page_ID);

}

//Call the main() Function - since we are running this on as server, this function will be called again and again and that's how the server will continue to request and update values
main();


//Graph API: 
//The primary way to read and write to the Facebook social graph. 
//Make an account - https://developers.facebook.com/docs/graph-api/
//Add new App, get App_ID and App_Secret
//Get Page_ID from Facebook page

