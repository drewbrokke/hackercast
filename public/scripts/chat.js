function Message(author, content, date, podcastId) {
	this.author = author;
	this.content = content;
	this.date = new Date(date);
}

const chat = new Vue({
	el: '#chat',
	data: {
		currentMessage: '',
		podcastId: podcastId,
		socket: socket,
		user: nickname,
		messages: []
	},
	created: function() {
		this.socket.on('message', ({author, content, date}) => {
			this.messages.push(new Message(author, content, date));
		})

		this.socket.on('messages', messages => {
			this.messages = messages
				.map(({author, content, date}) => new Message(author, content, date))
				.sort((m1, m2) => m1.date > m2.date);
		})

		this.socket.emit('chat-connect', this.podcastId);
	},
	methods: {
		handleInputKeyup: function() {
			if (this.currentMessage !== '') {
				this.submitMessage();
			}
		},
		submitMessage: function(text) {
			const message = {
				author: this.user,
				content: this.currentMessage,
				date: new Date(),
				podcastId: this.podcastId
			}

			this.socket.emit('message', message);

			this.currentMessage = '';
		}
	}
});