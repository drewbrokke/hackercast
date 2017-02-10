const chat = new Vue({
	el: '#chat',
	data: {
		currentMessage: '',
		podcastId,
		socket,
		nickname,
		messages: []
	},
	created: function() {
		this.socket.on('message', message => {
			this.messages = this.messages.concat([message]);
		})

		this.socket.on('messages', messages => {
			this.messages = messages.sort((m1, m2) => {
				console.log('m1.date: ', m1.date);
				console.log('m2.date: ', m2.date);
				return Number(m1.date) > Number(m2.date);
			});
		})

		this.socket.emit('chat-connect', this.podcastId);
	},

	updated: function() {
		this.focusLastMessage();
	},

	methods: {
		handleInputKeyup: function() {
			if (this.currentMessage !== '') {
				this.submitMessage();
			}
		},
		submitMessage: function(text) {
			const message = {
				author: this.nickname,
				content: this.currentMessage,
				date: (new Date).getTime(),
				podcastId: this.podcastId
			}

			this.socket.emit('message', message);

			this.currentMessage = '';
		},

		focusLastMessage: function() {
			const messageElements = document.querySelectorAll('.message');

			const lastElement = messageElements[messageElements.length - 1];

			if (lastElement) {
				lastElement.scrollIntoView();
			}

		}
	}
});