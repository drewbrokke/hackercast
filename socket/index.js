// Set up PERSISTENCE
const Datastore = require('nedb');

// const podcastDB = new Datastore({filename: userhome('.hackercast', 'persistence', 'podcasts')});
// const messagesDB = new Datastore({filename: userhome('.hackercast', 'persistence', 'messages')});

const podcastDB = new Datastore();
const messagesDB = new Datastore();

// podcastDB.loadDatabase();
// messagesDB.loadDatabase();

// Set up SOCKET server

const server = require('http').createServer();
const io = require('socket.io')(server);

const PORT = 80;

server.listen(PORT);

console.log(`Listening on port ${PORT}!`);

// Socket Interaction

let listeners = [];

io.on('connection', socket => {
	socket.on('join', ({podcastId, nickname}) => {
		socket.join(podcastId);

		let socketId = socket.id;

		listeners = listeners.concat([{podcastId, nickname, socketId}]);

		console.log(`listener "${nickname}" joined room ${podcastId}`);

		io.to(podcastId).emit('listeners-updated', listeners.filter(listener => listener.podcastId === podcastId));
	});

	socket.on('disconnect', () => {
		try {
			const {nickname, podcastId} = listeners.find(listener => listener.socketId === socket.id);

			listeners = listeners.filter(listener => listener.socketId !== socket.id);

			console.log(`listener "${nickname}" left room ${podcastId}`);

			io.to(podcastId).emit('listeners-updated', listeners.filter(listener => listener.podcastId === podcastId));
		}
		catch(err) {

		}
	});

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
			date: (new Date).getTime(),
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

	// DB: Updates podcasts currentTime and startTime
	// Socket: Emit scrub event and send new podcast data to all in room
	socket.on('podcast-scrub', ({podcast, nickname, newTime}) => {
		const podcastId = podcast._id;

		podcast.currentTime = newTime;
		podcast.startTime = Math.floor((new Date).getTime() - (newTime * 1000));

		podcastDB.update({ _id: podcastId }, podcast);

		io.to(podcastId).emit('podcast-scrub', podcast);

		newAdminMessage(`Scrubbed to ${Math.round(newTime)} by ${nickname}`, podcastId);
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
			paused: true,
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
});