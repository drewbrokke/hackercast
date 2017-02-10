const app = new Vue({
	data: {
		audio: null,
		currentTime: null,
		duration: null,
		listeners: null,
		nickname: nickname,
		paused: null,
		podcast: null,
		progress: 0,
		socket: socket,
		volume: 1
	},

	computed: {
		progress: function() {
			return Math.floor((this.currentTime / this.duration) * 100);
		}
	},

	el: '#podcast',

	beforeDestroy: function() {
		alert('Destroy!');
	},

	created: function() {
		this._fetchPodcast(podcastId);
	},

	watch: {
		volume: function() {
			this.audio.volume = this.volume;
		}
	},

	methods: {
		emitPause: function() {
			this.podcast.currentTime = this.audio.currentTime;
			this.podcast.paused = true;

			this.socket.emit('podcast-pause', this.podcast);
		},
		emitPlay: function() {
			this.podcast.startTime = Math.floor((new Date).getTime() - (this.currentTime * 1000));
			this.podcast.paused = false;

			this.socket.emit('podcast-play', this.podcast);
		},
		toggle: function() {
			this.paused ? this.emitPlay() : this.emitPause();
		},
		_bindAudioEvents: function() {
			this.audio = new Audio(`${this.podcast.src}`);

			let syncViewToAudio = (property) => this[property] = this.audio[property];

			this.audio.oncanplaythrough = () => this.paused ? "" : this.audio.play();
			this.audio.onloadeddata = () => this.audio.currentTime = this.currentTime;

			this.audio.ondurationchange = () => syncViewToAudio('duration');
			this.audio.ontimeupdate = () => syncViewToAudio('currentTime');

			this.audio.onpause = () => syncViewToAudio('paused');
			this.audio.onplay = () => syncViewToAudio('paused');
		},
		_bindSocketEvents: function() {
			this.socket.on('podcast-play', () => this.audio.play());
			this.socket.on('podcast-pause', () => this.audio.pause());
		},
		_fetchPodcast: function(podcastId) {
			fetch(`/podcast/find/${podcastId}`)
				.then(response => response.json())
				.then(podcast => {
					this.podcast = podcast;

					this._initData();
					this._bindAudioEvents();
					this._bindSocketEvents();
				});
		},
		_initData: function() {
			this.currentTime = this.podcast.paused
				? this.podcast.currentTime
				: ((new Date).getTime() - this.podcast.startTime) / 1000;

			this.paused = this.podcast.paused;
		}
	}
});