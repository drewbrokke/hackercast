const path = require('path');
const userhome = require('userhome');

const express = require('express');
const app = express();
const bodyParser = require('body-parser');

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

app.use(express.static('public'));

// View Routes

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'views', 'index.html')));
app.get('/listen/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', 'views', 'listen.html')));

// Set up PERSISTENCE
const Datastore = require('nedb');

const podcastDB = new Datastore({filename: userhome('.hackercast', 'persistence', 'podcasts')});
const messagesDB = new Datastore({filename: userhome('.hackercast', 'persistence', 'messages')});

podcastDB.loadDatabase();
messagesDB.loadDatabase();

// Set up SOCKET server

const server = require('http').Server(app);
const io = require('socket.io')(server);

server.listen(3001);

// Socket Interaction

io.on('connection', socket => {
	socket.on('join', podcastId => socket.join(podcastId));

	/*

	PODCASTS

	{
		currentTime: Number
		description: String
		paused: Boolean
		src: String
		startTime: Number
	}

	MESSAGES

	{
		author: String
		content: String
		date: Date
		podcastId: String
	}

	*/

	// DB: Find all messages with podcastId
	// Socket: Send messages to single client
	socket.on('chat-connect', podcastId => {
		messagesDB.find({ podcastId }, (err, docs) => {
			io.to(socket.id).emit('messages', docs);
		});
	})

	function newMessage(message) {
		messagesDB.insert(message, (err, createdMessage) => {
			io.to(message.podcastId).emit('message', createdMessage);
		});
	};

	function newAdminMessage(content, podcastId) {
		newMessage({
			author: `ROBOT-${podcastId}`,
			content,
			date: new Date(),
			podcastId
		});
	}

	// DB: Create new message
	// Socket: Send new message to all in room
	socket.on('message', message => {
		messagesDB.insert(message, (err, createdMessage) => {
			io.to(message.podcastId).emit('message', createdMessage);
		});
	});

	// DB: Update podcast as playing
	// Socket: Send play event to all in room
	socket.on('podcast-play', ({podcast, nickname}) => {
		const podcastId = podcast._id;

		console.log('');
		console.log(`Playing podcast ${podcastId}:`);
		console.log(podcast);

		podcastDB.update({ _id: podcastId }, podcast);

		io.to(podcastId).emit('podcast-play');

		newAdminMessage(`Resumed by ${nickname}`, podcastId);
	});

	// DB: Update podcast as paused
	// Socket: Send pause event to all in room
	socket.on('podcast-pause', ({podcast, nickname}) => {
		const podcastId = podcast._id;

		console.log('');
		console.log(`Pausing podcast ${podcastId}:`);
		console.log(podcast);

		podcastDB.update({ _id: podcastId }, podcast);

		io.to(podcastId).emit('podcast-pause');

		newAdminMessage(`Paused by ${nickname}`, podcastId);
	});

	socket.on('podcast-request-all', () => {
		podcastDB.find({}, (err, docs) => io.to(socket.id).emit('podcasts-found', docs));
	});

	socket.on('podcast-request-single', podcastId => {
		podcastDB.findOne({ _id: podcastId }, (err, doc) => {
			io.to(socket.id).emit('podcast-found', doc);
		});
	});

	socket.on('podcast-create', ({ description, url }) => {
		const podcast = {
			currentTime: 0,
			description: description,
			paused: false,
			src: url,
			startTime: (new Date).getTime()
		};

		podcastDB.insert(podcast, (err, newPodcast) => {
			podcastDB.find({}, (err, docs) => io.emit('podcasts-found', docs));
		});
	})

	// DB: Remove podcast && Remove all messages related to the podcast
	// Socket: Send all remaining podcast list to all clients
	socket.on('podcast-remove', podcastId => {
		console.log('');
		console.log(`Removing podcast with ID: ${podcastId}:`);

		podcastDB.remove({ _id: podcastId }, (err, numRemoved) => {
			podcastDB.find({}, (err, docs) => {
				io.emit('podcasts-found', docs);
			});
		});

		messagesDB.remove({ podcastId }, { multi: true }, (err, numRemoved) => {
			console.log('err: ', err);
			console.log('numRemoved: ', numRemoved);
		});
	});

	socket.on('disconnect', data => console.log(data));
});

app.listen(3000, () => console.log('Hackercast listening on port 3000!'));