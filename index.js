const InferenceEngine = require("@nicolasvenne/inferenceengine")
const creds = require("./inferenceengine-cc273-firebase-adminsdk-2wlqq-270abd13a0.json")

const dialogflow = require('dialogflow');
const uuid = require('uuid');

const sessionId = uuid.v4();
const projectId = "inferenceenginetextparser-qryr";

// Create a new session
const sessionClient = new dialogflow.SessionsClient();
const sessionPath = sessionClient.sessionPath(projectId, sessionId);



const engine = new InferenceEngine(creds, "https://inferenceengine-cc273.firebaseio.com");
engine.subscribeToKnowledge();



const express = require("express");
const api = express();
api.set('trust proxy', true);
const server = require("http").createServer(api);
const io = require('socket.io')(server);
server.listen(8080);

const jwt = require('express-jwt');
const jwtAuthz = require('express-jwt-authz');
const jwksRsa = require('jwks-rsa');

// io.use(checkJwt);

const checkJwt = jwt({
    // Dynamically provide a signing key
    // based on the kid in the header and 
    // the signing keys provided by the JWKS endpoint.
    secret: jwksRsa.expressJwtSecret({
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 5,
      jwksUri: `https://nicolasvenne.auth0.com/.well-known/jwks.json`
    }),
  
    // Validate the audience and the issuer.
    audience: 'https://inferenceapi.nicolasvenne.ca/',
    issuer: `https://nicolasvenne.auth0.com/`,
    algorithms: ['RS256']
  });

const checkScopes = jwtAuthz([ 'engine:tell' ]);

let clients = {}

api.get('/', function(req, res) {
    res.send("hello world");
})

engine.subscribeToPrompts(async (prompt, client) => {
  if(prompt === 0) {
    client.emit("endConvo");
    return;
  }
  return new Promise((resolve, reject) => {
    client.emit("prompt", prompt, (msg) => {
      resolve(msg);
    })
  })
});
io.on("connection", (client) => {
  console.log("Client connected");
  client.on("ask", async (message) => {
    console.log(message);
    let symptoms = await parseWithDialogflow(message, client);
    console.log(symptoms)
    let result = await engine.ask(symptoms.join(", "), client)
    client.emit("reply", result);
  })
})

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


