//Import the inference engine from node modules
const InferenceEngine = require("@nicolasvenne/inferenceengine")
//Get the credentials for the database
const creds = require("./inferenceengine-cc273-firebase-adminsdk-2wlqq-270abd13a0.json")

//Import dialogflow client
const dialogflow = require('dialogflow');
//Random string generator
const uuid = require('uuid');

//Create a session id with random string generator
const sessionId = uuid.v4();
//The id of the database used on firebase
const projectId = "inferenceenginetextparser-qryr";

// Create a new session for dialogflow
const sessionClient = new dialogflow.SessionsClient();
const sessionPath = sessionClient.sessionPath(projectId, sessionId);


//Create the Inference Engine
const engine = new InferenceEngine(creds, "https://inferenceengine-cc273.firebaseio.com");
//Tell the engine to listen for updates on the Knowledge Base
engine.subscribeToKnowledge();

//Create the server and the websockets and listen on port 8080
const express = require("express");
const api = express();
api.set('trust proxy', true);
const server = require("http").createServer(api);
const io = require('socket.io')(server);
const port = process.env.PORT || 8080;
server.listen(port);


api.get('/', function(req, res) {
    res.send("hello world");
})

//Listen to the engine for prompts
engine.subscribeToPrompts(async (prompt, client) => {
  //If the prompt returns 0, end the convo on the UI
  if(prompt === 0) {
    client.emit("endConvo");
    return;
  }
  //Otherwise tell the UI that there is a prompt incoming
  return new Promise((resolve, reject) => {
    client.emit("prompt", prompt, (msg) => {
      resolve(msg);
    })
  })
});

//When there is a user that connects to this server.
io.on("connection", (client) => {
  console.log("Client connected");
  //If the client ask's a question on the UI, listen for it and ask the engine.
  client.on("ask", async (message) => {
    console.log(message);
    //Ask dialogflow the parse the natural language
    let symptoms = await parseWithDialogflow(message, client);
    console.log(symptoms)
    //Send the parsed symptoms to the engine.
    try {
      let result = await engine.ask(symptoms.join(", "), client)
      client.emit("reply", result);
    } catch(error) {
      client.emit("error", error);
    }
  })
})

/**
 * Send a message to dialogflow and put the response into an array
 * @param {String} mesg 
 * @param {DialogflowClient} client 
 * @return {Array} The parsed symptoms
 */
async function parseWithDialogflow(mesg, client) {
  const request = {
    session: sessionPath,
    queryInput: {
      text: {
        // The query to send to the dialogflow agent
        text: mesg,
        // The language used by the client (en-US)
        languageCode: 'en-US',
      },
    },
  };
  const responses = await sessionClient.detectIntent(request);
  var result = responses[0].queryResult;
  while(result.action === "input.unknown") {
    result = await new Promise((resolve, reject) => {
      client.emit("prompt", {type: "input", message: result.fulfillmentText}, async (msg) => {
        const request = {
          session: sessionPath,
          queryInput: {
            text: {
              // The query to send to the dialogflow agent
              text: msg,
              // The language used by the client (en-US)
              languageCode: 'en-US',
            },
          },
        };
        const responses = await sessionClient.detectIntent(request);
        const result = responses[0].queryResult;
        resolve(result);
      })
    })
  }
  let output = [];
  for(let symp in result.parameters.fields.symptoms.listValue.values) {
    output.push(result.parameters.fields.symptoms.listValue.values[symp].stringValue)
  }
  return output;
} 


