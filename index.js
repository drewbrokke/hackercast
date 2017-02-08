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

// Podcast API

const Datastore = require('nedb');
const podcastDB = new Datastore({filename: userhome('.hackercast', 'persistence', 'podcasts')});
const chatMessages = new Datastore({filename: userhome('.hackercast', 'persistence', 'messages')});

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

const server = require('http').Server(app);
const io = require('socket.io')(server);

server.listen(3001);

io.on('connection', socket => {
	socket.on('play', podcast => {
		podcastDB.update({ _id: podcast._id }, podcast);
		io.emit('play');
	});

	socket.on('pause', podcast => {
		podcastDB.update({ _id: podcast._id }, podcast);
		io.emit('pause');
	});

	socket.on('disconnect', () => {
		// a user has left our page - remove them from the visitorsData object
	});
});

app.listen(3000, () => console.log('Example app listening on port 3000!'));