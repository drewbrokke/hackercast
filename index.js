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

const Datastore = require('nedb');

// Podcast API
const podcastDB = new Datastore({filename: userhome('.hackercast', 'persistence', 'podcasts')});

podcastDB.loadDatabase();

app.get('/podcasts', (req, res) => {
	podcastDB.find({}, (err, docs) => {
		res.setHeader('Content-Type', 'application/json');
		res.json(docs);
	});
});

app.get('/podcast/find/:id', (req, res) => {
	podcastDB.findOne({ _id: req.params.id }, (err, doc) => {
		res.setHeader('Content-Type', 'application/json');
		res.json(doc);
	});
});

app.post('/podcast/new', (req, res) => {
	const description = req.body.description;
	const url = req.body.url;

	const podcast = {
		currentTime: 0,
		description: description,
		paused: false,
		src: url,
		startTime: (new Date).getTime()
	};

	podcastDB.insert(podcast, (err, newPodcast) => {
		res.redirect(`/listen/${newPodcast._id}`);
	});
});

// Socket Interaction

const messagesDB = new Datastore({filename: userhome('.hackercast', 'persistence', 'messages')});

messagesDB.loadDatabase();

const server = require('http').Server(app);
const io = require('socket.io')(server);

server.listen(3001);

io.on('connection', socket => {
	socket.on('join', ({nickname, podcastId}) => {
		socket.join(podcastId);
	});

	socket.on('chat-connect', () => {
		messagesDB.find({}, (err, docs) => {
			io.to(socket.id).emit('messages', docs);
		});
	})

	socket.on('message', (message) => {
		messagesDB.insert(message, (err, newMessage) => {
			io.to(message.podcastId).emit('message', newMessage);
		});
	});

	socket.on('podcast-play', podcast => {
		console.log('');
		console.log(`Playing podcast ${podcast._id}:`);
		console.log(podcast);

		podcastDB.update({ _id: podcast._id }, podcast);
		io.to(podcast._id).emit('podcast-play');
	});

	socket.on('podcast-pause', podcast => {
		console.log('');
		console.log(`Pausing podcast ${podcast._id}:`);
		console.log(podcast);

		podcastDB.update({ _id: podcast._id }, podcast);
		io.to(podcast._id).emit('podcast-pause');
	});

	socket.on('podcast-remove', podcastId => {
		console.log('');
		console.log(`Removing podcast with ID: ${podcastId}:`);

		podcastDB.remove({ _id: podcastId }, (err, numRemoved) => {
			podcastDB.find({}, (err, docs) => {
				io.emit('podcasts', docs);
			});
		});
	});

	socket.on('disconnect', (data) => {
		console.log('data: ', data);
		// a user has left our page - remove them from the visitorsData object
	});
});

app.listen(3000, () => console.log('Hackercast listening on port 3000!'));