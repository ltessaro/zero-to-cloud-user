var express = require('express');
var app = express();
var fs = require("fs");
var AWS = require('aws-sdk');
AWS.config.update({region: 'us-east-1', credentials: {accessKeyId: 'AKIAJLDFP5D2QDSIX4VQ', secretAccessKey: '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'}});
var dynamodb = new AWS.DynamoDB();
var sha1 = require('sha1');
var sha256 = require('sha256');
var sns = new AWS.SNS();

//user: user-dynamodb-local
//access key: AKIAJLDFP5D2QDSIX4VQ
//secret: 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

app.get('/users', function (req, res) {
	console.log("`users` API has been called");

	var params = {
		TableName: "Person"
	};
	dynamodb.scan(params, function(err, data) {
   		if (err) {
   			console.log(err, err.stack); // an error occurred
   			if (err.code == 'ResourceNotFoundException') res.status(404).send('Not found');
   			else res.status(500).send('Problems!');
		} else {
			var response = []
   			console.log(data.Items);           // successful response
   			for (var idx in data.Items) {
   				map = {}
   				map['id'] = data.Items[idx].id.S
				map['email'] = data.Items[idx].email.S
   				map['first_name'] = data.Items[idx].first_name.S
   				response.push(map)
   			}
   			res.json( { 'users': response } );
   		}
	});
})

app.get('/user', function (req, res) {
	//validate_input(req)
	var salt = parseInt(Math.random() * (10000 - 1000) + 10000);
	
	var _id_user = sha1(req.query.first_name + req.query.email + req.query.password);
	var _salary = req.query.salary;
	
	var new_user = {
			"id": { S: _id_user },
			"first_name": { S: req.query.first_name }, 
			"email": { S: req.query.email },
			"password": { S: sha1(req.query.password + salt) },
			"salt": { N: ''+salt }
  		};
  	console.log(new_user);

	var params = {
		Item: new_user,
	  	TableName: "Person"
	};

	dynamodb.putItem(params, function(err, data) {
		if (err) {
			console.log(err, err.stack); // an error occurred
		} else {
			var sns_params = {
				Message: '{ "default": "user: y, salary: x", "account": { "user": "_id_user", "salary": "_salary" } }',
				MessageStructure: 'json',
				TopicArn: 'arn:aws:sns:us-east-1:672553294363:Z2C-AccountRegistration'
			};
			sns.publish(sns_params, function(err, sns_data) {
				if (err) {
  					console.log(err, err.stack);           // successful response
				} else {
			  		console.log(sns_data);           // successful response
			  	}
			});
			res.json( data );
		}
	 });
})

app.get('/login', function (req, res) {
	var email = req.query.email
	var password = req.query.password

  	var params = {
		ExpressionAttributeValues: { ":email": { S: email } }, 
		FilterExpression: "email = :email", 
		TableName: "Person"
	};

	dynamodb.scan(params, function(err, data) {
   		if (err) {
   			res.status(401).send('Ops! Not here my friend!');
		} else {
			if (data.Items.length == 0) {
				res.status(401).send('Ops! Not here my friend!');
			} else {
				var _id_user = null;
   				for (var idx in data.Items) {
   					var tmp = data.Items[idx];
   					//Compare login
   					if (sha1(password + tmp.salt.N) == tmp.password.S) {
   						_id_user = tmp.id.S;
   						break;
   					}
   				}
   				if (_id_user == null) {
					res.status(401).send('Ops! Not here my friend!');
   				} else {
   					_id_user
   					var milliseconds = (new Date).getTime();
   					var session_token = sha256(milliseconds + _id_user);
   					
   					var session_params = {
						Item: { 'token': { S: session_token }, 'milliseconds': { N: ''+milliseconds }, 'user': { S: _id_user } },
					  	TableName: "SessionLogin"
					};

					dynamodb.putItem(session_params, function(err, data) {
						if (err) {
							console.log(err, err.stack); // an error occurred
							res.status(500).send('Ops! Something didn\'t work!');
						} else {
		   					res.setHeader('X-Z2c-Token', session_token);
							res.status(200).send('Hey buddy, Here we go!');
						}
					 });
   				}
			}
   		}
	});

})



var server = app.listen(3000, function () {

  var host = server.address().address
  var port = server.address().port

  console.log("User listening at http://%s:%s", host, port)

})
