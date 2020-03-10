var request = require("request");

var options = { method: 'POST',
  url: 'https://nicolasvenne.auth0.com/oauth/token',
  headers: { 'content-type': 'application/json' },
  body: '{"client_id":"V4ELw22zfVXHDiQF163Kv9ozcYdXCIkc","client_secret":"s9q6OC2B4YDTv0cp90wmrmiB8I9XJsKZsHhw-8REr8IGz3kKCAzqdYwH01sCOyqA","audience":"https://inferenceapi.nicolasvenne.ca/","grant_type":"client_credentials"}' };
var token;
request(options, function (error, response, body) {
  if (error) throw new Error(error);

  token = JSON.parse(body);

    var options = { method: 'GET',
    url: 'http://localhost:3001',
    headers: { authorization: `${token.token_type} ${token.access_token}` } };

    request(options, function (error, response, body) {
        if (error) throw new Error(error);

        console.log(body);
    });
});

